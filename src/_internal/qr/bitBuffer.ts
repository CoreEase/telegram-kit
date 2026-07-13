export class BitBuffer {
  readonly bits: number[] = [];

  push(value: number, len: number): void {
    for (let i = len - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toCodewords(): number[] {
    const codewords: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (this.bits[i + j] ?? 0);
      }
      codewords.push(byte);
    }
    return codewords;
  }
}
