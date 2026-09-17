


export * as sdk from './sdk';
export { bootstrapTelegramWebApp } from './sdk';

export * from './core';
export * from './types/webapp';

export {
  installDevMode,
  isDevMode,
} from './core/dev';

export {
  encodeQRCode,
  qrCodeToSVG,
} from './ui/qr';
export type { QrEncodeOptions, QrEncodeResult, QrSvgOptions, ErrorCorrectionLevel } from './ui/qr';

export * from './utils/format';
export * from './utils/links';
export * from './utils/keyboards';
