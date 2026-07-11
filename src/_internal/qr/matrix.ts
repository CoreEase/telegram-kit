import { type ErrorCorrectionLevel, FORMAT_EC_BITS, getAlignmentPatternPositions, symbolSize } from './tables';

function createGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

function drawFinderPattern(modules: boolean[][], isFunction: boolean[][], cx: number, cy: number): void {
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));

      modules[y][x] = ring !== 2;
      isFunction[y][x] = true;
    }
  }
}

function drawAlignmentPattern(modules: boolean[][], isFunction: boolean[][], cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      modules[y][x] = ring !== 1;
      isFunction[y][x] = true;
    }
  }
}

export function drawFunctionPatterns(modules: boolean[][], isFunction: boolean[][], version: number): void {
  const size = modules.length;

  drawFinderPattern(modules, isFunction, 3, 3);
  drawFinderPattern(modules, isFunction, size - 4, 3);
  drawFinderPattern(modules, isFunction, 3, size - 4);

  const markSeparator = (x: number, y: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) isFunction[y][x] = true;
  };
  for (let i = 0; i < 8; i++) {
    markSeparator(7, i);
    markSeparator(i, 7);
    markSeparator(size - 8, i);
    markSeparator(size - 1 - i, 7);
    markSeparator(7, size - 1 - i);
    markSeparator(i, size - 8);
  }

  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0;
    isFunction[6][i] = true;
    modules[i][6] = i % 2 === 0;
    isFunction[i][6] = true;
  }

  const positions = getAlignmentPatternPositions(version);
  for (const cy of positions) {
    for (const cx of positions) {
      const overlapsFinder =
        (cx <= 8 && cy <= 8) || (cx >= size - 9 && cy <= 8) || (cx <= 8 && cy >= size - 9);
      if (overlapsFinder) continue;
      drawAlignmentPattern(modules, isFunction, cx, cy);
    }
  }

  modules[size - 8][8] = true;
  isFunction[size - 8][8] = true;

  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    isFunction[8][size - 1 - i] = true;
    isFunction[size - 1 - i][8] = true;
  }

  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        isFunction[size - 11 + j][i] = true;
        isFunction[i][size - 11 + j] = true;
      }
    }
  }
}

export function placeDataBits(modules: boolean[][], isFunction: boolean[][], dataBits: number[]): void {
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (isFunction[y][x]) continue;
        if (bitIndex < dataBits.length) {
          modules[y][x] = dataBits[bitIndex] === 1;
          bitIndex++;
        }
      }
    }
    upward = !upward;
  }
}

export function applyMask(modules: boolean[][], isFunction: boolean[][], maskId: number): boolean[][] {
  const size = modules.length;
  const out = createGrid(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y][x] = modules[y][x];
      if (isFunction[y][x]) continue;

      let invert: boolean;
      switch (maskId) {
        case 0: invert = (x + y) % 2 === 0; break;
        case 1: invert = y % 2 === 0; break;
        case 2: invert = x % 3 === 0; break;
        case 3: invert = (x + y) % 3 === 0; break;
        case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
        case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
        case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        default: invert = false;
      }
      if (invert) out[y][x] = !out[y][x];
    }
  }
  return out;
}

const FINDER_PENALTY_PATTERN_A = [true, false, true, true, true, false, true, false, false, false, false];
const FINDER_PENALTY_PATTERN_B = [false, false, false, false, true, false, true, true, true, false, true];

function matchesFinderPenaltyPattern(bits: boolean[]): boolean {
  const eq = (pattern: boolean[]) => pattern.every((v, i) => v === bits[i]);
  return eq(FINDER_PENALTY_PATTERN_A) || eq(FINDER_PENALTY_PATTERN_B);
}

export function computeMaskPenalty(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  const runPenalty = (getCell: (i: number, j: number) => boolean): number => {
    let p = 0;
    for (let i = 0; i < size; i++) {
      let runColor: boolean | null = null;
      let runLen = 0;
      for (let j = 0; j < size; j++) {
        const c = getCell(i, j);
        if (c === runColor) {
          runLen++;
        } else {
          if (runLen >= 5) p += 3 + (runLen - 5);
          runColor = c;
          runLen = 1;
        }
      }
      if (runLen >= 5) p += 3 + (runLen - 5);
    }
    return p;
  };
  penalty += runPenalty((r, c) => modules[r][c]);
  penalty += runPenalty((r, c) => modules[c][r]);

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = modules[y][x];
      if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) {
        penalty += 3;
      }
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x <= size - 11; x++) {
      const bits: boolean[] = [];
      for (let k = 0; k < 11; k++) bits.push(modules[y][x + k]);
      if (matchesFinderPenaltyPattern(bits)) penalty += 40;
    }
  }
  for (let x = 0; x < size; x++) {
    for (let y = 0; y <= size - 11; y++) {
      const bits: boolean[] = [];
      for (let k = 0; k < 11; k++) bits.push(modules[y + k][x]);
      if (matchesFinderPenaltyPattern(bits)) penalty += 40;
    }
  }

  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  const percentDark = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percentDark - 50) / 5) * 10;

  return penalty;
}

function computeFormatBits(level: ErrorCorrectionLevel, maskId: number): number {
  const data = (FORMAT_EC_BITS[level] << 3) | maskId;
  const GENERATOR = 0b10100110111; 
  let remainder = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((remainder & (1 << i)) !== 0) remainder ^= GENERATOR << (i - 10);
  }
  return ((data << 10) | remainder) ^ 0b101010000010010;
}

function computeVersionBits(version: number): number {
  const GENERATOR = 0b1111100100101; 
  let remainder = version << 12;
  for (let i = 17; i >= 12; i--) {
    if ((remainder & (1 << i)) !== 0) remainder ^= GENERATOR << (i - 12);
  }
  return (version << 12) | remainder;
}

export function drawFormatInfo(modules: boolean[][], level: ErrorCorrectionLevel, maskId: number): void {
  const size = modules.length;
  const bits = computeFormatBits(level, maskId);
  const bitAt = (k: number) => ((bits >> k) & 1) === 1;

  const group1: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  for (let k = 0; k < 15; k++) {
    const [r, c] = group1[k];
    modules[r][c] = bitAt(14 - k);
  }

  const group2: Array<[number, number]> = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let k = 0; k < 15; k++) {
    const [r, c] = group2[k];
    modules[r][c] = bitAt(14 - k);
  }

  modules[size - 8][8] = true;
}

export function drawVersionInfo(modules: boolean[][], version: number): void {
  if (version < 7) return;
  const size = modules.length;
  const bits = computeVersionBits(version);
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >> i) & 1) === 1;
    const a = Math.floor(i / 3);
    const b = i % 3;
    modules[size - 11 + b][a] = bit;
    modules[a][size - 11 + b] = bit;
  }
}

export { createGrid, symbolSize };
