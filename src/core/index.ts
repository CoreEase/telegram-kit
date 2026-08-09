/**
 * `@core-ease/telegram-kit/core`
 *
 * This is the batteries-included convenience layer on top of the bundled
 * SDK (`../sdk`): Promise-based wrappers, sensible defaults, and - for
 * every feature that has one - a real browser-native fallback, so your
 * Mini App keeps working instead of hanging or spamming the console when
 * it's opened in a plain browser tab, in dev mode, or in an older
 * Telegram client.
 *
 * Every function here gets the `WebApp` instance directly from the
 * bundled SDK via {@link getWebApp} - never from `window.Telegram`. That
 * keeps this file (and everything built on top of it: `react/hooks.ts`,
 * `_internal/providers/TelegramProvider.tsx`) decoupled from the DOM
 * global entirely.
 *
 * Every call that needs a *response* from the native Telegram client
 * (storage, biometrics, location, popups, clipboard, ...) is routed
 * through {@link callNativeOrFallback}, which races the real call against
 * a short timeout. This means a call can never hang forever - not when
 * opened in a plain browser, not in `installDevMode()` (which simulates
 * being inside Telegram but has no real client to answer), and not even
 * against a real but unresponsive client.
 */

import { bootstrapTelegramWebApp, type WebApp } from '../sdk';
import type {
  TgUser,
  DownloadFileParams,
  EmojiStatusParams,
  StoryShareParams,
  LocationData,
  PopupParams,
} from '../types/webapp';
import {
  callNativeOrFallback,
  createLocalStorageFallback,
  downloadFileFallback,
  fullscreenFallback,
  getLocationFallback,
  isDevModeActive,
  orientationLockFallback,
  readClipboardFallback,
  scanQrFallback,
  shareTextFallback,
  vibrateFallback,
  safeInvoke,
} from './fallback';

export { safeInvoke } from './fallback';

// ---------------------------------------------------------------------
// SDK access
// ---------------------------------------------------------------------

let cachedWebApp: WebApp | null = null;

/** Returns the bundled SDK's `WebApp` instance directly (never reads `window.Telegram`). */
export function getWebApp(): WebApp | null {
  if (typeof window === 'undefined') return null;
  if (!cachedWebApp) {
    cachedWebApp = bootstrapTelegramWebApp().webApp;
  }
  return cachedWebApp;
}

/**
 * `true` once real Telegram init data has been observed - i.e. the Mini
 * App was actually opened from inside Telegram, or `installDevMode()`
 * seeded matching fake data for local testing.
 */
export function isInTelegram(): boolean {
  const wa = getWebApp();
  return Boolean(wa && wa.initData && wa.initData.length > 0);
}

export function isVersionAtLeast(version: string): boolean {
  return getWebApp()?.isVersionAtLeast(version) ?? false;
}

/**
 * `true` when both inside Telegram (real client only - not dev mode) and
 * the client is at least `version`. Used to gate *response-required* calls
 * so they either go to the real client or straight to a local fallback,
 * never into a race that dev mode would always lose slowly.
 */
function nativeReady(version?: string): boolean {
  if (!isInTelegram()) return false;
  if (isDevModeActive()) return false;
  if (version && !isVersionAtLeast(version)) return false;
  return true;
}

// ---------------------------------------------------------------------
// User helpers (pure data reads - no native/browser distinction needed)
// ---------------------------------------------------------------------

export function getRawUserData(): TgUser | null {
  return getWebApp()?.initDataUnsafe?.user ?? null;
}

export function getUserDisplayName(user?: TgUser): string {
  if (!user) return 'User';
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
  if (fullName) return fullName;
  if (user.username) return `@${user.username}`;
  return `User_${user.id}`;
}

export function getUserIdentifier(user?: TgUser): string {
  if (user?.username) return user.username;
  if (user?.id) return String(user.id);
  return 'unknown';
}

export function getUserAvatarUrl(
  user?: TgUser,
  fallback = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNjY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iNDAiIGZpbGw9IndoaXRlIj4/PC90ZXh0Pjwvc3ZnPg=='
): string {
  if (user?.photo_url) return user.photo_url;

  if (user?.id) {
    const name =
      `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() ||
      user.username ||
      `user_${user.id}`;

    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100%" height="100%" rx="50" fill="#4F46E5"/>
        <text
          x="50%"
          y="50%"
          dominant-baseline="middle"
          text-anchor="middle"
          font-family="Arial,sans-serif"
          font-size="40"
          font-weight="bold"
          fill="white"
        >
          ${initials}
        </text>
      </svg>
    `;

    const base64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(svg).toString('base64')
        : btoa(svg);

    return `data:image/svg+xml;base64,${base64}`;
  }

  return fallback;
}

