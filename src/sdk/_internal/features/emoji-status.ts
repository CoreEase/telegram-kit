/**
 * `WebApp.setEmojiStatus` / `WebApp.requestEmojiStatusAccess`.
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';

type SetStatusCallback = (applied: boolean) => void;
type AccessCallback = (granted: boolean) => void;

export class EmojiStatusManager {
  private setRequested: { callback?: SetStatusCallback } | false = false;
  private accessRequested: { callback?: AccessCallback } | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('emoji_status_set', this.handleSet);
    kernel.webView.onEvent('emoji_status_failed', this.handleFailed);
    kernel.webView.onEvent('emoji_status_access_requested', this.handleAccessRequested);
  }

  private handleSet = (): void => {
    if (!this.setRequested) return;
    const requestData = this.setRequested;
    this.setRequested = false;
    requestData.callback?.(true);
    this.kernel.receiveWebViewEvent('emojiStatusSet');
  };

  private handleFailed = (_eventType: string, eventData: any): void => {
    if (!this.setRequested) return;
    const requestData = this.setRequested;
    this.setRequested = false;
    requestData.callback?.(false);
    this.kernel.receiveWebViewEvent('emojiStatusFailed', { error: eventData.error });
  };

  private handleAccessRequested = (_eventType: string, eventData: any): void => {
    if (!this.accessRequested) return;
    const requestData = this.accessRequested;
    this.accessRequested = false;
    requestData.callback?.(eventData.status == 'allowed');
    this.kernel.receiveWebViewEvent('emojiStatusAccessRequested', { status: eventData.status });
  };

  setEmojiStatus(customEmojiId: string, params: { duration?: number } = {}, callback?: SetStatusCallback): void {
    this.kernel.requireVersion('8.0', 'setEmojiStatus');
    const statusParams: { custom_emoji_id: string; duration?: number } = { custom_emoji_id: customEmojiId };
    if (typeof params.duration !== 'undefined') {
      statusParams.duration = params.duration;
    }
    if (this.setRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Emoji status is already requested');
      throwWebAppError(WebAppErrorName.EmojiStatusRequested);
    }
    this.setRequested = { callback };
    this.kernel.webView.postEvent('web_app_set_emoji_status', undefined, statusParams);
  }

  requestEmojiStatusAccess(callback?: AccessCallback): void {
    this.kernel.requireVersion('8.0', 'requestEmojiStatusAccess');
    if (this.accessRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Emoji status permission is already requested');
      throwWebAppError(WebAppErrorName.EmojiStatusAccessRequested);
    }
    this.accessRequested = { callback };
    this.kernel.webView.postEvent('web_app_request_emoji_status_access');
  }
}
