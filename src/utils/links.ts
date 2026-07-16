function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const START_PARAM_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidStartParam(param: string): boolean {
  return START_PARAM_PATTERN.test(param);
}

export function encodeStartParam(value: string): string {
  const encoded = bytesToBase64Url(new TextEncoder().encode(value));
  if (encoded.length > 64) {
    throw new Error(
      `[@core-ease/telegram-kit] encodeStartParam: the encoded value is ${encoded.length} characters, ` +
        `exceeding Telegram's 64-character limit for start parameters. Pass a shorter payload ` +
        `(e.g. a numeric/short ID you look up server-side, instead of embedding full data).`
    );
  }
  return encoded;
}

export function decodeStartParam(param: string): string {
  return new TextDecoder().decode(base64UrlToBytes(param));
}

interface StartParamInput {
  startParam?: string;
  data?: string;
}

function resolveStartParam(options: StartParamInput): string | undefined {
  if (options.startParam !== undefined && options.data !== undefined) {
    throw new Error('[@core-ease/telegram-kit] Provide either `startParam` or `data`, not both.');
  }
  if (options.data !== undefined) return encodeStartParam(options.data);
  if (options.startParam !== undefined) {
    if (!isValidStartParam(options.startParam)) {
      throw new Error(
        `[@core-ease/telegram-kit] "${options.startParam}" is not a valid Telegram start parameter ` +
          `(allowed characters: A-Z a-z 0-9 _ -, max 64 chars). Use \`data\` instead to auto-encode arbitrary text.`
      );
    }
    return options.startParam;
  }
  return undefined;
}

export interface BuildStartLinkOptions extends StartParamInput {
  botUsername: string;
}

export function buildStartLink(options: BuildStartLinkOptions): string {
  const param = resolveStartParam(options);
  const base = `https://telegram.me/${options.botUsername}`;
  return param ? `${base}?start=${param}` : base;
}

export interface BuildStartAppLinkOptions extends StartParamInput {
  botUsername: string;
  appName?: string;
  mode?: 'compact' | 'fullscreen';
}

export function buildStartAppLink(options: BuildStartAppLinkOptions): string {
  const param = resolveStartParam(options);
  const base = options.appName
    ? `https://telegram.me/${options.botUsername}/${options.appName}`
    : `https://telegram.me/${options.botUsername}`;
  const query = new URLSearchParams();
  if (param) query.set('startapp', param);
  if (options.mode) query.set('mode', options.mode);
  const queryString = query.toString();
  return queryString ? `${base}?${queryString}` : base;
}

export interface BuildShareLinkOptions {
  url?: string;
  text?: string;
}

export function buildShareLink(options: BuildShareLinkOptions = {}): string {
  const query = new URLSearchParams();
  
  if (options.url) query.set('url', options.url);
  if (options.text) query.set('text', options.text);
  
  const queryString = query.toString();
  return queryString ? `https://telegram.me/share/url?${queryString}` : 'https://telegram.me/share/url';
}

export type ParsedTelegramLink =
  | { type: 'profile'; username: string }
  | { type: 'bot-start'; username: string; startParam: string }
  | { type: 'mini-app'; username: string; appName?: string; startParam?: string; mode?: string }
  | { type: 'join-chat'; inviteHash: string }
  | { type: 'private-channel-post'; internalChatId: string; messageId: number }
  | { type: 'share'; url?: string; text?: string }
  | { type: 'unknown'; url: string };

const TME_HOSTNAMES = new Set(['t.me', 'telegram.me', 'telegram.dog']);

export function parseTelegramLink(link: string): ParsedTelegramLink {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { type: 'unknown', url: link };
  }

  if (url.protocol === 'tg:') {
    const action = url.hostname || url.pathname.replace(/^\/+/, '');

    if (action === 'resolve') {
      const domain = url.searchParams.get('domain');
      const start = url.searchParams.get('start');
      const startapp = url.searchParams.get('startapp');
      const mode = url.searchParams.get('mode') ?? undefined;
      if (domain && start) return { type: 'bot-start', username: domain, startParam: start };
      if (domain && startapp !== null) {
        return { type: 'mini-app', username: domain, startParam: startapp || undefined, mode };
      }
      if (domain) return { type: 'profile', username: domain };
    }
    if (action === 'join') {
      const invite = url.searchParams.get('invite');
      if (invite) return { type: 'join-chat', inviteHash: invite };
    }
    return { type: 'unknown', url: link };
  }

  if (!TME_HOSTNAMES.has(url.hostname)) {
    return { type: 'unknown', url: link };
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return { type: 'unknown', url: link };

  if (segments[0].startsWith('+')) {
    return { type: 'join-chat', inviteHash: segments[0].slice(1) };
  }
  if (segments[0] === 'joinchat' && segments[1]) {
    return { type: 'join-chat', inviteHash: segments[1] };
  }
  if (segments[0] === 'share' && segments[1] === 'url') {
    return {
      type: 'share',
      url: url.searchParams.get('url') ?? undefined,
      text: url.searchParams.get('text') ?? undefined,
    };
  }
  if (segments[0] === 'c' && segments[1] && segments[2]) {
    const messageId = Number(segments[2]);
    return { type: 'private-channel-post', internalChatId: segments[1], messageId };
  }

  const username = segments[0];
  const startapp = url.searchParams.get('startapp');
  const start = url.searchParams.get('start');
  const mode = url.searchParams.get('mode') ?? undefined;

  if (segments.length >= 2) {
    return { type: 'mini-app', username, appName: segments[1], startParam: startapp ?? undefined, mode };
  }
  if (startapp !== null) {
    return { type: 'mini-app', username, startParam: startapp || undefined, mode };
  }
  if (start !== null) {
    return { type: 'bot-start', username, startParam: start };
  }
  return { type: 'profile', username };
}