export function getUserInfoWithAvatar() {
  const user = getRawUserData() ?? undefined;
  return {
    user,
    avatarUrl: getUserAvatarUrl(user),
    displayName: getUserDisplayName(user),
    identifier: getUserIdentifier(user),
  };
}

// ---------------------------------------------------------------------
// Links (the SDK already falls back to window.open()/location.href
// internally for old/absent clients - see sdk/_internal/features/links.ts -
// so these wrappers just delegate, no duplicated fallback logic needed)
// ---------------------------------------------------------------------

export function openExternalLink(url: string, tryInstantView = false): void {
  const wa = getWebApp();
  if (!wa) {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
    return;
  }
  wa.openLink(url, { try_instant_view: tryInstantView });
}

export function openTelegramLink(url: string): void {
  const wa = getWebApp();
  if (!wa) {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
    return;
  }
  wa.openTelegramLink(url);
}

/** No meaningful browser fallback exists for Telegram Payments; rejects clearly instead of hanging. */
export function openInvoice(url: string): Promise<'paid' | 'cancelled' | 'failed' | 'pending'> {
  return callNativeOrFallback({
    ready: nativeReady('6.1'),
    native: () => new Promise((resolve) => getWebApp()!.openInvoice(url, (status) => resolve(status as any))),
    fallback: () => {
      throw new Error('openInvoice requires the Telegram app (Bot API 6.1+).');
    },
  });
}

export function switchInlineQuery(
  query: string,
  chooseChatTypes?: Array<'users' | 'bots' | 'groups' | 'channels'>
): void {
  if (!nativeReady('6.6')) return;
  safeInvoke(() => getWebApp()!.switchInlineQuery(query, chooseChatTypes));
}

export function hideKeyboard(): void {
  safeInvoke(() => getWebApp()?.hideKeyboard());
}

// ---------------------------------------------------------------------
// Theme / viewport / window chrome - all fire-and-forget, and every one
// of these already has a real browser fallback either inside the SDK
// itself (see comment above) or here.
// ---------------------------------------------------------------------

export function getTheme() {
  const wa = getWebApp();
  return { colorScheme: wa?.colorScheme ?? 'dark', themeParams: wa?.themeParams ?? {} };
}

export function getViewport() {
  const wa = getWebApp();
  return {
    height: wa?.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    stableHeight: wa?.viewportStableHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    isExpanded: wa?.isExpanded ?? true,
  };
}

export function expand(): void {
  safeInvoke(() => getWebApp()?.expand());
}

export function ready(): void {
  safeInvoke(() => getWebApp()?.ready());
}

export function close(): void {
  safeInvoke(() => getWebApp()?.close());
}

/** Fullscreen API fallback outside Telegram / older clients. */
export const fullscreen = {
  enter: (): Promise<boolean> => {
    if (nativeReady('8.0')) {
      safeInvoke(() => getWebApp()!.requestFullscreen());
      return Promise.resolve(true);
    }
    return fullscreenFallback(true);
  },
  exit: (): Promise<boolean> => {
    if (nativeReady('8.0')) {
      safeInvoke(() => getWebApp()!.exitFullscreen());
      return Promise.resolve(true);
    }
    return fullscreenFallback(false);
  },
};

/** Screen Orientation API fallback outside Telegram / older clients. */
export const orientation = {
  lock: (): Promise<boolean> => {
    if (nativeReady('8.0')) {
      safeInvoke(() => getWebApp()!.lockOrientation());
      return Promise.resolve(true);
    }
    return orientationLockFallback(true);
  },
  unlock: (): Promise<boolean> => {
    if (nativeReady('8.0')) {
      safeInvoke(() => getWebApp()!.unlockOrientation());
      return Promise.resolve(true);
    }
    return orientationLockFallback(false);
  },
};

export function enableClosingConfirmation(): void {
  safeInvoke(() => getWebApp()?.enableClosingConfirmation());
}

export function disableClosingConfirmation(): void {
  safeInvoke(() => getWebApp()?.disableClosingConfirmation());
}

export function enableVerticalSwipes(): void {
  safeInvoke(() => getWebApp()?.enableVerticalSwipes());
}

export function disableVerticalSwipes(): void {
  safeInvoke(() => getWebApp()?.disableVerticalSwipes());
}

