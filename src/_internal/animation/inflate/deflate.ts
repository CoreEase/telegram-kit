class ByteSink {
  private buf: Uint8Array;
  private len = 0;

  constructor(initialSize = 1 << 16) {
    this.buf = new Uint8Array(initialSize);
  }

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let newSize = this.buf.length * 2;
    while (newSize < this.len + extra) newSize *= 2;
    const next = new Uint8Array(newSize);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  pushByte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b;
  }

  pushBytes(src: Uint8Array, start: number, count: number): void {
    this.ensure(count);
    this.buf.set(src.subarray(start, start + count), this.len);
    this.len += count;
  }

  copyBack(distance: number, length: number): void {
    this.ensure(length);
    let srcPos = this.len - distance;
    for (let i = 0; i < length; i++) {
      this.buf[this.len + i] = this.buf[srcPos + i];
    }
    this.len += length;
  }

  toUint8Array(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

class BitReader {
  private readonly data: Uint8Array;
  private pos = 0; 
  private bitBuf = 0;
  private bitCount = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  get bytePos(): number {
    return this.pos;
  }

  hasMore(): boolean {
    return this.pos < this.data.length || this.bitCount > 0;
  }

  readBits(n: number): number {
    while (this.bitCount < n) {
      if (this.pos >= this.data.length) {
        this.bitBuf |= 0 << this.bitCount;
        this.bitCount += 8;
        this.pos++;
        continue;
      }
      this.bitBuf |= this.data[this.pos++] << this.bitCount;
      this.bitCount += 8;
    }
    const value = this.bitBuf & ((1 << n) - 1);
    this.bitBuf >>>= n;
    this.bitCount -= n;
    return value;
  }

  alignToByte(): void {
    this.bitBuf = 0;
    this.bitCount = 0;
  }

  readAlignedByte(): number {
    return this.data[this.pos++];
  }
}

class HuffmanTree {
  private readonly maxLen: number;
  private readonly codesByLength: Map<number, Map<number, number>> = new Map();

  constructor(codeLengths: number[]) {
    let maxLen = 0;
    for (const l of codeLengths) if (l > maxLen) maxLen = l;
    this.maxLen = maxLen;

    if (maxLen === 0) return;

    const blCount = new Array(maxLen + 1).fill(0);
    for (const l of codeLengths) if (l > 0) blCount[l]++;

    const nextCode = new Array(maxLen + 1).fill(0);
    let code = 0;
    for (let bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }

    for (let sym = 0; sym < codeLengths.length; sym++) {
      const len = codeLengths[sym];
      if (len === 0) continue;
      const c = nextCode[len]++;
      let map = this.codesByLength.get(len);
      if (!map) {
        map = new Map();
        this.codesByLength.set(len, map);
      }
      map.set(c, sym);
    }
  }

  decode(reader: BitReader): number {
    let code = 0;
    for (let len = 1; len <= this.maxLen; len++) {
      code = (code << 1) | reader.readBits(1);
      const map = this.codesByLength.get(len);
      if (map && map.has(code)) {
        return map.get(code) as number;
      }
    }
    throw new Error("Invalid Huffman code in DEFLATE stream");
  }
}

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67,
  83, 99, 115, 131, 163, 195, 227, 258,
];
const LENGTH_EXTRA_BITS = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513,
  769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA_BITS = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11,
  11, 12, 12, 13, 13,
];
const CODE_LENGTH_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];

function buildFixedLiteralLengths(): number[] {
  const lengths = new Array(288);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  return lengths;
}

function buildFixedDistLengths(): number[] {
  return new Array(30).fill(5);
}

function inflateBlock(
  reader: BitReader,
  sink: ByteSink,
  litTree: HuffmanTree,
  distTree: HuffmanTree
): void {
  for (;;) {
    const sym = litTree.decode(reader);

    if (sym < 256) {
      sink.pushByte(sym);
      continue;
    }

    if (sym === 256) {
      return; 
    }

    const lengthIndex = sym - 257;
    if (lengthIndex >= LENGTH_BASE.length) {
      throw new Error("Invalid length code in DEFLATE stream");
    }
    const length =
      LENGTH_BASE[lengthIndex] + reader.readBits(LENGTH_EXTRA_BITS[lengthIndex]);

    const distSym = distTree.decode(reader);
    if (distSym >= DIST_BASE.length) {
      throw new Error("Invalid distance code in DEFLATE stream");
    }
    const distance = DIST_BASE[distSym] + reader.readBits(DIST_EXTRA_BITS[distSym]);

    sink.copyBack(distance, length);
  }
}

function inflateDynamicBlock(reader: BitReader, sink: ByteSink): void {
  const hlit = reader.readBits(5) + 257;
  const hdist = reader.readBits(5) + 1;
  const hclen = reader.readBits(4) + 4;

  const codeLengthLengths = new Array(19).fill(0);
  for (let i = 0; i < hclen; i++) {
    codeLengthLengths[CODE_LENGTH_ORDER[i]] = reader.readBits(3);
  }
  const codeLengthTree = new HuffmanTree(codeLengthLengths);

  const allLengths: number[] = [];
  while (allLengths.length < hlit + hdist) {
    const sym = codeLengthTree.decode(reader);
    if (sym <= 15) {
      allLengths.push(sym);
    } else if (sym === 16) {
      const repeat = reader.readBits(2) + 3;
      const prev = allLengths[allLengths.length - 1] ?? 0;
      for (let i = 0; i < repeat; i++) allLengths.push(prev);
    } else if (sym === 17) {
      const repeat = reader.readBits(3) + 3;
      for (let i = 0; i < repeat; i++) allLengths.push(0);
    } else if (sym === 18) {
      const repeat = reader.readBits(7) + 11;
      for (let i = 0; i < repeat; i++) allLengths.push(0);
    } else {
      throw new Error("Invalid code length symbol in DEFLATE stream");
    }
  }

  const litLengths = allLengths.slice(0, hlit);
  const distLengths = allLengths.slice(hlit, hlit + hdist);

  const litTree = new HuffmanTree(litLengths);
  const distTree = new HuffmanTree(distLengths);

  inflateBlock(reader, sink, litTree, distTree);
}

export function inflateRaw(data: Uint8Array): Uint8Array {
  const reader = new BitReader(data);
  const sink = new ByteSink(Math.max(1 << 16, data.length * 4));

  let fixedLitTree: HuffmanTree | null = null;
  let fixedDistTree: HuffmanTree | null = null;

  for (;;) {
    const bfinal = reader.readBits(1);
    const btype = reader.readBits(2);

    if (btype === 0) {
      reader.alignToByte();
      const len = reader.readAlignedByte() | (reader.readAlignedByte() << 8);
      reader.readAlignedByte();
      reader.readAlignedByte();
      for (let i = 0; i < len; i++) {
        sink.pushByte(reader.readAlignedByte());
      }
    } else if (btype === 1) {
      if (!fixedLitTree) {
        fixedLitTree = new HuffmanTree(buildFixedLiteralLengths());
        fixedDistTree = new HuffmanTree(buildFixedDistLengths());
      }
      inflateBlock(reader, sink, fixedLitTree, fixedDistTree as HuffmanTree);
    } else if (btype === 2) {
      inflateDynamicBlock(reader, sink);
    } else {
      throw new Error("Invalid DEFLATE block type");
    }

    if (bfinal === 1) break;
    if (!reader.hasMore()) break;
  }

  return sink.toUint8Array();
}
