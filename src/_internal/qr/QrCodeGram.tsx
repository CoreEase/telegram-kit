import React, { useMemo } from 'react';
import { encodeQRCode } from './Qr';
import type { ErrorCorrectionLevel } from './Qr';

export interface QRCodeGramProps {
  value: string;
  size?: number;
  errorCorrectionLevel?: ErrorCorrectionLevel;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const QRCodeGram = React.forwardRef<SVGSVGElement, QRCodeGramProps>(function QRCodeGram(
  {
    value,
    size = 256,
    errorCorrectionLevel = 'L',
    backgroundColor = '#ffffff',
    className = '',
    style = {},
  },
  ref
) {
  const result = useMemo(() => {
    if (!value) return null;
    try {
      return encodeQRCode(value, { errorCorrectionLevel });
    } catch {
      return null;
    }
  }, [value, errorCorrectionLevel]);

  if (!result) return null;

  const { modules } = result;
  const matrixSize = modules.length;
  
  const padding = size * 0.08;
  const qrSize = size - padding * 2;
  const cellSize = qrSize / matrixSize;

  const isEyeModule = (r: number, c: number): boolean =>
    (r < 7 && c < 7) || (r < 7 && c >= matrixSize - 7) || (r >= matrixSize - 7 && c < 7);

  const isRenderable = (r: number, c: number): boolean =>
    modules[r]?.[c] === true && !isEyeModule(r, c);

  const getLogoPath = () => {
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = size * 0.38;
    const innerRadius = size * 0.28;
    
    const points = 8;
    const pathPoints = [];
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }
    
    pathPoints.push('Z');
    return pathPoints.join(' ');
  };

  const getInnerShapePath = () => {
    const cx = size / 2;
    const cy = size / 2;
    const innerRadius = size * 0.25;
    
    const points = 8;
    const pathPoints = [];
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? innerRadius : innerRadius * 0.65;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }
    
    pathPoints.push('Z');
    return pathPoints.join(' ');
  };

  const renderDots = () => {
    const elements: React.ReactElement[] = [];
    const startX = padding;
    const startY = padding;
    
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (!isRenderable(r, c)) continue;
        
        const x = startX + c * cellSize;
        const y = startY + r * cellSize;
        
        const cx = size / 2;
        const cy = size / 2;
        const centerX = x + cellSize / 2;
        const centerY = y + cellSize / 2;
        
        const dx = centerX - cx;
        const dy = centerY - cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxRadius = size * 0.35;
        
        if (distance > maxRadius) continue;
        
        const dotSize = cellSize * 0.7;
        elements.push(
          <rect
            key={`${r}-${c}`}
            x={x + (cellSize - dotSize) / 2}
            y={y + (cellSize - dotSize) / 2}
            width={dotSize}
            height={dotSize}
            fill="#000000"
            rx={dotSize * 0.2}
          />
        );
      }
    }
    return elements;
  };

  const renderEyes = () => {
    const elements: React.ReactElement[] = [];
    const startX = padding;
    const startY = padding;
    
    const eyePositions = [
      { row: 0, col: 0 },
      { row: 0, col: matrixSize - 7 },
      { row: matrixSize - 7, col: 0 },
    ];
    
    eyePositions.forEach((pos, index) => {
      const eyeX = startX + pos.col * cellSize;
      const eyeY = startY + pos.row * cellSize;
      const eyeSize = cellSize * 7;
      const dotSize = cellSize * 2.5;
      const innerSize = cellSize * 5;
      
      const cx = size / 2;
      const cy = size / 2;
      const centerX = eyeX + eyeSize / 2;
      const centerY = eyeY + eyeSize / 2;
      
      const dx = centerX - cx;
      const dy = centerY - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = size * 0.35;
      
      if (distance > maxRadius) return;
      
      elements.push(
        <g key={`eye-${index}`}>
          <rect
            x={eyeX}
            y={eyeY}
            width={eyeSize}
            height={eyeSize}
            fill="#000000"
            rx={cellSize * 0.5}
          />
          <rect
            x={eyeX + (eyeSize - innerSize) / 2}
            y={eyeY + (eyeSize - innerSize) / 2}
            width={innerSize}
            height={innerSize}
            fill={backgroundColor}
            rx={cellSize * 0.5}
          />
          <rect
            x={eyeX + (eyeSize - dotSize) / 2}
            y={eyeY + (eyeSize - dotSize) / 2}
            width={dotSize}
            height={dotSize}
            fill="#000000"
            rx={cellSize * 0.5}
          />
        </g>
      );
    });
    
    return elements;
  };

  const renderWhiteShape = () => {
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = size * 0.38;
    const innerRadius = size * 0.28;
    
    const points = 8;
    const pathPoints = [];
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }
    
    pathPoints.push('Z');
    return pathPoints.join(' ');
  };

  const renderBlueShape = () => {
    const cx = size / 2;
    const cy = size / 2;
    const outerRadius = size * 0.38;
    const innerRadius = size * 0.28;
    
    const points = 8;
    const pathPoints = [];
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius * 1.02 : innerRadius * 1.02;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      pathPoints.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
    }
    
    pathPoints.push('Z');
    return pathPoints.join(' ');
  };

  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={style}
    >
      <rect width={size} height={size} fill={backgroundColor} rx={size * 0.05} />
      
      <clipPath id="logoClip">
        <path d={renderBlueShape()} />
      </clipPath>
      
      <g clipPath="url(#logoClip)">
        <rect width={size} height={size} fill="#30A1F5" />
        {renderDots()}
        {renderEyes()}
      </g>
      
      <path d={renderWhiteShape()} fill="none" stroke="#30A1F5" strokeWidth={size * 0.02} />
      
      <path
        d="M60.268 24.224c.537-1.45 2.59-1.45 3.126 0l3.71 10.027a2.2 2.2 0 0 0 1.3 1.3l10.027 3.71c1.451.537 1.451 2.59 0 3.126l-10.027 3.71a2.2 2.2 0 0 0-1.3 1.3l-3.71 10.027c-.537 1.451-2.59 1.451-3.126 0l-3.71-10.027a2.2 2.2 0 0 0-1.3-1.3l-10.027-3.71c-1.451-.537-1.451-2.589 0-3.126l10.027-3.71a2.2 2.2 0 0 0 1.3-1.3l3.71-10.027z"
        fill="#ffffff"
        transform={`translate(${size * 0.5 - 50}, ${size * 0.5 - 50}) scale(${size / 100})`}
      />
    </svg>
  );
});

QRCodeGram.displayName = 'QRCodeGram';