export function setHeaderColor(color: string): void {
  safeInvoke(() => getWebApp()?.setHeaderColor(color));
}

export function setBackgroundColor(color: string): void {
  safeInvoke(() => getWebApp()?.setBackgroundColor(color));
}

export function setBottomBarColor(color: string): void {
  safeInvoke(() => getWebApp()?.setBottomBarColor(color));
}

/** No meaningful browser equivalent (this adds a Telegram Mini App shortcut, specifically) - safely no-ops outside Telegram. */
export function addToHomeScreen(): void {
  if (!nativeReady('8.0')) return;
  safeInvoke(() => getWebApp()!.addToHomeScreen());
}

export function checkHomeScreenStatus(): Promise<'unsupported' | 'unknown' | 'added' | 'missed'> {
  return callNativeOrFallback({
    ready: nativeReady('8.0'),
    native: () => new Promise((resolve) => getWebApp()!.checkHomeScreenStatus((status) => resolve(status))),
    fallback: () => 'unsupported' as const,
  });
}

// ---------------------------------------------------------------------
// Haptics - vibration API fallback outside Telegram
// ---------------------------------------------------------------------

export const haptic = {
  light: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.impactOccurred('light') : vibrateFallback('light')),
  medium: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.impactOccurred('medium') : vibrateFallback('medium')),
  heavy: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.impactOccurred('heavy') : vibrateFallback('heavy')),
  rigid: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.impactOccurred('rigid') : vibrateFallback('rigid')),
  soft: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.impactOccurred('soft') : vibrateFallback('soft')),
  success: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.notificationOccurred('success') : vibrateFallback('success')),
  warning: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.notificationOccurred('warning') : vibrateFallback('warning')),
  error: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.notificationOccurred('error') : vibrateFallback('error')),
  selection: () => (nativeReady('6.1') ? getWebApp()!.HapticFeedback.selectionChanged() : vibrateFallback('selection')),
};

// ---------------------------------------------------------------------
// Storages - localStorage-backed fallback outside Telegram / old clients
// / when the native side never answers (e.g. dev mode)
// ---------------------------------------------------------------------

const cloudStorageFallback = createLocalStorageFallback('cloud');
const deviceStorageFallback = createLocalStorageFallback('device');
const secureStorageFallback = createLocalStorageFallback('secure');

export const cloudStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.setItem(key, value, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => cloudStorageFallback.setItem(key, value),
    }),

  getItem: (key: string): Promise<string | undefined> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.getItem(key, (e, v) => (e ? reject(new Error(e)) : resolve(v)))),
      fallback: () => cloudStorageFallback.getItem(key),
    }),

  getItems: (keys: string[]): Promise<Record<string, string>> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.getItems(keys, (e, v) => (e ? reject(new Error(e)) : resolve(v ?? {})))),
      fallback: () => cloudStorageFallback.getItems(keys),
    }),

  removeItem: (key: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.removeItem(key, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => cloudStorageFallback.removeItem(key),
    }),

  removeItems: (keys: string[]): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.removeItems(keys, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => cloudStorageFallback.removeItems(keys),
    }),

  getKeys: (): Promise<string[]> =>
    callNativeOrFallback({
      ready: nativeReady('6.9'),
      native: () => new Promise((resolve, reject) => getWebApp()!.CloudStorage.getKeys((e, keys) => (e ? reject(new Error(e)) : resolve(keys ?? [])))),
      fallback: () => cloudStorageFallback.getKeys(),
    }),
};

export const deviceStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.DeviceStorage.setItem(key, value, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => deviceStorageFallback.setItem(key, value),
    }),

  getItem: (key: string): Promise<string | undefined> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.DeviceStorage.getItem(key, (e, v) => (e ? reject(new Error(e)) : resolve(v)))),
      fallback: () => deviceStorageFallback.getItem(key),
    }),

  removeItem: (key: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.DeviceStorage.removeItem(key, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => deviceStorageFallback.removeItem(key),
    }),

  clear: (): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.DeviceStorage.clear((e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => deviceStorageFallback.clear(),
    }),
};

