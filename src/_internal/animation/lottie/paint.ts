import { getAnimatedValue } from "./interpolate";
import type {
  GradientColor,
  ShapeFillItem,
  ShapeGradientFillItem,
  ShapeGradientStrokeItem,
  ShapeStrokeItem,
} from "./types";
import { type Mat2D, applyToPoint } from "./matrix";

export function colorToCss(rgb: number[], opacity01: number): string {
  const r = Math.round((rgb[0] ?? 0) * (rgb[0] <= 1 ? 255 : 1));
  const g = Math.round((rgb[1] ?? 0) * (rgb[1] <= 1 ? 255 : 1));
  const b = Math.round((rgb[2] ?? 0) * (rgb[2] <= 1 ? 255 : 1));
  const a = (rgb[3] !== undefined ? rgb[3] : 1) * opacity01;
  return `rgba(${clamp255(r)}, ${clamp255(g)}, ${clamp255(b)}, ${clampAlpha(a)})`;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}
function clampAlpha(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseGradientStops(
  g: GradientColor,
  frame: number
): Array<{ offset: number; r: number; g: number; b: number; a: number }> {
  const flat = getAnimatedValue(g.k, frame);
  const stopCount = g.p;
  const stops: Array<{ offset: number; r: number; g: number; b: number; a: number }> = [];

  for (let i = 0; i < stopCount; i++) {
    const base = i * 4;
    stops.push({
      offset: flat[base] ?? i / Math.max(1, stopCount - 1),
      r: (flat[base + 1] ?? 0) * 255,
      g: (flat[base + 2] ?? 0) * 255,
      b: (flat[base + 3] ?? 0) * 255,
      a: 1,
    });
  }

  const alphaStart = stopCount * 4;
  if (flat.length > alphaStart) {
    const alphaCount = (flat.length - alphaStart) / 2;
    for (let i = 0; i < alphaCount; i++) {
      const base = alphaStart + i * 2;
      const offset = flat[base];
      const alpha = flat[base + 1];
      let nearest = stops[0];
      let nearestDist = Infinity;
      for (const s of stops) {
        const dist = Math.abs(s.offset - offset);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = s;
        }
      }
      if (nearest) nearest.a = alpha;
    }
  }

  return stops;
}

export function buildGradient(
  ctx: CanvasRenderingContext2D,
  item: ShapeGradientFillItem | ShapeGradientStrokeItem,
  frame: number,
  m: Mat2D,
  opacity01: number
): CanvasGradient {
  const start = getAnimatedValue(item.s, frame);
  const end = getAnimatedValue(item.e, frame);
  const [sx, sy] = applyToPoint(m, start[0] ?? 0, start[1] ?? 0);
  const [ex, ey] = applyToPoint(m, end[0] ?? 0, end[1] ?? 0);

  let gradient: CanvasGradient;
  if (item.t === 2) {
    const radius = Math.hypot(ex - sx, ey - sy) || 1;
    gradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
  } else {
    gradient = ctx.createLinearGradient(sx, sy, ex, ey);
  }

  const stops = parseGradientStops(item.g, frame);
  for (const stop of stops) {
    gradient.addColorStop(
      Math.max(0, Math.min(1, stop.offset)),
      `rgba(${clamp255(stop.r)}, ${clamp255(stop.g)}, ${clamp255(stop.b)}, ${clampAlpha(
        stop.a * opacity01
      )})`
    );
  }
  return gradient;
}

const LINE_CAP: CanvasLineCap[] = ["butt", "round", "square"];
const LINE_JOIN: CanvasLineJoin[] = ["miter", "round", "bevel"];

export function applyStrokeStyle(
  ctx: CanvasRenderingContext2D,
  item: ShapeStrokeItem | ShapeGradientStrokeItem,
  frame: number,
  m: Mat2D
): void {
  const widthArr = getAnimatedValue(item.w, frame);
  const scaleFactor = Math.hypot(m[0], m[1]);
  ctx.lineWidth = Math.max(0, (widthArr[0] ?? 1) * scaleFactor);
  ctx.lineCap = LINE_CAP[(item.lc ?? 2) - 1] ?? "round";
  ctx.lineJoin = LINE_JOIN[(item.lj ?? 2) - 1] ?? "round";
  ctx.miterLimit = item.ml ?? 4;

  if (item.d && item.d.length > 0) {
    const dashArr: number[] = [];
    let dashOffset = 0;
    for (const d of item.d) {
      const val = getAnimatedValue(d.v, frame)[0] ?? 0;
      if (d.n === "o") {
        dashOffset = val * scaleFactor;
      } else {
        dashArr.push(val * scaleFactor);
      }
    }
    ctx.setLineDash(dashArr.length > 0 ? dashArr : []);
    ctx.lineDashOffset = dashOffset;
  } else {
    ctx.setLineDash([]);
  }
}
