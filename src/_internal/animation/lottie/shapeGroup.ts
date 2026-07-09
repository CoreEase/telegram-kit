import { getAnimatedValue, getAnimatedPosition, getAnimatedShape } from "./interpolate";
import {
  type BezierPath,
  ellipseToBezierPath,
  rectToBezierPath,
  shapeValueToBezierPath,
  starToBezierPath,
  tracePathOnContext,
  trimPaths,
} from "./path";
import { applyStrokeStyle, buildGradient, colorToCss } from "./paint";
import { identity, multiply, rotate, scale, skew, translate, type Mat2D } from "./matrix";
import type {
  ShapeEllipseItem,
  ShapeFillItem,
  ShapeGradientFillItem,
  ShapeGradientStrokeItem,
  ShapeGroupItem,
  ShapeItem,
  ShapeMergeItem,
  ShapeRectItem,
  ShapeRepeaterItem,
  ShapeStarItem,
  ShapeStrokeItem,
  ShapeTransformItem,
  ShapeTrimItem,
  Transform,
} from "./types";

export interface ShapeRenderContext {
  ctx: CanvasRenderingContext2D;
  frame: number;
  canvasWidth: number;
  canvasHeight: number;
  scratchCanvas: HTMLCanvasElement | OffscreenCanvas;
  scratchCtx: CanvasRenderingContext2D;
}

export function computeLocalTransform(
  t: Transform | undefined,
  frame: number
): { matrix: Mat2D; opacity: number } {
  if (!t) return { matrix: identity(), opacity: 1 };

  let anchor = [0, 0];
  let position = [0, 0];
  let scaleVal = [100, 100];
  let rotationDeg = 0;
  let skewDeg = 0;
  let skewAxisDeg = 0;
  let opacityPct = 100;

  if (t.a) anchor = getAnimatedValue(t.a, frame);
  if (t.p) {
    if ((t.p as any).s && (t.p as any).x && (t.p as any).y) {
      const px = getAnimatedValue((t.p as any).x, frame)[0] ?? 0;
      const py = getAnimatedValue((t.p as any).y, frame)[0] ?? 0;
      position = [px, py];
    } else {
      position = getAnimatedPosition(t.p, frame);
    }
  }
  if (t.s) scaleVal = getAnimatedValue(t.s, frame);
  if (t.r) rotationDeg = getAnimatedValue(t.r, frame)[0] ?? 0;
  if (t.sk) skewDeg = getAnimatedValue(t.sk, frame)[0] ?? 0;
  if (t.sa) skewAxisDeg = getAnimatedValue(t.sa, frame)[0] ?? 0;
  if (t.o) opacityPct = getAnimatedValue(t.o, frame)[0] ?? 100;

  let m = identity();
  m = translate(m, position[0] ?? 0, position[1] ?? 0);
  m = rotate(m, ((rotationDeg ?? 0) * Math.PI) / 180);
  if (skewDeg) m = skew(m, skewDeg, skewAxisDeg);
  m = scale(m, (scaleVal[0] ?? 100) / 100, (scaleVal[1] ?? 100) / 100);
  m = translate(m, -(anchor[0] ?? 0), -(anchor[1] ?? 0));

  return { matrix: m, opacity: Math.max(0, Math.min(1, opacityPct / 100)) };
}

