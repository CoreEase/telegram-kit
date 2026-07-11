import { getAnimatedValue } from "./interpolate";
import { computeLocalTransform, renderShapeItems, type ShapeRenderContext } from "./shapeGroup";
import { shapeValueToBezierPath, tracePathOnContext } from "./path";
import { getAnimatedShape } from "./interpolate";
import { identity, multiply, type Mat2D } from "./matrix";
import type { LottieAnimation, LottieAsset, LottieLayer } from "./types";

const BLEND_MODES: Record<number, GlobalCompositeOperation> = {
  0: "source-over",
  1: "multiply",
  2: "screen",
  3: "overlay",
  4: "darken",
  5: "lighten",
  6: "color-dodge",
  7: "color-burn",
  8: "hard-light",
  9: "soft-light",
  10: "difference",
  11: "exclusion",
  12: "hue",
  13: "saturation",
  14: "color",
  15: "luminosity",
};

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } {
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  } else {
    canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
  }
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  return { canvas, ctx };
}

function lumaToAlphaMask(
  source: HTMLCanvasElement | OffscreenCanvas,
  w: number,
  h: number
): HTMLCanvasElement | OffscreenCanvas {
  const { canvas, ctx } = makeCanvas(w, h);
  ctx.drawImage(source as any, 0, 0);
  const img = ctx.getImageData(0, 0, Math.max(1, w), Math.max(1, h));
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i + 3] = Math.round((luma / 255) * d[i + 3]);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export interface EngineImageCache {
  get(key: string): HTMLImageElement | undefined;
  set(key: string, img: HTMLImageElement): void;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  imageCache: EngineImageCache;
  onAssetLoaded?: () => void;
  warnOnce: (key: string, message: string) => void;
  getShapeScratch?: (
    w: number,
    h: number
  ) => { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D };
}

function getLayerMatrix(
  layer: LottieLayer,
  layersByInd: Map<number, LottieLayer>,
  frame: number,
  cache: Map<number, Mat2D>
): Mat2D {
  const ind = layer.ind ?? -1;
  const cached = cache.get(ind);
  if (cached) return cached;

  const { matrix: own } = computeLocalTransform(layer.ks, frame);

  let result = own;
  if (layer.parent != null) {
    const parent = layersByInd.get(layer.parent);
    if (parent && parent !== layer) {
      const parentMatrix = getLayerMatrix(parent, layersByInd, frame, cache);
      result = multiply(parentMatrix, own);
    }
  }

  if (ind >= 0) cache.set(ind, result);
  return result;
}

function applyMasks(
  ctx: CanvasRenderingContext2D,
  layer: LottieLayer,
  matrix: Mat2D,
  frame: number,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const masks = layer.masksProperties;
  if (!masks || masks.length === 0) return false;

  const active = masks.filter((m) => (m.mode ?? "a") !== "n");
  if (active.length === 0) return false;

  let clipped = false;
  let additiveBatch: typeof active = [];

  const flushAdditive = () => {
    if (additiveBatch.length === 0) return;
    ctx.beginPath();
    for (const mask of additiveBatch) {
      const sv = getAnimatedShape(mask.pt, frame);
      tracePathOnContext(ctx, shapeValueToBezierPath(sv), matrix);
    }
    ctx.clip("nonzero");
    clipped = true;
    additiveBatch = [];
  };

  for (const mask of active) {
    const mode = mask.mode ?? "a";
    const isAdditive = (mode === "a" || mode === "l") && !mask.inv;

    if (isAdditive) {
      additiveBatch.push(mask);
      continue;
    }

    flushAdditive();

    const sv = getAnimatedShape(mask.pt, frame);
    const path = shapeValueToBezierPath(sv);
    const keepOutside = mode === "s" || mask.inv;

    ctx.beginPath();
    if (keepOutside) {
      ctx.rect(0, 0, canvasWidth, canvasHeight);
      tracePathOnContext(ctx, path, matrix);
      ctx.clip("evenodd");
    } else {
      tracePathOnContext(ctx, path, matrix);
      ctx.clip("nonzero");
    }
    clipped = true;
  }

  flushAdditive();
  return clipped;
}

