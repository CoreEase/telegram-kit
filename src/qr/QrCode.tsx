import React, { useMemo } from 'react';
import { encodeQRCode } from './Qr';
import type { ErrorCorrectionLevel } from './Qr';

export interface QRCodeProps {
  value: string;
  size?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  dotColor?: string;
  eyeColor?: string;
  backgroundColor?: string;
  logo?: string;
  logoSize?: number;
  logoPadding?: number;
  quietZone?: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

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
