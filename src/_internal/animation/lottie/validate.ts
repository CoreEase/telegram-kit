import type { LottieAnimation, LottieLayer, ShapeItem } from "./types";

export function checkTgsCompliance(data: LottieAnimation & { tgs?: number }): string[] {
  const errors: string[] = [];

  if (data.tgs !== 1) {
    errors.push("Must be marked as a TGS Lottie variant (tgs: 1)");
  }

  if ((data.op - data.ip) / data.fr > 3.0) {
    errors.push("Longer than 3 seconds");
  }

  if (data.w !== 512 || data.h !== 512) {
    errors.push("Dimensions should be exactly 512x512px");
  }

  if (data.ddd != null && data.ddd !== 0) {
    errors.push("Must not have 3D layers");
  }

  if (data.markers && data.markers.length > 0) {
    errors.push("Must not have markers");
  }

  for (const asset of data.assets ?? []) {
    if (asset.layers) {
      for (const layer of asset.layers) errors.push(...checkLayer(layer));
    }
  }

  for (const layer of data.layers ?? []) {
    errors.push(...checkLayer(layer));
  }

  return errors;
}

function checkLayer(layer: LottieLayer): string[] {
  const errors: string[] = [];

  if ((layer as any).ddd != null && (layer as any).ddd !== 0) {
    errors.push("Composition should not include any 3D Layers");
  }
  if (layer.sr != null && layer.sr !== 1) {
    errors.push("Composition should not include any Time Stretching");
  }
  if (layer.tm != null) {
    errors.push("Composition should not include any Time Remapping");
  }
  if (layer.ty === 1) errors.push("Composition should not include any Solids");
  if (layer.ty === 2) errors.push("Composition should not include any Images");
  if (layer.ty === 5) errors.push("Composition should not include any Texts");
  if (layer.masksProperties && layer.masksProperties.length > 0) {
    errors.push("Composition should not include any Masks");
  }
  if (layer.tt != null) errors.push("Composition should not include any Mattes");
  if (layer.ao === 1) errors.push("Composition should not include any Auto-Oriented Layers");
  if ((layer as any).ef != null) errors.push("Composition should not include any Layer Effects");

  if (layer.shapes) {
    errors.push(...checkItems(layer.shapes, true));
  }

  return errors;
}

function checkItems(items: ShapeItem[] | undefined, isShapesLevel: boolean): string[] {
  const errors: string[] = [];
  if (!items) return errors;

  for (const item of items) {
    if (item.ty === "rp") errors.push("Composition should not include any Repeaters");
    if (item.ty === "sr") errors.push("Composition should not include any Star Shapes");
    if (item.ty === "mm") errors.push("Composition should not include any Merge Paths");
    if (item.ty === "gs") errors.push("Composition should not include any Gradient Strokes");

    if (item.ty === "gr") {
      errors.push(...checkItems((item as any).it, false));
    }

    if (isShapesLevel) {
    }
  }

  return errors;
}
