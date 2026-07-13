/**
 * Public-facing types for `window.Telegram.WebApp`, used throughout
 * `core/`, `react/hooks.ts`, and `_internal/providers/TelegramProvider.tsx`.
 *
 * These are now thin re-exports/aliases of the bundled SDK's real types
 * (`../sdk`) rather than a hand-maintained parallel interface set. Two
 * things made that possible:
 *
 * 1. `TgWebApp` is a straight alias for the SDK's real `WebApp` class -
 *    every property/method here is authoritative, not a best-effort copy
 *    that can drift out of sync.
 * 2. `core/dev.ts` no longer builds a plain-object mock that has to
 *    structurally satisfy this type (see its own docs): it seeds fake init
 *    data and lets the *real* SDK bootstrap from it, so there's no more
 *    need for a parallel, private-field-free interface just to keep mocks
 *    buildable.
 *
 * `getWebApp()` in `core/index.ts` returns the SDK's `WebApp` type
 * directly; `TgWebApp` exists mainly so older imports of this module don't
 * need to change.
 */

import type { WebApp } from '../sdk';

export type {
  WebAppUser as TgUser,
  WebAppChat as TgWebAppChat,
  WebAppInitDataUnsafe as WebAppInitData,
  ThemeParams as TgThemeParams,
  SafeAreaInset,
  SafeAreaInset as ContentSafeAreaInset,
  PopupButton,
  PopupParams,
  ScanQrPopupParams,
  ShareToStoryWidgetLink as StoryWidgetLink,
  ShareToStoryParams as StoryShareParams,
  DownloadFileParams,
  LocationData,
  HomeScreenStatus,
  ColorScheme,
} from '../sdk';

/** `WebApp.setEmojiStatus()` options. Not exported by the SDK as a named type (it's inline there), so kept here. */
export interface EmojiStatusParams {
  duration?: number;
}

export type WebAppEventType =
  | 'activated'
  | 'deactivated'
  | 'themeChanged'
  | 'viewportChanged'
  | 'safeAreaChanged'
  | 'contentSafeAreaChanged'
  | 'mainButtonClicked'
  | 'secondaryButtonClicked'
  | 'backButtonClicked'
  | 'settingsButtonClicked'
  | 'invoiceClosed'
  | 'popupClosed'
  | 'qrTextReceived'
  | 'scanQrPopupClosed'
  | 'clipboardTextReceived'
  | 'writeAccessRequested'
  | 'contactRequested'
  | 'biometricManagerUpdated'
  | 'biometricAuthRequested'
  | 'biometricTokenUpdated'
  | 'fullscreenChanged'
  | 'fullscreenFailed'
  | 'homeScreenAdded'
  | 'homeScreenChecked'
  | 'accelerometerStarted'
  | 'accelerometerStopped'
  | 'accelerometerChanged'
  | 'accelerometerFailed'
  | 'deviceOrientationStarted'
  | 'deviceOrientationStopped'
  | 'deviceOrientationChanged'
  | 'deviceOrientationFailed'
  | 'gyroscopeStarted'
  | 'gyroscopeStopped'
  | 'gyroscopeChanged'
  | 'gyroscopeFailed'
  | 'locationManagerUpdated'
  | 'locationRequested'
  | 'shareMessageSent'
  | 'shareMessageFailed'
  | 'emojiStatusSet'
  | 'emojiStatusFailed'
  | 'emojiStatusAccessRequested'
  | 'fileDownloadRequested'
  | 'customMethodInvoked';

export type TgPlatform =
  | 'android'
  | 'android_x'
  | 'ios'
  | 'macos'
  | 'tdesktop'
  | 'weba'
  | 'webz'
  | 'webk'
  | 'unigram'
  | 'unknown';

export type RuntimeMode = 'node' | 'edge';

/** The real, authoritative `WebApp` class from the bundled SDK. */
export type TgWebApp = WebApp;

declare global {
  interface Window {
    Telegram?: {
      WebApp: TgWebApp;
      WebView?: unknown;
      Utils?: unknown;
    };
  }
}
