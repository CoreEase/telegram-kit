/**
 * WebApp-level kernel.
 *
 * The original script keeps a pile of closures (`versionAtLeast`,
 * `receiveWebViewEvent`, `webAppCallbacks`, `generateCallbackId`,
 * `setCssProperty`, `invokeCustomMethod`, ...) that every feature
 * (buttons, storages, sensors, popups...) reaches into.
 *
 * To keep the TypeScript port modular while preserving that exact runtime
 * behavior, those closures are grouped into one small `WebAppKernel` class
 * that gets constructed once and injected into every feature module. This
 * is the *only* piece of shared mutable plumbing; everything else lives in
 * its own dedicated module.
 */

import { TelegramWebView } from './webview';
import { byteLength, generateRandomId, strTrim, versionCompare } from './utils';
import { WebAppErrorName, throwWebAppError } from './errors';
import type { EventHandler, InitParams } from '../types';

export type WebAppCallback = (...args: any[]) => void;

interface PendingCallback {
  callback?: WebAppCallback;
}

export class WebAppKernel {
  readonly webView: TelegramWebView;
  readonly initParams: InitParams;

  /** Mutable current protocol version reported by the client, e.g. '8.0'. */
  private _version = '6.0';

  private callbacks: Record<string, PendingCallback> = {};

  /** Height (px) reserved by the in-browser debug bottom bar, if active. */
  bottomBarHeightPx = 0;

  constructor(webView: TelegramWebView) {
    this.webView = webView;
    this.initParams = webView.initParams;
    if (this.initParams.tgWebAppVersion) {
      this._version = this.initParams.tgWebAppVersion;
    }
  }

  get version(): string {
    return this._version;
  }

  set version(v: string) {
    this._version = v;
  }

  versionAtLeast(ver: string): boolean {
    return versionCompare(this._version, ver) >= 0;
  }

  /** Logs + throws `WebAppMethodUnsupported` for a method gated by version. */
  requireVersion(ver: string, methodName: string): void {
    if (!this.versionAtLeast(ver)) {
      // eslint-disable-next-line no-console
      console.error(`[@core-ease/telegram-kit] Method ${methodName} is not supported in version ${this._version}`);
      throwWebAppError(WebAppErrorName.MethodUnsupported);
    }
  }

  /** Same as {@link requireVersion} but warns instead of throwing (soft-gated features). */
  warnIfUnsupported(ver: string, featureName: string): boolean {
    if (!this.versionAtLeast(ver)) {
      // eslint-disable-next-line no-console
      console.warn(`[@core-ease/telegram-kit] ${featureName} is not supported in version ${this._version}`);
      return false;
    }
    return true;
  }

  setCssProperty(name: string, value: string): void {
    const root = document.documentElement;
    if (root && root.style && root.style.setProperty) {
      root.style.setProperty('--tg-' + name, value);
    }
  }

  strTrim(str: unknown): string {
    return strTrim(str);
  }

  byteLength(str: string): number {
    return byteLength(str);
  }

  /** Dispatches an internal `webview:<eventType>` event to WebApp-level subscribers. */
  receiveWebViewEvent(eventType: string, ...args: any[]): void {
    this.webView.callEventCallbacks('webview:' + eventType, (callback) => {
      (callback as unknown as WebAppCallback).apply(null, args);
    });
  }

  onWebViewEvent(eventType: string, callback: EventHandler): void {
    this.webView.onEvent('webview:' + eventType, callback);
  }

  offWebViewEvent(eventType: string, callback: EventHandler): void {
    this.webView.offEvent('webview:' + eventType, callback);
  }

  /** Allocates a fresh request id and registers its pending callback. */
  registerCallback(callback?: WebAppCallback, len = 16): string {
    const id = generateRandomId(len, (candidate) => !!this.callbacks[candidate]);
    this.callbacks[id] = { callback };
    return id;
  }

  takeCallback(reqId: string): PendingCallback | undefined {
    const entry = this.callbacks[reqId];
    if (entry) {
      delete this.callbacks[reqId];
    }
    return entry;
  }

  hasCallback(reqId: string): boolean {
    return !!this.callbacks[reqId];
  }

  /** Generic `web_app_invoke_custom_method` used by CloudStorage, contact lookup, etc. */
  invokeCustomMethod(method: string, params: AnyRecordLike | undefined, callback?: WebAppCallback): void {
    this.requireVersion('6.9', 'invokeCustomMethod');
    const reqId = this.registerCallback(callback);
    this.webView.postEvent('web_app_invoke_custom_method', undefined, {
      req_id: reqId,
      method,
      params: params || {},
    });
  }

  onCustomMethodInvoked = (_eventType: string, eventData: any): void => {
    if (eventData.req_id && this.hasCallback(eventData.req_id)) {
      const entry = this.takeCallback(eventData.req_id);
      let res: any = null;
      let err: any = null;
      if (typeof eventData.result !== 'undefined') {
        res = eventData.result;
      }
      if (typeof eventData.error !== 'undefined') {
        err = eventData.error;
      }
      entry?.callback?.(err, res);
    }
  };
}

type AnyRecordLike = Record<string, any>;
