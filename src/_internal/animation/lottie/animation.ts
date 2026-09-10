import {
  buildAssetsMap,
  renderDocumentFrame,
  type EngineImageCache,
  type RenderOptions,
} from "./engine";
import type { LottieAnimation } from "./types";

export type PlayerState =
  | "loading"
  | "playing"
  | "paused"
  | "stopped"
  | "frozen"
  | "error"
  | "destroyed";

export type PlayMode = "normal" | "bounce";

export interface PlayerEventMap {
  ready: void;
  play: void;
  pause: void;
  stop: void;
  complete: void;
  loop: void;
  frame: { frame: number; progress: number };
  error: { errors?: string[] };
  destroyed: void;
}

type Listener<K extends keyof PlayerEventMap> = (detail: PlayerEventMap[K]) => void;

export interface AnimationOptions {
  canvas: HTMLCanvasElement;
  loop: boolean | number;
  autoplay: boolean;
  speed: number;
  direction: 1 | -1;
  mode: PlayMode;
  segments?: [number, number];
}

const memoryImageCache = new Map<string, HTMLImageElement>();
const imageCache: EngineImageCache = {
  get: (k) => memoryImageCache.get(k),
  set: (k, v) => void memoryImageCache.set(k, v),
};

const warnedKeys = new Set<string>();
const FRAME_EPSILON = 0.0001;

function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(message);
}

export class LottieAnimationController {
  private doc: LottieAnimation | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private state: PlayerState = "loading";
  private currentFrame = 0;
  private direction: 1 | -1 = 1;
  private speed = 1;
  private loop: boolean | number = false;
  private mode: PlayMode = "normal";
  private loopsCompleted = 0;
  private segment: [number, number] | null = null;
  private destroyed = false;

  private rafHandle: number | null = null;
  private lastTs: number | null = null;

  private shapeScratch: { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } | null = null;
  private assetsById = new Map<string, import("./types").LottieAsset>();
  private layerIndexCache = new WeakMap<
    import("./types").LottieLayer[],
    Map<number, import("./types").LottieLayer>
  >();

  private listeners: Map<keyof PlayerEventMap, Set<Listener<any>>> = new Map();

  constructor(options: AnimationOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("react-tgs-player: could not acquire a 2D canvas context");
    this.ctx = ctx;
    this.direction = options.direction ?? 1;
    this.speed = options.speed ?? 1;
    this.loop = options.loop ?? false;
    this.mode = options.mode ?? "normal";
    this.segment = options.segments ?? null;
  }