function buildShapePath(item: ShapeItem, frame: number): BezierPath | null {
  switch (item.ty) {
    case "sh": {
      const sv = getAnimatedShape((item as any).ks, frame);
      return shapeValueToBezierPath(sv);
    }
    case "rc": {
      const rc = item as ShapeRectItem;
      const pos = getAnimatedValue(rc.p, frame);
      const size = getAnimatedValue(rc.s, frame);
      const radius = getAnimatedValue(rc.r, frame)[0] ?? 0;
      return rectToBezierPath(pos[0] ?? 0, pos[1] ?? 0, size[0] ?? 0, size[1] ?? 0, radius);
    }
    case "el": {
      const el = item as ShapeEllipseItem;
      const pos = getAnimatedValue(el.p, frame);
      const size = getAnimatedValue(el.s, frame);
      return ellipseToBezierPath(pos[0] ?? 0, pos[1] ?? 0, size[0] ?? 0, size[1] ?? 0);
    }
    case "sr": {
      const sr = item as ShapeStarItem;
      const pos = getAnimatedValue(sr.p, frame);
      const outerRadius = getAnimatedValue(sr.or, frame)[0] ?? 0;
      const innerRadius = sr.ir ? getAnimatedValue(sr.ir, frame)[0] ?? 0 : outerRadius * 0.5;
      const outerRoundness = getAnimatedValue(sr.os, frame)[0] ?? 0;
      const innerRoundness = sr.is ? getAnimatedValue(sr.is, frame)[0] ?? 0 : 0;
      const rotationDeg = getAnimatedValue(sr.r, frame)[0] ?? 0;
      const points = getAnimatedValue(sr.pt, frame)[0] ?? 5;
      return starToBezierPath(
        pos[0] ?? 0,
        pos[1] ?? 0,
        points,
        outerRadius,
        innerRadius,
        outerRoundness,
        innerRoundness,
        rotationDeg,
        sr.sy === 2
      );
    }
    default:
      return null;
  }
}

function tracePathsAsOne(ctx: CanvasRenderingContext2D, paths: BezierPath[], m: Mat2D): void {
  ctx.beginPath();
  for (const p of paths) tracePathOnContext(ctx, p, m);
}

function paintFill(
  rc: ShapeRenderContext,
  paths: BezierPath[],
  m: Mat2D,
  fillStyle: string | CanvasGradient,
  mergeMode: number | null
): void {
  if (paths.length === 0) return;

  if (mergeMode === 3 || mergeMode === 4) {

    const sctx = rc.scratchCtx;
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, rc.canvasWidth, rc.canvasHeight);
    sctx.beginPath();
    tracePathOnContext(sctx, paths[0], m);
    sctx.fillStyle = fillStyle as any;
    sctx.fill("nonzero");
    for (let i = 1; i < paths.length; i++) {
      sctx.globalCompositeOperation = mergeMode === 3 ? "destination-out" : "destination-in";
      sctx.beginPath();
      tracePathOnContext(sctx, paths[i], m);
      sctx.fillStyle = fillStyle as any;
      sctx.fill("nonzero");
    }
    sctx.restore();
    rc.ctx.drawImage(rc.scratchCanvas as any, 0, 0);
    return;
  }

  tracePathsAsOne(rc.ctx, paths, m);
  rc.ctx.fillStyle = fillStyle as any;
  rc.ctx.fill(mergeMode === 5 ? "evenodd" : "nonzero");
}

function paintStroke(
  rc: ShapeRenderContext,
  paths: BezierPath[],
  m: Mat2D,
  strokeStyle: string | CanvasGradient
): void {
  if (paths.length === 0) return;
  tracePathsAsOne(rc.ctx, paths, m);
  rc.ctx.strokeStyle = strokeStyle as any;
  rc.ctx.stroke();
}

