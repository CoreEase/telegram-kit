export interface LottieKeyframe {
  t: number;
  s?: number[];
  e?: number[];
  i?: { x: number | number[]; y: number | number[] };
  o?: { x: number | number[]; y: number | number[] };
  h?: 0 | 1;
  to?: number[]; 
  ti?: number[]; 
}

export interface AnimatedProperty {
  a: 0 | 1;
  k: number[] | number | LottieKeyframe[];
  ix?: number;
  x?: string;
}

export interface MultiDimensional extends AnimatedProperty {}
export interface ScalarProperty extends AnimatedProperty {}

export interface ShapeProperty {
  a: 0 | 1;
  k: ShapeKeyframeValue | ShapeAnimKeyframe[];
}

export interface ShapeKeyframeValue {
  c: boolean;
  v: number[][];
  i: number[][];
  o: number[][];
}

export interface ShapeAnimKeyframe {
  t: number;
  s?: ShapeKeyframeValue[];
  e?: ShapeKeyframeValue[];
  i?: { x: number | number[]; y: number | number[] };
  o?: { x: number | number[]; y: number | number[] };
  h?: 0 | 1;
}

export interface Transform {
  a?: MultiDimensional; 
  p?: MultiDimensional & { s?: boolean; x?: AnimatedProperty; y?: AnimatedProperty };
  s?: MultiDimensional; 
  r?: ScalarProperty; 
  o?: ScalarProperty; 
  sk?: ScalarProperty; 
  sa?: ScalarProperty; 
}

export interface GradientColor {
  p: number; 
  k: AnimatedProperty;
}

export interface ShapeItemBase {
  ty: string;
  nm?: string;
  hd?: boolean;
}

export interface ShapePathItem extends ShapeItemBase {
  ty: "sh";
  ks: ShapeProperty;
}

export interface ShapeRectItem extends ShapeItemBase {
  ty: "rc";
  p: MultiDimensional;
  s: MultiDimensional;
  r: ScalarProperty;
}

export interface ShapeEllipseItem extends ShapeItemBase {
  ty: "el";
  p: MultiDimensional;
  s: MultiDimensional;
}

export interface ShapeStarItem extends ShapeItemBase {
  ty: "sr";
  p: MultiDimensional; 
  or: ScalarProperty; 
  os: ScalarProperty; 
  ir?: ScalarProperty; 
  is?: ScalarProperty; 
  r: ScalarProperty; 
  pt: ScalarProperty; 
  sy: 1 | 2; 
}

export interface ShapeFillItem extends ShapeItemBase {
  ty: "fl";
  c: MultiDimensional;
  o: ScalarProperty;
  r?: number; 
}

export interface ShapeGradientFillItem extends ShapeItemBase {
  ty: "gf";
  o: ScalarProperty;
  s: MultiDimensional;
  e: MultiDimensional;
  t: 1 | 2;
  g: GradientColor;
  h?: ScalarProperty;
  a?: ScalarProperty;
}

export interface ShapeStrokeItem extends ShapeItemBase {
  ty: "st";
  c: MultiDimensional;
  o: ScalarProperty;
  w: ScalarProperty;
  lc?: number;
  lj?: number;
  ml?: number;
  d?: Array<{ n: string; v: AnimatedProperty }>;
}

export interface ShapeGradientStrokeItem extends ShapeItemBase {
  ty: "gs";
  o: ScalarProperty;
  s: MultiDimensional;
  e: MultiDimensional;
  t: 1 | 2;
  g: GradientColor;
  w: ScalarProperty;
  lc?: number;
  lj?: number;
  ml?: number;
  d?: Array<{ n: string; v: AnimatedProperty }>;
}

export interface ShapeGroupItem extends ShapeItemBase {
  ty: "gr";
  it: ShapeItem[];
}

export interface ShapeTrimItem extends ShapeItemBase {
  ty: "tm";
  s: ScalarProperty;
  e: ScalarProperty;
  o: ScalarProperty;
  m?: 1 | 2;
}

export interface ShapeRepeaterItem extends ShapeItemBase {
  ty: "rp";
  c: ScalarProperty; 
  o: ScalarProperty; 
  tr: {
    p: MultiDimensional;
    a: MultiDimensional;
    s: MultiDimensional;
    r: ScalarProperty;
    so?: ScalarProperty;
    eo?: ScalarProperty;
  };
}

export interface ShapeMergeItem extends ShapeItemBase {
  ty: "mm";
  mm: number; 
}

export interface ShapeTransformItem extends ShapeItemBase, Transform {
  ty: "tr";
}

export type ShapeItem =
  | ShapePathItem
  | ShapeRectItem
  | ShapeEllipseItem
  | ShapeStarItem
  | ShapeFillItem
  | ShapeGradientFillItem
  | ShapeStrokeItem
  | ShapeGradientStrokeItem
  | ShapeGroupItem
  | ShapeTrimItem
  | ShapeRepeaterItem
  | ShapeMergeItem
  | ShapeTransformItem;

export interface MaskProperty {
  inv: boolean;
  mode: "a" | "s" | "i" | "l" | "d" | "n";
  pt: ShapeProperty;
  o: ScalarProperty;
}

export interface LottieLayer {
  ty: number; 
  ind?: number;
  parent?: number;
  nm?: string;
  ip: number;
  op: number;
  st: number;
  sr?: number; 
  ks: Transform;
  shapes?: ShapeItem[];
  refId?: string; 
  w?: number;
  h?: number;
  sc?: string; 
  sw?: number;
  sh?: number;
  masksProperties?: MaskProperty[];
  tt?: number; 
  td?: number; 
  bm?: number; 
  hd?: boolean;
  ao?: number; 
  tm?: AnimatedProperty; 
}

export interface LottieAsset {
  id: string;
  layers?: LottieLayer[]; 
  w?: number;
  h?: number;
  u?: string; 
  p?: string; 
  e?: number; 
}

export interface LottieAnimation {
  v: string;
  fr: number; 
  ip: number; 
  op: number; 
  w: number;
  h: number;
  nm?: string;
  ddd?: number;
  assets?: LottieAsset[];
  layers: LottieLayer[];
  markers?: Array<{ tm: number; cm: string; dr: number }>;
  tgs?: number;
}
