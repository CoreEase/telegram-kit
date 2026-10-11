import {
  Appearance,
  DiamondEntrance,
  DiamondMotion,
  DiamondReferenceHighlights,
  DiamondStarBurst,
  DiamondTransferAnimation,
} from "./animation";
import { DiamondStyle, defaultDiamondStyle, styleEquals } from "./style";
import {
  DiamondRenderer,
  RefractionGeometry,
  RefractionSource,
} from "./renderer";

export interface DiamondPose {
  yaw: number;
  pitch: number;
  grow: number;
  shift: number;
}

export type DragState = "began" | "changed" | "ended" | "cancelled" | "failed";
export type HapticKind = "tap" | "impact";

export interface DragOptions {
  translation?: { x: number; y: number };
  velocity?: { x: number; y: number };
  scale?: number;
  releaseImpulse?: number | null;
  playFlingHaptic?: boolean;
  allowsFlingBurst?: boolean;
  tapSpinDirection?: number | null;
}

const now = () => performance.now() / 1000;

export class InteractiveDiamondLayer {
  readonly canvas: HTMLCanvasElement;
  private gl!: WebGL2RenderingContext;
  private renderer!: DiamondRenderer;

  onReady: (() => void) | null = null;
  onHold: ((holding: boolean) => void) | null = null;
  onPoseUpdated: ((pose: DiamondPose) => void) | null = null;
  onHaptic: ((kind: HapticKind) => void) | null = null;
  scrollTiltProvider: ((time: number) => number) | null = null;
  onRefractionUpdated: ((g: RefractionGeometry | null) => void) | null = null;
  onError: ((e: unknown) => void) | null = null;

  private _externalMotion:
    | ((time: number | null) => { rotation: number; isAnimating: boolean })
    | null = null;

  get externalMotion() {
    return this._externalMotion;
  }

  set externalMotion(v) {
    const old = this._externalMotion;
    this._externalMotion = v;
    if (v === null && old === null) return;
    old?.(null);
    this.stopLink();
    this.requestExternalMotionUpdate();
  }

  private externalMotionIsAnimating = false;

  lightBackground = false;
  interactionScale = 1;
  starOffset = { x: 0, y: 0 };
  refractionSource: RefractionSource | null = null;
  refractionStrength = 0;
  highlightBoost = 0;
  private appliedHighlightBoost = 0;
  usesHighFrameRate = false;
  bounds = { width: 0, height: 0 };

  private _renderSize: { width: number; height: number } | null = null;

  get renderSize() {
    return this._renderSize;
  }

  set renderSize(v) {
    const o = this._renderSize;
    this._renderSize = v;
    if (
      !o !== !v ||
      (o && v && (o.width !== v.width || o.height !== v.height))
    ) {
      this.setNeedsUpdate();
    }
  }

  private _isRenderingEnabled = true;

  get isRenderingEnabled() {
    return this._isRenderingEnabled;
  }

  set isRenderingEnabled(v: boolean) {
    if (v !== this._isRenderingEnabled) {
      this._isRenderingEnabled = v;
      this.updateAnimationState();
    }
  }

  private _inHierarchy = false;

  get isInHierarchy() {
    return this._inHierarchy;
  }

  set isInHierarchy(v: boolean) {
    if (v !== this._inHierarchy) {
      this._inHierarchy = v;
      this.updateAnimationState();
    }
  }

  private foreground =
    typeof document === "undefined"
      ? true
      : document.visibilityState !== "hidden";

  diamondStyle: DiamondStyle;

  private get hasCompletedReferenceAnimation() {
    return (
      this.diamondStyle.animationMode === "reference" &&
      !this.diamondStyle.referenceAnimationLoops &&
      this.elapsed >= DiamondReferenceHighlights.lastFrameTime
    );
  }

  get isPlaying() {
    return this.linkId !== null && !this.hasCompletedReferenceAnimation;
  }

