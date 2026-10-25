import { V2, V4, Mat4, mulMV, mixN, mix4, mix2, fmod, saturate } from "./math";

export enum Appearance {
  blue = 0,
  white = 1,
  cool = 2,
}
export type AnimationMode = "continuous" | "reference" | "entrance";
export type TransferPhase = "sending" | "receiving" | "completion";

export class DiamondTransferAnimation {
  static completionDuration = 1.8;
  constructor(
    public phase: TransferPhase,
    public startTime: number,
  ) {}

  presentation(time: number): { energy: number; scale: number; offset: number } {
    const t = Math.max(0, time - this.startTime);
    let energy: number, hit: number, breath: number, blow: number;
    if (this.phase === "sending" || this.phase === "receiving") {
      energy = Math.pow(Math.min(t / 0.45, 1), 0.65);
      hit =
        this.phase === "sending" && t < 0.42
          ? Math.sin((Math.PI * t) / 0.42) * (1 - (0.3 * t) / 0.42)
          : 0;
      breath = Math.sin(2 * Math.PI * 1.1 * t);
      blow = 0;
    } else {
      energy = Math.pow(1 - Math.min(t / 0.7, 1), 2.2);
      hit = 0;
      breath = 0;
      blow = t < 0.9 ? Math.sin(2 * Math.PI * 1.6 * t) * Math.exp(-t / 0.2) : 0;
    }
    const offset =
      this.phase !== "completion" ? -1.6 * energy * Math.sin(2 * Math.PI * 1.1 * (t - 0.18)) : 0;
    return { energy, scale: 1 + 0.32 * hit + 0.07 * energy * breath + blow, offset };
  }
}

export class DiamondStarBurst {
  static lifetime = 6.4;
  constructor(
    public startTime: number,
    public seed: number,
    public isFromTap = false,
  ) {}
}

export const DiamondEntrance = {
  spinBoost: 12.6,
  spinDecay: 0.95 / 1.4,
  steadyStarCount: 240,
  burstStarCount: 144,
  extraAngle(time: number): number {
    return (
      DiamondEntrance.spinBoost *
      DiamondEntrance.spinDecay *
      (1 - Math.exp(-Math.max(0, time) / DiamondEntrance.spinDecay))
    );
  },
  angularTravel(start: number, end: number, speed: number): number {
    if (speed === 0) return 0;
    return (
      speed * Math.max(0, end - start) +
      (speed > 0 ? 1 : -1) * (DiamondEntrance.extraAngle(end) - DiamondEntrance.extraAngle(start))
    );
  },
  highlightTime(time: number, entrance: boolean): number {
    const t = Math.max(0, time);
    return entrance
      ? t + 4 * DiamondEntrance.spinDecay * (1 - Math.exp(-t / DiamondEntrance.spinDecay))
      : t;
  },
  particleTime(time: number, entrance: boolean): number {
    const t = Math.max(0, time);
    return entrance ? t + 2.2 * (1 - Math.exp(-t)) : t;
  },
};

export function easing(progress: number, out: V2, into: V2): number {
  const x = Math.min(1, Math.max(0, progress));
  if (x === 0 || x === 1) return x;
  let low = 0,
    high = 1;
  for (let i = 0; i < 18; i++) {
    const t = (low + high) * 0.5,
      s = 1 - t;
    const bx = 3 * s * s * t * out[0] + 3 * s * t * t * into[0] + t * t * t;
    if (bx < x) low = t;
    else high = t;
  }
  const t = (low + high) * 0.5,
    s = 1 - t;
  return 3 * s * s * t * out[1] + 3 * s * t * t * into[1] + t * t * t;
}

const smoothstep01 = (v: number) => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

export interface LightState {
  crown: V4;
  pavilion: V4;
  sweep: V4;
  crownSweep: V4;
  rightCrownSweep: V4;
  leftCrownSweep: V4;
  pavilionSweep: V4;
  rightPavilionSweep: V4;
  leftPavilionSweep: V4;
}

