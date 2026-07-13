export * from './types/webapp';
export * from './core';
export * from './react/hooks';

export { TelegramProvider, useTelegram } from './react/provider';

export type {
  TelegramContextValue,
  TelegramProviderOptions,
} from './react/provider';

export * from './utils/format';
export * from './utils/links';
export * from './utils/keyboards';

// The full bundled Mini Apps SDK (a byte-for-byte behavioral TypeScript
// port of Telegram's official telegram-web-app.js), namespaced so it
// doesn't collide with @core-ease/telegram-kit's own convenience exports above.
// `window.Telegram.{WebView,Utils,WebApp}` is set up the first time any
// telegram-kit function calls `getWebApp()` (core functions, hooks,
// <TelegramProvider>, ...) - no `<script src="https://telegram.org/js/telegram-web-app.js">`
// or `loadTelegramScript()` call is needed anymore, and nothing here runs
// eagerly just from importing the package (safe for SSR).
export * as sdk from './sdk';
export { bootstrapTelegramWebApp } from './sdk';
