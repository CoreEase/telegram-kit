/**
 * `@core-ease/telegram-kit/dev`
 *
 * Dev mode used to work by building a large plain-object mock that
 * re-implemented (and had to keep in sync with) the entire `TgWebApp`
 * surface by hand. That duplication is gone: `installDevMode()` now seeds
 * fake `tgWebAppData` / `tgWebAppThemeParams` / `tgWebAppVersion` /
 * `tgWebAppPlatform` into the exact session-storage slot the bundled SDK
 * reads on bootstrap (`sdk/_internal/core/webview.ts`), so the *real*
 * `WebApp` class boots up thinking it's talking to a (very quiet) native
 * client - no parallel implementation to maintain.
 *
 * Because there's no real native client behind it, response-required
 * calls (storage, biometrics, location, popups, clipboard, ...) would
 * naturally time out. `core/index.ts` already knows this: it marks the
 * session as dev-mode-active (see `isDevModeActive()` in `./fallback`) so
 * those calls skip straight to their fast browser-native fallback
 * (`localStorage`, `window.confirm`, `navigator.geolocation`, ...)
 * instead of waiting out a timeout. Fire-and-forget calls (buttons, theme
 * colors, haptics, ...) flow through the real SDK either way and simply
 * no-op harmlessly.
 *
 * **Call `installDevMode()` first thing** in your app's entry point,
 * before any other `@core-ease/telegram-kit` import touches
 * `getWebApp()` (hooks, `<TelegramProvider>`, `core/index.ts` functions,
 * ...) - the SDK bootstraps once and caches the result, so seeding after
 * that point has no effect.
 */

import { Utils, isBootstrapped, bootstrapTelegramWebApp } from '../sdk';
import { markDevModeActive } from './fallback';
import type { TgUser, TgThemeParams } from '../types/webapp';

export interface DevModeOptions {
  /** Defaults to a generic "Dev User". */
  user?: Partial<TgUser>;
  /** Forces light/dark theme. Defaults to reading the host page's CSS variables (see `getAppTheme()`), falling back to dark. */
  colorScheme?: 'light' | 'dark';
  /** Simulated `Telegram.WebApp.platform`. Defaults to `'tdesktop'`. */
  platform?: string;
  /** Simulated Bot API version. Defaults to `'8.0'`. */
  version?: string;
  /** Simulated `start_param` (deep-link payload). */
  startParam?: string;
  /** Shows a small "dev mode" badge in the corner of the page. Defaults to `true`. */
  showIndicator?: boolean;
}

export interface InstallDevModeOptions extends DevModeOptions {
  /** Seed fake data even if this looks like it's already running inside real Telegram. */
  force?: boolean;
}

const DEFAULT_USER: TgUser = {
  id: 123456789,
  first_name: 'Dev',
  last_name: 'User',
  username: 'dev_user',
  language_code: 'en',
  is_premium: false,
};

const LIGHT_THEME: TgThemeParams = {
  bg_color: '#ffffff',
  secondary_bg_color: '#f1f1f1',
  text_color: '#000000',
  hint_color: '#999999',
  link_color: '#2678b6',
  button_color: '#2678b6',
  button_text_color: '#ffffff',
  header_bg_color: '#527da3',
  bottom_bar_bg_color: '#ffffff',
  accent_text_color: '#168acd',
  section_bg_color: '#ffffff',
  section_header_text_color: '#168acd',
  section_separator_color: '#e7e7e7',
  subtitle_text_color: '#999999',
  destructive_text_color: '#cc2929',
};

const DARK_THEME: TgThemeParams = {
  bg_color: '#17212b',
  secondary_bg_color: '#232e3c',
  text_color: '#f5f5f5',
  hint_color: '#708499',
  link_color: '#6ab3f3',
  button_color: '#5288c1',
  button_text_color: '#ffffff',
  header_bg_color: '#17212b',
  bottom_bar_bg_color: '#17212b',
  accent_text_color: '#6ab3f3',
  section_bg_color: '#232e3c',
  section_header_text_color: '#6ab3f3',
  section_separator_color: '#ffffff14',
  subtitle_text_color: '#708499',
  destructive_text_color: '#ec3942',
};

/** Reads the host page's own CSS variables for a theme that matches your app's current look, falling back to `DARK_THEME`. */
function getAppTheme(): TgThemeParams {
  if (typeof document === 'undefined') return DARK_THEME;

  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const getColor = (varName: string, fallback: string): string => styles.getPropertyValue(varName).trim() || fallback;
  const isDark = getColor('--color-scheme', 'dark') === 'dark' || getColor('--background', '#0f0f0f') === '#0f0f0f';

  return {
    bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
    secondary_bg_color: getColor('--secondary', isDark ? '#101010' : '#f1f1f1'),
    text_color: getColor('--foreground', isDark ? '#f5f5f5' : '#000000'),
    hint_color: getColor('--muted-foreground', isDark ? '#7a7a7a' : '#999999'),
    link_color: getColor('--primary', isDark ? '#6ab3f3' : '#2678b6'),
    button_color: getColor('--primary', isDark ? '#f5f5f5' : '#2678b6'),
    button_text_color: getColor('--primary-foreground', isDark ? '#262626' : '#ffffff'),
    header_bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
    bottom_bar_bg_color: getColor('--background', isDark ? '#0f0f0f' : '#ffffff'),
    accent_text_color: getColor('--accent-foreground', isDark ? '#6ab3f3' : '#168acd'),
    section_bg_color: getColor('--card', isDark ? '#101010' : '#ffffff'),
    section_header_text_color: getColor('--accent-foreground', isDark ? '#6ab3f3' : '#168acd'),
    section_separator_color: getColor('--border', isDark ? '#ffffff14' : '#e7e7e7'),
    subtitle_text_color: getColor('--muted-foreground', isDark ? '#7a7a7a' : '#999999'),
    destructive_text_color: getColor('--destructive', isDark ? '#f16060' : '#cc2929'),
  };
}

