import { encodeQRCode } from './Qr';
import type { ErrorCorrectionLevel } from './Qr';

export type QRDotShape = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type QRCornerSquareShape = 'square' | 'dot' | 'rounded' | 'classy';
export type QRCornerDotShape = 'square' | 'dot' | 'rounded';
export type QRLogoShape = 'circle' | 'square' | 'rounded' | 'none';

export interface GenerateStyledQROptions {
  value: string;
  size?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  dotsOptions?: {
    color?: string;
    style?: QRDotShape;
  };
  cornersSquareOptions?: {
    color?: string;
    style?: QRCornerSquareShape;
    outerSize?: number;
    innerSize?: number;
  };
  cornersDotOptions?: {
    color?: string;
    style?: QRCornerDotShape;
    dotSize?: number;
  };
  dotColor?: string;
  eyeColor?: string;
  backgroundColor?: string;
  logo?: string;
  logoSize?: number;
  logoPadding?: number;
  logoShape?: QRLogoShape;
  logoBackgroundColor?: string;
  quietZone?: number;
  borderRadius?: number;
}

function roundedRectPath(
  cx: number,
  cy: number,
  halfSize: number,
  radii: { tl: number; tr: number; br: number; bl: number }
): string {
  const x = cx - halfSize;
  const y = cy - halfSize;
  const w = halfSize * 2;
  const h = halfSize * 2;
  const { tl, tr, br, bl } = radii;

  return [
    `M${x + tl},${y}`,
    `L${x + w - tr},${y}`,
    tr > 0 ? `A${tr},${tr} 0 0 1 ${x + w},${y + tr}` : '',
    `L${x + w},${y + h - br}`,
    br > 0 ? `A${br},${br} 0 0 1 ${x + w - br},${y + h}` : '',
    `L${x + bl},${y + h}`,
    bl > 0 ? `A${bl},${bl} 0 0 1 ${x},${y + h - bl}` : '',
    `L${x},${y + tl}`,
    tl > 0 ? `A${tl},${tl} 0 0 1 ${x + tl},${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join('');
}

function dotPath(
  cx: number,
  cy: number,
  cellSize: number,
  shape: QRDotShape,
  neighbors: { top: boolean; right: boolean; bottom: boolean; left: boolean }
): { d?: string; circle?: boolean } {
  const half = cellSize / 2;

  if (shape === 'square') {
    return { d: roundedRectPath(cx, cy, half * 0.98, { tl: 0, tr: 0, br: 0, bl: 0 }) };
  }
  if (shape === 'dots') {
    return { circle: true };
  }

  const isolatedCorner = (a: boolean, b: boolean) => (a ? 0 : 1) + (b ? 0 : 1) === 2;

  if (shape === 'rounded' || shape === 'extra-rounded') {
    const r = half * (shape === 'extra-rounded' ? 0.7 : 0.5);
    return {
      d: roundedRectPath(cx, cy, half * 0.98, {
        tl: isolatedCorner(neighbors.top, neighbors.left) ? r : 0,
        tr: isolatedCorner(neighbors.top, neighbors.right) ? r : 0,
        br: isolatedCorner(neighbors.bottom, neighbors.right) ? r : 0,
        bl: isolatedCorner(neighbors.bottom, neighbors.left) ? r : 0,
      }),
    };
  }

  const r = half * (shape === 'classy-rounded' ? 0.65 : 0.4);
  return {
    d: roundedRectPath(cx, cy, half * 0.98, {
      tl: isolatedCorner(neighbors.top, neighbors.left) ? r : 0,
      br: isolatedCorner(neighbors.bottom, neighbors.right) ? r : 0,
      tr: 0,
      bl: 0,
    }),
  };
}

export function generateStyledQRSVG(options: GenerateStyledQROptions): string {
  const {
    value,
    size = 512,
    errorCorrectionLevel,
    dotsOptions,
    cornersSquareOptions,
    cornersDotOptions,
    dotColor = '#000000',
    eyeColor,
    backgroundColor = '#ffffff',
    logo,
    logoSize,
    logoPadding = 2,
    logoShape = 'circle',
    logoBackgroundColor = 'transparent',
    quietZone = 4,
    borderRadius = 0,
  } = options;

  const resolvedDotColor = dotsOptions?.color ?? dotColor;
  const resolvedDotShape: QRDotShape = dotsOptions?.style ?? 'square';
  const resolvedCornerSquareColor = cornersSquareOptions?.color ?? eyeColor ?? resolvedDotColor;
  const resolvedCornerSquareShape: QRCornerSquareShape = cornersSquareOptions?.style ?? 'square';
  const resolvedCornerDotColor = cornersDotOptions?.color ?? resolvedCornerSquareColor;
  const resolvedCornerDotShape: QRCornerDotShape = cornersDotOptions?.style ?? 'square';
  const resolvedCornerOuterSize = cornersSquareOptions?.outerSize ?? 3.5;
  const resolvedCornerInnerSize = cornersSquareOptions?.innerSize ?? 2.5;
  const resolvedCornerDotSize = cornersDotOptions?.dotSize ?? 1.5;

  const isStylized =
    resolvedDotShape !== 'square' ||
    resolvedCornerSquareShape !== 'square' ||
    resolvedCornerDotShape !== 'square';

  const resolvedLevel: ErrorCorrectionLevel =
    errorCorrectionLevel ?? (isStylized ? 'Q' : 'M');

  const result = encodeQRCode(value, { errorCorrectionLevel: resolvedLevel });
  if (!result) throw new Error('Failed to encode QR');

  const { modules } = result;
  const matrixSize = modules.length;
  const dimension = matrixSize + quietZone * 2;
  const cellSize = size / dimension;

  const isEyeModule = (r: number, c: number) =>
    (r < 7 && c < 7) ||
    (r < 7 && c >= matrixSize - 7) ||
    (r >= matrixSize - 7 && c < 7);

  let logoClearRadiusPx = 0;
  let effectiveLogoImageSize = 0;

  if (logo) {
    const requestedLogoSize = logoSize ?? size * 0.2;
    const requestedRadiusPx = requestedLogoSize / 2 + logoPadding;
    const requestedRadiusModules = requestedRadiusPx / cellSize;

    const MAX_SAFE: Record<ErrorCorrectionLevel, number> = {
      L: 0.06,
      M: 0.13,
      Q: 0.2,
      H: 0.27,
    };

    let clearRadiusModules = requestedRadiusModules;
    const maxAreaRatio = MAX_SAFE[resolvedLevel];
    const requestedAreaRatio = (Math.PI * requestedRadiusModules ** 2) / (matrixSize * matrixSize);

    if (requestedAreaRatio > maxAreaRatio) {
      clearRadiusModules = Math.sqrt((maxAreaRatio * matrixSize * matrixSize) / Math.PI);
    }

    clearRadiusModules = Math.min(clearRadiusModules, Math.max(matrixSize / 2 - 8, 0));
    logoClearRadiusPx = clearRadiusModules * cellSize;
    effectiveLogoImageSize = Math.max(0, logoClearRadiusPx * 2 - logoPadding * 2);
  }

  const centerModule = matrixSize / 2;

  const isInLogoClearZone = (r: number, c: number) => {
    if (!logo || logoClearRadiusPx <= 0) return false;
    const dx = c + 0.5 - centerModule;
    const dy = r + 0.5 - centerModule;
    const radiusModules = logoClearRadiusPx / cellSize;

    if (logoShape === 'circle' || logoShape === 'none') {
      return Math.sqrt(dx * dx + dy * dy) < radiusModules;
    }
    return Math.abs(dx) < radiusModules && Math.abs(dy) < radiusModules;
  };

  const isRenderable = (r: number, c: number) =>
    modules[r]?.[c] === true && !isEyeModule(r, c) && !isInLogoClearZone(r, c);

  let paths = '';
  let circles = '';

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (!isRenderable(r, c)) continue;

      const cx = (c + quietZone + 0.5) * cellSize;
      const cy = (r + quietZone + 0.5) * cellSize;

      const neighbors = {
        top: isRenderable(r - 1, c),
        right: isRenderable(r, c + 1),
        bottom: isRenderable(r + 1, c),
        left: isRenderable(r, c - 1),
      };

      const shape = dotPath(cx, cy, cellSize, resolvedDotShape, neighbors);

      if (shape.circle) {
        circles += `<circle cx="${cx}" cy="${cy}" r="${cellSize * 0.46}" fill="${resolvedDotColor}"/>`;
      } else if (shape.d) {
        paths += `<path d="${shape.d}" fill="${resolvedDotColor}"/>`;
      }
    }
  }

  const eyePositions = [
    { x: 0, y: 0 },
    { x: matrixSize - 7, y: 0 },
    { x: 0, y: matrixSize - 7 },
  ];

  let eyes = '';

  for (const pos of eyePositions) {
    const cx = (pos.x + quietZone + 3.5) * cellSize;
    const cy = (pos.y + quietZone + 3.5) * cellSize;

    const outerHalf = cellSize * resolvedCornerOuterSize;
    const innerHalf = cellSize * resolvedCornerInnerSize;
    const strokeMid = (outerHalf + innerHalf) / 2;
    const strokeWidth = outerHalf - innerHalf;

    if (resolvedCornerSquareShape === 'dot') {
      eyes += `<circle cx="${cx}" cy="${cy}" r="${strokeMid}" fill="none" stroke="${resolvedCornerSquareColor}" stroke-width="${strokeWidth}"/>`;
    } else {
      const radius = resolvedCornerSquareShape === 'classy' ? outerHalf * 0.35 : outerHalf * 0.3;
      const outerRadii =
        resolvedCornerSquareShape === 'classy'
          ? { tl: radius, tr: 0, br: radius, bl: 0 }
          : { tl: radius, tr: radius, br: radius, bl: radius };

      const d = `${roundedRectPath(cx, cy, outerHalf, outerRadii)} ${roundedRectPath(cx, cy, innerHalf, outerRadii)}`;
      eyes += `<path d="${d}" fill="${resolvedCornerSquareColor}" fill-rule="evenodd"/>`;
    }

    const half = cellSize * resolvedCornerDotSize;
    if (resolvedCornerDotShape === 'dot') {
      eyes += `<circle cx="${cx}" cy="${cy}" r="${half}" fill="${resolvedCornerDotColor}"/>`;
    } else {
      const r = resolvedCornerDotShape === 'rounded' ? half * 0.4 : 0;
      eyes += `<path d="${roundedRectPath(cx, cy, half, { tl: r, tr: r, br: r, bl: r })}" fill="${resolvedCornerDotColor}"/>`;
    }
  }

  let logoSvg = '';
  if (logo && logoClearRadiusPx > 0) {
    const center = size / 2;

    if (logoBackgroundColor && logoBackgroundColor !== 'transparent') {
      if (logoShape === 'circle') {
        logoSvg += `<circle cx="${center}" cy="${center}" r="${logoClearRadiusPx}" fill="${logoBackgroundColor}"/>`;
      } else {
        const r = logoShape === 'rounded' ? logoClearRadiusPx * 0.25 : 0;
        logoSvg += `<path d="${roundedRectPath(center, center, logoClearRadiusPx, { tl: r, tr: r, br: r, bl: r })}" fill="${logoBackgroundColor}"/>`;
      }
    }

    const clipId = `logo-clip-${Math.random().toString(36).slice(2, 9)}`;
    let clipPath = '';

    if (logoShape === 'circle') {
      clipPath = `<clipPath id="${clipId}"><circle cx="${center}" cy="${center}" r="${logoClearRadiusPx}"/></clipPath>`;
    } else if (logoShape === 'rounded') {
      const r = logoClearRadiusPx * 0.25;
      clipPath = `<clipPath id="${clipId}"><rect x="${center - logoClearRadiusPx}" y="${center - logoClearRadiusPx}" width="${logoClearRadiusPx * 2}" height="${logoClearRadiusPx * 2}" rx="${r}" ry="${r}"/></clipPath>`;
    } else {
      clipPath = `<clipPath id="${clipId}"><rect x="${center - logoClearRadiusPx}" y="${center - logoClearRadiusPx}" width="${logoClearRadiusPx * 2}" height="${logoClearRadiusPx * 2}"/></clipPath>`;
    }

    logoSvg =
      clipPath +
      logoSvg +
      `<image href="${logo}" x="${center - effectiveLogoImageSize / 2}" y="${center - effectiveLogoImageSize / 2}" width="${effectiveLogoImageSize}" height="${effectiveLogoImageSize}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${clipId})"/>`;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${backgroundColor !== 'transparent' ? `<rect width="${size}" height="${size}" fill="${backgroundColor}" rx="${borderRadius}" ry="${borderRadius}"/>` : ''}
  ${paths}
  ${circles}
  ${eyes}
  ${logoSvg}
</svg>`.trim();
}
