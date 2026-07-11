import React, { useMemo } from 'react';
import { encodeQRCode } from './Qr';
import type { ErrorCorrectionLevel } from './Qr';

export type QRDotShape = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type QRCornerSquareShape = 'square' | 'dot' | 'rounded' | 'classy';
export type QRCornerDotShape = 'square' | 'dot' | 'rounded';
export type QRLogoShape = 'circle' | 'square' | 'rounded' | 'none';

export interface QRDotsOptions {
  color?: string;
  style?: QRDotShape;
}
export interface QRCornersSquareOptions {
  color?: string;
  style?: QRCornerSquareShape;
}
export interface QRCornersDotOptions {
  color?: string;
  style?: QRCornerDotShape;
}

export interface QRCodeProps {
  value: string;
  size?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  dotsOptions?: QRDotsOptions;
  cornersSquareOptions?: QRCornersSquareOptions;
  cornersDotOptions?: QRCornersDotOptions;
  dotColor?: string;
  eyeColor?: string;
  backgroundColor?: string;
  logo?: string;
  logoSize?: number;
  logoPadding?: number;
  logoShape?: QRLogoShape;
  logoBackgroundColor?: string;
  onLogoSizeClamped?: (clampedSizePx: number, requestedSizePx: number) => void;
  quietZone?: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
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

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 256,
  errorCorrectionLevel,
  dotsOptions,
  cornersSquareOptions,
  cornersDotOptions,
  dotColor = '#000',
  eyeColor,
  backgroundColor = 'transparent',
  logo,
  logoSize,
  logoPadding = 8,
  logoShape = 'circle',
  logoBackgroundColor,
  onLogoSizeClamped,
  quietZone = 4,
  borderRadius = 0,
  className = '',
  style = {},
}) => {
  const resolvedDotColor = dotsOptions?.color ?? dotColor;
  const resolvedDotShape: QRDotShape = dotsOptions?.style ?? 'square';
  const resolvedCornerSquareColor = cornersSquareOptions?.color ?? eyeColor ?? resolvedDotColor;
  const resolvedCornerSquareShape: QRCornerSquareShape = cornersSquareOptions?.style ?? 'square';
  const resolvedCornerDotColor = cornersDotOptions?.color ?? resolvedCornerSquareColor;
  const resolvedCornerDotShape: QRCornerDotShape = cornersDotOptions?.style ?? 'square';

  const isStylized =
    resolvedDotShape !== 'square' || resolvedCornerSquareShape !== 'square' || resolvedCornerDotShape !== 'square';
  const resolvedLevel: ErrorCorrectionLevel =
    errorCorrectionLevel ?? (logo ? 'H' : isStylized ? 'Q' : 'M');
  const requestedLogoSize = logoSize ?? size * 0.2;

  const result = useMemo(() => {
    if (!value) return null;
    try {
      return encodeQRCode(value, { errorCorrectionLevel: resolvedLevel });
    } catch {
      return null;
    }
  }, [value, resolvedLevel]);

  if (!result) return null;

  const { modules } = result;
  const matrixSize = modules.length;
  const dimension = matrixSize + quietZone * 2;
  const cellSize = size / dimension;

  const isEyeModule = (r: number, c: number): boolean =>
    (r < 7 && c < 7) || (r < 7 && c >= matrixSize - 7) || (r >= matrixSize - 7 && c < 7);

  const MAX_SAFE_LOGO_AREA_RATIO: Record<ErrorCorrectionLevel, number> = {
    L: 0.06,
    M: 0.13,
    Q: 0.2,
    H: 0.27,
  };

  let logoClearRadiusPx = 0;
  let effectiveLogoImageSize = 0;
  if (logo) {
    const requestedRadiusPx = requestedLogoSize / 2 + logoPadding;
    const requestedRadiusModules = requestedRadiusPx / cellSize;
    const requestedAreaRatio = (Math.PI * requestedRadiusModules ** 2) / (matrixSize * matrixSize);

    let clearRadiusModules = requestedRadiusModules;

    const maxAreaRatio = MAX_SAFE_LOGO_AREA_RATIO[resolvedLevel];
    if (requestedAreaRatio > maxAreaRatio) {
      clearRadiusModules = Math.sqrt((maxAreaRatio * matrixSize * matrixSize) / Math.PI);
    }
    const maxRadiusByBorder = Math.max(matrixSize / 2 - 8, 0);
    clearRadiusModules = Math.min(clearRadiusModules, maxRadiusByBorder);

    logoClearRadiusPx = clearRadiusModules * cellSize;
    effectiveLogoImageSize = Math.max(0, logoClearRadiusPx * 2 - logoPadding * 2);

    const requestedTotalSize = requestedLogoSize + logoPadding * 2;
    const effectiveTotalSize = logoClearRadiusPx * 2;
    if (onLogoSizeClamped && effectiveTotalSize < requestedTotalSize - 0.5) {
      onLogoSizeClamped(effectiveTotalSize, requestedTotalSize);
    }
  }

  const centerModule = matrixSize / 2;
  const isInLogoClearZone = (r: number, c: number): boolean => {
    if (!logo || logoClearRadiusPx <= 0) return false;
    const dx = c + 0.5 - centerModule;
    const dy = r + 0.5 - centerModule;
    const radiusModules = logoClearRadiusPx / cellSize;
    if (logoShape === 'circle' || logoShape === 'none') {
      return Math.sqrt(dx * dx + dy * dy) < radiusModules;
    }
    const half = radiusModules;
    return Math.abs(dx) < half && Math.abs(dy) < half;
  };

  const isRenderable = (r: number, c: number): boolean =>
    modules[r]?.[c] === true && !isEyeModule(r, c) && !isInLogoClearZone(r, c);

  const renderDots = () => {
    const elements: React.ReactElement[] = [];
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
          elements.push(
            <circle key={`${r}-${c}`} cx={cx} cy={cy} r={cellSize * 0.46} fill={resolvedDotColor} />
          );
        } else if (shape.d) {
          elements.push(<path key={`${r}-${c}`} d={shape.d} fill={resolvedDotColor} />);
        }
      }
    }
    return elements;
  };

  const renderCornerSquare = (cx: number, cy: number, key: string) => {
    const outerHalf = cellSize * 3.5;
    const innerHalf = cellSize * 2.5;
    const strokeMid = (outerHalf + innerHalf) / 2;
    const strokeWidth = outerHalf - innerHalf;

    if (resolvedCornerSquareShape === 'dot') {
      return (
        <circle
          key={key}
          cx={cx}
          cy={cy}
          r={strokeMid}
          fill="none"
          stroke={resolvedCornerSquareColor}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (resolvedCornerSquareShape === 'square') {
      const d = `${roundedRectPath(cx, cy, outerHalf, { tl: 0, tr: 0, br: 0, bl: 0 })}${roundedRectPath(
        cx,
        cy,
        innerHalf,
        { tl: 0, tr: 0, br: 0, bl: 0 }
      )}`;
      return <path key={key} d={d} fill={resolvedCornerSquareColor} fillRule="evenodd" />;
    }
    const radius = resolvedCornerSquareShape === 'classy' ? outerHalf * 0.35 : outerHalf * 0.3;
    const outerRadii =
      resolvedCornerSquareShape === 'classy'
        ? { tl: radius, tr: 0, br: radius, bl: 0 }
        : { tl: radius, tr: radius, br: radius, bl: radius };
    const d = `${roundedRectPath(cx, cy, outerHalf, outerRadii)}${roundedRectPath(cx, cy, innerHalf, outerRadii)}`;
    return <path key={key} d={d} fill={resolvedCornerSquareColor} fillRule="evenodd" />;
  };

  const renderCornerDot = (cx: number, cy: number, key: string) => {
    const half = cellSize * 1.5;
    if (resolvedCornerDotShape === 'dot') {
      return <circle key={key} cx={cx} cy={cy} r={half} fill={resolvedCornerDotColor} />;
    }
    const radius = resolvedCornerDotShape === 'rounded' ? half * 0.4 : 0;
    return (
      <path
        key={key}
        d={roundedRectPath(cx, cy, half, { tl: radius, tr: radius, br: radius, bl: radius })}
        fill={resolvedCornerDotColor}
      />
    );
  };

  const renderEyes = () => {
    const positions = [
      { x: 0, y: 0 },
      { x: matrixSize - 7, y: 0 },
      { x: 0, y: matrixSize - 7 },
    ];
    return positions.map((pos, i) => {
      const cx = (pos.x + quietZone + 3.5) * cellSize;
      const cy = (pos.y + quietZone + 3.5) * cellSize;
      return (
        <g key={`eye-${i}`}>
          {renderCornerSquare(cx, cy, `eye-square-${i}`)}
          {renderCornerDot(cx, cy, `eye-dot-${i}`)}
        </g>
      );
    });
  };

  const renderLogo = () => {
    if (!logo || logoClearRadiusPx <= 0) return null;
    const center = size / 2;
    const backdropColor =
      logoBackgroundColor ?? (backgroundColor === 'transparent' ? '#ffffff' : backgroundColor);

    let backdrop: React.ReactElement | null = null;
    if (logoShape === 'circle') {
      backdrop = <circle cx={center} cy={center} r={logoClearRadiusPx} fill={backdropColor} />;
    } else if (logoShape === 'square' || logoShape === 'rounded') {
      const radii =
        logoShape === 'rounded'
          ? { tl: logoClearRadiusPx * 0.25, tr: logoClearRadiusPx * 0.25, br: logoClearRadiusPx * 0.25, bl: logoClearRadiusPx * 0.25 }
          : { tl: 0, tr: 0, br: 0, bl: 0 };
      backdrop = <path d={roundedRectPath(center, center, logoClearRadiusPx, radii)} fill={backdropColor} />;
    }

    return (
      <g>
        {backdrop}
        <image
          href={logo}
          x={center - effectiveLogoImageSize / 2}
          y={center - effectiveLogoImageSize / 2}
          width={effectiveLogoImageSize}
          height={effectiveLogoImageSize}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{
        borderRadius: `${borderRadius}px`,
        overflow: borderRadius ? 'hidden' : undefined,
        ...style,
      }}
    >
      {backgroundColor !== 'transparent' && (
        <rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
      )}
      {renderDots()}
      {renderEyes()}
      {renderLogo()}
    </svg>
  );
};
