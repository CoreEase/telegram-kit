import { makeBezierEasing } from "./bezierEasing";
import type {
  AnimatedProperty,
  LottieKeyframe,
  ShapeAnimKeyframe,
  ShapeKeyframeValue,
  ShapeProperty,
} from "./types";

const easingCache = new Map<string, (x: number) => number>();

function getEasing(
  ox: number,
  oy: number,
  ix: number,
  iy: number
): (x: number) => number {
  const key = `${ox}|${oy}|${ix}|${iy}`;
  let fn = easingCache.get(key);
  if (!fn) {
    fn = makeBezierEasing(ox, oy, ix, iy);
    easingCache.set(key, fn);
  }
  return fn;
}

function componentAt(v: number | number[] | undefined, idx: number): number {
  if (v == null) return 0.5;
  if (Array.isArray(v)) return v[idx] ?? v[0] ?? 0.5;
  return v;
}

export function getAnimatedValue(prop: AnimatedProperty | undefined, frame: number): number[] {
  if (!prop) return [0];

  if (prop.a === 0 || !Array.isArray(prop.k) || typeof prop.k[0] === "number") {
    const k = prop.k as number[] | number;
    return Array.isArray(k) ? k : [k];
  }

  const keyframes = prop.k as unknown as LottieKeyframe[];
  return sampleKeyframes(keyframes, frame);
}

function sampleKeyframes(keyframes: LottieKeyframe[], frame: number): number[] {
  if (keyframes.length === 0) return [0];
  if (frame <= keyframes[0].t) {
    return (keyframes[0].s as number[]) ?? [0];
  }

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.t) {
    return (last.s as number[]) ?? (keyframes[keyframes.length - 2]?.e as number[]) ?? [0];
  }

  for (let idx = 0; idx < keyframes.length - 1; idx++) {
    const kf = keyframes[idx];
    const next = keyframes[idx + 1];
    if (frame >= kf.t && frame < next.t) {
      const startVal = (kf.s as number[]) ?? [0];
      const endVal = (kf.e as number[]) ?? (next.s as number[]) ?? startVal;

      if (kf.h === 1) {
        return startVal; 
      }

      const span = next.t - kf.t;
      const linearT = span > 0 ? (frame - kf.t) / span : 0;

      const dims = Math.max(startVal.length, endVal.length);
      const out: number[] = new Array(dims);

      for (let d = 0; d < dims; d++) {
        const ox = componentAt(kf.o?.x, d);
        const oy = componentAt(kf.o?.y, d);
        const ix = componentAt(kf.i?.x, d);
        const iy = componentAt(kf.i?.y, d);
        const ease = getEasing(ox, oy, ix, iy);
        const easedT = ease(linearT);
        const s = startVal[d] ?? startVal[0] ?? 0;
        const e = endVal[d] ?? endVal[0] ?? s;
        out[d] = s + (e - s) * easedT;
      }

      return out;
    }
  }

  return (last.s as number[]) ?? [0];
}

export function getAnimatedPosition(
  prop: AnimatedProperty | undefined,
  frame: number
): number[] {
  if (!prop) return [0, 0, 0];

  if (prop.a === 0 || !Array.isArray(prop.k) || typeof prop.k[0] === "number") {
    const k = prop.k as number[] | number;
    return Array.isArray(k) ? k : [k, 0, 0];
  }

  const keyframes = prop.k as unknown as LottieKeyframe[];
  if (keyframes.length === 0) return [0, 0, 0];
  if (frame <= keyframes[0].t) return (keyframes[0].s as number[]) ?? [0, 0, 0];

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.t) return (last.s as number[]) ?? [0, 0, 0];

  for (let idx = 0; idx < keyframes.length - 1; idx++) {
    const kf = keyframes[idx];
    const next = keyframes[idx + 1];
    if (frame >= kf.t && frame < next.t) {
      const startVal = (kf.s as number[]) ?? [0, 0, 0];
      const endVal = (kf.e as number[]) ?? (next.s as number[]) ?? startVal;

      if (kf.h === 1) return startVal;

      const span = next.t - kf.t;
      const linearT = span > 0 ? (frame - kf.t) / span : 0;

      const ox = componentAt(kf.o?.x, 0);
      const oy = componentAt(kf.o?.y, 0);
      const ix = componentAt(kf.i?.x, 0);
      const iy = componentAt(kf.i?.y, 0);
      const easedT = getEasing(ox, oy, ix, iy)(linearT);

      if (kf.to && kf.ti) {
        const p0 = startVal;
        const p3 = endVal;
        const p1 = [p0[0] + kf.to[0], p0[1] + kf.to[1], (p0[2] ?? 0) + (kf.to[2] ?? 0)];
        const p2 = [p3[0] + kf.ti[0], p3[1] + kf.ti[1], (p3[2] ?? 0) + (kf.ti[2] ?? 0)];
        return cubicBezierPoint(p0, p1, p2, p3, easedT);
      }

      const dims = Math.max(startVal.length, endVal.length);
      const out: number[] = new Array(dims);
      for (let d = 0; d < dims; d++) {
        const s = startVal[d] ?? 0;
        const e = endVal[d] ?? s;
        out[d] = s + (e - s) * easedT;
      }
      return out;
    }
  }

  return (last.s as number[]) ?? [0, 0, 0];
}