export const secureStorage = {
  setItem: (key: string, value: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.SecureStorage.setItem(key, value, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => secureStorageFallback.setItem(key, value),
    }),

  getItem: (key: string): Promise<{ value: string | null | undefined; canRestore: boolean }> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () =>
        new Promise((resolve, reject) =>
          getWebApp()!.SecureStorage.getItem(key, (e, v, canRestore) => (e ? reject(new Error(e)) : resolve({ value: v, canRestore: canRestore ?? false })))
        ),
      fallback: async () => ({ value: await secureStorageFallback.getItem(key), canRestore: false }),
    }),

  removeItem: (key: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.SecureStorage.removeItem(key, (e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => secureStorageFallback.removeItem(key),
    }),

  clear: (): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.SecureStorage.clear((e, ok) => (e ? reject(new Error(e)) : resolve(ok ?? false)))),
      fallback: () => secureStorageFallback.clear(),
    }),

  restoreItem: (key: string): Promise<string | undefined> =>
    callNativeOrFallback({
      ready: nativeReady('9.0'),
      native: () => new Promise((resolve, reject) => getWebApp()!.SecureStorage.restoreItem(key, (e, v) => (e ? reject(new Error(e)) : resolve(v)))),
      fallback: () => secureStorageFallback.getItem(key),
    }),
};

// ---------------------------------------------------------------------
// Dialogs - window.alert/confirm/prompt fallback outside Telegram
// ---------------------------------------------------------------------

export const dialog = {
  alert: (message: string): Promise<void> =>
    callNativeOrFallback({
      ready: nativeReady('6.2'),
      native: () => new Promise((resolve) => getWebApp()!.showAlert(message, resolve)),
      fallback: () => {
        if (typeof window !== 'undefined') window.alert(message);
      },
    }),

  confirm: (message: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('6.2'),
      native: () => new Promise((resolve) => getWebApp()!.showConfirm(message, resolve)),
      fallback: () => typeof window !== 'undefined' && window.confirm(message),
    }),

  popup: (params: PopupParams): Promise<string | null> =>
    callNativeOrFallback({
      ready: nativeReady('6.2'),
      native: () => new Promise((resolve) => getWebApp()!.showPopup(params, (buttonId) => resolve(buttonId ?? null))),
      fallback: () => {
        if (typeof window === 'undefined') return null;
        // Best-effort browser approximation: render the message via
        // confirm()/alert() so the flow doesn't just silently drop.
        const okButton = params.buttons?.find((b) => b.type === 'ok' || b.type === 'default');
        const okButtonId = okButton?.id != null ? String(okButton.id) : null;
        if (params.buttons && params.buttons.length > 1) {
          const ok = window.confirm(`${params.title ? params.title + '\n' : ''}${params.message}`);
          return ok ? okButtonId ?? 'ok' : null;
        }
        window.alert(`${params.title ? params.title + '\n' : ''}${params.message}`);
        return okButtonId;
      },
    }),

  prompt: (message: string, defaultValue = ''): Promise<string | null> =>
    Promise.resolve(typeof window === 'undefined' ? null : window.prompt(message, defaultValue)),
};

// ---------------------------------------------------------------------
// Clipboard / QR / sharing / downloads
// ---------------------------------------------------------------------

export function readClipboard(): Promise<string | null> {
  return callNativeOrFallback({
    ready: nativeReady('6.4'),
    native: () => new Promise((resolve) => getWebApp()!.readTextFromClipboard((text) => resolve(text ?? null))),
    fallback: () => readClipboardFallback(),
  });
}

export function scanQr(text?: string): Promise<string | null> {
  return callNativeOrFallback({
    ready: nativeReady('6.4'),
    native: () =>
      new Promise((resolve) => {
        const wa = getWebApp()!;
        wa.showScanQrPopup({ text }, (result) => {
          wa.closeScanQrPopup();
          resolve(result);
          return true;
        });
      }),
    fallback: () => Promise.resolve(null), // fallback: () => scanQrFallback(text),
  });
}

export function shareToStory(mediaUrl: string, params?: StoryShareParams): void {
  if (!nativeReady('7.8')) return;
  safeInvoke(() => getWebApp()!.shareToStory(mediaUrl, params));
}

export function shareMessage(msgId: string): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('8.0'),
    native: () => new Promise((resolve) => getWebApp()!.shareMessage(msgId, resolve)),
    fallback: () => shareTextFallback(msgId),
  });
}

export function downloadFile(params: DownloadFileParams): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('8.0'),
    native: () => new Promise((resolve) => getWebApp()!.downloadFile(params, resolve)),
    fallback: () => downloadFileFallback(params.url, params.file_name),
  });
}

// ---------------------------------------------------------------------
// Telegram-account-only actions - no meaningful browser equivalent, so
// these resolve gracefully to `false` outside Telegram instead of
// rejecting, warning, or hanging.
// ---------------------------------------------------------------------