export const DiamondLightAnimation = {
  facetSweepSpeed: 0.5,
  state(time: number): LightState {
    const frame = fmod(Math.max(0, time * 60), 180);
    const sweepFrame = fmod(Math.max(0, time * 60 * DiamondLightAnimation.facetSweepSpeed), 180);
    const times = [0, 39, 99, 179];
    const crown: V4[] = [
      [-53.8, 112.9, 50.5, -54.2],
      [12, 53.4, 143.3, -112.9],
      [-126.9, 168.8, 190.3, -192.8],
      [-53.8, 112.9, 50.5, -54.2],
    ];
    const pavilion: V4[] = [
      [-53.8, 80.7, 10.8, -165.2],
      [-34.2, 23.1, 104.6, -191],
      [-147.9, 125.5, -9.9, -106.1],
      [-53.8, 80.7, 10.8, -165.2],
    ];
    const sweep = [-0.05, 0.84, -0.88, -0.05];
    const segment = frame < 39 ? 0 : frame < 99 ? 1 : 2;
    const progress = Math.min(
      1,
      Math.max(0, (frame - times[segment]) / (times[segment + 1] - times[segment])),
    );
    const t = lightEasing(progress);
    let transmission: number;
    if (frame < 25) transmission = (0.45 * frame) / 25;
    else if (frame < 142) transmission = 0.45;
    else transmission = 0.45 * Math.max(0, (166 - frame) / 24);
    return {
      crown: mix4(crown[segment], crown[segment + 1], t),
      pavilion: mix4(pavilion[segment], pavilion[segment + 1], t),
      sweep: [
        sweep[segment] + (sweep[segment + 1] - sweep[segment]) * t,
        (frame / 180) * 2 * Math.PI,
        transmission,
        0,
      ],
      crownSweep: facetSweep(sweepFrame, [11, 49, 127, 179]),
      rightCrownSweep: facetSweep(sweepFrame, [6, 44, 88]),
      leftCrownSweep: facetSweep(sweepFrame, [0, 38, 118, 167]),
      pavilionSweep: facetSweep(sweepFrame, [0, 38, 103, 163]),
      rightPavilionSweep: facetSweep(sweepFrame, [5, 43, 92]),
      leftPavilionSweep: facetSweep(sweepFrame, [0, 38, 112, 168]),
    };
  },
};

function facetSweep(frame: number, times: number[]): V4 {
  const a: V4 = [-115.8, 40.3, -279.3, 240.6];
  const b: V4 = [317, -341.9, 188, -131.9];
  for (let i = 1; i < times.length; i++) {
    if (frame < times[i]) {
      const progress = (frame - times[i - 1]) / (times[i] - times[i - 1]);
      const t = easing(progress, [0.333, 0], [0.667, 1]);
      return i % 2 === 1 ? mix4(a, b, t) : mix4(b, a, t);
    }
  }
  return times.length % 2 === 0 ? b : a;
}

function lightEasing(x: number): number {
  if (x === 0 || x === 1) return x;
  let low = 0,
    high = 1;
  for (let i = 0; i < 16; i++) {
    const t = (low + high) * 0.5,
      s = 1 - t;
    const bx = 1.5 * s * s * t + 1.5 * s * t * t + t * t * t;
    if (bx < x) low = t;
    else high = t;
  }
  const t = (low + high) * 0.5;
  return t * t * (3 - 2 * t);
}

export interface Key {
  frame: number;
  value: number;
  out?: V2;
  into?: V2;
}
export interface ReferenceEvent {
  frame: number;
  position: V2;
  peakScale: number;
  riseY: number;
  decayY: number;
}
export interface Streak {
  center: V2;
  axisX: V2;
  axisY: V2;
  opacity: number;
}

const ev = (
  frame: number,
  x: number,
  y: number,
  peakScale = 0.632,
  riseY = 0.167,
  decayY = 0.72,
): ReferenceEvent => ({ frame, position: [x, y], peakScale, riseY, decayY });
const K = (frame: number, value: number, out?: V2, into?: V2): Key => ({ frame, value, out, into });
const A: V2 = [0.167, 0.167],
  B: V2 = [0.833, 0.833],
  L: V2 = [0.333, 0],
  M: V2 = [0.667, 1];

