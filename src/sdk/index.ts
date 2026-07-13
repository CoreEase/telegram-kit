/**
 * `@core-ease/telegram-kit/sdk` - public entry point of the bundled Mini
 * Apps SDK.
 *
 * Everything that actually implements the protocol lives under
 * `./_internal/` (transport, kernel, theme, ui, features, sensors) and is
 * considered an implementation detail - import from here, not from
 * `./_internal/*` directly.
 *
 * Calling {@link bootstrapTelegramWebApp} reproduces exactly what the
 * original `telegram-web-app.js` did when loaded as a `<script>` tag:
 *   1. Set up `window.Telegram.WebView` (transport + event bus) and
 *      `window.Telegram.Utils`.
 *   2. Set up `window.Telegram.WebApp` (the full public API).
 *
 * Unlike the very first version of this SDK, bootstrapping is **lazy**
 * (it does not run automatically just from importing this module). This
 * lets `core/dev.ts` seed fake init data into session storage *before* the
 * bridge is constructed, so local/dev-mode "just works" through the exact
 * same code path as running inside real Telegram - no parallel mock
 * implementation needed. In practice you never have to think about this:
 * `getWebApp()` in `core/index.ts` calls {@link bootstrapTelegramWebApp}
 * for you on first use.
 */

import { TelegramWebView, Utils } from './_internal/core/webview';
import { WebApp } from './_internal/webapp';

export * from './_internal/types';
export { TelegramWebView, Utils } from './_internal/core/webview';
export { WebAppKernel } from './_internal/core/kernel';
export { WebAppError, WebAppErrorName } from './_internal/core/errors';
export { WebApp } from './_internal/webapp';

// Re-export every feature/UI/sensor class so consumers can build their own
// composition (e.g. a custom WebApp subset for a specific surface) without
// depending on the full aggregator.
export { ThemeManager } from './_internal/theme/theme-manager';
export { ViewportManager } from './_internal/theme/viewport-manager';
export { BackButton } from './_internal/ui/back-button';
export { BottomButton } from './_internal/ui/bottom-button';
export { SettingsButton } from './_internal/ui/settings-button';
export { DebugBottomBar } from './_internal/ui/debug-bottom-bar';
export { PopupManager } from './_internal/ui/popup';
export { ScanQrManager } from './_internal/ui/scan-qr';
export { HapticFeedback } from './_internal/features/haptic-feedback';
export { CloudStorage } from './_internal/features/cloud-storage';
export { DeviceStorage } from './_internal/features/device-storage';
export { SecureStorage } from './_internal/features/secure-storage';
export { BiometricManager } from './_internal/features/biometric-manager';
export { LocationManager } from './_internal/features/location-manager';
export { InvoiceManager } from './_internal/features/invoice';
export { ClipboardManager } from './_internal/features/clipboard';
export { ContactManager } from './_internal/features/contact';
export { HomeScreenManager } from './_internal/features/home-screen';
export { DownloadFileManager } from './_internal/features/download-file';
export { SharingManager } from './_internal/features/sharing';
export { EmojiStatusManager } from './_internal/features/emoji-status';
export { LinkManager } from './_internal/features/links';
export { Accelerometer } from './_internal/sensors/accelerometer';
export { Gyroscope } from './_internal/sensors/gyroscope';
export { DeviceOrientation } from './_internal/sensors/device-orientation';

export const SDK_NAME = '@core-ease/telegram-kit';

let bootstrapped: { webView: TelegramWebView; webApp: WebApp } | null = null;

/**
 * Runs the SDK bootstrap exactly once (idempotent) and exposes
 * `window.Telegram.{WebView,Utils,WebApp}`. Safe to call in non-browser
 * contexts (returns nothing useful but never throws), so it's safe to wire
 * into SSR code paths.
 *
 * This is normally called for you by `getWebApp()` in `core/index.ts` the
 * first time any @core-ease/telegram-kit function is used - you only need to call it
 * yourself if you want direct, typed access to the `WebApp`/`TelegramWebView`
 * instances instead of going through the `core`/`hooks` convenience layer.
 */
export function bootstrapTelegramWebApp(): { webView: TelegramWebView; webApp: WebApp } {
  if (bootstrapped) {
    return bootstrapped;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(`[${SDK_NAME}] bootstrapTelegramWebApp() requires a browser environment (window/document).`);
  }

  const webView = new TelegramWebView();

  const telegram = ((window as any).Telegram ?? ((window as any).Telegram = {})) as {
    WebView?: TelegramWebView;
    Utils?: typeof Utils;
    WebApp?: WebApp;
  };
  telegram.WebView = webView;
  telegram.Utils = Utils;

  const webApp = new WebApp(webView);
  telegram.WebApp = webApp;

  bootstrapped = { webView, webApp };
  return bootstrapped;
}

/** True once {@link bootstrapTelegramWebApp} has run at least once. */
export function isBootstrapped(): boolean {
  return bootstrapped !== null;
}