  on<K extends keyof PlayerEventMap>(event: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  private emit<K extends keyof PlayerEventMap>(event: K, detail?: PlayerEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(detail as PlayerEventMap[K]);
  }

  setDocument(doc: LottieAnimation): void {
    if (this.destroyed) return;
    this.doc = doc;
    this.assetsById = buildAssetsMap(doc);
    this.layerIndexCache = new WeakMap();
    this.loopsCompleted = 0;
    this.lastTs = null;
    const [inF, outF] = this.getBounds();
    this.currentFrame = this.direction === -1 ? outF : inF;
    this.state = "stopped";
    this.emit("ready");
    this.renderCurrentFrame();
  }

  setError(errors?: string[]): void {
    this.stopLoop();
    this.state = "error";
    this.emit("error", { errors });
  }

  private getBounds(): [number, number] {
    if (!this.doc) return [0, 0];
    const start = this.segment?.[0] ?? this.doc.ip;
    const rawEnd = this.segment?.[1] ?? this.doc.op;
    // Lottie `op` is exclusive. Rendering it makes every layer inactive because
    // layer visibility is checked with `frame < layer.op`.
    const end = Math.max(start, rawEnd - FRAME_EPSILON);
    return [start, end];
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderCurrentFrame();
  }

  setSegment(segment: [number, number] | null): void {
    this.segment = segment;
    const [inF, outF] = this.getBounds();
    this.currentFrame = Math.min(Math.max(this.currentFrame, inF), outF);
    this.renderCurrentFrame();
  }

  play(): void {
    if (!this.doc) return;
    if (this.state === "destroyed") return;
    this.state = "playing";
    this.emit("play");
    this.startLoop();
  }

  pause(): void {
    this.state = "paused";
    this.stopLoop();
    this.emit("pause");
  }

  freeze(): void {
    if (this.state !== "playing") return;
    this.state = "frozen";
    this.stopLoop();
  }

  unfreeze(): void {
    if (this.state !== "frozen") return;
    this.play();
  }

  stop(): void {
    if (!this.doc) return;
    this.state = "stopped";
    this.stopLoop();
    const [inF, outF] = this.getBounds();
    this.currentFrame = this.direction === -1 ? outF : inF;
    this.loopsCompleted = 0;
    this.renderCurrentFrame();
    this.emit("stop");
  }

  destroy(): void {
    this.stopLoop();
    this.destroyed = true;
    this.state = "destroyed";
    this.doc = null;
    this.shapeScratch = null;
    this.listeners.clear();
  }

  togglePlay(): void {
    this.state === "playing" ? this.pause() : this.play();
  }

  setSpeed(speed: number): void {
    this.speed = Number.isFinite(speed) ? Math.max(0, speed) : 1;
  }

  setDirection(direction: 1 | -1): void {
    this.direction = direction;
    if (this.doc && this.state === "stopped") {
      const [inF, outF] = this.getBounds();
      this.currentFrame = direction === -1 ? outF : inF;
      this.renderCurrentFrame();
    }
  }

  setLoop(loop: boolean | number): void {
    this.loop =
      typeof loop === "number" && Number.isFinite(loop)
        ? Math.max(0, Math.floor(loop))
        : loop;
  }

  setMode(mode: PlayMode): void {
    this.mode = mode;
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  getState(): PlayerState {
    return this.state;
  }

  getTotalFrames(): number {
    const [inF, outF] = this.getBounds();
    return outF - inF;
  }

  seek(value: number | string): void {
    if (!this.doc) return;
    const [inF, outF] = this.getBounds();
    let frame: number;

    if (typeof value === "string" && value.trim().endsWith("%")) {
      const pct = Math.max(0, Math.min(1, parseFloat(value) / 100));
      frame = inF + (outF - inF) * pct;
    } else {
      frame = Number(value);
    }

    frame = Math.min(Math.max(frame, inF), outF);
    this.currentFrame = frame;
    this.renderCurrentFrame();
    this.emitFrameEvent();

  }

  private startLoop(): void {
    if (this.rafHandle != null) return;
    this.lastTs = null;
    const tick = (ts: number) => {
      if (this.state !== "playing") {
        this.rafHandle = null;
        return;
      }
      if (this.lastTs == null) this.lastTs = ts;
      const dtMs = ts - this.lastTs;
      this.lastTs = ts;
      this.advance(dtMs);
      this.rafHandle = requestAnimationFrame(tick);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafHandle != null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.lastTs = null;
  }

  private advance(dtMs: number): void {
    if (!this.doc) return;
    const [inF, outF] = this.getBounds();
    const fps = this.doc.fr || 30;
    const framesDelta = Math.max(0, dtMs) / 1000 * fps * this.speed * this.direction;

    let next = this.currentFrame + framesDelta;

    const span = Math.max(1, outF - inF);
    const loopLimit =
      this.loop === true ? Infinity : this.loop === false ? 1 : Math.max(1, this.loop);

    if (this.mode === "bounce") {
      let remaining = Math.abs(framesDelta);
      let direction = this.direction;
      let guard = 0;
      while (remaining > 0 && guard++ < 128) {
        const distance = direction === 1 ? outF - next : next - inF;
        if (remaining <= distance) {
          next += remaining * direction;
          remaining = 0;
          break;
        }

        remaining -= Math.max(0, distance);
        next = direction === 1 ? outF : inF;
        if (this.loop !== true && this.loopsCompleted >= loopLimit - 0.5) {
          this.direction = direction;
          this.finishPlayback();
          break;
        }
        direction = direction === 1 ? -1 : 1;
        this.direction = direction;
        this.loopsCompleted += 0.5;
        this.emit("loop");
      }
    } else if (framesDelta !== 0) {
      const movingForward = framesDelta > 0;
      let remaining = Math.abs(framesDelta);
      let guard = 0;
      while (remaining > 0 && guard++ < 128) {
        const distance = movingForward ? outF - next : next - inF;
        if (remaining <= distance) {
          next += remaining * (movingForward ? 1 : -1);
          remaining = 0;
          break;
        }

        remaining -= Math.max(0, distance);
        next = movingForward ? outF : inF;
        if (this.loop !== true && this.loopsCompleted >= loopLimit - 1) {
          this.finishPlayback();
          break;
        }
        next = movingForward ? inF : outF;
        this.loopsCompleted += 1;
        this.emit("loop");
      }
    }

    this.currentFrame = next;
    this.renderCurrentFrame();
    this.emitFrameEvent();
  }

  private finishPlayback(): void {
    this.state = "paused";
    this.stopLoop();
    this.emit("complete");
  }

  private emitFrameEvent(): void {
    const [inF, outF] = this.getBounds();
    const span = Math.max(1, outF - inF);
    this.emit("frame", {
      frame: this.currentFrame,
      progress: (this.currentFrame - inF) / span,
    });
  }

  private getShapeScratch(
    w: number,
    h: number
  ): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } {
    const cur = this.shapeScratch;
    if (cur && cur.canvas.width === Math.max(1, w) && cur.canvas.height === Math.max(1, h)) {
      return cur;
    }
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
    } else {
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
    }
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    this.shapeScratch = { canvas, ctx };
    return this.shapeScratch;
  }

  private renderCurrentFrame(): void {
    if (!this.doc) return;
    const opts: RenderOptions = {
      ctx: this.ctx,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      imageCache,
      assetsById: this.assetsById,
      layerIndexCache: this.layerIndexCache,
      sourceUrl: this.doc.__sourceUrl,
      onAssetLoaded: () => this.renderCurrentFrame(),
      warnOnce,
      getShapeScratch: (w, h) => this.getShapeScratch(w, h),
    };
    try {
      renderDocumentFrame(this.doc, this.currentFrame, opts);
    } catch (err) {
      this.setError([(err as Error).message]);
    }
  }
}
