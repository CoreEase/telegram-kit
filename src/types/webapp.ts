





















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