function cubicBezierPoint(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  t: number
): number[] {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  const dims = Math.max(p0.length, p1.length, p2.length, p3.length);
  const out = new Array(dims);
  for (let i = 0; i < dims; i++) {
    out[i] =
      a * (p0[i] ?? 0) + b * (p1[i] ?? 0) + c * (p2[i] ?? 0) + d * (p3[i] ?? 0);
  }
  return out;
}

function lerpShapeValue(
  a: ShapeKeyframeValue,
  b: ShapeKeyframeValue,
  t: number
): ShapeKeyframeValue {
  const count = Math.min(a.v.length, b.v.length);
  const v: number[][] = new Array(count);
  const i: number[][] = new Array(count);
  const o: number[][] = new Array(count);

  for (let idx = 0; idx < count; idx++) {
    const av = a.v[idx] ?? [0, 0];
    const bv = b.v[idx] ?? av;
    const ai = a.i[idx] ?? [0, 0];
    const bi = b.i[idx] ?? ai;
    const ao = a.o[idx] ?? [0, 0];
    const bo = b.o[idx] ?? ao;
    v[idx] = [av[0] + (bv[0] - av[0]) * t, av[1] + (bv[1] - av[1]) * t];
    i[idx] = [ai[0] + (bi[0] - ai[0]) * t, ai[1] + (bi[1] - ai[1]) * t];
    o[idx] = [ao[0] + (bo[0] - ao[0]) * t, ao[1] + (bo[1] - ao[1]) * t];
  }

  return { c: a.c, v, i, o };
}

export function getAnimatedShape(
  prop: ShapeProperty | undefined,
  frame: number
): ShapeKeyframeValue {
  const empty: ShapeKeyframeValue = { c: false, v: [], i: [], o: [] };
  if (!prop) return empty;

  if (prop.a === 0) {
    return (prop.k as ShapeKeyframeValue) ?? empty;
  }

  const keyframes = prop.k as ShapeAnimKeyframe[];
  if (!keyframes || keyframes.length === 0) return empty;

  if (frame <= keyframes[0].t) return keyframes[0].s?.[0] ?? empty;

  const last = keyframes[keyframes.length - 1];
  if (frame >= last.t) return last.s?.[0] ?? empty;

  for (let idx = 0; idx < keyframes.length - 1; idx++) {
    const kf = keyframes[idx];
    const next = keyframes[idx + 1];
    if (frame >= kf.t && frame < next.t) {
      const startVal = kf.s?.[0] ?? empty;
      const endVal = kf.e?.[0] ?? next.s?.[0] ?? startVal;
      if (kf.h === 1) return startVal;

      const span = next.t - kf.t;
      const linearT = span > 0 ? (frame - kf.t) / span : 0;
      const ox = componentAt(kf.o?.x, 0);
      const oy = componentAt(kf.o?.y, 0);
      const ix = componentAt(kf.i?.x, 0);
      const iy = componentAt(kf.i?.y, 0);
      const easedT = getEasing(ox, oy, ix, iy)(linearT);

      return lerpShapeValue(startVal, endVal, easedT);
    }
  }

  return last.s?.[0] ?? empty;
}