function resolveTheme(colorScheme?: 'light' | 'dark'): TgThemeParams {
  if (colorScheme === 'light') return LIGHT_THEME;
  if (colorScheme === 'dark') return DARK_THEME;
  return getAppTheme();
}

/** Builds the exact `tgWebAppData` query-string shape a real Telegram client would send. */
function buildFakeTgWebAppData(options: DevModeOptions): string {
  const user: TgUser = { ...DEFAULT_USER, ...options.user };
  const fields: Record<string, string> = {
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: 'dev_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
  };
  if (options.startParam) fields.start_param = options.startParam;
  return Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

/** Cheap heuristic (no bootstrap needed) for "does this look like a real Telegram launch". */
function looksLikeRealTelegramLaunch(): boolean {
  try {
    return typeof location !== 'undefined' && location.hash.indexOf('tgWebAppData') !== -1;
  } catch {
    return false;
  }
}

/**
 * Seeds fake Telegram init data (a fake user, theme, platform, and Bot API
 * version) so the bundled SDK bootstraps exactly as it would inside real
 * Telegram - just talking to a client that never answers. Every
 * `@core-ease/telegram-kit` feature keeps working through its browser
 * fallback (see `core/fallback.ts`).
 *
 * Call this **before** anything else touches `getWebApp()` (any hook, the
 * `<TelegramProvider>`, or any `core/index.ts` function) - the SDK
 * bootstraps once and caches the result.
 *
 * Returns `false` (and does nothing) if it looks like the app is already
 * running inside real Telegram, unless `options.force` is set.
 */
export function installDevMode(options: InstallDevModeOptions = {}): boolean {
  if (typeof window === 'undefined') return false;

  if (looksLikeRealTelegramLaunch() && !options.force) return false;

  if (isBootstrapped()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[@core-ease/telegram-kit] installDevMode() was called after the SDK already bootstrapped - call it before ' +
        'any other @core-ease/telegram-kit import touches getWebApp() (hooks, <TelegramProvider>, core functions).'
    );
    if (!options.force) return false;
  }

  Utils.sessionStorageSet('initParams', {
    tgWebAppData: buildFakeTgWebAppData(options),
    tgWebAppVersion: options.version ?? '8.0',
    tgWebAppPlatform: options.platform ?? 'tdesktop',
    tgWebAppThemeParams: JSON.stringify(resolveTheme(options.colorScheme)),
  });
  markDevModeActive();

  // Bootstraps right away (idempotent) so window.Telegram.WebApp and
  // getWebApp() are usable immediately after this call returns.
  bootstrapTelegramWebApp();

  if (options.showIndicator !== false) attachDevIndicator();

  // eslint-disable-next-line no-console
  console.info(
    '%c[@core-ease/telegram-kit] Dev mode active',
    'background:#2678b6;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold'
  );

  return true;
}

function attachDevIndicator(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('core-ease-telegram-kit-dev-indicator')) return;

  const styles = getComputedStyle(document.documentElement);
  const bgColor = styles.getPropertyValue('--primary').trim() || '#2678b6';
  const textColor = styles.getPropertyValue('--primary-foreground').trim() || '#ffffff';

  const el = document.createElement('div');
  el.id = 'core-ease-telegram-kit-dev-indicator';
  el.textContent = '@core-ease/telegram-kit dev';
  el.style.cssText = [
    'position:fixed',
    'bottom:8px',
    'right:8px',
    'z-index:999999',
    `background:${bgColor}`,
    `color:${textColor}`,
    'font:bold 11px/1 monospace',
    'padding:4px 8px',
    'border-radius:4px',
    'pointer-events:none',
    'opacity:0.85',
    'letter-spacing:0.5px',
    'box-shadow:0 2px 4px rgba(0,0,0,0.2)',
  ].join(';');

  document.body.appendChild(el);
}

/**
 * Environment heuristic (NOT the same as "dev mode is active" - see
 * `isDevModeActive()` in `./fallback` for that) you can use to decide
 * *whether* to call `installDevMode()` at all, e.g.:
 *
 * ```ts
 * if (isDevMode()) installDevMode();
 * ```
 */
export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') ||
    new URLSearchParams(window.location.search).has('tg_dev')
  );
}
