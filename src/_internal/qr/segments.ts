import { BitBuffer } from './bitBuffer';

export const QR_MODE = {
  NUMERIC: 0b0001,
  ALPHANUMERIC: 0b0010,
  BYTE: 0b0100,
} as const;

export type QrMode = (typeof QR_MODE)[keyof typeof QR_MODE];

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function isNumeric(text: string): boolean {
  return /^[0-9]*$/.test(text);
}

function isAlphanumeric(text: string): boolean {
  for (const ch of text) {
    if (ALPHANUMERIC_CHARSET.indexOf(ch) === -1) return false;
  }
  return true;
}

export function chooseMode(text: string): QrMode {
  if (isNumeric(text)) return QR_MODE.NUMERIC;
  if (isAlphanumeric(text)) return QR_MODE.ALPHANUMERIC;
  return QR_MODE.BYTE;
}

export function toUtf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

export function charCountBitLength(mode: QrMode, version: number): number {
  if (version <= 9) {
    return mode === QR_MODE.NUMERIC ? 10 : mode === QR_MODE.ALPHANUMERIC ? 9 : 8;
  }
  if (version <= 26) {
    return mode === QR_MODE.NUMERIC ? 12 : mode === QR_MODE.ALPHANUMERIC ? 11 : 16;
  }
  return mode === QR_MODE.NUMERIC ? 14 : mode === QR_MODE.ALPHANUMERIC ? 13 : 16;
}

export function segmentCharacterCount(mode: QrMode, text: string): number {
  return mode === QR_MODE.BYTE ? toUtf8Bytes(text).length : text.length;
}

export function encodeSegmentBits(mode: QrMode, text: string, bb: BitBuffer): void {
  if (mode === QR_MODE.NUMERIC) {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.substring(i, i + 3);
      const bitsForLen = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
      bb.push(parseInt(chunk, 10), bitsForLen);
    }
  } else if (mode === QR_MODE.ALPHANUMERIC) {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        const value =
          ALPHANUMERIC_CHARSET.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
        bb.push(value, 11);
      } else {
        bb.push(ALPHANUMERIC_CHARSET.indexOf(text[i]), 6);
      }
    }
  } else {
    for (const byte of toUtf8Bytes(text)) bb.push(byte, 8);
  }
}