  private isSendingTransfer = false;
  private transferAnimation: DiamondTransferAnimation | null = null;
  private receivingTransfer: {
    startTime: number;
    completionDelay: number;
  } | null = null;

  get hasTransferAnimation() {
    return !this.reduceMotion && this.transferAnimation !== null;
  }

  get isCompletingTransfer() {
    return (
      !this.reduceMotion && this.transferAnimation?.phase === "completion"
    );
  }

  get hasStarBursts() {
    return !this.reduceMotion && this.starBursts.length > 0;
  }

  get animationState(): {
    time: number;
    transferEnergy: number | null;
  } | null {
    if (
      !this.isInHierarchy ||
      !this.foreground ||
      !this.isRenderingEnabled ||
      this.reduceMotion
    ) {
      return null;
    }
    return {
      time: this.elapsed,
      transferEnergy: this.transferAnimation
        ? this.transferAnimation.presentation(this.elapsed).energy
        : null,
    };
  }

  private get effectiveStyle(): DiamondStyle {
    const style = { ...this.diamondStyle };

    if (!this.reduceMotion && this.starBursts.some((b) => b.isFromTap)) {
      style.backgroundStars = true;
      style.steadyStars = false;
    }

    if (!this.reduceMotion && this.transferAnimation) {
      const animation = this.transferAnimation;
      const presentation = animation.presentation(this.elapsed);
      style.rotationSpeed *= 1 + 5 * presentation.energy;
      style.swayScale *= 1 + 1.4 * presentation.energy;
      style.widthPoints *= presentation.scale;
      style.growShift *= presentation.scale;
      style.verticalOffset += presentation.offset;
      if (animation.phase === "completion") {
        style.backgroundStars = true;
        style.steadyStars = false;
        style.starZoom = 0.62;
        style.starEmission = 0.3;
        style.burstSize = 0.8;
        style.burstFadeInDuration = 0.03;
      }
    }

    return style;
  }

  get zoom() {
    return this.motion.zoom;
  }

  set zoom(v: number) {
    this.motion.zoom = Math.min(1.6, Math.max(0.6, v));
    this.onPoseUpdated?.(this.pose);
    this.setNeedsUpdate();
  }

  get pose(): DiamondPose {
    return {
      yaw: this.motion.renderedYaw,
      pitch: this.motion.pitch,
      grow: this.grow * this.interactionScale,
      shift:
        this.diamondStyle.growShift * (this.grow * this.interactionScale - 1),
    };
  }

  private motion = new DiamondMotion();
  private grow = 1;
  private growVelocity = 0;

  get isGrowthAnimating() {
    return this.grow !== 1 || this.growVelocity !== 0;
  }

  resetGrowth() {
    this.grow = this.motion.isDragging ? this.diamondStyle.dragGrow : 1;
    this.growVelocity = 0;
    this.setNeedsUpdate();
  }

  private starBursts: DiamondStarBurst[] = [];
  private nextBurstSeed = 1;
  private tapStreak = 0;
  private lastTapTime: number | null = null;
  private elapsed = 0;
  private lastTime: number | null = null;
  private linkId: number | null = null;
  private pendingRender: number | null = null;
  reduceMotion = false;
  private didAnimateAppearance = false;
  private didSetReady = false;
  private disposed = false;

