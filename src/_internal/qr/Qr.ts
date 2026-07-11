import { encodeQrMatrix } from './encoder';
import type { QrEncodeOptions, QrEncodeResult } from './types';
import type { ErrorCorrectionLevel } from './tables';

export type { QrEncodeOptions, QrEncodeResult, ErrorCorrectionLevel };

export function encodeQRCode(text: string, options?: QrEncodeOptions): QrEncodeResult {
  return encodeQrMatrix(text, options);
}

export interface QrSvgOptions extends QrEncodeOptions {
  size?: number;
  color?: string;
  background?: string;
  quietZone?: number;
}

export function qrCodeToSVG(text: string, options: QrSvgOptions = {}): string {
  const { size = 512, color = '#000000', background = '#ffffff', quietZone = 4, ...encodeOptions } = options;
  const { modules } = encodeQrMatrix(text, encodeOptions);
  const dimension = modules.length + quietZone * 2;
  const cell = size / dimension;

  let path = '';
  for (let y = 0; y < modules.length; y++) {
    for (let x = 0; x < modules.length; x++) {
      if (!modules[y][x]) continue;
      const px = (x + quietZone) * cell;
      const py = (y + quietZone) * cell;
      path += `M${px} ${py}h${cell}v${cell}h${-cell}z`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">` +
    `<rect width="${size}" height="${size}" fill="${background}"/>` +
    `<path d="${path}" fill="${color}"/>` +
    `</svg>`
  );
}
