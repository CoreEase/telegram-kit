import type { ErrorCorrectionLevel } from './tables';

export interface QrEncodeOptions {
  errorCorrectionLevel?: ErrorCorrectionLevel;
  version?: number;
  minVersion?: number;
  maxVersion?: number;
  maskPattern?: number;
}

export interface QrEncodeResult {
  modules: boolean[][];
  size: number;
  version: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  maskPattern: number;
}