  constructor(backgroundStars = true, private pixelRatioCap = 3) {
    const style = defaultDiamondStyle();
    style.backgroundStars = backgroundStars;
    this.diamondStyle = style;
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.pointerEvents = "none";
    this.initGL();
    if (style.backgroundStars && style.animationMode === "entrance") {
      this.starBursts.push(new DiamondStarBurst(0, 0));
    }
    this.canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.canvas.addEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private initGL() {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    this.renderer = new DiamondRenderer(gl);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.stopLink();
  };

  private onContextRestored = () => {
    try {
      this.initGL();
      this.updateAnimationState();
      this.setNeedsUpdate();
    } catch (e) {
      this.onError?.(e);
    }
  };

  private onVisibility = () => {
    this.foreground = document.visibilityState !== "hidden";
    this.updateAnimationState();
  };

  dispose() {
    this.disposed = true;
    this.stopLink();
    if (this.pendingRender !== null) cancelAnimationFrame(this.pendingRender);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored,
    );
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.externalMotion?.(null);
    try {
      this.renderer.dispose();
    } catch {
      /* ignore */
    }
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  update(style: DiamondStyle, preservingMotion = false) {
    if (styleEquals(this.diamondStyle, style)) return;
    if (this.lastTime !== null) this.updateMotion(now());
    const previous = this.diamondStyle;
    this.diamondStyle = { ...style };
    if (!style.tapToSpin) this.cancelTapSpin();
    if (style.starOpacity <= 0.001) this.starBursts = [];
    else if (!style.backgroundStars && !this.isCompletingTransfer) {
      this.starBursts = this.starBursts.filter((b) => b.isFromTap);
    }
    const modeChanged =
      previous.animationMode !== style.animationMode ||
      previous.referenceAnimationLoops !== style.referenceAnimationLoops;
    if (modeChanged && !preservingMotion) {
      this.resetAnimation();
    } else {
      this.updateMotionStyle();
      if (
        style.animationMode === "reference" &&
        previous.appearance !== style.appearance
      ) {
        this.motion.changeReferenceAppearance(
          previous.appearance,
          style.appearance,
          this.elapsed,
        );
      }
      this.onPoseUpdated?.(this.pose);
      if (modeChanged) this.updateAnimationState();
      this.setNeedsUpdate();
    }
  }

  private updateMotionStyle() {
    this.motion.mainSparkleOnRotation = this.diamondStyle.mainSparkleOnRotation;
    this.motion.swayScale = this.diamondStyle.swayScale;
    this.motion.tilt = this.diamondStyle.tilt;
    this.motion.targetLean = this.diamondStyle.lean;
    this.motion.releaseDecay = this.diamondStyle.releaseDecay;
    this.motion.releaseTilt = this.diamondStyle.releaseTilt;
  }

  resetAnimation() {
    const wasDragging = this.motion.isDragging;
    const externalYaw = this.motion.externalYaw;
    this.cancelTapSpin();
    this.motion = new DiamondMotion();
    this.motion.externalYaw = externalYaw;
    this.updateMotionStyle();
    this.grow = 1;
    this.growVelocity = 0;
    this.elapsed = 0;
    this.lastTime = null;
    this.starBursts =
      this.diamondStyle.backgroundStars &&
      this.diamondStyle.animationMode === "entrance"
        ? [new DiamondStarBurst(0, 0)]
        : [];
    this.nextBurstSeed = 1;
    if (wasDragging) this.onHold?.(false);
    this.onPoseUpdated?.(this.pose);
    this.updateAnimationState();
  }

  private get canAnimate() {
    return (
      this.isInHierarchy &&
      this.foreground &&
      this.isRenderingEnabled &&
      !this.reduceMotion
    );
  }

  spin(velocity: number, decay = 0.7) {
    if (!this.canAnimate) return;
    this.updateMotion(now());
    this.motion.spin(velocity, decay);
    this.setNeedsUpdate();
  }

  pushFromBelow(strength: number) {
    if (!this.canAnimate) return;
    this.updateMotion(now());
    this.motion.pushFromBelow(strength);
    this.updateAnimationState();
  }

  emitStarBurst() {
    if (!this.diamondStyle.backgroundStars || !this.canAnimate) return;
    this.updateMotion(now());
    this.addStarBurst();
    this.setNeedsUpdate();
  }

  updateTransferState(isSending: boolean, animateCompletion: boolean) {
    if (this.isSendingTransfer === isSending) return;
    if (this.lastTime !== null) this.updateMotion(now());
    this.cancelTapSpin();
    this.isSendingTransfer = isSending;
    this.cancelTransferCompletion();
    if (isSending) {
      this.transferAnimation = new DiamondTransferAnimation(
        "sending",
        this.elapsed,
      );
    } else if (animateCompletion && this.canAnimate) {
      this.transferAnimation = new DiamondTransferAnimation(
        "completion",
        this.elapsed,
      );
      this.motion.spin(
        this.diamondStyle.rotationSpeed < 0 ? -11 : 11,
        0.7,
      );
      this.addStarBurst(this.elapsed);
      this.addStarBurst(this.elapsed + 0.2);
    } else {
      this.transferAnimation = null;
    }
    this.onPoseUpdated?.(this.pose);
    this.setNeedsUpdate();
  }

  beginReceivingTransfer(startTime: number, completionDelay: number) {
    this.cancelTapSpin();
    this.cancelTransferCompletion();
    this.receivingTransfer = { startTime, completionDelay };
    this.updateMotion(now());
    this.setNeedsUpdate();
  }

  endReceivingTransfer() {
    const receiving = this.receivingTransfer;
    if (!receiving) return;
    if (
      now() - receiving.startTime >=
      receiving.completionDelay + DiamondTransferAnimation.completionDuration
    ) {
      this.receivingTransfer = null;
      this.transferAnimation = null;
      this.starBursts = this.starBursts.filter((b) => b.isFromTap);
    } else {
      this.cancelTransferCompletion();
    }
    this.onPoseUpdated?.(this.pose);
    this.setNeedsUpdate();
  }

  private cancelTransferCompletion() {
    if (
      !(
        this.transferAnimation?.phase === "completion" ||
        this.receivingTransfer
      )
    ) {
      return;
    }
    this.receivingTransfer = null;
    this.transferAnimation = null;
    this.starBursts = [];
    this.motion.stopSpin();
  }

  setReduceMotion(enabled: boolean) {
    if (this.reduceMotion === enabled) return;
    this.reduceMotion = enabled;
    this.motion.step(
      0,
      this.diamondStyle.rotationSpeed,
      this.reduceMotion,
      this.diamondStyle.animationMode,
      this.elapsed,
      this.diamondStyle.appearance,
    );
    this.updateAnimationState();
  }

  private updateExternalMotion(time: number | null) {
    const result = this._externalMotion?.(time);
    this.motion.externalYaw = time === null ? 0 : result?.rotation ?? 0;
    this.externalMotionIsAnimating =
      time !== null && result?.isAnimating === true;
  }

  requestExternalMotionUpdate() {
    if (this.linkId !== null) return;
    this.updateAnimationState();
    this.onPoseUpdated?.(this.pose);
  }

  private stopLink() {
    if (this.linkId !== null) {
      cancelAnimationFrame(this.linkId);
      this.linkId = null;
    }
  }

  private startLink() {
    if (this.linkId !== null || this.disposed) return;
    const tick = () => {
      this.linkId = null;
      if (this.disposed) return;
      this.linkId = requestAnimationFrame(tick);
      this.updateMotion(now());
      if (
        this.hasCompletedReferenceAnimation &&
        !this.motion.isAppearanceImpulseActive &&
        !this.externalMotionIsAnimating
      ) {
        this.updateAnimationState();
      }
      this.draw();
    };
    this.linkId = requestAnimationFrame(tick);
  }

  private updateAnimationState() {
    const isVisible =
      this.isInHierarchy && this.foreground && this.isRenderingEnabled;
    if (!isVisible || this.reduceMotion) this.updateExternalMotion(null);
    else if (this.linkId === null) this.updateExternalMotion(now());
    if (
      isVisible &&
      this.diamondStyle.animateOnAppear &&
      !this.didAnimateAppearance
    ) {
      this.didAnimateAppearance = true;
      if (!this.reduceMotion) this.motion.pushFromBelow();
    }
    if (
      isVisible &&
      !this.reduceMotion &&
      (!this.hasCompletedReferenceAnimation ||
        this.motion.isAppearanceImpulseActive ||
        this.externalMotionIsAnimating)
    ) {
      this.startLink();
    } else {
      this.stopLink();
      this.lastTime = null;
      this.cancelTapSpin();
      this.cancelTransferCompletion();
      if (!isVisible && this.motion.isDragging) {
        this.motion.end(now(), true);
        this.motion.step(
          0,
          this.diamondStyle.rotationSpeed,
          this.reduceMotion,
          this.diamondStyle.animationMode,
          this.elapsed,
          this.diamondStyle.appearance,
        );
        this.onHold?.(false);
      }
      this.onPoseUpdated?.(this.pose);
    }
    if (isVisible) this.setNeedsUpdate();
  }

  setNeedsUpdate() {
    if (
      this.linkId !== null ||
      this.pendingRender !== null ||
      this.disposed
    ) {
      return;
    }
    this.pendingRender = requestAnimationFrame(() => {
      this.pendingRender = null;
      this.draw();
    });
  }

  private updateMotion(time: number) {
    this.updateExternalMotion(this.canAnimate ? time : null);
    const dt =
      this.lastTime === null
        ? 0
        : Math.min(Math.max(0, time - this.lastTime), 0.05);
    this.lastTime = time;
    let animationDt = dt;
    if (
      this.diamondStyle.animationMode === "reference" &&
      !this.diamondStyle.referenceAnimationLoops
    ) {
      animationDt = Math.min(
        dt,
        Math.max(0, DiamondReferenceHighlights.lastFrameTime - this.elapsed),
      );
    }
    if (!this.reduceMotion) this.elapsed += animationDt;
    const receiving = this.receivingTransfer;
    if (receiving) {
      const t = Math.max(0, time - receiving.startTime);
      const completionTime = t - receiving.completionDelay;
      if (completionTime >= DiamondTransferAnimation.completionDuration) {
        this.receivingTransfer = null;
        this.transferAnimation = null;
        this.starBursts = this.starBursts.filter((b) => b.isFromTap);
      } else {
        const phase = completionTime >= 0 ? "completion" : "receiving";
        const didComplete =
          phase === "completion" &&
          this.transferAnimation?.phase !== "completion";
        this.transferAnimation = new DiamondTransferAnimation(
          phase,
          this.elapsed - (phase === "completion" ? completionTime : t),
        );
        if (didComplete) {
          this.motion.spin(
            (this.diamondStyle.rotationSpeed < 0 ? -11 : 11) *
              Math.exp(-completionTime / 0.7),
            0.7,
          );
          this.addStarBurst(this.elapsed - completionTime);
        }
      }
    }
    const anim = this.transferAnimation;
    if (
      anim &&
      anim.phase === "completion" &&
      this.elapsed - anim.startTime >= DiamondTransferAnimation.completionDuration
    ) {
      this.transferAnimation = null;
      this.starBursts = this.starBursts.filter((b) => b.isFromTap);
    }
    this.starBursts = this.starBursts.filter(
      (b) => !(this.elapsed - b.startTime >= DiamondStarBurst.lifetime),
    );
    const style = this.effectiveStyle;
    this.motion.swayScale = style.swayScale;
    const scrollTilt = this.canAnimate
      ? this.scrollTiltProvider?.(time) ?? 0
      : 0;
    this.motion.tilt = style.tilt + scrollTilt;
    this.motion.targetLean = style.lean;
    this.motion.step(
      animationDt,
      style.isRotating ? style.rotationSpeed : 0,
      this.reduceMotion,
      style.animationMode,
      this.elapsed,
      style.appearance,
    );
    if (dt > animationDt) {
      this.motion.step(
        dt - animationDt,
        0,
        this.reduceMotion,
        style.animationMode,
        this.elapsed,
        style.appearance,
      );
    }
    if (this.reduceMotion) {
      this.grow = this.motion.isDragging ? this.diamondStyle.dragGrow : 1;
      this.growVelocity = 0;
    } else if (
      this.diamondStyle.dragGrow !== 1 ||
      this.grow !== 1 ||
      this.growVelocity !== 0
    ) {
      const target = this.motion.isDragging ? this.diamondStyle.dragGrow : 1;
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 240);
        this.growVelocity +=
          ((target - this.grow) * 196 -
            2 * this.diamondStyle.growDamping * 14 * this.growVelocity) *
          step;
        this.grow += this.growVelocity * step;
        remaining = Math.max(0, remaining - step);
      }
      if (
        Math.abs(this.grow - target) < 0.0001 &&
        Math.abs(this.growVelocity) < 0.0001
      ) {
        this.grow = target;
        this.growVelocity = 0;
      }
    }
    this.onPoseUpdated?.(this.pose);
    const boostTarget = this.highlightBoost * this.refractionStrength;
    this.appliedHighlightBoost +=
      (boostTarget - this.appliedHighlightBoost) * (1 - Math.exp(-dt / 0.25));
    if (Math.abs(this.appliedHighlightBoost - boostTarget) < 0.001) {
      this.appliedHighlightBoost = boostTarget;
    }
  }

  handleTap(horizontalOffset: number): boolean {
    if (
      !this.isInHierarchy ||
      !this.foreground ||
      !this.isRenderingEnabled ||
      this.motion.isDragging ||
      this.reduceMotion
    ) {
      return false;
    }
    if (!(Math.abs(horizontalOffset) > 20 && Math.abs(horizontalOffset) <= 180)) {
      return false;
    }
    this.updateMotion(now());
    const triggersBurst = this.motion.tap(
      horizontalOffset < 0 ? -1 : 1,
      this.diamondStyle.isRotating ? this.diamondStyle.rotationSpeed : 0,
      this.diamondStyle.animationMode,
      this.elapsed,
      this.diamondStyle.appearance,
    );
    if (triggersBurst === null) return false;
    if (triggersBurst) {
      this.addStarBurst();
      this.onHaptic?.("impact");
    } else {
      this.onHaptic?.("tap");
    }
    this.setNeedsUpdate();
    return true;
  }

  private addStarBurst(time: number | null = null, isFromTap = false) {
    if (!(this.diamondStyle.starOpacity > 0.001)) return;
    if (
      !(
        this.diamondStyle.backgroundStars ||
        this.isCompletingTransfer ||
        (isFromTap && this.diamondStyle.tapToSpin)
      )
    ) {
      return;
    }
    if (this.starBursts.length >= 3) this.starBursts.shift();
    this.starBursts.push(
      new DiamondStarBurst(time ?? this.elapsed, this.nextBurstSeed, isFromTap),
    );
    this.nextBurstSeed = (this.nextBurstSeed + 1) % 65536;
  }

  private tapSpin(direction: number, time: number) {
    const current = this.motion.spinAtPress;
    const sign =
      Math.abs(current) > 0.5 ? (current < 0 ? -1 : 1) : direction;
    const top = 16;
    this.tapStreak =
      this.lastTapTime !== null && time - this.lastTapTime < 1
        ? this.tapStreak + 1
        : 1;
    this.lastTapTime = time;
    const streakSpeed = (top * this.tapStreak) / 4;
    const speed = Math.min(top, Math.max(Math.abs(current) + 5, streakSpeed));
    const reachedTop = speed >= top * 0.95;
    if (reachedTop) this.tapStreak = 0;
    this.motion.setSpin(
      sign * speed,
      reachedTop ? 2.5 : Math.max(this.diamondStyle.releaseDecay, 0.05),
    );
    if (reachedTop) this.addStarBurst(null, true);
  }

  cancelTapSpin() {
    if (this.lastTapTime !== null) this.motion.stopSpin();
    this.tapStreak = 0;
    this.lastTapTime = null;
    this.starBursts = this.starBursts.filter((b) => !b.isFromTap);
  }

  updateDrag(state: DragState, o: DragOptions = {}) {
    const translation = o.translation ?? { x: 0, y: 0 };
    const velocity = o.velocity ?? { x: 0, y: 0 };
    const scale = o.scale ?? 100;
    const playFlingHaptic = o.playFlingHaptic ?? true;
    if (state !== "cancelled" && state !== "failed") {
      if (!(this.isInHierarchy && this.foreground && this.isRenderingEnabled)) {
        return;
      }
    }
    const t = now();
    this.updateMotion(t);
    switch (state) {
      case "began":
        this.motion.begin(t);
        this.onHold?.(true);
        break;
      case "changed":
      case "ended":
        if (!this.motion.isDragging) break;
        if (translation.x !== 0 || translation.y !== 0) {
          this.motion.drag(translation.x, translation.y, scale, t);
        }
        if (state === "ended") {
          this.motion.step(
            0,
            this.diamondStyle.rotationSpeed,
            this.reduceMotion,
            this.diamondStyle.animationMode,
            this.elapsed,
            this.diamondStyle.appearance,
          );
          this.motion.end(t);
          if (
            o.tapSpinDirection != null &&
            this.diamondStyle.tapToSpin &&
            !this.isSendingTransfer &&
            !this.reduceMotion
          ) {
            this.tapSpin(o.tapSpinDirection, t);
          } else if (Math.abs(velocity.x) > 600 && !this.reduceMotion) {
            this.motion.fling(
              velocity.x < 0 ? -1 : 1,
              o.releaseImpulse ?? null,
            );
            this.addStarBurst(null, o.allowsFlingBurst ?? false);
            if (playFlingHaptic) this.onHaptic?.("impact");
          }
          this.onHold?.(false);
        }
        break;
      case "cancelled":
      case "failed":
        if (this.motion.isDragging) {
          this.motion.end(t, true);
          this.onHold?.(false);
        }
        break;
    }
    this.motion.step(
      0,
      this.diamondStyle.rotationSpeed,
      this.reduceMotion,
      this.diamondStyle.animationMode,
      this.elapsed,
      this.diamondStyle.appearance,
    );
    this.onPoseUpdated?.(this.pose);
    this.setNeedsUpdate();
  }

  get isDragging() {
    return this.motion.isDragging;
  }

  get minBoundsSide() {
    return Math.min(this.bounds.width, this.bounds.height);
  }

  private scheduleReady() {
    if (this.didSetReady) return;
    this.didSetReady = true;
    requestAnimationFrame(() => this.onReady?.());
  }

  draw() {
    if (this.disposed || this.gl.isContextLost()) return;
    const canvasSize = this._renderSize ?? this.bounds;
    if (
      !this.isInHierarchy ||
      !this.foreground ||
      !this.isRenderingEnabled ||
      !(canvasSize.width > 0) ||
      !(canvasSize.height > 0)
    ) {
      return;
    }
    const ppp = Math.min(this.pixelRatioCap, window.devicePixelRatio || 1);
    const width = Math.ceil(canvasSize.width * ppp);
    const height = Math.ceil(canvasSize.height * ppp);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.canvas.style.width = `${canvasSize.width}px`;
    this.canvas.style.height = `${canvasSize.height}px`;
    const style = this.effectiveStyle;
    const highlightBoost = this.reduceMotion
      ? this.highlightBoost * this.refractionStrength
      : this.appliedHighlightBoost;
    void highlightBoost;
    try {
      this.renderer.encode({
        size: { width, height },
        time: this.elapsed,
        starBursts: this.starBursts,
        starOffset: this.starOffset,
        motion: this.motion,
        style,
        grow: this.grow * this.interactionScale,
        pixelsPerPoint: ppp,
        reduceMotion: this.reduceMotion,
        lightBackground: this.lightBackground,
        refractionSource: this.refractionSource,
        refractionStrength: this.refractionStrength,
        highlightBoost: 0,
        refractionUpdated: this.onRefractionUpdated,
      });
    } catch (e) {
      this.stopLink();
      this.onError?.(e);
      return;
    }
    this.scheduleReady();
  }
}

void DiamondEntrance;
void Appearance;