export function renderShapeItems(
  rc: ShapeRenderContext,
  items: ShapeItem[],
  parentMatrix: Mat2D,
  parentOpacity: number
): void {
  const trItem = items.find((i) => i.ty === "tr") as ShapeTransformItem | undefined;
  const { matrix: groupMatrix, opacity: groupOpacity } = computeLocalTransform(
    trItem,
    rc.frame
  );
  const localMatrix = multiply(parentMatrix, groupMatrix);
  const localOpacity = parentOpacity * groupOpacity;

  let currentPaths: BezierPath[] = [];
  let mergeMode: number | null = null;

  for (let idx = items.length - 1; idx >= 0; idx--) {
    const item = items[idx];
    if (item.hd) continue;

    switch (item.ty) {
      case "tr":
        continue; 

      case "gr": {
        const group = item as ShapeGroupItem;
        renderShapeItems(rc, group.it, localMatrix, localOpacity);
        break;
      }

      case "sh":
      case "rc":
      case "el":
      case "sr": {
        const path = buildShapePath(item, rc.frame);
        if (path) currentPaths = [...currentPaths, path];
        break;
      }

      case "tm": {
        const tm = item as ShapeTrimItem;
        const s = getAnimatedValue(tm.s, rc.frame)[0] ?? 0;
        const e = getAnimatedValue(tm.e, rc.frame)[0] ?? 100;
        const o = getAnimatedValue(tm.o, rc.frame)[0] ?? 0;
        currentPaths = trimPaths(currentPaths, s, e, o);
        break;
      }

      case "rp": {
        const rp = item as ShapeRepeaterItem;
        const copies = Math.max(0, Math.round(getAnimatedValue(rp.c, rc.frame)[0] ?? 0));
        const offset = getAnimatedValue(rp.o, rc.frame)[0] ?? 0;
        const rTr = rp.tr;
        const repPos = getAnimatedValue(rTr.p, rc.frame);
        const repAnchor = getAnimatedValue(rTr.a, rc.frame);
        const repScale = getAnimatedValue(rTr.s, rc.frame);
        const repRotation = getAnimatedValue(rTr.r, rc.frame)[0] ?? 0;

        const basePaths = currentPaths;
        const repeated: BezierPath[] = [];
        for (let c = 0; c < copies; c++) {
          const n = c + offset;
          let rm = identity();
          rm = translate(rm, repPos[0] ?? 0, repPos[1] ?? 0);
          rm = translate(rm, repAnchor[0] ?? 0, repAnchor[1] ?? 0);
        
          let compound = identity();
          for (let k = 0; k < Math.abs(n); k++) {
            compound = translate(compound, repPos[0] ?? 0, repPos[1] ?? 0);
            compound = rotate(compound, ((repRotation ?? 0) * Math.PI) / 180);
            compound = scale(compound, (repScale[0] ?? 100) / 100, (repScale[1] ?? 100) / 100);
          }
          for (const p of basePaths) {
            repeated.push({
              closed: p.closed,
              vertices: p.vertices.map((v) => {
                const [vx, vy] = applyMat(compound, v.v[0], v.v[1]);
                const [ix, iy] = applyMatDelta(compound, v.i[0], v.i[1]);
                const [ox, oy] = applyMatDelta(compound, v.o[0], v.o[1]);
                return { v: [vx, vy], i: [ix, iy], o: [ox, oy] };
              }),
            });
          }
        }
        currentPaths = repeated;
        break;
      }

      case "mm": {
        mergeMode = (item as ShapeMergeItem).mm ?? 1;
        break;
      }

      case "fl": {
        const fl = item as ShapeFillItem;
        const color = getAnimatedValue(fl.c, rc.frame);
        const opacity = (getAnimatedValue(fl.o, rc.frame)[0] ?? 100) / 100;
        const css = colorToCss(color, opacity * localOpacity);
        paintFill(rc, currentPaths, localMatrix, css, mergeMode);
        break;
      }

      case "gf": {
        const gf = item as ShapeGradientFillItem;
        const opacity = (getAnimatedValue(gf.o, rc.frame)[0] ?? 100) / 100;
        const gradient = buildGradient(rc.ctx, gf, rc.frame, localMatrix, opacity * localOpacity);
        paintFill(rc, currentPaths, localMatrix, gradient, mergeMode);
        break;
      }

      case "st": {
        const st = item as ShapeStrokeItem;
        const color = getAnimatedValue(st.c, rc.frame);
        const opacity = (getAnimatedValue(st.o, rc.frame)[0] ?? 100) / 100;
        const css = colorToCss(color, opacity * localOpacity);
        applyStrokeStyle(rc.ctx, st, rc.frame, localMatrix);
        paintStroke(rc, currentPaths, localMatrix, css);
        break;
      }

      case "gs": {
        const gs = item as ShapeGradientStrokeItem;
        const opacity = (getAnimatedValue(gs.o, rc.frame)[0] ?? 100) / 100;
        const gradient = buildGradient(rc.ctx, gs, rc.frame, localMatrix, opacity * localOpacity);
        applyStrokeStyle(rc.ctx, gs, rc.frame, localMatrix);
        paintStroke(rc, currentPaths, localMatrix, gradient);
        break;
      }

      default:
        break;
    }
  }
}

function applyMat(m: Mat2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function applyMatDelta(m: Mat2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y, m[1] * x + m[3] * y];
}
