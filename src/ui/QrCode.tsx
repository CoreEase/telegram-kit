import React, { useMemo } from 'react';

export interface QRCodeProps {
  value: string;
  size?: number;
  dotColor?: string;
  eyeColor?: string;
  backgroundColor?: string;
  logo?: string;
  logoSize?: number;
  logoPadding?: number;
  margin?: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

const generateQRMatrix = (text: string): number[][] => {
  const size = 29;
  const matrix: number[][] = Array.from({ length: size }, () => Array(size).fill(0));

  const drawFinder = (x: number, y: number) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        if (i < 0 || j < 0 || i > 6 || j > 6) continue;
        const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
        const isInner = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        matrix[y + i][x + j] = isBorder || isInner ? 2 : 0;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  let seed = text.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 0);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] !== 0) continue;

      if (r >= 11 && r <= 17 && c >= 11 && c <= 17) {
        matrix[r][c] = 0;
        continue;
      }

      seed = (seed * 9301 + 49297) % 233280;
      matrix[r][c] = seed / 233280 > 0.42 ? 1 : 0;
    }
  }

  return matrix;
};

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 512,
  level = 'M',
  dotColor = '#000',
  eyeColor = '#000',
  backgroundColor = 'transparent',
  logo,
  logoSize = 72,
  logoPadding = 10,
  margin = 12,
  borderRadius = 20,
  className = '',
  style = {},
}) => {
  const matrix = useMemo(() => generateQRMatrix(value), [value]);

  const matrixSize = matrix.length;
  const cellSize = (size - margin * 2) / matrixSize;

  const renderCells = () => {
    const cells = [];
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        const cell = matrix[r][c];
        if (cell === 0) continue;

        const isEye = cell === 2;
        const cx = margin + (c + 0.5) * cellSize;
        const cy = margin + (r + 0.5) * cellSize;

        if (
          isEye &&
          ((r >= 1 && r <= 5 && c >= 1 && c <= 5) ||
            (r >= matrixSize - 6 && r <= matrixSize - 2 && c >= 1 && c <= 5) ||
            (r >= 1 && r <= 5 && c >= matrixSize - 6 && c <= matrixSize - 2))
        ) {
          continue;
        }

        cells.push(
          <circle
            key={`${r}-${c}`}
            cx={cx}
            cy={cy}
            r={cellSize * 0.46}
            fill={isEye ? eyeColor : dotColor}
          />
        );
      }
    }
    return cells;
  };

  const renderEyes = () => {
    const positions = [
      { x: 0, y: 0 },
      { x: matrixSize - 7, y: 0 },
      { x: 0, y: matrixSize - 7 },
    ];

    return positions.map((pos, i) => {
      const cx = margin + (pos.x + 3.5) * cellSize;
      const cy = margin + (pos.y + 3.5) * cellSize;
      const outerR = cellSize * 3.1;

      return (
        <g key={`eye-${i}`}>
          <circle
            cx={cx}
            cy={cy}
            r={outerR}
            fill="none"
            stroke={eyeColor}
            strokeWidth={cellSize * 1.05}
          />
          <circle cx={cx} cy={cy} r={cellSize * 1.35} fill={eyeColor} />
        </g>
      );
    });
  };

  const renderLogo = () => {
    if (!logo) return null;

    return (
      <g>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={logoSize / 2 + logoPadding}
          fill={backgroundColor === 'transparent' ? '#ffffff' : backgroundColor}
        />
        <image
          href={logo}
          x={size / 2 - logoSize / 2}
          y={size / 2 - logoSize / 2}
          width={logoSize}
          height={logoSize}
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
        backgroundColor:
          backgroundColor === 'transparent' ? 'transparent' : backgroundColor,
        borderRadius: `${borderRadius}px`,
        ...style,
      }}
    >
      {renderCells()}
      {renderEyes()}
      {renderLogo()}
    </svg>
  );
};