export const DiamondReferenceHighlights = {
  lastFrameTime: 179.0 / 60.0,

  frame(time: number, appearance: Appearance = Appearance.blue): number {
    const f = fmod(Math.max(0, time * 60), 180);
    return appearance === Appearance.white ? (f * 121) / 180 : f;
  },
  eventsFor(appearance: Appearance): ReferenceEvent[] {
    return appearance === Appearance.white ? whiteEvents : blueEvents;
  },
  eventScale(
    event: ReferenceEvent,
    time: number,
    appearance: Appearance = Appearance.blue,
  ): number {
    const age = DiamondReferenceHighlights.frame(time, appearance) - event.frame;
    if (!(age > 0 && age < 14)) return 0;
    const envelope =
      age < 2
        ? easing(age / 2, [0.167, event.riseY], [0.5, 1])
        : 1 - easing((age - 2) / 12, [0.347, 0], [0.823, event.decayY]);
    return (event.peakScale / 0.75) * envelope;
  },
  sample(keys: Key[], frame: number): number {
    if (!(frame > keys[0].frame)) return keys[0].value;
    for (let i = 1; i < keys.length; i++) {
      if (frame < keys[i].frame) {
        const a = keys[i - 1],
          b = keys[i];
        const t = easing((frame - a.frame) / (b.frame - a.frame), a.out ?? L, a.into ?? M);
        return a.value + (b.value - a.value) * t;
      }
    }
    return keys[keys.length - 1].value;
  },
  facetFlashes(time: number): { crown: V4; pavilion: V4 } {
    const frame = DiamondReferenceHighlights.frame(time, Appearance.white);
    const crown: V4 = [0, 0, 0, 0],
      pavilion: V4 = [0, 0, 0, 0];
    for (const flash of whiteFacetFlashes) {
      const alpha = DiamondReferenceHighlights.sample(flash.opacity, frame) * 0.55;
      const c = flash.region % 3;
      if (flash.region < 3) pavilion[c] = 1 - (1 - pavilion[c]) * (1 - alpha);
      else crown[c] = 1 - (1 - crown[c]) * (1 - alpha);
    }
    return { crown, pavilion };
  },
  streaks(time: number, appearance: Appearance = Appearance.blue): Streak[] {
    const frame = DiamondReferenceHighlights.frame(time, appearance);
    const rotate = (p: V2, degrees: number): V2 => {
      const r = (degrees * Math.PI) / 180;
      return [Math.cos(r) * p[0] - Math.sin(r) * p[1], Math.sin(r) * p[0] + Math.cos(r) * p[1]];
    };
    const make = (
      innerPosition: V2,
      innerScale: V2,
      innerAngle: number,
      outerPosition: V2,
      outerAngle: number,
      layerPosition: V2,
      layerAnchor: V2,
      opacity = 0.4,
      layerScale = 0.75,
    ): Streak => {
      const g: V2 = [-3.2 * innerScale[0], -84.1 * innerScale[1]];
      const gr = rotate(g, innerAngle);
      const center = rotate([innerPosition[0] + gr[0], innerPosition[1] + gr[1]], outerAngle);
      const ax = rotate([innerScale[0], 0], innerAngle + outerAngle);
      const ay = rotate([0, innerScale[1]], innerAngle + outerAngle);
      return {
        center: [
          layerPosition[0] + layerScale * (outerPosition[0] + center[0] - layerAnchor[0]),
          layerPosition[1] + layerScale * (outerPosition[1] + center[1] - layerAnchor[1]),
        ],
        axisX: [ax[0] * layerScale, ax[1] * layerScale],
        axisY: [ay[0] * layerScale, ay[1] * layerScale],
        opacity,
      };
    };
    if (appearance === Appearance.white) {
      const sway = easing(frame < 59 ? frame / 59 : (120 - frame) / 61, [0.5, 0], [0.5, 1]);
      const top = make(
        [-30.026, 1.203],
        [0.07139, 0.418],
        90,
        [287.292, 106.248],
        0,
        [238.031, 256.411],
        [238.031, 256.411],
      );
      const left = make(
        [-30.026 + 14.441 * sway, 1.203 + 34.194 * sway],
        [0.07139, 0.768],
        90 - 8.804 * sway,
        [158.649, 298.438],
        60.525,
        [238.031, 256.411],
        [238.031, 256.411],
      );
      const sweep = make(
        [-30.026, 1.203],
        [0.07139, 0.418],
        90,
        [297.292, 106.248],
        0,
        [311.829 - 166 * Math.min(1, Math.max(0, (frame - 12.066) / 73.934)), 244.564],
        [303.096, 107.282],
        0.4 * DiamondReferenceHighlights.sample(whiteStreakOpacity, frame),
        DiamondReferenceHighlights.sample(whiteStreakScale, frame),
      );
      return [top, left, sweep];
    }
    const times = [0, 39, 69, 99, 179];
    const positions: V2[] = [
      [-30, 1.2],
      [-31.3, 24.4],
      [-30, 1.2],
      [4, -39.6],
      [-30, 1.2],
    ];
    const angles = [90, 82.9, 82.9, 100.6, 90];
    const segment = frame < 39 ? 0 : frame < 69 ? 1 : frame < 99 ? 2 : 3;
    const progress = (frame - times[segment]) / (times[segment + 1] - times[segment]);
    const out: V2 = segment === 2 ? [0.167, 0.167] : [0.5, 0];
    const into: V2 = segment === 1 ? [0.833, 0.833] : [0.5, 1];
    const t = easing(progress, out, into);
    const position = mix2(positions[segment], positions[segment + 1], t);
    const rotationT = easing(progress, out, segment === 1 ? [0.833, 1] : into);
    const angle = angles[segment] + (angles[segment + 1] - angles[segment]) * rotationT;
    const top = make([-30, 1.2], [0.071, 0.418], 90, [297.3, 106.2], 0, [238, 256.4], [238, 256.4]);
    const left = make(
      position,
      [0.071, 0.768],
      angle,
      [158.6, 298.4],
      60.5,
      [238, 256.4],
      [238, 256.4],
    );
    const opacity =
      Math.min(1, Math.max(0, (frame - 18) / 12)) * Math.min(1, Math.max(0, (117 - frame) / 13));
    const sweep = make(
      [-30, 1.2],
      [0.071, 0.418],
      90,
      [297.3, 106.2],
      0,
      [181.8 + 160 * Math.min(1, Math.max(0, (frame - 18) / 99)), 244.6],
      [303.1, 107.3],
      opacity * 0.4,
    );
    return [top, left, sweep];
  },
};

