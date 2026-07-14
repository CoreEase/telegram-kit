/**
 * Pure, side-effect-light helper functions.
 * Direct TypeScript port of the `window.Telegram.Utils` helpers plus a
 * handful of private helpers that lived as free functions in the original
 * IIFE (strTrim, byteLength, versionCompare, parseColorToHex, isColorDark).
 */

export const ALLOWED_TELEGRAM_HOSTS = [
  't.me',
  'telegram.me',
  'telegram.dog',
];

export function urlSafeDecode(urlencoded: string): string {
  try {
    urlencoded = urlencoded.replace(/\+/g, '%20');
    return decodeURIComponent(urlencoded);
  } catch (e) {
    return urlencoded;
  }
}

export function urlParseQueryString(queryString: string): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  if (!queryString.length) {
    return params;
  }
  const queryStringParams = queryString.split('&');
  for (let i = 0; i < queryStringParams.length; i++) {
    const param = queryStringParams[i].split('=');
    const paramName = urlSafeDecode(param[0]);
    const paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
    params[paramName] = paramValue;
  }
  return params;
}

export function urlParseHashParams(locationHash: string): Record<string, any> {
  locationHash = locationHash.replace(/^#/, '');
  const params: Record<string, any> = {};
  if (!locationHash.length) {
    return params;
  }
  if (locationHash.indexOf('=') < 0 && locationHash.indexOf('?') < 0) {
    params._path = urlSafeDecode(locationHash);
    return params;
  }
  const qIndex = locationHash.indexOf('?');
  if (qIndex >= 0) {
    const pathParam = locationHash.substr(0, qIndex);
    params._path = urlSafeDecode(pathParam);
    locationHash = locationHash.substr(qIndex + 1);
  }
  const queryParams = urlParseQueryString(locationHash);
  for (const k in queryParams) {
    params[k] = queryParams[k];
  }
  return params;
}

/**
 * Telegram apps use this to add service params (e.g. tgShareScoreUrl) to a
 * game URL.
 * url looks like 'https://game.com/path?query=1#hash'
 * addHash looks like 'tgShareScoreUrl=' + encodeURIComponent('tgb://share_game_score?hash=very_long_hash123')
 */
export function urlAppendHashParams(url: string, addHash: string): string {
  const ind = url.indexOf('#');
  if (ind < 0) {
    // https://game.com/path -> https://game.com/path#tgShareScoreUrl=etc
    return url + '#' + addHash;
  }
  const curHash = url.substr(ind + 1);
  if (curHash.indexOf('=') >= 0 || curHash.indexOf('?') >= 0) {
    // https://game.com/#hash=1 -> https://game.com/#hash=1&tgShareScoreUrl=etc
    // https://game.com/#path?query -> https://game.com/#path?query&tgShareScoreUrl=etc
    return url + '&' + addHash;
  }
  // https://game.com/#hash -> https://game.com/#hash?tgShareScoreUrl=etc
  if (curHash.length > 0) {
    return url + '?' + addHash;
  }
  // https://game.com/# -> https://game.com/#tgShareScoreUrl=etc
  return url + addHash;
}

const SESSION_STORAGE_PREFIX = '__telegram-kit__';

export function sessionStorageSet(key: string, value: unknown): boolean {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    // ignore
  }
  return false;
}

export function sessionStorageGet<T = any>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_PREFIX + key);
    return JSON.parse(raw as string) as T;
  } catch (e) {
    // ignore
  }
  return null;
}

export function strTrim(str: unknown): string {
  return String(str).replace(/^\s+|\s+$/g, '');
}

/** UTF-8 byte length of a string, using Blob when available. */
export function byteLength(str: string): number {
  if (typeof window !== 'undefined' && window.Blob) {
    try {
      return new Blob([str]).size;
    } catch (e) {
      // fall through to manual calculation
    }
  }
  let s = str.length;
  for (let i = str.length - 1; i >= 0; i--) {
    const code = str.charCodeAt(i);
    if (code > 0x7f && code <= 0x7ff) s++;
    else if (code > 0x7ff && code <= 0xffff) s += 2;
    if (code >= 0xdc00 && code <= 0xdfff) i--;
  }
  return s;
}

/** Compares two dot-separated version strings. Returns -1, 0 or 1. */
export function versionCompare(v1: unknown, v2: unknown): -1 | 0 | 1 {
  const a1 = (typeof v1 === 'string' ? v1 : '').replace(/^\s+|\s+$/g, '').split('.');
  const a2 = (typeof v2 === 'string' ? v2 : '').replace(/^\s+|\s+$/g, '').split('.');
  const len = Math.max(a1.length, a2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parseInt(a1[i]) || 0;
    const p2 = parseInt(a2[i]) || 0;
    if (p1 == p2) continue;
    if (p1 > p2) return 1;
    return -1;
  }
  return 0;
}

/** Parses any CSS-ish color (hex3/hex6/rgb/rgba) into a normalized `#rrggbb`. */
export function parseColorToHex(color: unknown): string | false {
  const str = String(color);
  let match: RegExpExecArray | null;
  if ((match = /^\s*#([0-9a-f]{6})\s*$/i.exec(str))) {
    return '#' + match[1].toLowerCase();
  } else if ((match = /^\s*#([0-9a-f])([0-9a-f])([0-9a-f])\s*$/i.exec(str))) {
    return ('#' + match[1] + match[1] + match[2] + match[2] + match[3] + match[3]).toLowerCase();
  } else if ((match = /^\s*rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)\s*$/.exec(str))) {
    let r = parseInt(match[1]);
    let g = parseInt(match[2]);
    let b = parseInt(match[3]);
    const rHex = (r < 16 ? '0' : '') + r.toString(16);
    const gHex = (g < 16 ? '0' : '') + g.toString(16);
    const bHex = (b < 16 ? '0' : '') + b.toString(16);
    return '#' + rHex + gHex + bHex;
  }
  return false;
}

/** Perceived-brightness heuristic used to derive light/dark color-scheme. */
export function isColorDark(rgb: string): boolean {
  let hex = rgb.replace(/[\s#]/g, '');
  if (hex.length == 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
  return hsp < 120;
}

/** Generates a random alphanumeric id, retrying while `taken()` reports a collision. */
export function generateRandomId(len: number, taken: (id: string) => boolean): string {
  let tries = 100;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const charsLen = chars.length;
  while (--tries) {
    let id = '';
    for (let i = 0; i < len; i++) {
      id += chars[Math.floor(Math.random() * charsLen)];
    }
    if (!taken(id)) {
      return id;
    }
  }
  throw new Error('WebAppCallbackIdGenerateFailed');
}
