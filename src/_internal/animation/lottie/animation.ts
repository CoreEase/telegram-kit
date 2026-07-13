import { renderDocumentFrame, type EngineImageCache, type RenderOptions } from "./engine";
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

  private rafHandle: number | null = null;
  private lastTs: number | null = null;

  private shapeScratch: { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } | null = null;

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
    this.doc = doc;
    const [inF, outF] = this.getBounds();
    this.currentFrame = this.direction === -1 ? outF : inF;
    this.state = "stopped";
    this.emit("ready");
    this.renderCurrentFrame();
  }

  setError(errors?: string[]): void {
    this.state = "error";
    this.emit("error", { errors });
  }

  private getBounds(): [number, number] {
    if (!this.doc) return [0, 0];
    if (this.segment) return this.segment;
    return [this.doc.ip, this.doc.op];
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
    this.state = "destroyed";
    this.doc = null;
    this.shapeScratch = null;
    this.listeners.clear();
  }

  togglePlay(): void {
    this.state === "playing" ? this.pause() : this.play();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setDirection(direction: 1 | -1): void {
    this.direction = direction;
  }

  setLoop(loop: boolean | number): void {
    this.loop = loop;
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
      const pct = parseFloat(value) / 100;
      frame = inF + (outF - inF) * pct;
    } else {
      frame = Number(value);
    }

    frame = Math.min(Math.max(frame, inF), outF);
    this.currentFrame = frame;
    this.renderCurrentFrame();
    this.emitFrameEvent();

    if (this.state !== "playing") {
    }
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
    const framesDelta = (dtMs / 1000) * fps * this.speed * this.direction;

    let next = this.currentFrame + framesDelta;

    const span = Math.max(1, outF - inF);
    const loopLimit =
      this.loop === true ? Infinity : this.loop === false ? 1 : Math.max(1, this.loop);

    if (this.mode === "bounce") {
      if (next >= outF) {
        if (this.direction === 1 && (this.loop === true || this.loopsCompleted < loopLimit - 0.5)) {
          this.direction = -1;
          next = outF - (next - outF);
          this.loopsCompleted += 0.5;
          this.emit("loop");
        } else {
          next = outF;
          this.finishPlayback();
        }
      } else if (next <= inF) {
        if (this.direction === -1 && (this.loop === true || this.loopsCompleted < loopLimit - 0.5)) {
          this.direction = 1;
          next = inF + (inF - next);
          this.loopsCompleted += 0.5;
          this.emit("loop");
        } else {
          next = inF;
          this.finishPlayback();
        }
      }
    } else {
      if (next >= outF && this.direction === 1) {
        if (this.loop === true || this.loopsCompleted < loopLimit - 1) {
          next = inF + ((next - outF) % span);
          this.loopsCompleted += 1;
          this.emit("loop");
        } else {
          next = outF;
          this.finishPlayback();
        }
      } else if (next <= inF && this.direction === -1) {
        if (this.loop === true || this.loopsCompleted < loopLimit - 1) {
          next = outF - ((inF - next) % span);
          this.loopsCompleted += 1;
          this.emit("loop");
        } else {
          next = inF;
          this.finishPlayback();
        }
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