const whiteMainScale: Key[] = [
  K(0, 1, L, B),
  K(22.123, 0, [0.167, 0], [0.833, 1]),
  K(83, 0, [0.41, 0], [0.12, 1]),
  K(120, 1),
];
const whiteMorph: Key[] = [K(0, 0, A, B), K(12, 1, A, B), K(102, 1, A, [0.4, 1]), K(120, 0)];
const whiteCoreScale: Key[] = [
  K(0, 1, L, M),
  K(12.066, 1, L, M),
  K(23.463, 0.8, L, M),
  K(33.52, 1, L, M),
  K(43.576, 0.8, L, M),
  K(60.336, 1, L, M),
  K(70.391, 0.8, L, M),
  K(80.447, 1, L, M),
  K(90.502, 0.8, L, M),
  K(114.637, 1),
];
const whiteHaloScale: Key[] = [
  K(5.363, 1, L, M),
  K(17.43, 1, L, M),
  K(28.826, 0.8, L, M),
  K(38.883, 1, L, M),
  K(48.939, 0.8, L, M),
  K(65.699, 1, L, M),
  K(75.754, 0.8, L, M),
  K(85.811, 1, L, M),
  K(95.865, 0.8, L, M),
  K(120, 1),
];
const whiteStreakOpacity: Key[] = [
  K(12.066, 0, A, B),
  K(20.781, 1, A, B),
  K(70.391, 1, A, B),
  K(86, 0),
];
const whiteStreakScale: Key[] = [
  K(12, 0, A, B),
  K(26, 0.75, A, B),
  K(65, 0.75, A, B),
  K(85.5645, 0),
];
const whiteEvents: ReferenceEvent[] = [
  ev(33, 219.694, 280.654, 0.63197, 0.167, 0.72),
  ev(52, 332.694, 196.654, 0.75, 0.141, 0.764),
  ev(70, 358.694, 279.654, 0.55, 0.192, 0.678),
];
const FL: V2 = [1, 0],
  FI: V2 = [0, 1];
const flash = (region: number, f: number): { region: number; opacity: Key[] } => ({
  region,
  opacity: [K(f, 0, FL, FI), K(f + 6, 0.77, FL, FI), K(f + 13, 0)],
});
const whiteFacetFlashes = [
  flash(0, 38),
  flash(1, 20),
  flash(2, 39),
  flash(4, 55),
  flash(5, 33),
  flash(0, 31),
  flash(1, 47),
  flash(2, 18),
  flash(4, 82),
  flash(5, 60),
];
const blueEvents: ReferenceEvent[] = [
  ev(7, 242.7, 357.7),
  ev(15, 166.7, 233.7),
  ev(21, 322.7, 173.7),
  ev(27, 392.7, 228.7),
  ev(33, 144.7, 238.7),
  ev(41, 209.7, 364.7),
  ev(47, 365.7, 249.7),
  ev(52, 338.7, 152.7),
  ev(58, 198.7, 246.7),
  ev(64, 123.7, 210.7),
  ev(70, 303.7, 336.7),
  ev(77, 385.7, 211.7),
  ev(83, 153.7, 253.7),
  ev(91, 139.7, 305.7),
  ev(97, 309.7, 313.7),
  ev(105, 379.7, 211.7),
  ev(111, 224.7, 204.7),
  ev(119, 158.7, 277.7),
  ev(126, 323.7, 302.7),
];

export interface SparkleState {
  shape: V4;
  haloScale: number;
}

function groupScale(frame: number): number {
  const times = [0, 18, 35, 50, 65, 90, 105, 120, 135, 171];
  const values = [1, 1, 0.8, 1, 0.8, 1, 0.8, 1, 0.8, 1];
  for (let i = 1; i < times.length; i++) {
    if (frame < times[i]) {
      const t = easing((frame - times[i - 1]) / (times[i] - times[i - 1]), [0.333, 0], [0.667, 1]);
      return values[i - 1] + (values[i] - values[i - 1]) * t;
    }
  }
  return 1;
}

export const DiamondSparkleAnimation = {
  easing,
  smoothstep: smoothstep01,
  state(time: number, appearance: Appearance = Appearance.blue): SparkleState {
    const frame = DiamondReferenceHighlights.frame(time, appearance);
    if (appearance === Appearance.white) {
      const h = DiamondReferenceHighlights;
      return {
        shape: [
          h.sample(whiteMainScale, frame),
          h.sample(whiteMorph, frame),
          h.sample(whiteCoreScale, frame),
          1,
        ],
        haloScale: h.sample(whiteHaloScale, frame),
      };
    }
    let scale: number;
    if (frame < 33) scale = 1 - easing(frame / 33, [0.333, 0], [0.833, 0.833]);
    else if (frame < 129) scale = 0;
    else scale = easing((frame - 129) / 50, [0.167, 0.167], [0.4, 1]);
    let morph: number;
    if (frame < 18) morph = easing(frame / 18, [0.167, 0.167], [0.667, 1]);
    else if (frame < 151) morph = 1;
    else morph = 1 - easing((frame - 151) / 28, [0.167, 0.167], [0.4, 1]);
    return {
      shape: [scale, morph, groupScale(frame), groupScale(frame - 4)],
      haloScale: groupScale(frame - 8),
    };
  },
  mainPlacement(
    model: Mat4,
    angularSpeed = 0,
    rotationTriggered = false,
  ): { faceRotation: number; visibility: number } {
    const pitch = DiamondMotion.referencePitch;
    const referenceFront: V4 = [0, -Math.sin(pitch), Math.cos(pitch), 0];
    let bestFacing = -1,
      faceAngle = 0;
    for (let face = 0; face < 4; face++) {
      const angle = (face * Math.PI) / 2;
      const f = mulMV(model, [Math.sin(angle), 0, Math.cos(angle), 0]);
      const facing =
        f[0] * referenceFront[0] +
        f[1] * referenceFront[1] +
        f[2] * referenceFront[2] +
        f[3] * referenceFront[3];
      if (facing > bestFacing) {
        bestFacing = facing;
        faceAngle = angle;
      }
    }
    if (rotationTriggered) return { faceRotation: faceAngle, visibility: 1 };
    const limit = (Math.PI * 12) / 180;
    const angle = Math.acos(Math.min(1, Math.max(-1, bestFacing)));
    const facing = smoothstep01(1 - angle / limit);
    const crossingDuration = (2 * limit) / Math.max(Math.abs(angularSpeed), 0.001);
    const duration = smoothstep01((crossingDuration - 0.06) / 0.34);
    return { faceRotation: faceAngle, visibility: facing * duration };
  },
};

