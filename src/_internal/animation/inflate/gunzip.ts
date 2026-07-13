import { inflateRaw } from "./deflate";

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

const FLAG_FTEXT = 0x01;
const FLAG_FHCRC = 0x02;
const FLAG_FEXTRA = 0x04;
const FLAG_FNAME = 0x08;
const FLAG_FCOMMENT = 0x10;

export function isGzip(data: Uint8Array): boolean {
  return data.length > 2 && data[0] === GZIP_MAGIC_0 && data[1] === GZIP_MAGIC_1;
}

export function gunzip(data: Uint8Array): Uint8Array {
  if (!isGzip(data)) {
    throw new Error("Not a valid gzip stream (bad magic bytes)");
  }

  let pos = 2;
  const cm = data[pos++]; 
  if (cm !== 8) {
    throw new Error(`Unsupported gzip compression method: ${cm}`);
  }

  const flags = data[pos++];
  pos += 4; 
  pos += 1; 
  pos += 1;

  if (flags & FLAG_FEXTRA) {
    const xlen = data[pos] | (data[pos + 1] << 8);
    pos += 2 + xlen;
  }

  if (flags & FLAG_FNAME) {
    while (pos < data.length && data[pos] !== 0) pos++;
    pos++; 
  }

  if (flags & FLAG_FCOMMENT) {
    while (pos < data.length && data[pos] !== 0) pos++;
    pos++;
  }

  if (flags & FLAG_FHCRC) {
    pos += 2;
  }

  const deflateData = data.subarray(pos);
  return inflateRaw(deflateData);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
    } else if (b0 >= 0xc0 && b0 < 0xe0) {
      const b1 = bytes[i++];
      out += String.fromCharCode(((b0 & 0x1f) << 6) | (b1 & 0x3f));
    } else if (b0 >= 0xe0 && b0 < 0xf0) {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      out += String.fromCharCode(
        ((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f)
      );
    } else {
      const b1 = bytes[i++];
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const codePoint =
        ((b0 & 0x07) << 18) |
        ((b1 & 0x3f) << 12) |
        ((b2 & 0x3f) << 6) |
        (b3 & 0x3f);
      out += String.fromCodePoint(codePoint);
    }
  }
  return out;
}
