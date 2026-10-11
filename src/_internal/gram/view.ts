import { Appearance } from "./animation";
import { DiamondStyle, defaultDiamondStyle } from "./style";
import { InteractiveDiamondLayer, DiamondPose, HapticKind } from "./layer";
import type { RefractionGeometry, RefractionSource } from "./renderer";

export type ExpansionStyle = "centered" | "downward" | "wallet";
export type InteractiveAnimationMode =
  | "continuous"
  | "idle"
  | "lottie"
  | "lottie-once";
export interface Point {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}

export interface InteractiveDiamondOptions {
  size: Size;
  diamondWidth: number;
  isVisible: boolean;
  lightBackground: boolean;
  appearance: Appearance;
  expansionStyle: ExpansionStyle;
  expandedCenter: Point | null;
  animationMode: InteractiveAnimationMode;
  animateOnAppear: boolean;
  tapToSpin: boolean;
  touchAction: string;
}

export interface MotionState {
  rotation: number;
  time: number;
  transferEnergy: number | null;
}

interface Expansion {
  start: number;
  from: number;
  holding: boolean;
}

const now = () => performance.now() / 1000;

export class InteractiveDiamondView {
  readonly element: HTMLDivElement;
  readonly layer: InteractiveDiamondLayer;
  isExpanded = false;
  onExpansionChanged: ((expanded: boolean) => void) | null = null;
  onLanding: ((power: number) => void) | null = null;
  onMotionUpdated: ((state: MotionState | null) => void) | null = null;
  onHaptic: ((kind: HapticKind, intensity?: number) => void) | null = null;
  onRefractionUpdated: ((g: RefractionGeometry | null) => void) | null = null;

  private isHolding = false;
  private restingSize: Size = { width: 0, height: 0 };
  private diamondWidth = 0;
  private walletScale = 1;
  private walletLeftInset = Number.MAX_VALUE;
  private walletStarCanvasSize: Size = { width: 240, height: 240 };
  private expansionStyle: ExpansionStyle = "centered";
  private expandedCenter: Point | null = null;
  private refractionSource: RefractionSource | null = null;
  private animationMode: InteractiveAnimationMode = "continuous";
  private expansion: Expansion | null = null;
  private grip = 0;
  private dragPosition: Point | null = null;
  private pressStart: { position: Point; time: number } | null = null;
  private dragSamples: { x: number; time: number }[] = [];
  private landingTimer: ReturnType<typeof setTimeout> | null = null;
  private isWalletTransfer = false;
  private openingScale: number | null = null;
  private layerPosition: Point = { x: 0, y: 0 };
  private pressEnabled = true;
  private pointerId: number | null = null;
  private io: IntersectionObserver | null = null;
  private mq: MediaQueryList | null = null;
  private visibleOnScreen = true;
  private optionsVisible = false;
  private reduceMotionMode: "auto" | boolean = "auto";