export class RotationPulse {
  private static rotationInterval = Math.PI;
  private static probability = 0.6;
  private static highSpeedThreshold = 2 * Math.PI;
  private static highSpeedProbability = 0.05;
  private static rise = 0.08;
  private static duration = RotationPulse.rise + 33.0 / 60.0;
  private rotation = 0;
  private age = 0;
  private from: SparkleState = { shape: [0, 0, 0, 0], haloScale: 1 };
  clone(): RotationPulse {
    const c = new RotationPulse();
    c.rotation = this.rotation;
    c.age = this.age;
    c.from = { shape: [...this.from.shape] as V4, haloScale: this.from.haloScale };
    return c;
  }
  get state(): SparkleState {
    if (!(this.age < RotationPulse.duration)) return { shape: [0, 0, 0, 0], haloScale: 1 };
    if (this.age < RotationPulse.rise) {
      const t = smoothstep01(this.age / RotationPulse.rise);
      const peak = DiamondSparkleAnimation.state(0);
      return {
        shape: mix4(this.from.shape, peak.shape, t),
        haloScale: this.from.haloScale + (peak.haloScale - this.from.haloScale) * t,
      };
    }
    return DiamondSparkleAnimation.state(Math.min(33.0 / 60.0, this.age - RotationPulse.rise));
  }
  advance(rotation: number, dt: number) {
    this.age = Math.min(RotationPulse.duration, this.age + dt);
    this.rotation += Math.abs(rotation);
    const speed = dt > 0 ? Math.abs(rotation) / dt : 0;
    const probability =
      speed >= RotationPulse.highSpeedThreshold
        ? RotationPulse.highSpeedProbability
        : RotationPulse.probability;
    while (this.rotation >= RotationPulse.rotationInterval) {
      this.rotation -= RotationPulse.rotationInterval;
      if (Math.random() < probability && this.age >= RotationPulse.rise) {
        this.from = this.state;
        this.age = 0;
      }
    }
  }
}

class TapRotation {
  constructor(
    public velocity: number,
    public boost: number,
    public readonly decayTime: number,
    public readonly responseTime: number,
    public readonly isFast: boolean,
  ) {}
  step(dt: number, speed: number): number {
    const previousVelocity = this.velocity;
    this.boost *= Math.exp(-dt / this.decayTime);
    const targetVelocity = speed + this.boost;
    this.velocity += (targetVelocity - this.velocity) * (1 - Math.exp(-dt / this.responseTime));
    if (Math.abs(this.boost) < 0.001 && Math.abs(this.velocity - speed) < 0.001) {
      this.boost = 0;
      this.velocity = speed;
    }
    return (previousVelocity + this.velocity) * 0.5 * dt;
  }
}

export class DiamondMotion {
  static readonly referencePitch = -0.104458;
  private static readonly pitchLimit = 1.1;
  private static readonly springFrequency = 3 * 2 * Math.PI;
  private static readonly springDamping = 0.8;
  private static readonly tapUnlockSpeedMultiplier = 1.4;

  yaw = 0;
  externalYaw = 0;
  get renderedYaw() {
    return this.yaw + this.lean + this.externalYaw;
  }
  pitch = DiamondMotion.referencePitch;
  isDragging = false;
  zoom = 1;
  private _mainSparkleOnRotation = false;
  get mainSparkleOnRotation() {
    return this._mainSparkleOnRotation;
  }
  set mainSparkleOnRotation(v: boolean) {
    if (v !== this._mainSparkleOnRotation) {
      this._mainSparkleOnRotation = v;
      this.rotationSparkle = new RotationPulse();
    }
  }
  rotationSparkle = new RotationPulse();

