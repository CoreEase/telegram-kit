export type Mat4 = Float32Array;

export type V3 = [number, number, number];

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}

export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function scaling(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

export function fromQuat(x: number, y: number, z: number, w: number): Mat4 {
  const n = Math.hypot(x, y, z, w) || 1;
  x /= n;
  y /= n;
  z /= n;
  w /= n;
  const m = identity();
  m[0] = 1 - 2 * (y * y + z * z);
  m[1] = 2 * (x * y + z * w);
  m[2] = 2 * (x * z - y * w);
  m[4] = 2 * (x * y - z * w);
  m[5] = 1 - 2 * (x * x + z * z);
  m[6] = 2 * (y * z + x * w);
  m[8] = 2 * (x * z + y * w);
  m[9] = 2 * (y * z - x * w);
  m[10] = 1 - 2 * (x * x + y * y);
  return m;
}

export function rotX(a: number): Mat4 {
  const m = identity(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function rotY(a: number): Mat4 {
  const m = identity(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function rotZ(a: number): Mat4 {
  const m = identity(),
    c = Math.cos(a),
    s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export function euler(pitch: number, yaw: number, roll: number): Mat4 {
  return mul(rotX(pitch), mul(rotY(yaw), rotZ(roll)));
}

export function perspective(yFov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(yFov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function normalMatrix(m: Mat4): Float32Array {
  const n = new Float32Array(9);
  for (let c = 0; c < 3; c++) {
    const x = m[c * 4],
      y = m[c * 4 + 1],
      z = m[c * 4 + 2];
    const l = Math.hypot(x, y, z) || 1;
    n[c * 3] = x / l;
    n[c * 3 + 1] = y / l;
    n[c * 3 + 2] = z / l;
  }

  return n;
}

export function rotateByQuat(v: V3, q: number[]): V3 {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
}

export function normalize3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function rgb(hex: number): V3 {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}
