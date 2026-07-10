export * from './core';
export * from './types/webapp';

export {
  loadTelegramScript,
  getTelegramCdnUrl,
} from './cdn';

export {
  createMockWebApp,
  installDevMode,
  isDevMode,
} from './dev';

export {
  encodeQRCode,
  qrCodeToSVG,
} from './qr';
export type { QrEncodeOptions, QrEncodeResult, QrSvgOptions, ErrorCorrectionLevel } from './qr';
