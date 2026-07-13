/**
 * Browser-native fallbacks for `@core-ease/telegram-kit`.
 *
 * Every wrapper in `core/index.ts` calls into the real bundled SDK first.
 * When that isn't possible - the Mini App is opened in a plain browser tab,
 * or the installed Telegram client is older than a feature needs - these
 * helpers provide the closest standard Web API equivalent instead of
 * rejecting the call or spamming the console with "not supported"
 * warnings. Where no meaningful browser equivalent exists (biometrics,
 * emoji status, Telegram-account actions, ...) the wrapper still resolves
 * predictably (`false`/`null`/`[]`) instead of throwing.
 */

import type { LocationData } from '../types/webapp';

const DEV_MODE_STORAGE_KEY = '@core-ease/telegram-kit:dev-mode-active';

/** Marks the current session as dev-mode-simulated Telegram. Used by `core/dev.ts`. */
export function markDevModeActive(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

/**
 * `true` if `installDevMode()` seeded fake init data this session. When
 * true, `core/index.ts` treats response-required native calls as
 * unreachable *immediately* (skipping the timeout race) so dev mode feels
 * fast, while fire-and-forget calls (buttons, theme, ...) still flow
 * through the real SDK harmlessly.
 */
export function isDevModeActive(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem(DEV_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const STORAGE_PREFIX = '@core-ease/telegram-kit:fallback:';

export interface FallbackKeyValueStore {
  setItem(key: string, value: string): Promise<boolean>;
  getItem(key: string): Promise<string | undefined>;
  getItems(keys: string[]): Promise<Record<string, string>>;
  removeItem(key: string): Promise<boolean>;
  removeItems(keys: string[]): Promise<boolean>;
  getKeys(): Promise<string[]>;
  clear(): Promise<boolean>;
}

/**
 * A `localStorage`-backed implementation of the Cloud/Device/Secure storage
 * contract, namespaced so the three don't collide with each other or with
 * the host app's own `localStorage` keys.
 *
 * Note: this is a *functional* fallback, not a *secure* one - there is no
 * standard browser API that provides Telegram's server-side encrypted
 * SecureStorage outside of the Telegram client itself.
 */
export function createLocalStorageFallback(namespace: string): FallbackKeyValueStore {
  const prefix = `${STORAGE_PREFIX}${namespace}:`;
  const hasLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

  return {
    async setItem(key, value) {
      if (!hasLocalStorage()) return false;
      try {
        window.localStorage.setItem(prefix + key, value);
        return true;
      } catch {
        return false;
      }
    },
    async getItem(key) {
      if (!hasLocalStorage()) return undefined;
      try {
        const value = window.localStorage.getItem(prefix + key);
        return value === null ? undefined : value;
      } catch {
        return undefined;
      }
    },
    async getItems(keys) {
      const result: Record<string, string> = {};
      if (!hasLocalStorage()) return result;
      for (const key of keys) {
        try {
          const value = window.localStorage.getItem(prefix + key);
          if (value !== null) result[key] = value;
        } catch {
          // skip unreadable key
        }
      }
      return result;
    },
    async removeItem(key) {
      if (!hasLocalStorage()) return false;
      try {
        window.localStorage.removeItem(prefix + key);
        return true;
      } catch {
        return false;
      }
    },
    async removeItems(keys) {
      if (!hasLocalStorage()) return false;
      try {
        keys.forEach((key) => window.localStorage.removeItem(prefix + key));
        return true;
      } catch {
        return false;
      }
    },
    async getKeys() {
      if (!hasLocalStorage()) return [];
      try {
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const rawKey = window.localStorage.key(i);
          if (rawKey && rawKey.startsWith(prefix)) keys.push(rawKey.slice(prefix.length));
        }
        return keys;
      } catch {
        return [];
      }
    },
    async clear() {
      if (!hasLocalStorage()) return false;
      try {
        const keys = await this.getKeys();
        keys.forEach((key) => window.localStorage.removeItem(prefix + key));
        return true;
      } catch {
        return false;
      }
    },
  };
}

const HAPTIC_PATTERNS = {
  light: 10,
  medium: 20,
  heavy: 30,
  rigid: 15,
  soft: 10,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 60, 30],
  selection: 5,
} as const;

/** Best-effort `navigator.vibrate` stand-in for `HapticFeedback`. */
export function vibrateFallback(kind: keyof typeof HAPTIC_PATTERNS): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(HAPTIC_PATTERNS[kind] as number | number[]);
    }
  } catch {
    // vibration API not available/allowed - silently ignore, this is a
    // best-effort nicety, not a required feature.
  }
}

/** Triggers a classic `<a download>` browser file download. */
export function downloadFileFallback(url: string, fileName: string): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

