import type { EmitterManifest } from "./types";
import { normalize3, rotateByQuat, type V3 } from "./math";

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  size: number;
  intensity: number;
  phase: number;
  tint: [number, number, number];
}

export interface EmitterState extends EmitterManifest {
  enabled: boolean;
  color: V3;
  acc: number;
  dir: V3;
  particles: Particle[];
}

const rnd = () => Math.random();

const sym = () => rnd() * 2 - 1;

function spread(dir: V3, halfAngleDeg: number): V3 {
  const a = (halfAngleDeg * Math.PI) / 180;
  const cosT = 1 - rnd() * (1 - Math.cos(a));
  const sinT = Math.sqrt(1 - cosT * cosT);
  const phi = rnd() * Math.PI * 2;
  const up: V3 = Math.abs(dir[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let tx: V3 = [
    dir[1] * up[2] - dir[2] * up[1],
    dir[2] * up[0] - dir[0] * up[2],
    dir[0] * up[1] - dir[1] * up[0],
  ];
  tx = normalize3(tx);
  const ty: V3 = [
    dir[1] * tx[2] - dir[2] * tx[1],
    dir[2] * tx[0] - dir[0] * tx[2],
    dir[0] * tx[1] - dir[1] * tx[0],
  ];
  const cx = Math.cos(phi) * sinT,
    cy = Math.sin(phi) * sinT;
  return [
    dir[0] * cosT + tx[0] * cx + ty[0] * cy,
    dir[1] * cosT + tx[1] * cx + ty[1] * cy,
    dir[2] * cosT + tx[2] * cx + ty[2] * cy,
  ];
}

export class ParticleSystem {
  readonly emitters: EmitterState[];
  private gravity: V3;

  constructor(emitters: EmitterManifest[], gravity: number[] | null, defaultColor: V3) {
    this.gravity = (gravity ? [gravity[0], gravity[1], gravity[2]] : [0, 0, 0]) as V3;
    this.emitters = emitters.map((e) => ({
      ...e,
      enabled: !e.node.startsWith("coins_"),
      color: defaultColor,
      acc: 0,
      dir: normalize3(
        rotateByQuat(normalize3([e.direction[0], e.direction[1], e.direction[2]]), e.orientation),
      ),
      particles: [],
    }));
  }

  get(name: string): EmitterState | undefined {
    return this.emitters.find((e) => e.node === name);
  }

  private spawn(e: EmitterState) {
    const d = spread(e.dir, e.spreadingAngle * 0.5);
    const v = e.velocity * e.speedFactor;
    const lp = rotateByQuat(
      [sym() * 0.5 * (e.shapeWidth ?? 0), sym() * 0.5 * (e.shapeHeight ?? 0), 0],
      e.orientation,
    );
    e.particles.push({
      x: e.position[0] + lp[0],
      y: e.position[1] + lp[1],
      z: e.position[2] + lp[2],
      vx: d[0] * v,
      vy: d[1] * v,
      vz: d[2] * v,
      age: 0,
      life: Math.max(0.2, e.lifeSpan + sym() * e.lifeSpanVariation),
      size: Math.max(0.05, e.size + sym() * e.sizeVariation),
      intensity: Math.min(1, Math.max(0, e.intensity + sym() * e.intensityVariation)),
      phase: rnd() * Math.PI * 2,
      tint: [sym() * e.colorVariation[0], sym() * e.colorVariation[1], sym() * e.colorVariation[2]],
    });
  }

  step(dt: number) {
    for (const e of this.emitters) {
      if (e.enabled) {
        e.acc += e.birthRate * e.speedFactor * dt;
        while (e.acc >= 1) {
          e.acc -= 1;
          this.spawn(e);
        }
      }

      const g = e.gravity
        ? [this.gravity[0] * 0.2, this.gravity[1] * 0.2, this.gravity[2] * 0.2]
        : [0, 0, 0];
      const ps = e.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.age += dt * e.speedFactor;
        if (p.age >= p.life) {
          ps.splice(i, 1);
          continue;
        }

        p.vx += g[0] * dt;
        p.vy += g[1] * dt;
        p.vz += g[2] * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
    }
  }

  warmup(seconds: number) {
    const step = 1 / 30;
    for (let t = 0; t < seconds; t += step) this.step(step);
  }

  explode(strength = 2.2) {
    for (const e of this.emitters)
      for (const p of e.particles) {
        const l = Math.hypot(p.x, p.y) || 1;
        p.vx += (p.x / l) * strength;
        p.vy += (p.y / l) * strength;
      }
  }

  pack(out: Float32Array): number {
    let n = 0;
    const max = out.length / 8;
    for (const e of this.emitters)
      for (const p of e.particles) {
        if (n >= max) return n;
        const t = p.age / p.life;
        const fadeIn = Math.min(1, t / 0.15),
          fadeOut = Math.min(1, (1 - t) / 0.4);
        const a =
          Math.max(0, Math.min(fadeIn, fadeOut)) *
          p.intensity *
          (0.7 + 0.3 * Math.sin(p.phase + p.age * 5));
        const s =
          p.size * (0.55 + 0.45 * Math.min(1, t / 0.3)) * (1 - 0.25 * Math.max(0, (t - 0.6) / 0.4));
        const o = n * 8;
        out[o] = p.x;
        out[o + 1] = p.y;
        out[o + 2] = p.z;
        out[o + 3] = s;
        out[o + 4] = Math.min(1, Math.max(0, e.color[0] + p.tint[0]));
        out[o + 5] = Math.min(1, Math.max(0, e.color[1] + p.tint[1]));
        out[o + 6] = Math.min(1, Math.max(0, e.color[2] + p.tint[2]));
        out[o + 7] = a;
        n++;
      }
    return n;
  }
}
