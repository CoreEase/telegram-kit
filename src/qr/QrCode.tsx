import React, { useMemo } from 'react';
import { encodeQRCode } from './qr';
import type { ErrorCorrectionLevel } from './qr';

export interface QRCodeProps {
  /** The text/URL to encode. */
  value: string;
  /** Pixel size of the rendered SVG (square). Default: 256. */
  size?: number;
  /** Error correction level. Default: 'M', or 'H' automatically when `logo` is set. */
  errorCorrectionLevel?: ErrorCorrectionLevel;
  /** Color of the data modules (dots). Default: '#000'. */
  dotColor?: string;
  /** Color of the three finder pattern "eyes". Default: same as `dotColor`. */
  eyeColor?: string;
  /** Background color, or 'transparent'. Default: 'transparent'. */
  backgroundColor?: string;
  /** Optional logo image (URL or data URI) rendered in the center. */
  logo?: string;
  /** Logo diameter in pixels. Default: size * 0.2. */
  logoSize?: number;
  /** Padding (in pixels) between the logo and its background circle. Default: 8. */
  logoPadding?: number;
  /**
   * Quiet zone width, in modules, around the QR symbol. ISO/IEC 18004
   * recommends at least 4 for reliable scanning. Default: 4.
   */
  quietZone?: number;
  /** Border radius applied to the outer SVG, in pixels. Default: 0. */
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders a real, standards-compliant, scannable QR Code (ISO/IEC 18004)
 * as an inline SVG — not a decorative approximation.
 */
export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 256,
  errorCorrectionLevel,
  dotColor = '#000',
  eyeColor,
  backgroundColor = 'transparent',
  logo,
  logoSize,
  logoPadding = 8,
  quietZone = 4,
  borderRadius = 0,
  className = '',
  style = {},
}) => {
  const resolvedEyeColor = eyeColor ?? dotColor;
  const resolvedLevel: ErrorCorrectionLevel = errorCorrectionLevel ?? (logo ? 'H' : 'M');
  const resolvedLogoSize = logoSize ?? size * 0.2;

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

  const renderDots = () => {
    const dots: React.ReactElement[] = [];
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (!modules[r][c] || isEyeModule(r, c)) continue;
        const cx = (c + quietZone + 0.5) * cellSize;
        const cy = (r + quietZone + 0.5) * cellSize;
        dots.push(<circle key={`${r}-${c}`} cx={cx} cy={cy} r={cellSize * 0.46} fill={dotColor} />);
      }
    }
    return dots;
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
      const outerR = cellSize * 3.1;
      return (
        <g key={`eye-${i}`}>
          <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={resolvedEyeColor} strokeWidth={cellSize * 1.05} />
          <circle cx={cx} cy={cy} r={cellSize * 1.35} fill={resolvedEyeColor} />
        </g>
      );
    });
  };

  const renderLogo = () => {
    if (!logo) return null;
    const center = size / 2;
    return (
      <g>
        <circle
          cx={center}
          cy={center}
          r={resolvedLogoSize / 2 + logoPadding}
          fill={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
        />
        <image
          href={logo}
          x={center - resolvedLogoSize / 2}
          y={center - resolvedLogoSize / 2}
          width={resolvedLogoSize}
          height={resolvedLogoSize}
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
        backgroundColor: backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
        borderRadius: `${borderRadius}px`,
        ...style,
      }}
    >
      {renderDots()}
      {renderEyes()}
      {renderLogo()}
    </svg>
  );
};