function renderSolidLayer(ctx: CanvasRenderingContext2D, layer: LottieLayer, matrix: Mat2D): void {
  const w = layer.sw ?? 0;
  const h = layer.sh ?? 0;
  ctx.save();
  ctx.beginPath();
  const p0 = applyPoint(matrix, 0, 0);
  const p1 = applyPoint(matrix, w, 0);
  const p2 = applyPoint(matrix, w, h);
  const p3 = applyPoint(matrix, 0, h);
  ctx.moveTo(p0[0], p0[1]);
  ctx.lineTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.lineTo(p3[0], p3[1]);
  ctx.closePath();
  ctx.fillStyle = layer.sc ?? "#000000";
  ctx.fill();
  ctx.restore();
}

function applyPoint(m: Mat2D, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function resolveImageSrc(asset: LottieAsset): string | null {
  if (asset.e === 1) {
    if (!asset.p) return null;
    if (asset.p.startsWith("data:")) return asset.p;
    return `data:image/png;base64,${asset.p}`;
  }
  if (asset.u) return asset.u + (asset.p ?? "");
  return asset.p ?? null;
}

function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  asset: LottieAsset,
  matrix: Mat2D,
  opts: RenderOptions
): void {
  const src = resolveImageSrc(asset);
  if (!src) return;

  let img = opts.imageCache.get(asset.id);
  if (!img) {
    img = new Image();
    img.src = src;
    opts.imageCache.set(asset.id, img);
    img.addEventListener("load", () => opts.onAssetLoaded?.());
    return;
  }
  if (!img.complete || img.naturalWidth === 0) return;

  const w = asset.w ?? img.naturalWidth;
  const h = asset.h ?? img.naturalHeight;

  ctx.save();
  ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();
}

export function renderLayers(
  targetCtx: CanvasRenderingContext2D,
  layers: LottieLayer[],
  assetsById: Map<string, LottieAsset>,
  parentMatrix: Mat2D,
  parentOpacity: number,
  docFrame: number,
  opts: RenderOptions
): void {
  const layersByInd = new Map<number, LottieLayer>();
  for (const l of layers) {
    if (l.ind != null) layersByInd.set(l.ind, l);
  }
  const matrixCache = new Map<number, Mat2D>();

  const isLayerActive = (layer: LottieLayer): boolean => {
    if (layer.hd) return false;
    const startFrame = layer.ip ?? 0;
    const endFrame = layer.op ?? Infinity;
    return docFrame >= startFrame && docFrame < endFrame;
  };

  const renderMatteSource = (
    matteLayer: LottieLayer
  ): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } | null => {
    if (!isLayerActive(matteLayer)) return null;

    const ownMatrix = getLayerMatrix(matteLayer, layersByInd, docFrame, matrixCache);
    const matrix = multiply(parentMatrix, ownMatrix);
    const { opacity: ownOpacity } = computeLocalTransform(matteLayer.ks, docFrame);
    const opacity = parentOpacity * ownOpacity;

    const scratch = makeCanvas(opts.canvasWidth, opts.canvasHeight);
    scratch.ctx.save();
    scratch.ctx.globalAlpha = opacity;
    applyMasks(scratch.ctx, matteLayer, matrix, docFrame, opts.canvasWidth, opts.canvasHeight);
    renderSingleLayer(scratch.ctx, matteLayer, assetsById, matrix, 1, docFrame, opts);
    scratch.ctx.restore();
    return scratch;
  };

  for (let idx = layers.length - 1; idx >= 0; idx--) {
    const layer = layers[idx];
    if (layer.hd) continue;
    if (!isLayerActive(layer)) continue;

    if (layer.td === 1) continue;

    const ownMatrix = getLayerMatrix(layer, layersByInd, docFrame, matrixCache);
    const matrix = multiply(parentMatrix, ownMatrix);
    const { opacity: ownOpacity } = computeLocalTransform(layer.ks, docFrame);
    const opacity = parentOpacity * ownOpacity;

    const matteLayer = layer.tt && idx > 0 ? layers[idx - 1] : null;
    const pendingMatte = matteLayer && matteLayer.td === 1 ? renderMatteSource(matteLayer) : null;
    const needsMatte = !!layer.tt && !!pendingMatte;

    let drawCtx: CanvasRenderingContext2D;
    let scratch: { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } | null = null;

    if (needsMatte) {
      scratch = makeCanvas(opts.canvasWidth, opts.canvasHeight);
      drawCtx = scratch.ctx;
    } else {
      drawCtx = targetCtx;
    }

    drawCtx.save();
    if (drawCtx === targetCtx) {
      drawCtx.globalAlpha = opacity;
      drawCtx.globalCompositeOperation = BLEND_MODES[layer.bm ?? 0] ?? "source-over";
    } else {
      drawCtx.globalAlpha = opacity;
    }

    const hadClip = applyMasks(drawCtx, layer, matrix, docFrame, opts.canvasWidth, opts.canvasHeight);

    renderSingleLayer(drawCtx, layer, assetsById, matrix, 1, docFrame, opts);

    drawCtx.restore();
    void hadClip;

    if (needsMatte && scratch && pendingMatte) {
      const tt = layer.tt;
      const isLuma = tt === 3 || tt === 4;
      const matteSource = isLuma
        ? lumaToAlphaMask(pendingMatte.canvas, opts.canvasWidth, opts.canvasHeight)
        : pendingMatte.canvas;

      scratch.ctx.save();
      scratch.ctx.globalCompositeOperation =
        tt === 2 || tt === 4 ? "destination-out" : "destination-in";
      scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
      scratch.ctx.drawImage(matteSource as any, 0, 0);
      scratch.ctx.restore();

      targetCtx.save();
      targetCtx.globalCompositeOperation = BLEND_MODES[layer.bm ?? 0] ?? "source-over";
      targetCtx.drawImage(scratch.canvas as any, 0, 0);
      targetCtx.restore();
    }
  }
}