  private targetYaw = 0;
  private targetPitch = DiamondMotion.referencePitch;
  private rawPitchOffset = 0;
  private yawSpringVelocity = 0;
  private pitchSpringVelocity = 0;
  isAppearanceImpulseActive = false;
  private yawVelocity = 0;
  private _swayScale = 0;
  get swayScale() {
    return this._swayScale;
  }
  set swayScale(v: number) {
    this._swayScale = v;
    if (v !== 0 && this.swayPhase === null)
      this.swayPhase = [Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI];
  }
  tilt = 0;
  targetLean = 0;
  lean = 0;
  private leanVelocity = 0;
  releaseDecay = 0;
  releaseTilt = 0;
  private swayPhase: V2 | null = null;
  private spinVelocity = 0;
  spinAtPress = 0;
  private spinDecay = 0.7;
  private lastDragTime = 0;
  private timeSinceRelease = 10;
  private tapRotation: TapRotation | null = null;
  private entranceInterrupted = false;

  clone(): DiamondMotion {
    const c = new DiamondMotion();
    Object.assign(c, this);
    c._mainSparkleOnRotation = this._mainSparkleOnRotation;
    c._swayScale = this._swayScale;
    c.rotationSparkle = this.rotationSparkle.clone();
    c.swayPhase = this.swayPhase ? ([...this.swayPhase] as V2) : null;
    c.tapRotation = this.tapRotation
      ? Object.assign(Object.create(TapRotation.prototype), this.tapRotation)
      : null;
    return c;
  }

  tap(
    direction: number,
    speed: number,
    mode: AnimationMode,
    time: number,
    appearance = Appearance.blue,
  ): boolean | null {
    if (this.isDragging) return null;
    const tapUnlockSpeed = Math.abs(speed) * DiamondMotion.tapUnlockSpeedMultiplier;
    let triggersBurst: boolean;
    if (this.tapRotation) {
      const t = this.tapRotation;
      const remainingBoost = Math.max(Math.abs(t.boost), Math.abs(t.velocity - speed));
      const fastSpinSpeed = Math.max(Math.abs(t.velocity), Math.abs(speed + t.boost));
      if (t.isFast && fastSpinSpeed > tapUnlockSpeed) return null;
      triggersBurst = !t.isFast && remainingBoost > 0.12;
    } else {
      if (mode === "entrance" && !this.entranceInterrupted && speed !== 0) {
        const remainingBoost =
          DiamondEntrance.spinBoost * Math.exp(-Math.max(0, time) / DiamondEntrance.spinDecay);
        if (Math.abs(speed) + remainingBoost > tapUnlockSpeed) return null;
      }
      triggersBurst = false;
    }
    const interval = 1 / 120;
    const currentVelocity = this.tapRotation
      ? this.tapRotation.velocity
      : (this.automaticTravel(time, time + interval, speed, mode, appearance) / interval) *
        Math.min(this.timeSinceRelease / 0.75, 1);
    this.startRotation(direction, currentVelocity + this.yawVelocity, triggersBurst);
    return triggersBurst;
  }

  spin(velocity: number, decay: number) {
    this.spinVelocity += velocity;
    this.spinDecay = Math.max(decay, 0.05);
  }
  stopSpin() {
    this.spinVelocity = 0;
  }
  setSpin(velocity: number, decay: number) {
    if (this.isDragging) return;
    this.tapRotation = null;
    this.spinVelocity = velocity;
    this.spinDecay = Math.max(decay, 0.05);
  }
  pushFromBelow(strength = 1.0) {
    if (this.isDragging) return;
    this.pitchSpringVelocity -= strength;
    this.isAppearanceImpulseActive = true;
  }
  private sway(time: number): number {
    if (this.swayScale === 0 || !this.swayPhase) return 0;
    const fx = (2 * Math.PI) / 5.3,
      fy = (2 * Math.PI) / 8.9;
    return (
      this.swayScale *
      (0.17 * Math.sin(fx * time + this.swayPhase[0]) +
        0.1 * Math.sin(fy * time + this.swayPhase[1]))
    );
  }
  fling(direction: number, impulse: number | null = null) {
    if (this.isDragging) return;
    const currentVelocity = this.yawSpringVelocity;
    this.targetYaw = this.yaw;
    this.yawSpringVelocity = 0;
    if (impulse !== null) {
      this.tapRotation = null;
      this.yawVelocity = 0;
      this.spinVelocity = 0;
      this.spin(direction * impulse, 0.7);
    } else {
      this.startRotation(direction, currentVelocity, true);
    }
  }
  private startRotation(direction: number, velocity: number, isFast: boolean) {
    this.tapRotation = new TapRotation(
      velocity,
      direction * (isFast ? DiamondEntrance.spinBoost : 3.36),
      isFast ? DiamondEntrance.spinDecay : 0.85,
      isFast ? 0.08 : 0.16,
      isFast,
    );
    this.entranceInterrupted = true;
    this.yawVelocity = 0;
    this.timeSinceRelease = 0.75;
  }
  begin(time: number) {
    this.spinAtPress = this.spinVelocity;
    this.isDragging = true;
    this.isAppearanceImpulseActive = false;
    this.tapRotation = null;
    this.targetYaw = this.yaw;
    this.targetPitch = this.pitch;
    const L = DiamondMotion.pitchLimit;
    const offset = Math.min(
      L - 0.001,
      Math.max(-L + 0.001, this.pitch - DiamondMotion.referencePitch),
    );
    this.rawPitchOffset = offset / (1 - Math.abs(offset) / L);
    this.yawSpringVelocity = 0;
    this.pitchSpringVelocity = 0;
    this.yawVelocity = 0;
    this.spinVelocity = 0;
    this.lastDragTime = time;
  }
  drag(dx: number, dy: number, scale: number, time: number) {
    if (!this.isDragging) return;
    const sensitivity = Math.PI / Math.max(scale, 100);
    const deltaYaw = dx * sensitivity;
    this.targetYaw += deltaYaw;
    this.rawPitchOffset += dy * sensitivity;
    this.targetPitch =
      DiamondMotion.referencePitch +
      this.rawPitchOffset / (1 + Math.abs(this.rawPitchOffset) / DiamondMotion.pitchLimit);
    const dt = Math.max(1 / 240, Math.min(time - this.lastDragTime, 0.1));
    this.yawVelocity = Math.min(5, Math.max(-5, deltaYaw / dt));
    this.lastDragTime = time;
  }
  end(time: number, cancelled = false) {
    this.isDragging = false;
    this.timeSinceRelease = 0;
    this.targetPitch = DiamondMotion.referencePitch;
    if (!cancelled) {
      this.pitchSpringVelocity -= this.releaseTilt;
      if (this.releaseDecay > 0 && time - this.lastDragTime <= 0.12) {
        this.spinVelocity += this.yawVelocity;
        this.spinDecay = Math.max(this.releaseDecay, 0.05);
        this.yawVelocity = 0;
      }
    }
    if (cancelled || time - this.lastDragTime > 0.12) this.yawVelocity = 0;
    if (cancelled) {
      this.targetYaw = this.yaw;
      this.yawSpringVelocity = 0;
      this.pitchSpringVelocity = 0;
    }
  }