  constructor(private mount: HTMLElement) {
    this.element = document.createElement("div");
    this.element.style.cssText =
      "position:relative;overflow:visible;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;";
    this.element.setAttribute("aria-hidden", "true");
    mount.appendChild(this.element);
    this.layer = new InteractiveDiamondLayer(false);
    this.layer.canvas.style.position = "absolute";
    this.element.appendChild(this.layer.canvas);
    this.layer.isRenderingEnabled = false;

    const style = defaultDiamondStyle();
    style.animationMode = "continuous";
    style.rotationSpeed = (2 * Math.PI) / 26;
    style.swayScale = 1;
    style.backgroundStars = false;
    style.mainSparkleOnRotation = true;
    style.releaseTilt = 2.6;
    this.layer.update(style);

    this.layer.onHold = (holding) => this.setHolding(holding);
    this.layer.onHaptic = (k) => this.onHaptic?.(k);
    this.layer.onRefractionUpdated = (g) => {
      if (!this.onRefractionUpdated) return;
      const o = this.layerPosition;
      this.onRefractionUpdated(
        g
          ? {
              ...g,
              center: { x: g.center.x + o.x, y: g.center.y + o.y },
              hull: g.hull.map((h) => ({ x: h.x + o.x, y: h.y + o.y })),
            }
          : null,
      );
    };
    this.layer.onPoseUpdated = (pose) => this.poseUpdated(pose);

    const el = this.element;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerCancel);
    el.addEventListener("lostpointercapture", this.onPointerCancel);
    window.addEventListener("blur", this.onBlur);

    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          this.visibleOnScreen = e.isIntersecting;
          this.syncHierarchy();
        }
      },
      { rootMargin: "64px" },
    );
    this.io.observe(el);
    if (typeof window.matchMedia === "function") {
      this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.mq.addEventListener?.("change", this.onReduceMotion);
    }
    this.syncHierarchy();
    this.onReduceMotion();
  }

  setReduceMotionMode(mode: "auto" | boolean) {
    this.reduceMotionMode = mode;
    this.onReduceMotion();
  }

  private syncHierarchy() {
    this.layer.isInHierarchy = this.visibleOnScreen && this.element.isConnected;
  }

  private onReduceMotion = () => {
    const enabled =
      this.reduceMotionMode === "auto"
        ? !!this.mq?.matches
        : this.reduceMotionMode;
    this.layer.setReduceMotion(enabled);
    if (enabled) {
      this.expansion = null;
      this.grip = this.isHolding ? 1 : 0;
      this.layer.resetGrowth();
      this.applyExpansion();
    }
  };

  private onBlur = () => this.cancelInteraction();

  dispose() {
    if (this.landingTimer) clearTimeout(this.landingTimer);
    this.io?.disconnect();
    this.mq?.removeEventListener?.("change", this.onReduceMotion);
    window.removeEventListener("blur", this.onBlur);
    this.layer.dispose();
    this.element.remove();
  }

  private hitTest(p: Point): boolean {
    if (this.animationMode !== "continuous") return true;
    if (this.expansionStyle === "wallet") {
      const radius =
        this.restingSize.width * ((30 * 0.9) / 96) * this.walletScale;
      return (
        Math.hypot(p.x - this.layerPosition.x, p.y - this.layerPosition.y) <=
        radius
      );
    }
    const cx = this.restingSize.width / 2;
    const cy = this.restingSize.height / 2;
    return Math.abs(p.x - cx) <= 32 && Math.abs(p.y - cy) <= 32;
  }

  private local(e: PointerEvent): Point {
    const r = this.element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (
      !this.pressEnabled ||
      this.pointerId !== null ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    const position = this.local(e);
    if (!this.hitTest(position)) return;
    this.pointerId = e.pointerId;
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {}
    const t = now();
    this.cancelLandingFeedback();
    this.dragPosition = position;
    this.pressStart = { position, time: t };
    this.dragSamples = [{ x: position.x, time: t }];
    this.layer.updateDrag("began");
  };

  private pressUpdate(e: PointerEvent, state: "changed" | "ended") {
    const position = this.local(e);
    const t = now();
    const previous = this.dragPosition;
    if (!previous) return;
    const wasHolding = this.isHolding;
    const releasePower = this.layer.refractionStrength;
    const translation = {
      x: position.x - previous.x,
      y: position.y - previous.y,
    };
    this.dragSamples.push({ x: position.x, time: t });
    while (
      this.dragSamples.length > 2 &&
      this.dragSamples[0].time < t - 0.08
    )
      this.dragSamples.shift();
    const sample = this.dragSamples[0];
    const interval = Math.max(t - sample.time, 1 / 240);
    const velocity = { x: (position.x - sample.x) / interval, y: 0 };
    let tapDirection: number | null = null;
    if (
      state === "ended" &&
      this.layer.diamondStyle.tapToSpin &&
      this.pressStart &&
      t - this.pressStart.time < 0.25 &&
      Math.hypot(
        position.x - this.pressStart.position.x,
        position.y - this.pressStart.position.y,
      ) < 10
    ) {
      const centerX =
        this.expansionStyle === "wallet"
          ? this.layerPosition.x
          : this.restingSize.width / 2;
      tapDirection = position.x < centerX ? -1 : 1;
    }
    this.dragPosition = state === "ended" ? null : position;
    if (state === "ended") {
      this.pressStart = null;
      this.dragSamples = [];
    }
    const wallet = this.expansionStyle === "wallet";
    this.layer.updateDrag(state, {
      translation,
      velocity,
      scale: wallet
        ? Math.min(this.restingSize.width, this.restingSize.height)
        : 220,
      releaseImpulse: wallet ? null : 3 * 6.5,
      playFlingHaptic: wallet,
      allowsFlingBurst: wallet,
      tapSpinDirection: tapDirection,
    });
    if (wallet && tapDirection !== null && !this.layer.reduceMotion)
      this.onHaptic?.("impact", 0.4);
    if (state === "ended" && wasHolding && !wallet)
      this.scheduleLandingFeedback(releasePower);
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId === this.pointerId) this.pressUpdate(e, "changed");
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pressUpdate(e, "ended");
    this.releasePointer(e.pointerId);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.cancelLandingFeedback();
    this.dragPosition = null;
    this.pressStart = null;
    this.dragSamples = [];
    this.layer.updateDrag("cancelled");
    this.releasePointer(e.pointerId);
  };

  private releasePointer(id: number) {
    this.pointerId = null;
    try {
      this.element.releasePointerCapture(id);
    } catch {}
  }

  private scheduleLandingFeedback(power: number) {
    this.cancelLandingFeedback();
    if (
      !(
        power > 0 &&
        (power > 0.2 || this.onLanding) &&
        !this.isHolding
      )
    )
      return;
    this.landingTimer = setTimeout(() => {
      this.landingTimer = null;
      if (
        !this.element.isConnected ||
        !this.layer.isRenderingEnabled ||
        !this.pressEnabled ||
        this.isHolding
      )
        return;
      if (power > 0.2)
        this.onHaptic?.("impact", 0.35 + 0.4 * Math.min(1, power));
      this.onLanding?.(Math.min(1, power));
    }, 200);
  }

  private cancelLandingFeedback() {
    if (this.landingTimer) clearTimeout(this.landingTimer);
    this.landingTimer = null;
  }

  private setHolding(holding: boolean) {
    if (this.isHolding === holding) return;
    const t = now();
    this.updateExpansion(t);
    this.isHolding = holding;
    if (this.expansionStyle !== "centered") {
      if (this.layer.reduceMotion) this.layer.resetGrowth();
      this.applyExpansion();
      return;
    }
    if (this.layer.reduceMotion) {
      this.expansion = null;
      this.grip = holding ? 1 : 0;
    } else {
      this.expansion = { start: t, from: this.grip, holding };
    }
    this.applyExpansion();
  }

  private updateExpansion(time: number) {
    const ex = this.expansion;
    if (!ex) return;
    const elapsed = Math.max(0, time - ex.start);
    if (ex.holding) {
      const t = Math.min(1, elapsed / 0.46);
      const u = t * t * (3 - 2 * t);
      const settle =
        1 -
        Math.exp(-5.6 * u) *
          (Math.cos(6.2 * u) + (5.6 / 6.2) * Math.sin(6.2 * u));
      this.grip = ex.from + (1 - ex.from) * settle;
      if (t === 1) {
        this.grip = 1;
        this.expansion = null;
      }
    } else {
      this.grip = ex.from * (Math.exp(-4.2 * elapsed) * Math.cos(7 * elapsed));
      if (elapsed >= 1.96) {
        this.grip = 0;
        this.expansion = null;
      }
    }
    this.applyExpansion();
  }

  private poseUpdated(_pose: DiamondPose) {
    if (this.expansionStyle !== "centered") this.applyExpansion();
    else this.updateExpansion(now());
    if (this.onMotionUpdated) {
      const state = this.layer.animationState;
      if (state) {
        this.onMotionUpdated({
          rotation: this.layer.pose.yaw,
          time: state.time,
          transferEnergy: state.transferEnergy,
        });
      } else this.onMotionUpdated(null);
    }
  }

  private applyExpansion() {
    const layer = this.layer;
    if (this.isWalletTransfer) {
      layer.usesHighFrameRate = true;
      layer.interactionScale = 1;
      layer.refractionStrength = 0;
      this.layerPosition = {
        x: this.restingSize.width / 2,
        y: this.restingSize.height / 2,
      };
      layer.renderSize = { width: 150, height: 150 };
      this.placeCanvas();
      return;
    }
    const expanded =
      this.isHolding || this.expansion !== null || layer.isGrowthAnimating;
    layer.usesHighFrameRate =
      expanded || this.openingScale !== null || layer.hasTransferAnimation;
    layer.interactionScale =
      (this.expansionStyle !== "centered" ? 1 : 1 + 2.75 * this.grip) *
      (this.openingScale ?? 1);
    const refractionStrength =
      this.expansionStyle !== "centered" &&
      layer.diamondStyle.dragGrow !== 1
        ? (layer.pose.grow - 1) / (layer.diamondStyle.dragGrow - 1)
        : this.grip;
    layer.refractionStrength = Math.min(1, Math.max(0, refractionStrength));
    const rc = {
      x: this.restingSize.width * 0.5,
      y: this.restingSize.height * 0.5,
    };
    const ec = this.expandedCenter ?? rc;
    const pos = {
      x: rc.x + (ec.x - rc.x) * refractionStrength,
      y: rc.y + (ec.y - rc.y) * refractionStrength,
    };
    if (this.expansionStyle === "wallet") {
      const halfWidth =
        this.diamondWidth *
        (layer.pose.grow * layer.zoom) *
        this.walletScale *
        0.55;
      pos.x = rc.x + Math.max(0, halfWidth - this.walletLeftInset);
    }
    this.layerPosition = pos;
    layer.starOffset =
      this.expansionStyle === "wallet"
        ? { x: rc.x - pos.x, y: rc.y - pos.y }
        : { x: 0, y: 0 };
    this.updateRefractionPosition();
    if (this.openingScale !== null) layer.renderSize = { width: 320, height: 320 };
    else if (layer.isCompletingTransfer || layer.hasStarBursts) {
      layer.renderSize =
        this.expansionStyle === "wallet"
          ? this.walletStarCanvasSize
          : { width: 240, height: 240 };
    } else if (expanded) layer.renderSize = { width: 220, height: 220 };
    else if (layer.hasTransferAnimation)
      layer.renderSize = { width: 96, height: 96 };
    else layer.renderSize = { ...this.restingSize };
    this.placeCanvas();
    layer.setNeedsUpdate();
    if (this.isExpanded !== expanded) {
      this.isExpanded = expanded;
      this.onExpansionChanged?.(expanded);
    }
  }

  private placeCanvas() {
    const size = this.layer.renderSize ?? this.layer.bounds;
    const c = this.layer.canvas;
    c.style.left = `${this.layerPosition.x - size.width / 2}px`;
    c.style.top = `${this.layerPosition.y - size.height / 2}px`;
  }

  cancelInteraction() {
    this.cancelLandingFeedback();
    this.layer.cancelTapSpin();
    if (
      !(
        this.isHolding ||
        this.expansion ||
        this.dragPosition ||
        this.layer.isGrowthAnimating
      )
    ) {
      this.applyExpansion();
      return;
    }
    if (this.pointerId !== null) this.releasePointer(this.pointerId);
    if (this.isHolding) this.layer.updateDrag("cancelled");
    this.dragPosition = null;
    this.pressStart = null;
    this.dragSamples = [];
    this.isHolding = false;
    this.expansion = null;
    this.grip = 0;
    this.layer.resetGrowth();
    this.applyExpansion();
  }

  get isPlaying() {
    return this.layer.isPlaying;
  }

  playOnce() {
    if (this.animationMode === "lottie-once") this.layer.resetAnimation();
  }

  spin(velocity: number, decay: number) {
    this.layer.spin(velocity, decay);
  }

  pushFromBelow(strength = 1) {
    this.layer.pushFromBelow(strength);
  }

  updateTransferState(isSending: boolean, animateCompletion: boolean) {
    this.layer.updateTransferState(isSending, animateCompletion);
  }

  beginReceivingTransfer(startTime: number, completionDelay: number) {
    this.layer.beginReceivingTransfer(startTime, completionDelay);
  }

  endReceivingTransfer() {
    this.layer.endReceivingTransfer();
  }

  set externalMotion(
    v: ((t: number | null) => { rotation: number; isAnimating: boolean }) | null,
  ) {
    this.layer.externalMotion = v;
  }

  set scrollTiltProvider(v: ((t: number) => number) | null) {
    this.layer.scrollTiltProvider = v;
  }

  requestExternalMotionUpdate() {
    this.layer.requestExternalMotionUpdate();
  }

  set isRenderingEnabled(v: boolean) {
    if (!v) this.cancelInteraction();
    this.layer.isRenderingEnabled = v;
  }

  updateWalletTilt(
    pitch: number,
    roll: number,
    scale: number,
    leftInset: number,
    starCanvasSize: Size,
  ) {
    if (this.expansionStyle !== "wallet") return;
    this.walletScale = scale;
    this.walletLeftInset = leftInset;
    this.walletStarCanvasSize = {
      width: Math.max(240, Math.ceil(starCanvasSize.width)),
      height: Math.max(240, Math.ceil(starCanvasSize.height)),
    };
    const style = { ...this.layer.diamondStyle };
    style.tilt = -pitch * 2.8;
    style.lean = roll * 2.6;
    style.widthPoints = this.diamondWidth * scale;
    this.layer.update(style);
    this.applyExpansion();
  }

  updateOpeningScale(scale: number | null) {
    if (this.openingScale === scale) return;
    this.openingScale = scale;
    this.applyExpansion();
  }

  prepareForWalletTransfer() {
    this.cancelInteraction();
    this.isWalletTransfer = true;
    this.openingScale = null;
    this.pressEnabled = false;
    this.onExpansionChanged = null;
    this.onLanding = null;
    this.onMotionUpdated = null;
    this.onRefractionUpdated = null;
    this.layer.scrollTiltProvider = null;
    this.layer.externalMotion = null;
    this.updateRefractionSource(null);
    this.applyExpansion();
  }

  updateWalletTransfer(
    width: number,
    rotationSpeed: number,
    completion: boolean,
    isDark: boolean,
    appearance = Appearance.blue,
  ) {
    this.layer.lightBackground = !isDark;
    const style = { ...this.layer.diamondStyle };
    const startsCompletion = completion && !style.backgroundStars;
    style.animationMode = "continuous";
    style.appearance = appearance;
    style.widthPoints = width;
    style.rotationSpeed = rotationSpeed;
    style.swayScale = 2.4;
    style.floatAmplitude = 0;
    style.backgroundStars = completion;
    style.steadyStars = false;
    style.starZoom = 0.55;
    style.starEmission = 0.3;
    style.burstSize = 0.7;
    style.burstFadeInDuration = 0;
    this.layer.update(style, true);
    if (startsCompletion) {
      this.spin(12, 0.7);
      this.layer.emitStarBurst();
    }
    this.applyExpansion();
  }

  updateRefractionSource(source: RefractionSource | null) {
    if (this.refractionSource === source) return;
    this.refractionSource = source;
    this.updateRefractionPosition();
    this.layer.setNeedsUpdate();
  }

  private updateRefractionPosition() {
    const s = this.refractionSource;
    if (!s) {
      this.layer.refractionSource = null;
      return;
    }
    this.layer.refractionSource = {
      ...s,
      rect: {
        ...s.rect,
        x: s.rect.x + this.restingSize.width * 0.5 - this.layerPosition.x,
        y: s.rect.y + this.restingSize.height * 0.5 - this.layerPosition.y,
      },
    };
  }

  update(o: InteractiveDiamondOptions): Size {
    const returningFromFlight = this.isWalletTransfer;
    this.isWalletTransfer = false;
    if (returningFromFlight) this.pressEnabled = true;
    if (this.animationMode !== o.animationMode) {
      this.cancelInteraction();
      this.animationMode = o.animationMode;
    }
    const isInteractive = o.animationMode === "continuous";
    this.pressEnabled = isInteractive;
    this.element.style.touchAction = isInteractive ? o.touchAction : "auto";
    if (this.expansionStyle !== o.expansionStyle) {
      this.cancelInteraction();
      this.expansionStyle = o.expansionStyle;
    }
    this.restingSize = o.size;
    this.diamondWidth = o.diamondWidth;
    this.expandedCenter = o.expandedCenter;
    this.layer.bounds = { ...o.size };
    this.element.style.width = `${o.size.width}px`;
    this.element.style.height = `${o.size.height}px`;
    const style = { ...this.layer.diamondStyle };
    if (returningFromFlight) {
      style.rotationSpeed = (2 * Math.PI) / 26;
      const d = defaultDiamondStyle();
      style.backgroundStars = false;
      style.steadyStars = d.steadyStars;
      style.starZoom = d.starZoom;
      style.starEmission = d.starEmission;
      style.burstSize = d.burstSize;
      style.burstFadeInDuration = d.burstFadeInDuration;
    }
    style.animateOnAppear = o.animateOnAppear;
    style.isRotating = o.animationMode !== "idle";
    switch (o.animationMode) {
      case "continuous":
      case "idle":
        style.animationMode = "continuous";
        style.referenceAnimationLoops = true;
        break;
      case "lottie":
        style.animationMode = "reference";
        style.referenceAnimationLoops = true;
        break;
      case "lottie-once":
        style.animationMode = "reference";
        style.referenceAnimationLoops = false;
        break;
    }
    style.swayScale = isInteractive ? 1 : 0;
    style.floatAmplitude =
      isInteractive && o.expansionStyle === "downward" ? 1.5 : 0;
    style.floatPeriod = 3.2;
    this.layer.highlightBoost = isInteractive ? 0.4 : 0;
    style.mainSparkleOnRotation = isInteractive;
    style.widthPoints =
      o.diamondWidth * (o.expansionStyle === "wallet" ? this.walletScale : 1);
    style.appearance = o.appearance;
    style.widthCompensation = o.expansionStyle !== "wallet";
    style.dragGrow =
      o.expansionStyle === "wallet"
        ? 2.6
        : o.expansionStyle === "downward"
          ? 3
          : 1;
    style.growShift =
      o.expansionStyle === "downward" && !o.expandedCenter ? 12 : 0;
    style.growDamping = o.expansionStyle !== "centered" ? 0.62 : 0.42;
    style.releaseDecay = o.expansionStyle !== "centered" ? 1.1 : 0;
    style.releaseTilt = o.expansionStyle !== "centered" ? 0 : 2.6;
    style.tapToSpin = isInteractive && o.tapToSpin;
    style.starOpacity = o.expansionStyle === "wallet" ? 0 : 1;
    style.rightwardStars = o.expansionStyle === "wallet";
    style.starReferenceSize = o.expansionStyle === "wallet" ? 240 : 0;
    if (o.expansionStyle !== "wallet") {
      style.tilt = 0;
      style.lean = 0;
    }
    this.layer.update(style);
    this.layer.lightBackground =
      o.expansionStyle === "centered" && o.lightBackground;
    this.optionsVisible = o.isVisible;
    this.isRenderingEnabled = o.isVisible;
    this.applyExpansion();
    return o.size;
  }
}

