export type Mat2D = [number, number, number, number, number, number];

export function identity(): Mat2D {
  return [1, 0, 0, 1, 0, 0];
}

export function multiply(m1: Mat2D, m2: Mat2D): Mat2D {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function translate(m: Mat2D, x: number, y: number): Mat2D {
  return multiply(m, [1, 0, 0, 1, x, y]);
}

export function rotate(m: Mat2D, radians: number): Mat2D {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return multiply(m, [c, s, -s, c, 0, 0]);
}

export function scale(m: Mat2D, sx: number, sy: number): Mat2D {
  return multiply(m, [sx, 0, 0, sy, 0, 0]);
}

export function skew(m: Mat2D, skewDeg: number, skewAxisDeg: number): Mat2D {
  if (!skewDeg) return m;
  const axis = (skewAxisDeg * Math.PI) / 180;
  const angle = (-skewDeg * Math.PI) / 180;
  const sMat = multiply(
    [Math.cos(axis), Math.sin(axis), -Math.sin(axis), Math.cos(axis), 0, 0],
    [1, 0, Math.tan(angle), 1, 0, 0]
  );
  const back: Mat2D = [
    Math.cos(-axis),
    Math.sin(-axis),
    -Math.sin(-axis),
    Math.cos(-axis),
    0,
    0,
  ];
  return multiply(m, multiply(sMat, back));
}

export function applyToPoint(m: Mat2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