  step(
    dt0: number,
    speed: number,
    reduceMotion: boolean,
    mode: AnimationMode = "continuous",
    time = 0,
    appearance = Appearance.blue,
  ) {
    const dt = Math.min(Math.max(dt0, 0), 0.05);
    if (reduceMotion) {
      this.lean = this.targetLean;
      this.leanVelocity = 0;
      this.isAppearanceImpulseActive = false;
      this.rotationSparkle = new RotationPulse();
      this.tapRotation = null;
      if (this.isDragging) {
        this.yaw = this.targetYaw;
        this.pitch = this.targetPitch;
      } else {
        this.targetYaw = this.yaw;
        this.pitch = DiamondMotion.referencePitch;
        this.targetPitch = this.pitch;
      }
      this.yawSpringVelocity = 0;
      this.pitchSpringVelocity = 0;
      this.yawVelocity = 0;
      this.spinVelocity = 0;
      return;
    }
    let leanRemaining = dt;
    while (leanRemaining > 0 && (this.lean !== this.targetLean || this.leanVelocity !== 0)) {
      const step = Math.min(leanRemaining, 1 / 240);
      this.leanVelocity +=
        ((this.targetLean - this.lean) * 110 - 2 * 0.55 * 10.5 * this.leanVelocity) * step;
      this.lean += this.leanVelocity * step;
      leanRemaining = Math.max(0, leanRemaining - step);
    }
    if (Math.abs(this.lean - this.targetLean) < 0.0001 && Math.abs(this.leanVelocity) < 0.0001) {
      this.lean = this.targetLean;
      this.leanVelocity = 0;
    }
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, 1 / (this.isAppearanceImpulseActive ? 240 : 120));
      const previousYaw = this.yaw;
      const stepTime = Math.max(0, time - remaining + step);
      if (!this.isDragging) {
        this.timeSinceRelease += step;
        const decay = Math.exp(-4.2 * step);
        this.targetYaw += (this.yawVelocity * (1 - decay)) / 4.2;
        this.yawVelocity *= decay;

        if (this.spinVelocity !== 0) {
          const fade = Math.exp(-step / this.spinDecay);
          const travel = this.spinVelocity * this.spinDecay * (1 - fade);
          this.spinVelocity *= fade;
          if (Math.abs(this.spinVelocity) < 0.002) this.spinVelocity = 0;
          this.targetYaw += travel;
          this.yaw += travel;
        }
        let auto: number;
        if (this.tapRotation) auto = this.tapRotation.step(step, speed);
        else
          auto = this.automaticTravel(
            Math.max(0, stepTime - step),
            stepTime,
            speed,
            mode,
            appearance,
          );
        const travel = auto * Math.min(this.timeSinceRelease / 0.75, 1);
        this.targetYaw += travel;
        this.yaw += travel;
        this.targetPitch = DiamondMotion.referencePitch + this.sway(stepTime) + this.tilt;
      }
      const stiffness = DiamondMotion.springFrequency * DiamondMotion.springFrequency;
      const damping = 2 * DiamondMotion.springDamping * DiamondMotion.springFrequency;
      const pitchFrequency = this.isAppearanceImpulseActive
        ? 2 * Math.PI * 1.25
        : DiamondMotion.springFrequency;
      const pitchDamping =
        2 * (this.isAppearanceImpulseActive ? 0.13 : DiamondMotion.springDamping) * pitchFrequency;
      this.yawSpringVelocity +=
        ((this.targetYaw - this.yaw) * stiffness - damping * this.yawSpringVelocity) * step;
      this.pitchSpringVelocity +=
        ((this.targetPitch - this.pitch) * pitchFrequency * pitchFrequency -
          pitchDamping * this.pitchSpringVelocity) *
        step;
      this.yaw += this.yawSpringVelocity * step;
      this.pitch += this.pitchSpringVelocity * step;
      if (
        this.isAppearanceImpulseActive &&
        Math.abs(this.pitch - this.targetPitch) < 0.0001 &&
        Math.abs(this.pitchSpringVelocity) < 0.0001
      ) {
        this.pitch = this.targetPitch;
        this.pitchSpringVelocity = 0;
        this.isAppearanceImpulseActive = false;
      }
      if (this.mainSparkleOnRotation) this.rotationSparkle.advance(this.yaw - previousYaw, step);
      remaining = Math.max(0, remaining - step);
    }
    const fullTurns = Math.trunc(this.yaw / (2 * Math.PI));
    this.yaw -= fullTurns * 2 * Math.PI;
    this.targetYaw -= fullTurns * 2 * Math.PI;
    if (
      !this.isDragging &&
      this.swayScale === 0 &&
      this.tilt === 0 &&
      Math.abs(this.pitch - DiamondMotion.referencePitch) < 0.0001 &&
      Math.abs(this.pitchSpringVelocity) < 0.0001
    ) {
      this.pitch = DiamondMotion.referencePitch;
      this.pitchSpringVelocity = 0;
    }
  }

  private automaticTravel(
    start: number,
    end: number,
    speed: number,
    mode: AnimationMode,
    appearance: Appearance,
  ): number {
    switch (mode) {
      case "entrance":
        return this.entranceInterrupted
          ? speed * (end - start)
          : DiamondEntrance.angularTravel(start, end, speed);
      case "continuous":
        return speed * (end - start);
      case "reference":
        return speed === 0
          ? 0
          : DiamondMotion.referenceYaw(end, appearance) -
              DiamondMotion.referenceYaw(start, appearance);
    }
  }

  changeReferenceAppearance(from: Appearance, to: Appearance, time: number) {
    this.targetYaw += DiamondMotion.referenceYaw(time, to) - DiamondMotion.referenceYaw(time, from);
  }

  static referenceYaw(time: number, appearance = Appearance.blue): number {
    const frame = DiamondReferenceHighlights.frame(time, appearance);
    if (appearance === Appearance.white) {
      const progress = frame < 59 ? frame / 59 : (120 - frame) / 61;
      return -0.42 * easing(progress, [0.5, 0], [0.5, 1]);
    }
    const times = [0, 39, 69, 99, 179];
    const angles = [0, -0.34, 0, 0.33, 0];
    const index = frame < 39 ? 0 : frame < 69 ? 1 : frame < 99 ? 2 : 3;
    const progress = Math.min(1, (frame - times[index]) / (times[index + 1] - times[index]));
    const out: V2 = index === 2 ? [0.167, 0.167] : [0.5, 0];
    const into: V2 = index === 1 ? [0.833, 0.833] : [0.5, 1];
    const t = easing(progress, out, into);
    return angles[index] + (angles[index + 1] - angles[index]) * t;
  }
}