export interface PremiumDiamondOptions {
  size: Size;
  lightBackground: boolean;
  style?: Partial<DiamondStyle>;
  touchAction: string;
  isVisible: boolean;
}

export class PremiumDiamondView {
  readonly element: HTMLDivElement;
  readonly layer: InteractiveDiamondLayer;
  private pointerId: number | null = null;
  private down: { x: number; y: number; time: number } | null = null;
  private panning = false;
  private last: Point | null = null;
  private samples: { x: number; y: number; time: number }[] = [];
  private io: IntersectionObserver;
  private mq: MediaQueryList | null = null;
  private visibleOnScreen = true;
  private reduceMotionMode: "auto" | boolean = "auto";
  private appliedOverrides: Partial<DiamondStyle> | undefined;
  private static readonly slop = 10;

  constructor(mount: HTMLElement) {
    this.element = document.createElement("div");
    this.element.style.cssText =
      "position:relative;width:100%;height:100%;overflow:visible;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;";
    this.element.setAttribute("aria-hidden", "true");
    mount.appendChild(this.element);
    this.layer = new InteractiveDiamondLayer(true);
    this.layer.canvas.style.position = "absolute";
    this.element.appendChild(this.layer.canvas);
    const el = this.element;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onCancel);
    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          this.visibleOnScreen = e.isIntersecting;
          this.sync();
        }
      },
      { rootMargin: "64px" },
    );
    this.io.observe(el);
    if (typeof window.matchMedia === "function") {
      this.mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.mq.addEventListener?.("change", this.onReduce);
    }
    this.sync();
    this.onReduce();
  }

  private enabled = true;

  private sync() {
    this.layer.isInHierarchy =
      this.visibleOnScreen && this.element.isConnected && this.enabled;
  }

  setReduceMotionMode(mode: "auto" | boolean) {
    this.reduceMotionMode = mode;
    this.onReduce();
  }

  private onReduce = () => {
    this.layer.setReduceMotion(
      this.reduceMotionMode === "auto" ? !!this.mq?.matches : this.reduceMotionMode,
    );
  };

  dispose() {
    this.io.disconnect();
    this.mq?.removeEventListener?.("change", this.onReduce);
    this.layer.dispose();
    this.element.remove();
  }

  private local(e: PointerEvent): Point {
    const r = this.element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent) => {
    if (
      this.pointerId !== null ||
      (e.pointerType === "mouse" && e.button !== 0)
    )
      return;
    this.pointerId = e.pointerId;
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {}
    const p = this.local(e);
    this.down = { ...p, time: performance.now() / 1000 };
    this.last = p;
    this.panning = false;
    this.samples = [{ ...p, time: this.down.time }];
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.down) return;
    const p = this.local(e);
    const t = performance.now() / 1000;
    this.samples.push({ ...p, time: t });
    while (this.samples.length > 2 && this.samples[0].time < t - 0.1)
      this.samples.shift();
    if (!this.panning) {
      if (
        Math.hypot(p.x - this.down.x, p.y - this.down.y) <
        PremiumDiamondView.slop
      )
        return;
      this.panning = true;
      this.last = p;
      this.layer.updateDrag("began");
      return;
    }
    const translation = { x: p.x - this.last!.x, y: p.y - this.last!.y };
    this.last = p;
    this.layer.updateDrag("changed", {
      translation,
      scale: this.layer.minBoundsSide,
    });
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const p = this.local(e);
    const t = performance.now() / 1000;
    if (this.panning) {
      const s = this.samples[0];
      const dt = Math.max(t - s.time, 1 / 240);
      const velocity = { x: (p.x - s.x) / dt, y: (p.y - s.y) / dt };
      const translation = { x: p.x - this.last!.x, y: p.y - this.last!.y };
      this.layer.updateDrag("ended", {
        translation,
        velocity,
        scale: this.layer.minBoundsSide,
      });
    } else {
      this.layer.handleTap(p.x - this.element.clientWidth / 2);
    }
    this.finish(e.pointerId);
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.panning) this.layer.updateDrag("cancelled");
    this.finish(e.pointerId);
  };

  private finish(id: number) {
    this.pointerId = null;
    this.down = null;
    this.panning = false;
    this.last = null;
    this.samples = [];
    try {
      this.element.releasePointerCapture(id);
    } catch {}
  }

  update(o: PremiumDiamondOptions) {
    this.element.style.touchAction = o.touchAction;
    if (o.style !== this.appliedOverrides) {
      this.appliedOverrides = o.style;
      const base = this.layer.diamondStyle;
      this.layer.update({ ...base, ...o.style });
    }
    this.enabled = o.isVisible;
    this.layer.isRenderingEnabled = o.isVisible;
    this.sync();
    this.layer.bounds = { ...o.size };
    this.layer.lightBackground = o.lightBackground;
    const c = this.layer.canvas;
    c.style.left = "0px";
    c.style.top = "-8px";
    this.layer.setNeedsUpdate();
  }
}