/** `navigator.geolocation`-backed stand-in for `LocationManager.getLocation`. */
export function getLocationFallback(): Promise<LocationData | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude: position.coords.altitude,
          course: position.coords.heading,
          speed: position.coords.speed,
          horizontal_accuracy: position.coords.accuracy,
          vertical_accuracy: position.coords.altitudeAccuracy,
          course_accuracy: null,
          speed_accuracy: null,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/** `navigator.clipboard.readText()` stand-in for `readTextFromClipboard`. */
export async function readClipboardFallback(): Promise<string | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return text ?? null;
    }
  } catch {
    // permission denied / not available - fall through
  }
  return null;
}

/** `window.prompt()` stand-in for the native camera QR scanner. */
export function scanQrFallback(promptText?: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null;
  const value = window.prompt(promptText || 'Enter the QR code value:');
  return value && value.length ? value : null;
}

/** Web Share API (falling back to clipboard copy) stand-in for `shareMessage`/`shareToStory`. */
export async function shareTextFallback(text: string, url?: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text, url });
      return true;
    }
  } catch {
    // user cancelled the native share sheet, or it's unavailable - try clipboard next
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Races a native, callback-driven Telegram call against a timeout so a
 * feature gated by an unmet Bot API version (which the real client would
 * silently no-op on) can never hang a caller's `await` forever. Resolves
 * to `fallback` if the real call doesn't settle in time, or if it throws
 * synchronously (e.g. a hard version-gate error).
 */
export function withTimeoutFallback<T>(factory: () => Promise<T>, fallback: T, timeoutMs = 4000): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    try {
      factory().then(
        (value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        },
        () => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(fallback);
          }
        }
      );
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(fallback);
      }
    }
  });
}

/**
 * The one function every `core/index.ts` wrapper is built on:
 *
 * - If `ready` is false (not in Telegram, or the client is older than the
 *   feature needs), calls `fallback()` directly - no attempt to reach a
 *   bridge that isn't there.
 * - If `ready` is true, calls `native()` but races it against `timeoutMs`.
 *   This covers `installDevMode()`'s seeded fake init data too: it makes
 *   `ready` true (so the app *looks* like it's running in Telegram), but
 *   there is still no real native client to answer, so without this race
 *   the call would hang forever. Timing out (or the native call throwing/
 *   rejecting) falls through to `fallback()` as well.
 *
 * This means every wrapped feature *always* settles, and always settles
 * with a real, usable value - never a thrown "not supported" error and
 * never a permanently-pending promise.
 */
export function callNativeOrFallback<T>(options: {
  ready: boolean;
  native: () => Promise<T>;
  fallback: () => T | Promise<T>;
  timeoutMs?: number;
}): Promise<T> {
  const { ready, native, fallback, timeoutMs = 4000 } = options;
  if (!ready) {
    try {
      return Promise.resolve(fallback());
    } catch (e) {
      return Promise.reject(e);
    }
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = async (useFallback: boolean, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(useFallback ? await fallback() : (value as T));
    };
    const timer = setTimeout(() => finish(true), timeoutMs);
    try {
      native().then(
        (value) => finish(false, value),
        () => finish(true)
      );
    } catch {
      finish(true);
    }
  });
}

/** `screen.orientation.lock/unlock()` stand-in for `WebApp.lockOrientation/unlockOrientation`. */
export async function orientationLockFallback(locked: boolean): Promise<boolean> {
  try {
    const orientation = typeof screen !== 'undefined' ? (screen as any).orientation : undefined;
    if (!orientation) return false;
    if (locked) {
      await orientation.lock('portrait');
    } else if (typeof orientation.unlock === 'function') {
      orientation.unlock();
    }
    return true;
  } catch {
    // Locking requires fullscreen / user gesture in most browsers - fine to
    // silently no-op when it isn't allowed.
    return false;
  }
}

/** Best-effort Fullscreen API stand-in for `WebApp.requestFullscreen/exitFullscreen`. */
export async function fullscreenFallback(enter: boolean, el?: HTMLElement): Promise<boolean> {
  try {
    if (typeof document === 'undefined') return false;
    if (enter) {
      const target = el ?? document.documentElement;
      await target.requestFullscreen?.();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    }
    return true;
  } catch {
    return false;
  }
}

/** Swallows synchronous throws from fire-and-forget SDK calls (e.g. hard version gates). */
export function safeInvoke(fn: () => void): void {
  try {
    fn();
  } catch {
    // A hard-gated SDK method (wrong Bot API version, invalid input, ...)
    // threw synchronously. This helper is used for fire-and-forget calls
    // that have no meaningful browser fallback, so degrading to a no-op is
    // the right behavior instead of crashing the caller.
  }
}