export class InteractiveDiamondIntro {
  static delay = 0.18;
  static duration = 1.2;
  private static omega = (2 * Math.PI) / 0.9;
  readonly progress: number;
  get lift() {
    return -48 * 4 * this.progress * (1 - this.progress);
  }
  get scaleValue() {
    return this.scale(6);
  }
  constructor(progress: number);
  constructor(opts: { time: number | null; speed?: number; damping?: number });
  constructor(arg: number | { time: number | null; speed?: number; damping?: number }) {
    if (typeof arg === "number") {
      this.progress = arg;
      return;
    }
    const speed = arg.speed ?? 1,
      damping = arg.damping ?? 0.8;
    const duration =
      InteractiveDiamondIntro.delay +
      (InteractiveDiamondIntro.duration - InteractiveDiamondIntro.delay) / speed;
    if (arg.time === null || !(arg.time < duration)) {
      this.progress = 1;
      return;
    }
    const t = Math.max(arg.time - InteractiveDiamondIntro.delay, 0) * speed;
    const decay = damping * InteractiveDiamondIntro.omega;
    const frequency = InteractiveDiamondIntro.omega * Math.sqrt(1 - damping * damping);
    this.progress =
      1 -
      Math.exp(-decay * t) *
        (Math.cos(frequency * t) + ((decay - 1.2) / frequency) * Math.sin(frequency * t));
  }
  scale(initialScale: number, allowsOvershoot = false): number {
    const remaining = 1 - this.progress;
    const offset =
      allowsOvershoot && remaining < 0
        ? -Math.pow(-remaining, 1.25)
        : Math.pow(Math.max(0, remaining), 1.25);
    return 1 + (initialScale - 1) * offset;
  }
}

void mixN;
void saturate;
