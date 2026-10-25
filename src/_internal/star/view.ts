import { StarLayer, type StarVariant } from "./layer";

export class StarView {
  readonly element: HTMLDivElement;
  readonly layer: StarLayer;
  private pointerId: number | null = null;

  private start: {
    x: number;
    y: number;
  } | null = null;

  private samples: {
    x: number;
    t: number;
  }[] = [];
  private panning = false;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private mq: MediaQueryList | null = null;
  private visible = true;
  private reduce: "auto" | boolean = "auto";
  private static readonly slop = 10;

  constructor(mount: HTMLElement, variant: StarVariant) {
    this.element = document.createElement("div");
    this.element.style.cssText =
      "position:relative;width:100%;height:100%;overflow:visible;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;";
    this.element.setAttribute("aria-hidden", "true");
    mount.appendChild(this.element);
    this.layer = new StarLayer(variant);
    this.element.appendChild(this.layer.canvas);
    const el = this.element;
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointercancel", this.onCancel);
    this.ro = new ResizeObserver(() => this.layer.resize(el.clientWidth, el.clientHeight));
    this.ro.observe(el);
    this.layer.resize(el.clientWidth, el.clientHeight);
    this.io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          this.visible = e.isIntersecting;
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

    this.onReduce();
  }

  private enabled = true;

  setActive(v: boolean) {
    this.enabled = v;
    this.sync();
  }

  private sync() {
    this.layer.isInHierarchy = this.visible && this.enabled && this.element.isConnected;
  }
  setReduceMotionMode(m: "auto" | boolean) {
    this.reduce = m;
    this.onReduce();
  }

  private onReduce = () =>
    this.layer.setReduceMotion(this.reduce === "auto" ? !!this.mq?.matches : this.reduce);

  dispose() {
    this.io.disconnect();
    this.ro.disconnect();
    this.mq?.removeEventListener?.("change", this.onReduce);
    this.layer.dispose();
    this.element.remove();
  }

  private rel(e: PointerEvent) {
    const r = this.element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    this.pointerId = e.pointerId;
    try {
      this.element.setPointerCapture(e.pointerId);
    } catch {}
    const p = this.rel(e);
    this.start = { x: p.x, y: p.y };
    this.panning = false;
    this.samples = [{ x: p.x, t: performance.now() / 1000 }];
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId || !this.start) return;
    const p = this.rel(e),
      t = performance.now() / 1000;
    this.samples.push({ x: p.x, t });
    while (this.samples.length > 2 && this.samples[0].t < t - 0.1) this.samples.shift();
    const dx = p.x - this.start.x,
      dy = p.y - this.start.y;
    if (!this.panning) {
      if (Math.hypot(dx, dy) < StarView.slop) return;
      this.panning = true;
      this.layer.dragBegan();
    }

    this.layer.dragChanged(dx, dy);
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    const p = this.rel(e);
    if (this.panning) {
      const a = this.samples[0],
        b = this.samples[this.samples.length - 1];
      const vx = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0;
      this.layer.dragEnded(vx);
    } else {
      this.layer.tap(p.x - p.w / 2, p.y - p.h / 2);
    }

    this.reset(e);
  };

  private onCancel = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.panning) this.layer.dragEnded(0);
    this.reset(e);
  };

  private reset(e: PointerEvent) {
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {}
    this.pointerId = null;
    this.start = null;
    this.panning = false;
    this.samples = [];
  }
}
