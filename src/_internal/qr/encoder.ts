import { buildDataCodewords, interleaveBlocks, splitIntoBlocksWithEcc } from './dataCodewords';
import {
  applyMask,
  computeMaskPenalty,
  createGrid,
  drawFormatInfo,
  drawFunctionPatterns,
  drawVersionInfo,
  placeDataBits,
  symbolSize,
} from './matrix';
import { chooseMode } from './segments';
import type { QrEncodeOptions, QrEncodeResult } from './types';

const MIN_VERSION = 1;
const MAX_VERSION = 40;

export function encodeQrMatrix(text: string, options: QrEncodeOptions = {}): QrEncodeResult {
  const level = options.errorCorrectionLevel ?? 'M';
  const mode = chooseMode(text);

  const minVersion = options.version ?? options.minVersion ?? MIN_VERSION;
  const maxVersion = options.version ?? options.maxVersion ?? MAX_VERSION;

  let version: number | null = null;
  let dataCodewords: number[] | null = null;
  for (let v = minVersion; v <= maxVersion; v++) {
    const codewords = buildDataCodewords(text, v, level, mode);
    if (codewords) {
      version = v;
      dataCodewords = codewords;
      break;
    }
  }

  if (version === null || dataCodewords === null) {
    throw new Error(
      `[@core-ease/telegram-kit] Unable to encode a QR code: the input is too long for error correction level "${level}"` +
        (options.version ? ` at version ${options.version}.` : ' within the allowed version range.')
    );
  }

  const blocked = splitIntoBlocksWithEcc(dataCodewords, version, level);
  const allCodewords = interleaveBlocks(blocked);

  const dataBits: number[] = [];
  for (const codeword of allCodewords) {
    for (let i = 7; i >= 0; i--) dataBits.push((codeword >> i) & 1);
  }

  const size = symbolSize(version);
  const modules = createGrid(size);
  const isFunction = createGrid(size);
  drawFunctionPatterns(modules, isFunction, version);
  placeDataBits(modules, isFunction, dataBits);

  let bestMask = 0;
  let bestModules = modules;

  if (typeof options.maskPattern === 'number') {
    bestMask = options.maskPattern;
    bestModules = applyMask(modules, isFunction, bestMask);
  } else {
    let bestPenalty = Infinity;
    for (let maskId = 0; maskId < 8; maskId++) {
      const masked = applyMask(modules, isFunction, maskId);
      const penalty = computeMaskPenalty(masked);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = maskId;
        bestModules = masked;
      }
    }
  }

  drawFormatInfo(bestModules, level, bestMask);
  drawVersionInfo(bestModules, version);

  return {
    modules: bestModules,
    size,
    version,
    errorCorrectionLevel: level,
    maskPattern: bestMask,
  };
}
