export interface LoadTelegramScriptOptions {
  async?: boolean;
  defer?: boolean;
  onLoad?: () => void;
  onError?: (error: Event) => void;
}

const TELEGRAM_CDN_URL = 'https://telegram.org/js/telegram-web-app.js';

export function loadTelegramScript(options: LoadTelegramScriptOptions = {}): Promise<void> {
  const { async: isAsync = true, defer = false, onLoad, onError } = options;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    if ((window as Window & { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TELEGRAM_CDN_URL}"]`
    );

    if (existing) {
      existing.addEventListener('load', () => { onLoad?.(); resolve(); });
      existing.addEventListener('error', (e) => { onError?.(e); reject(e); });
      return;
    }

    const script = document.createElement('script');
    script.src = TELEGRAM_CDN_URL;
    script.async = isAsync;
    script.defer = defer;

    script.addEventListener('load', () => {
      onLoad?.();
      resolve();
    });

    script.addEventListener('error', (e) => {
      onError?.(e);
      reject(new Error('Failed to load Telegram WebApp script from CDN'));
    });

    document.head.appendChild(script);
  });
}

export function getTelegramCdnUrl(): string {
  return TELEGRAM_CDN_URL;
}

export function injectTelegramScriptTag(options: {
  async?: boolean;
  defer?: boolean;
} = {}): string {
  const attrs: string[] = [`src="${TELEGRAM_CDN_URL}"`];
  if (options.async !== false) attrs.push('async');
  if (options.defer) attrs.push('defer');
  return `<script ${attrs.join(' ')}></script>`;
}
