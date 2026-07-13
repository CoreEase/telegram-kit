/**
 * `WebApp.requestWriteAccess` / `WebApp.requestContact`.
 */

import { WebAppKernel } from '../core/kernel';
import { urlParseQueryString } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import { invokeGetRequestedContact } from './custom-method-helpers';

type WriteAccessCallback = (granted: boolean) => void;
type ContactCallback = (sent: boolean, eventPayload: Record<string, any>) => void;

export class ContactManager {
  private writeAccessRequested: { callback?: WriteAccessCallback } | false = false;
  private contactRequested: { callback?: ContactCallback } | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('write_access_requested', this.handleWriteAccessRequested);
    kernel.webView.onEvent('phone_requested', this.handlePhoneRequested);
  }

  private handleWriteAccessRequested = (_eventType: string, eventData: any): void => {
    if (this.writeAccessRequested) {
      const requestData = this.writeAccessRequested;
      this.writeAccessRequested = false;
      requestData.callback?.(eventData.status == 'allowed');
      this.kernel.receiveWebViewEvent('writeAccessRequested', { status: eventData.status });
    }
  };

  private handlePhoneRequested = (_eventType: string, eventData: any): void => {
    if (!this.contactRequested) return;
    const requestData = this.contactRequested;
    this.contactRequested = false;
    const requestSent = eventData.status == 'sent';
    const webViewEvent: Record<string, any> = { status: eventData.status };

    if (requestSent) {
      invokeGetRequestedContact(this.kernel, (res) => {
        if (res && res.length) {
          webViewEvent.response = res;
          webViewEvent.responseUnsafe = urlParseQueryString(res);
          for (const key in webViewEvent.responseUnsafe) {
            const val = webViewEvent.responseUnsafe[key];
            try {
              if ((val?.substr(0, 1) == '{' && val?.substr(-1) == '}') || (val?.substr(0, 1) == '[' && val?.substr(-1) == ']')) {
                webViewEvent.responseUnsafe[key] = JSON.parse(val);
              }
            } catch (e) {
              // leave raw string on parse failure
            }
          }
        }
        requestData.callback?.(requestSent, webViewEvent);
        this.kernel.receiveWebViewEvent('contactRequested', webViewEvent);
      }, 3000);
    } else {
      requestData.callback?.(requestSent, webViewEvent);
      this.kernel.receiveWebViewEvent('contactRequested', webViewEvent);
    }
  };

  requestWriteAccess(callback?: WriteAccessCallback): void {
    this.kernel.requireVersion('6.9', 'requestWriteAccess');
    if (this.writeAccessRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Write access is already requested');
      throwWebAppError(WebAppErrorName.WriteAccessRequested);
    }
    this.writeAccessRequested = { callback };
    this.kernel.webView.postEvent('web_app_request_write_access');
  }

  requestContact(callback?: ContactCallback): void {
    this.kernel.requireVersion('6.9', 'requestContact');
    if (this.contactRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Contact is already requested');
      throwWebAppError(WebAppErrorName.ContactRequested);
    }
    this.contactRequested = { callback };
    this.kernel.webView.postEvent('web_app_request_phone');
  }
}
