import { Appearance, AnimationMode } from "./animation";

export interface DiamondStyle {
  appearance: Appearance;
  animationMode: AnimationMode;
  referenceAnimationLoops: boolean;
  animateOnAppear: boolean;
  rotationSpeed: number;
  isRotating: boolean;
  sparkles: boolean;
  mainSparkleOnRotation: boolean;
  backgroundStars: boolean;
  widthCompensation: boolean;
  refraction: number;
  brightness: number;
  zoom: number;
  whiten: number;
  swayScale: number;
  floatAmplitude: number;
  floatPeriod: number;
  tilt: number;
  lean: number;
  releaseDecay: number;
  releaseTilt: number;
  tapToSpin: boolean;
  dragGrow: number;
  growShift: number;
  verticalOffset: number;
  growDamping: number;
  widthPoints: number;
  starOpacity: number;
  starZoom: number;
  starReferenceSize: number;
  starEmission: number;
  rightwardStars: boolean;
  burstSize: number;
  burstFadeInDuration: number;
  steadyStars: boolean;
}

export function defaultDiamondStyle(): DiamondStyle {
  return {
    appearance: Appearance.blue,
    animationMode: "entrance",
    referenceAnimationLoops: true,
    animateOnAppear: false,
    rotationSpeed: ((2 * Math.PI) / 18) * 1.70775,
    isRotating: true,
    sparkles: true,
    mainSparkleOnRotation: false,
    backgroundStars: true,
    widthCompensation: true,
    refraction: 0.72,
    brightness: 1,
    zoom: 0.72,
    whiten: 0,
    swayScale: 0,
    floatAmplitude: 0,
    floatPeriod: 3.2,
    tilt: 0,
    lean: 0,
    releaseDecay: 0,
    releaseTilt: 0,
    tapToSpin: false,
    dragGrow: 1,
    growShift: 0,
    verticalOffset: 0,
    growDamping: 0.42,
    widthPoints: 0,
    starOpacity: 1,
    starZoom: 1,
    starReferenceSize: 0,
    starEmission: 1,
    rightwardStars: false,
    burstSize: 1,
    burstFadeInDuration: 0.5,
    steadyStars: true,
  };
}

export function styleEquals(a: DiamondStyle, b: DiamondStyle): boolean {
  for (const k of Object.keys(a) as (keyof DiamondStyle)[]) if (a[k] !== b[k]) return false;
  return true;
}
