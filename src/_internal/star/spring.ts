export class Spring {
  readonly beta: number;
  readonly wd: number;
  readonly settling: number;

  constructor(
    readonly mass = 1,
    readonly stiffness = 21,
    readonly damping = 5.8,
    readonly v0 = 0,
  ) {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    this.beta = zeta * w0;
    this.wd = w0 * Math.sqrt(Math.max(1e-6, 1 - zeta * zeta));
    this.settling = Math.log(1 / 0.001) / this.beta;
  }

  at(t: number): number {
    if (t <= 0) return 0;
    const e = Math.exp(-this.beta * t);
    return (
      1 - e * (Math.cos(this.wd * t) + ((this.beta - this.v0) / this.wd) * Math.sin(this.wd * t))
    );
  }
}

export const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 2);

export function rubberBand(offset: number, start = 0, range = 60, coefficient = 0.4): number {
  const banded = offset - start;
  return start + (1 - 1 / ((banded * coefficient) / range + 1)) * range;
}
