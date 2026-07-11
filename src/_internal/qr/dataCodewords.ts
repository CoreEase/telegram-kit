import { BitBuffer } from './bitBuffer';
import { reedSolomonEncode } from './reedSolomon';
import {
  type ErrorCorrectionLevel,
  getBlockStructure,
  getNumDataCodewords,
} from './tables';
import {
  type QrMode,
  charCountBitLength,
  encodeSegmentBits,
  segmentCharacterCount,
} from './segments';

export function buildDataCodewords(
  text: string,
  version: number,
  level: ErrorCorrectionLevel,
  mode: QrMode
): number[] | null {
  const bb = new BitBuffer();
  bb.push(mode, 4);
  bb.push(segmentCharacterCount(mode, text), charCountBitLength(mode, version));
  encodeSegmentBits(mode, text, bb);

  const capacityBits = getNumDataCodewords(version, level) * 8;
  if (bb.length > capacityBits) return null;

  const terminatorLen = Math.min(4, capacityBits - bb.length);
  bb.push(0, terminatorLen);

  while (bb.length % 8 !== 0) bb.bits.push(0);

  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (bb.length < capacityBits) {
    bb.push(padBytes[padIndex % 2], 8);
    padIndex++;
  }

  return bb.toCodewords();
}

export interface BlockedCodewords {
  dataBlocks: number[][];
  eccBlocks: number[][];
}

export function splitIntoBlocksWithEcc(
  dataCodewords: number[],
  version: number,
  level: ErrorCorrectionLevel
): BlockedCodewords {
  const { eccLength, numBlocks } = getBlockStructure(version, level);
  const totalData = dataCodewords.length;
  const shortBlockLen = Math.floor(totalData / numBlocks);
  const numLongBlocks = totalData % numBlocks;
  const numShortBlocks = numBlocks - numLongBlocks;

  const dataBlocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numShortBlocks; i++) {
    dataBlocks.push(dataCodewords.slice(offset, offset + shortBlockLen));
    offset += shortBlockLen;
  }
  for (let i = 0; i < numLongBlocks; i++) {
    dataBlocks.push(dataCodewords.slice(offset, offset + shortBlockLen + 1));
    offset += shortBlockLen + 1;
  }

  const eccBlocks = dataBlocks.map((block) => reedSolomonEncode(block, eccLength));
  return { dataBlocks, eccBlocks };
}

export function interleaveBlocks({ dataBlocks, eccBlocks }: BlockedCodewords): number[] {
  const result: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i]);
    }
  }
  const eccLen = eccBlocks[0].length;
  for (let i = 0; i < eccLen; i++) {
    for (const block of eccBlocks) result.push(block[i]);
  }
  return result;
}
