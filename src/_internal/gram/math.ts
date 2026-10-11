export type V2 = [number, number];
export type V3 = [number, number, number];
export type V4 = [number, number, number, number];
export type Mat4 = Float32Array;

export const PI = Math.PI;
export const fr = Math.fround;
export const saturate = (x: number) => Math.min(1, Math.max(0, x));
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = saturate((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const mixN = (a: number, b: number, t: number) => a + (b - a) * t;

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a: V3): V3 => {
  const l = len3(a);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};
export const dist3 = (a: V3, b: V3) => len3(sub3(a, b));
export const dist2sq3 = (a: V3, b: V3) => {
  const d = sub3(a, b);
  return dot3(d, d);
};
export const mix3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const mix4 = (a: V4, b: V4, t: number): V4 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  a[3] + (b[3] - a[3]) * t,
];

export const mix2 = (a: V2, b: V2, t: number): V2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function ieeeRemainder(x: number, y: number): number {
  const q = x / y;
  let n = Math.round(q);
  if (Math.abs(q - Math.trunc(q)) === 0.5) n = 2 * Math.round(q / 2);
  return x - n * y;
}

export const fmod = (x: number, y: number) => x % y;

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}
export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let row = 0; row < 4; row++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
      r[c * 4 + row] = s;
    }
  return r;
}
export function mat4Transpose(m: Mat4): Mat4 {
  const r = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) r[row * 4 + c] = m[c * 4 + row];
  return r;
}
export function mulMV(m: ArrayLike<number>, v: V4): V4 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

export const DiamondMath = {
  cameraDistance: 6,
  cameraScale: 0.948985,

  cameraW(z: number): number {
    return (1 - z / DiamondMath.cameraDistance) / DiamondMath.cameraScale;
  },
  cameraPoint(world: V4): V2 {
    const w = DiamondMath.cameraW(world[2]);
    return [world[0] / w, world[1] / w];
  },
  cameraRay(point: V2): { origin: V4; direction: V4 } {
    const s = DiamondMath.cameraScale, d = DiamondMath.cameraDistance;
    const dir = norm3([point[0] / s, point[1] / s, -d]);
    return { origin: [0, 0, d, 1], direction: [dir[0], dir[1], dir[2], 0] };
  },
  rotation(x: number, y: number): Mat4 {
    const cp = Math.cos(x), sp = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y);
    const rx = new Float32Array([1, 0, 0, 0, 0, cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1]);
    const ry = new Float32Array([cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1]);
    return mat4Mul(rx, ry);
  },
  projection(aspect: number, zoom: number, perspective = true): Mat4 {
    const halfHeight = (1.52 / zoom) * Math.max(1, 1 / Math.max(aspect, 0.01));
    const halfWidth = halfHeight * aspect;
    const m = new Float32Array(16);
    if (perspective) {
      const w0 = 1 / DiamondMath.cameraScale, wz = -w0 / DiamondMath.cameraDistance;
      const framing = 0.12 / halfHeight;
      m.set([1 / halfWidth, 0, 0, 0, 0, 1 / halfHeight, 0, 0, 0, framing * wz, -w0 / 6, wz, 0, framing * w0, 0.5 * w0, w0]);
    } else {
      m.set([1 / halfWidth, 0, 0, 0, 0, 1 / halfHeight, 0, 0, 0, 0, -1 / 12, 0, 0, 0.12 / halfHeight, 0.5, 1]);
    }
    return m;
  },
};