function renderSingleLayer(
  ctx: CanvasRenderingContext2D,
  layer: LottieLayer,
  assetsById: Map<string, LottieAsset>,
  matrix: Mat2D,
  opacity: number,
  docFrame: number,
  opts: RenderOptions
): void {
  switch (layer.ty) {
    case 4: {
      if (!layer.shapes) return;
      const scratch = opts.getShapeScratch
        ? opts.getShapeScratch(opts.canvasWidth, opts.canvasHeight)
        : makeCanvas(opts.canvasWidth, opts.canvasHeight);
      const rc: ShapeRenderContext = {
        ctx,
        frame: docFrame,
        canvasWidth: opts.canvasWidth,
        canvasHeight: opts.canvasHeight,
        scratchCanvas: scratch.canvas,
        scratchCtx: scratch.ctx,
      };
      renderShapeItems(rc, layer.shapes, matrix, opacity);
      break;
    }
    case 1: {
      renderSolidLayer(ctx, layer, matrix);
      break;
    }
    case 0: {
      const asset = layer.refId ? assetsById.get(layer.refId) : undefined;
      if (!asset || !asset.layers) return;
      const stretch = layer.sr ?? 1;
      const innerFrame = layer.tm
        ? getAnimatedValue(layer.tm, docFrame)[0] ?? docFrame
        : (docFrame - (layer.st ?? 0)) / stretch + (layer.st ?? 0);
      renderLayers(ctx, asset.layers, assetsById, matrix, opacity, innerFrame, opts);
      break;
    }
    case 2: {
      const asset = layer.refId ? assetsById.get(layer.refId) : undefined;
      if (asset) renderImageLayer(ctx, asset, matrix, opts);
      break;
    }
    case 3:
      break;
    case 5:
      opts.warnOnce(
        "text-layer",
        "react-tgs-player: text layers are not rendered by this zero-dependency engine (not used by valid .tgs stickers)."
      );
      break;
    default:
      break;
  }
}

export function getDocumentFrameRange(doc: LottieAnimation): { ip: number; op: number; fr: number } {
  return { ip: doc.ip, op: doc.op, fr: doc.fr };
}

export function buildAssetsMap(doc: LottieAnimation): Map<string, LottieAsset> {
  const map = new Map<string, LottieAsset>();
  for (const asset of doc.assets ?? []) {
    map.set(asset.id, asset);
  }
  return map;
}

export function renderDocumentFrame(doc: LottieAnimation, frame: number, opts: RenderOptions): void {
  const assetsById = buildAssetsMap(doc);
  opts.ctx.save();
  opts.ctx.clearRect(0, 0, opts.canvasWidth, opts.canvasHeight);
  const scaleX = opts.canvasWidth / doc.w;
  const scaleY = opts.canvasHeight / doc.h;
  const base: Mat2D = [scaleX, 0, 0, scaleY, 0, 0];
  renderLayers(opts.ctx, doc.layers, assetsById, base, 1, frame, opts);
  opts.ctx.restore();
}
