/**
 * WebView bridge / transport layer.
 *
 * This is a faithful port of the first `(function () { ... })()` block in
 * the original telegram-web-app.js: it is responsible for talking to the
 * native Telegram client (Android/iOS WebView proxy, Windows `external`
 * bridge, or a browser `postMessage` iframe bridge) and for the generic
 * pub/sub event bus that every higher-level feature (WebApp, buttons,
 * storages, sensors, ...) is built on top of.
 *
 * Nothing Telegram.WebApp-specific lives here on purpose: this module only
 * knows how to send/receive named events and parse the initial hash params.
 */

import {
  sessionStorageGet,
  sessionStorageSet,
  urlParseHashParams,
  urlParseQueryString,
  urlSafeDecode,
  urlAppendHashParams,
} from './utils';
import type { EventHandler, InitParams } from '../types';

declare global {
  interface Window {
    TelegramWebviewProxy?: {
      postEvent(eventType: string, eventData: string): void;
    };
    TelegramGameProxy_receiveEvent?: (eventType: string, eventData: any) => void;
    TelegramGameProxy?: {
      receiveEvent: (eventType: string, eventData: any) => void;
    };
  }
}

export type PostEventCallback = (error?: { notAvailable?: true } | Error | undefined) => void;

export class TelegramWebView {
  readonly initParams: InitParams;
  readonly isIframe: boolean;

  private eventHandlers: Record<string, EventHandler[]> = {};
  private iFrameStyleEl: HTMLStyleElement | undefined;

  constructor() {
    let locationHash = '';
    try {
      locationHash = location.hash.toString();
    } catch (e) {
      // ignore - `location` may be unavailable in some embedding contexts
    }

    const parsedParams = urlParseHashParams(locationHash);
    const storedParams = sessionStorageGet<InitParams>('initParams');
    if (storedParams) {
      for (const key in storedParams) {
        if (typeof parsedParams[key] === 'undefined') {
          parsedParams[key] = storedParams[key];
        }
      }
    }
    sessionStorageSet('initParams', parsedParams);
    this.initParams = parsedParams as InitParams;

    let isIframe = false;
    try {
      isIframe = window.parent != null && window !== window.parent;
      if (isIframe) {
        window.addEventListener('message', this.handleParentMessage);
        this.iFrameStyleEl = document.createElement('style');
        document.head.appendChild(this.iFrameStyleEl);
        try {
          window.parent.postMessage(
            JSON.stringify({ eventType: 'iframe_ready', eventData: { reload_supported: true } }),
            '*'
          );
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }
    this.isIframe = isIframe;

    // Windows Phone app / legacy game-proxy backward compatibility.
    window.TelegramGameProxy_receiveEvent = this.receiveEvent;
    window.TelegramGameProxy = { receiveEvent: this.receiveEvent };
  }

  private handleParentMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return;
    let dataParsed: any;
    try {
      dataParsed = JSON.parse(event.data);
    } catch (e) {
      return;
    }
    if (!dataParsed || !dataParsed.eventType) {
      return;
    }
    if (dataParsed.eventType == 'set_custom_style') {
      if (event.origin === 'https://web.telegram.org' && this.iFrameStyleEl) {
        this.iFrameStyleEl.innerHTML = dataParsed.eventData;
      }
    } else if (dataParsed.eventType == 'reload_iframe') {
      try {
        window.parent.postMessage(JSON.stringify({ eventType: 'iframe_will_reload' }), '*');
      } catch (e) {
        // ignore
      }
      location.reload();
    } else {
      this.receiveEvent(dataParsed.eventType, dataParsed.eventData);
    }
  };

  /** Sends a named event + payload to the native Telegram client. */
  postEvent(eventType: string, callback?: PostEventCallback, eventData: unknown = ''): void {
    const cb: PostEventCallback = callback || (() => {});
    // eslint-disable-next-line no-console
    console.log('[@core-ease/telegram-kit:webview] > postEvent', eventType, eventData);

    if (window.TelegramWebviewProxy !== undefined) {
      window.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
      cb();
    } else if (window.external && 'notify' in (window.external as any)) {
      (window.external as any).notify(JSON.stringify({ eventType, eventData }));
      cb();
    } else if (this.isIframe) {
      try {
        // For now we don't restrict target, for testing purposes.
        const trustedTarget = '*';
        window.parent.postMessage(JSON.stringify({ eventType, eventData }), trustedTarget);
        cb();
      } catch (e) {
        cb(e as Error);
      }
    } else {
      cb({ notAvailable: true });
    }
  }

  /** Dispatches an incoming event to every subscriber of `eventType`. */
  receiveEvent = (eventType: string, eventData: any): void => {
    // eslint-disable-next-line no-console
    console.log('[@core-ease/telegram-kit:webview] < receiveEvent', eventType, eventData);
    this.callEventCallbacks(eventType, (callback) => callback(eventType, eventData));
  };

  callEventCallbacks(eventType: string, func: (handler: EventHandler) => void): void {
    const handlers = this.eventHandlers[eventType];
    if (!handlers || !handlers.length) {
      return;
    }
    for (let i = 0; i < handlers.length; i++) {
      try {
        func(handlers[i]);
      } catch (e) {
        // Swallow subscriber errors, matching original try/catch-per-callback behavior.
      }
    }
  }

  onEvent(eventType: string, callback: EventHandler): void {
    if (this.eventHandlers[eventType] === undefined) {
      this.eventHandlers[eventType] = [];
    }
    if (this.eventHandlers[eventType].indexOf(callback) === -1) {
      this.eventHandlers[eventType].push(callback);
    }
  }

  offEvent(eventType: string, callback: EventHandler): void {
    const handlers = this.eventHandlers[eventType];
    if (handlers === undefined) {
      return;
    }
    const index = handlers.indexOf(callback);
    if (index === -1) {
      return;
    }
    handlers.splice(index, 1);
  }
}

/**
 * Opens a `tg://` / `web+tg://` proto URL, following the same iOS-iframe
 * workaround as the original `openProtoUrl` helper.
 */
export function openProtoUrl(url: string): boolean {
  if (!url.match(/^(web\+)?tgb?:\/\/./)) {
    return false;
  }
  const useIframe = /iOS|iPhone OS|iPhone|iPod|iPad/i.test(navigator.userAgent);
  if (useIframe) {
    const iframeContEl = document.getElementById('tgme_frame_cont') || document.body;
    const iframeEl = document.createElement('iframe');
    iframeContEl.appendChild(iframeEl);
    let pageHidden = false;
    const enableHidden = () => {
      pageHidden = true;
    };
    window.addEventListener('pagehide', enableHidden, false);
    window.addEventListener('blur', enableHidden, false);
    if (iframeEl !== null) {
      iframeEl.src = url;
    }
    setTimeout(() => {
      if (!pageHidden) {
        window.location.href = url;
      }
      window.removeEventListener('pagehide', enableHidden, false);
      window.removeEventListener('blur', enableHidden, false);
    }, 2000);
  } else {
    window.location.href = url;
  }
  return true;
}

/** Re-exported so consumers of `window.Telegram.Utils` keep the same surface. */
export const Utils = {
  urlSafeDecode,
  urlParseQueryString,
  urlParseHashParams,
  urlAppendHashParams,
  sessionStorageSet,
  sessionStorageGet,
};
