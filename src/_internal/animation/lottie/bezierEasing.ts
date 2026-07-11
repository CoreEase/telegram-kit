function A(a1: number, a2: number) {
  return 1.0 - 3.0 * a2 + 3.0 * a1;
}
function B(a1: number, a2: number) {
  return 3.0 * a2 - 6.0 * a1;
}
function C(a1: number) {
  return 3.0 * a1;
}

function calcBezier(t: number, a1: number, a2: number): number {
  return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
}

function getSlope(t: number, a1: number, a2: number): number {
  return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
}

export function makeBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): (x: number) => number {
  if (x1 === y1 && x2 === y2) {
    return (x: number) => x; 
  }

  const clampedX1 = Math.min(Math.max(x1, 0), 1);
  const clampedX2 = Math.min(Math.max(x2, 0), 1);

  function getTForX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentSlope = getSlope(t, clampedX1, clampedX2);
      if (currentSlope === 0) break;
      const currentX = calcBezier(t, clampedX1, clampedX2) - x;
      t -= currentX / currentSlope;
    }

    let lower = 0;
    let upper = 1;
    let candidate = t;
    if (candidate < 0 || candidate > 1 || isNaN(candidate)) {
      candidate = x;
      for (let i = 0; i < 20; i++) {
        const currentX = calcBezier(candidate, clampedX1, clampedX2);
        if (Math.abs(currentX - x) < 1e-6) break;
        if (currentX < x) {
          lower = candidate;
        } else {
          upper = candidate;
        }
        candidate = (lower + upper) / 2;
      }
    }
    return candidate;
  }

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const t = getTForX(x);
    return calcBezier(t, y1, y2);
  };
}
