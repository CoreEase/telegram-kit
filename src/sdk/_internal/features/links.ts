/**
 * `WebApp.openLink` / `WebApp.openTelegramLink` + the iframe `<a href="t.me/...">`
 * click interception (`linkHandler` in the original script).
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { OpenLinkOptions, OpenTelegramLinkOptions } from '../types';

export class LinkManager {
  private readonly ALLOWED_TELEGRAM_HOSTS = ['t.me', 'telegram.me'];

  constructor(private readonly kernel: WebAppKernel) {}

  openLink(url: string, options: OpenLinkOptions = {}): void {
    const a = document.createElement('A') as HTMLAnchorElement;
    a.href = url;
    if (a.protocol != 'http:' && a.protocol != 'https:') {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Url protocol is not supported', url);
      throwWebAppError(WebAppErrorName.TgUrlInvalid);
    }
    const resolvedUrl = a.href;
    if (this.kernel.versionAtLeast('6.1')) {
      const reqParams: Record<string, any> = { url: resolvedUrl };
      if (this.kernel.versionAtLeast('6.4') && options.try_instant_view) {
        reqParams.try_instant_view = true;
      }
      if (this.kernel.versionAtLeast('7.6') && options.try_browser) {
        reqParams.try_browser = options.try_browser;
      }
      this.kernel.webView.postEvent('web_app_open_link', undefined, reqParams);
    } else {
      window.open(resolvedUrl, '_blank');
    }
  }

  openTelegramLink(url: string, options: OpenTelegramLinkOptions = {}): void {
    const a = document.createElement('A') as HTMLAnchorElement;
    a.href = url;

    if (a.protocol != 'http:' && a.protocol != 'https:') {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Url protocol is not supported', url);
      throwWebAppError(WebAppErrorName.TgUrlInvalid);
    }
    
    if (!this.ALLOWED_TELEGRAM_HOSTS.includes(a.hostname)) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Url host is not supported. Allowed hosts: t.me, telegram.me', url);
      throwWebAppError(WebAppErrorName.TgUrlInvalid);
    }
    
    const pathFull = a.pathname + a.search;
    
    if (this.kernel.webView.isIframe || this.kernel.versionAtLeast('6.1')) {
      const reqParams: Record<string, any> = { path_full: pathFull };
      if (options.force_request) {
        reqParams.force_request = true;
      }
      this.kernel.webView.postEvent('web_app_open_tg_link', undefined, reqParams);
    } else {
      location.href = a.protocol + '//' + a.hostname + pathFull;
    }
  }

  /**
   * Intercepts clicks on in-page `t.me` / `telegram.me` links while running inside an
   * iframe (web.telegram.org) and routes them through `openTelegramLink`
   * instead of letting the browser navigate directly.
   */
  handleDocumentClick = (e: MouseEvent): void => {
    if (e.metaKey || e.ctrlKey) return;
    
    let el = e.target as HTMLElement | null;
    while (el && el.tagName != 'A' && el.parentNode) {
      el = el.parentNode as HTMLElement;
    }
    
    if (
      el &&
      el.tagName == 'A' &&
      (el as HTMLAnchorElement).target != '_blank' &&
      ((el as HTMLAnchorElement).protocol == 'http:' || (el as HTMLAnchorElement).protocol == 'https:') &&
      this.ALLOWED_TELEGRAM_HOSTS.includes((el as HTMLAnchorElement).hostname)
    ) {
      this.openTelegramLink((el as HTMLAnchorElement).href);
      e.preventDefault();
    }
  };
}
