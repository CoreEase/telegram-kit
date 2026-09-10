import { getAnimatedValue } from "./interpolate";
import { computeLocalTransform, renderShapeItems, type ShapeRenderContext } from "./shapeGroup";
import { shapeValueToBezierPath, tracePathOnContext } from "./path";
import { getAnimatedShape } from "./interpolate";
import { identity, multiply, type Mat2D } from "./matrix";
import type { LottieAnimation, LottieAsset, LottieLayer, TextDocumentData } from "./types";

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
  assetsById?: Map<string, LottieAsset>;
  layerIndexCache?: WeakMap<LottieLayer[], Map<number, LottieLayer>>;
  sourceUrl?: string;
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

  const { matrix: own } = computeLocalTransform(layer.ks, frame - (layer.st ?? 0));

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

function renderMaskedLayer(
  targetCtx: CanvasRenderingContext2D,
  layer: LottieLayer,
  assetsById: Map<string, LottieAsset>,
  matrix: Mat2D,
  frame: number,
  opts: RenderOptions
): void {
  const masks = (layer.masksProperties ?? []).filter((mask) => (mask.mode ?? "a") !== "n");
  if (masks.length === 0) {
    renderSingleLayer(targetCtx, layer, assetsById, matrix, 1, frame, opts);
    return;
  }

  const content = makeCanvas(opts.canvasWidth, opts.canvasHeight);
  renderSingleLayer(content.ctx, layer, assetsById, matrix, 1, frame, opts);

  const maskSurface = makeCanvas(opts.canvasWidth, opts.canvasHeight);
  for (let index = 0; index < masks.length; index++) {
    const mask = masks[index];
    const mode = mask.mode ?? "a";
    const opacity = Math.max(0, Math.min(1, (getAnimatedValue(mask.o, frame)[0] ?? 100) / 100));
    const shape = shapeValueToBezierPath(getAnimatedShape(mask.pt, frame));
    if (!shape) continue;

    if (
      index === 0 &&
      (mask.inv || mode === "s" || mode === "i" || mode === "d")
    ) {
      maskSurface.ctx.fillStyle = "#fff";
      maskSurface.ctx.fillRect(0, 0, opts.canvasWidth, opts.canvasHeight);
    }

    maskSurface.ctx.save();
    maskSurface.ctx.globalAlpha = opacity;
    if (mask.inv) {
      maskSurface.ctx.fillStyle = "#fff";
      maskSurface.ctx.fillRect(0, 0, opts.canvasWidth, opts.canvasHeight);
      maskSurface.ctx.globalCompositeOperation = "destination-out";
    } else if (mode === "s") {
      maskSurface.ctx.globalCompositeOperation = "destination-out";
    } else if (mode === "i") {
      maskSurface.ctx.globalCompositeOperation = "destination-in";
    } else if (mode === "d") {
      maskSurface.ctx.globalCompositeOperation = "darken";
    } else if (mode === "l") {
      maskSurface.ctx.globalCompositeOperation = "lighter";
    } else {
      maskSurface.ctx.globalCompositeOperation = "source-over";
    }
    maskSurface.ctx.beginPath();
    tracePathOnContext(maskSurface.ctx, shape, matrix);
    maskSurface.ctx.fillStyle = "#fff";
    maskSurface.ctx.fill("nonzero");
    maskSurface.ctx.restore();
  }

  content.ctx.save();
  content.ctx.globalCompositeOperation = "destination-in";
  content.ctx.setTransform(1, 0, 0, 1, 0, 0);
  content.ctx.drawImage(maskSurface.canvas as any, 0, 0);
  content.ctx.restore();
  targetCtx.drawImage(content.canvas as any, 0, 0);
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

function resolveImageSrc(asset: LottieAsset, baseUrl?: string): string | null {
  if (asset.e === 1) {
    if (!asset.p) return null;
    if (asset.p.startsWith("data:")) return asset.p;
    return `data:image/png;base64,${asset.p}`;
  }
  if (asset.u) {
    const relative = asset.u + (asset.p ?? "");
    if (baseUrl) {
      try {
        return new URL(relative, baseUrl).toString();
      } catch {
        // Keep the original path for non-URL sources.
      }
    }
    return relative;
  }
  if (asset.p && baseUrl) {
    try {
      return new URL(asset.p, baseUrl).toString();
    } catch {
      // Keep the original path for non-URL sources.
    }
  }
  return asset.p ?? null;
}

function renderImageLayer(
  ctx: CanvasRenderingContext2D,
  asset: LottieAsset,
  matrix: Mat2D,
  opts: RenderOptions
): void {
  const src = resolveImageSrc(asset, opts.sourceUrl);
  if (!src) return;

  const cacheKey = `${asset.id}:${src}`;
  let img = opts.imageCache.get(cacheKey);
  if (!img) {
    img = new Image();
    img.src = src;
    opts.imageCache.set(cacheKey, img);
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

function getTextDocument(layer: LottieLayer, frame: number): TextDocumentData | null {
  const keyframes = layer.t?.d?.k;
  if (!keyframes || keyframes.length === 0) return null;
  let selected = keyframes[0]?.s;
  for (const keyframe of keyframes) {
    if ((keyframe.t ?? 0) <= frame && keyframe.s) selected = keyframe.s;
  }
  return selected ?? null;
}

function renderTextLayer(ctx: CanvasRenderingContext2D, layer: LottieLayer, matrix: Mat2D, frame: number): void {
  const data = getTextDocument(layer, frame);
  const text = data?.t ?? "";
  if (!data || !text) return;
  const size = Math.max(1, data.s ?? data.sz ?? 16);
  const family = data.f || "sans-serif";
  const color = data.fc ?? [0, 0, 0];
  const strokeColor = data.sc ?? null;
  const tracking = (data.tr ?? data.ls ?? 0) / 10;
  const lineHeight = data.lh ?? size * 1.2;
  const lines = text.split(/\r?\n/);
  ctx.save();
  ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = `rgba(${Math.round((color[0] ?? 0) * 255)}, ${Math.round((color[1] ?? 0) * 255)}, ${Math.round((color[2] ?? 0) * 255)}, 1)`;
  if (strokeColor) {
    ctx.strokeStyle = `rgba(${Math.round((strokeColor[0] ?? 0) * 255)}, ${Math.round((strokeColor[1] ?? 0) * 255)}, ${Math.round((strokeColor[2] ?? 0) * 255)}, 1)`;
    ctx.lineWidth = Math.max(0, data.sw ?? 0);
  }
  ctx.textBaseline = "alphabetic";
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const width = ctx.measureText(line).width + Math.max(0, line.length - 1) * tracking;
    const x = data.j === 1 ? -width : data.j === 2 ? -width / 2 : 0;
    if (tracking === 0) {
      ctx.fillText(line, x, index * lineHeight);
      if (strokeColor && (data.sw ?? 0) > 0) ctx.strokeText(line, x, index * lineHeight);
    } else {
      let cursor = x;
      for (const character of line) {
        ctx.fillText(character, cursor, index * lineHeight);
        if (strokeColor && (data.sw ?? 0) > 0) ctx.strokeText(character, cursor, index * lineHeight);
        cursor += ctx.measureText(character).width + tracking;
      }
    }
  }
  ctx.restore();
}

function applyLayerEffects(ctx: CanvasRenderingContext2D, layer: LottieLayer): void {
  const filters: string[] = [];
  for (const effect of layer.ef ?? []) {
    if (effect.en === 0) continue;
    if (effect.ty === 29 || effect.nm?.toLowerCase().includes("blur")) {
      const raw = effect.ef?.find((entry) => entry.ty === 0)?.v?.k;
      const amount = typeof raw === "number" ? raw : Array.isArray(raw) && typeof raw[0] === "number" ? raw[0] : 0;
      filters.push(`blur(${Math.max(0, amount ?? 0)}px)`);
    }
  }
  if (filters.length) ctx.filter = filters.join(" ");
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
  let layersByInd = opts.layerIndexCache?.get(layers);
  if (!layersByInd) {
    layersByInd = new Map<number, LottieLayer>();
    for (const l of layers) {
      if (l.ind != null) layersByInd.set(l.ind, l);
    }
    opts.layerIndexCache?.set(layers, layersByInd);
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
    const matteFrame = docFrame - (matteLayer.st ?? 0);
    const { opacity: ownOpacity } = computeLocalTransform(matteLayer.ks, matteFrame);
    const opacity = parentOpacity * ownOpacity;

    const scratch = makeCanvas(opts.canvasWidth, opts.canvasHeight);
    scratch.ctx.save();
    scratch.ctx.globalAlpha = opacity;
    renderMaskedLayer(scratch.ctx, matteLayer, assetsById, matrix, matteFrame, opts);
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
    const layerFrame = docFrame - (layer.st ?? 0);
    const { opacity: ownOpacity } = computeLocalTransform(layer.ks, layerFrame);
    const opacity = parentOpacity * ownOpacity;

    const matteIndex = layer.tt
      ? layer.tp != null
        ? layers.findIndex((candidate) => candidate.ind === layer.tp)
        : idx - 1
      : -1;
    const matteLayer = matteIndex >= 0 ? layers[matteIndex] : null;
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

    applyLayerEffects(drawCtx, layer);

    if (layer.masksProperties?.some((mask) => (mask.mode ?? "a") !== "n")) {
      renderMaskedLayer(drawCtx, layer, assetsById, matrix, layerFrame, opts);
    } else {
      renderSingleLayer(drawCtx, layer, assetsById, matrix, 1, layerFrame, opts);
    }

    drawCtx.restore();

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
        warnOnce: opts.warnOnce,
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
        : docFrame / stretch;
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
      renderTextLayer(ctx, layer, matrix, docFrame);
      break;
    default:
      opts.warnOnce(
        `layer-type:${layer.ty}`,
        `[@core-ease/telegram-kit] Unsupported Lottie layer type ${layer.ty}; the layer was skipped.`
      );
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
  const assetsById = opts.assetsById ?? buildAssetsMap(doc);
  opts.ctx.save();
  opts.ctx.clearRect(0, 0, opts.canvasWidth, opts.canvasHeight);
  const scaleX = opts.canvasWidth / doc.w;
  const scaleY = opts.canvasHeight / doc.h;
  const base: Mat2D = [scaleX, 0, 0, scaleY, 0, 0];
  renderLayers(opts.ctx, doc.layers, assetsById, base, 1, frame, opts);
  opts.ctx.restore();
}
