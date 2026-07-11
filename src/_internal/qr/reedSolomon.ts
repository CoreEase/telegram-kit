import { gfMultiply, generatorPolynomial } from './galoisField';

export function reedSolomonEncode(dataCodewords: number[], eccLength: number): number[] {
  const generator = generatorPolynomial(eccLength);
  const result = dataCodewords.slice();
  for (let i = 0; i < eccLength; i++) result.push(0);

  for (let i = 0; i < dataCodewords.length; i++) {
    const factor = result[i];
    if (factor === 0) continue;
    for (let j = 0; j < generator.length; j++) {
      result[i + j] ^= gfMultiply(generator[j], factor);
    }
  }

  return result.slice(dataCodewords.length);
}
