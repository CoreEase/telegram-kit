export function generateGradientCanvas(colors: number[]): HTMLCanvasElement {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, size, size, 0);
  const n = Math.max(1, colors.length - 1);
  colors.forEach((hex, i) => g.addColorStop(i / n, "#" + hex.toString(16).padStart(6, "0")));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
