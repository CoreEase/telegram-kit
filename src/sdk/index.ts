
























import { TelegramWebView, Utils } from './_internal/core/webview';
import { WebApp } from './_internal/webapp';

export * from './_internal/types';
export { TelegramWebView, Utils } from './_internal/core/webview';
export { WebAppKernel } from './_internal/core/kernel';
export { WebAppError, WebAppErrorName } from './_internal/core/errors';
export { WebApp } from './_internal/webapp';




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


export function isBootstrapped(): boolean {
  return bootstrapped !== null;
}
