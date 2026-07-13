// `window.Telegram.{WebView,Utils,WebApp}` is set up the first time any
// telegram-kit function is used (see `./sdk/index.ts` / `./core/index.ts`) -
// this bundle no longer needs, and does not load, telegram.org's CDN script.
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