export function setEmojiStatus(customEmojiId: string, params?: EmojiStatusParams): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('8.0'),
    native: () => new Promise((resolve) => getWebApp()!.setEmojiStatus(customEmojiId, params, resolve)),
    fallback: () => false,
  });
}

export function requestEmojiStatusAccess(): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('8.0'),
    native: () => new Promise((resolve) => getWebApp()!.requestEmojiStatusAccess(resolve)),
    fallback: () => false,
  });
}

export function requestWriteAccess(): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('6.9'),
    native: () => new Promise((resolve) => getWebApp()!.requestWriteAccess(resolve)),
    fallback: () => false,
  });
}

export function requestContact(): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('6.9'),
    native: () => new Promise((resolve) => getWebApp()!.requestContact(resolve)),
    fallback: () => false,
  });
}

/**
 * Opens Telegram's native chat-request dialog for a chat request you
 * already created server-side, identified by `reqId`. Requires Bot API
 * 9.6+. No browser fallback exists for this Telegram-account action.
 */
export function requestChat(reqId: string): Promise<boolean> {
  return callNativeOrFallback({
    ready: nativeReady('9.6'),
    native: () => new Promise((resolve) => getWebApp()!.requestChat(reqId, resolve)),
    fallback: () => false,
  });
}

/** No fallback: this calls your own bot's server-side logic, which only exists via the real Telegram client. */
export function invokeCustomMethod(method: string, params: object = {}): Promise<unknown> {
  return callNativeOrFallback({
    ready: nativeReady('6.9'),
    native: () => new Promise((resolve, reject) => getWebApp()!.invokeCustomMethod(method, params, (e, r) => (e ? reject(new Error(e)) : resolve(r)))),
    fallback: () => {
      throw new Error('invokeCustomMethod requires the Telegram app (Bot API 6.9+).');
    },
  });
}

// ---------------------------------------------------------------------
// Biometrics - no browser equivalent; resolve gracefully instead of
// hanging (the native BiometricManager silently no-ops on an unsupported
// client, which used to leave these promises pending forever).
// ---------------------------------------------------------------------

export const biometric = {
  init: (): Promise<void> =>
    callNativeOrFallback({
      ready: nativeReady('7.2'),
      native: () => new Promise<void>((resolve) => getWebApp()!.BiometricManager.init(resolve)),
      fallback: () => undefined,
    }),

  requestAccess: (reason?: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('7.2'),
      native: () => new Promise<boolean>((resolve) => getWebApp()!.BiometricManager.requestAccess({ reason }, resolve)),
      fallback: () => false,
    }),

  authenticate: (reason?: string): Promise<{ authenticated: boolean; token?: string }> =>
    callNativeOrFallback({
      ready: nativeReady('7.2'),
      native: () =>
        new Promise<{ authenticated: boolean; token?: string }>((resolve) =>
          getWebApp()!.BiometricManager.authenticate({ reason }, (authenticated, token) => resolve({ authenticated, token: token ?? undefined }))
        ),
      fallback: () => ({ authenticated: false }),
    }),

  updateBiometricToken: (token: string): Promise<boolean> =>
    callNativeOrFallback({
      ready: nativeReady('7.2'),
      native: () => new Promise<boolean>((resolve) => getWebApp()!.BiometricManager.updateBiometricToken(token, resolve)),
      fallback: () => false,
    }),

  openSettings: (): void => {
    if (!nativeReady('7.2')) return;
    safeInvoke(() => getWebApp()!.BiometricManager.openSettings());
  },
};

// ---------------------------------------------------------------------
// Location - navigator.geolocation fallback outside Telegram
// ---------------------------------------------------------------------

export const location = {
  init: (): Promise<void> =>
    callNativeOrFallback({
      ready: nativeReady('8.0'),
      native: () => new Promise<void>((resolve) => getWebApp()!.LocationManager.init(() => resolve())),
      fallback: () => undefined,
    }),

  getLocation: (): Promise<LocationData | null> =>
    callNativeOrFallback({
      ready: nativeReady('8.0'),
      native: () => new Promise<LocationData | null>((resolve) => getWebApp()!.LocationManager.getLocation((data) => resolve(data))),
      fallback: () => getLocationFallback(),
    }),

  openSettings: (): void => {
    if (!nativeReady('8.0')) return;
    safeInvoke(() => getWebApp()!.LocationManager.openSettings());
  },
};
