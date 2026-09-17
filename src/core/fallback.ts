
import type { LocationData } from '../types/webapp';

const DEV_MODE_STORAGE_KEY = '@core-ease/telegram-kit:dev-mode-active';

export function markDevModeActive(): void {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(DEV_MODE_STORAGE_KEY, '1');
  } catch {

  }
}

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

export function vibrateFallback(kind: keyof typeof HAPTIC_PATTERNS): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(HAPTIC_PATTERNS[kind] as number | number[]);
    }
  } catch {

  }
}

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

export async function readClipboardFallback(): Promise<string | null> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      const text = await navigator.clipboard.readText();
      return text ?? null;
    }
  } catch {

  }
  return null;
}

export function scanQrFallback(promptText?: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return null;
  const value = window.prompt(promptText || 'Enter the QR code value:');
  return value && value.length ? value : null;
}

export async function shareTextFallback(text: string, url?: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ text, url });
      return true;
    }
  } catch {

  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      return true;
    }
  } catch {

  }
  return false;
}

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

    return false;
  }
}

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

export function safeInvoke(fn: () => void): void {
  try {
    fn();
  } catch {

  }
}
