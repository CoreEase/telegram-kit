/**
 * Sharing-related surface: `shareToStory`, `shareMessage`, `requestChat`,
 * `switchInlineQuery`.
 */

import { WebAppKernel } from '../core/kernel';
import { strTrim } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { InitParams, ShareToStoryParams } from '../types';

type SentCallback = (sent: boolean) => void;

export class SharingManager {
  private shareMessageOpened: { callback?: SentCallback } | false = false;
  private requestChatOpened: { callback?: SentCallback } | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('prepared_message_sent', this.handlePreparedMessageSent);
    kernel.webView.onEvent('prepared_message_failed', this.handlePreparedMessageFailed);
    kernel.webView.onEvent('requested_chat_sent', this.handleRequestedChatSent);
    kernel.webView.onEvent('requested_chat_failed', this.handleRequestedChatFailed);
  }

  private handlePreparedMessageSent = (): void => {
    if (!this.shareMessageOpened) return;
    const requestData = this.shareMessageOpened;
    this.shareMessageOpened = false;
    requestData.callback?.(true);
    this.kernel.receiveWebViewEvent('shareMessageSent');
  };

  private handlePreparedMessageFailed = (_eventType: string, eventData: any): void => {
    if (!this.shareMessageOpened) return;
    const requestData = this.shareMessageOpened;
    this.shareMessageOpened = false;
    requestData.callback?.(false);
    this.kernel.receiveWebViewEvent('shareMessageFailed', { error: eventData.error });
  };

  private handleRequestedChatSent = (): void => {
    if (!this.requestChatOpened) return;
    const requestData = this.requestChatOpened;
    this.requestChatOpened = false;
    requestData.callback?.(true);
    this.kernel.receiveWebViewEvent('requestedChatSent');
  };

  private handleRequestedChatFailed = (_eventType: string, eventData: any): void => {
    if (!this.requestChatOpened) return;
    const requestData = this.requestChatOpened;
    this.requestChatOpened = false;
    requestData.callback?.(false);
    this.kernel.receiveWebViewEvent('requestedChatFailed', { error: eventData.error });
  };

  shareToStory(mediaUrl: string, params: ShareToStoryParams = {}): void {
    this.kernel.requireVersion('7.8', 'shareToStory');
    const a = document.createElement('A') as HTMLAnchorElement;
    a.href = mediaUrl;
    if (a.protocol != 'http:' && a.protocol != 'https:') {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Media url protocol is not supported', mediaUrl);
      throwWebAppError(WebAppErrorName.MediaUrlInvalid);
    }
    const shareParams: Record<string, any> = { media_url: a.href };

    if (typeof params.text !== 'undefined') {
      const text = strTrim(params.text);
      if (text.length > 2048) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Text is too long', text);
        throwWebAppError(WebAppErrorName.ShareToStoryParamInvalid);
      }
      if (text.length > 0) shareParams.text = text;
    }

    if (typeof params.widget_link !== 'undefined') {
      const widgetLinkParam = params.widget_link || ({} as NonNullable<typeof params.widget_link>);
      a.href = widgetLinkParam.url;
      if (a.protocol != 'http:' && a.protocol != 'https:') {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Link protocol is not supported', widgetLinkParam.url);
        throwWebAppError(WebAppErrorName.ShareToStoryParamInvalid);
      }
      const widgetLink: { url: string; name?: string } = { url: a.href };
      if (typeof widgetLinkParam.name !== 'undefined') {
        const linkName = strTrim(widgetLinkParam.name);
        if (linkName.length > 48) {
          // eslint-disable-next-line no-console
          console.error('[@core-ease/telegram-kit] Link name is too long', linkName);
          throwWebAppError(WebAppErrorName.ShareToStoryParamInvalid);
        }
        if (linkName.length > 0) widgetLink.name = linkName;
      }
      shareParams.widget_link = widgetLink;
    }

    this.kernel.webView.postEvent('web_app_share_to_story', undefined, shareParams);
  }

  shareMessage(msgId: string, callback?: SentCallback): void {
    this.kernel.requireVersion('8.0', 'shareMessage');
    if (this.shareMessageOpened) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Share message is already opened');
      throwWebAppError(WebAppErrorName.ShareMessageOpened);
    }
    this.shareMessageOpened = { callback };
    this.kernel.webView.postEvent('web_app_send_prepared_message', undefined, { id: msgId });
  }

  requestChat(reqId: string, callback?: SentCallback): void {
    this.kernel.requireVersion('9.6', 'requestChat');
    if (this.requestChatOpened) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Request chat is already opened');
      throwWebAppError(WebAppErrorName.RequestChatOpened);
    }
    this.requestChatOpened = { callback };
    this.kernel.webView.postEvent('web_app_request_chat', undefined, { req_id: reqId });
  }

  switchInlineQuery(query: string, chooseChatTypes: string[] | undefined, initParams: InitParams): void {
    this.kernel.requireVersion('6.6', 'switchInlineQuery');
    if (!initParams.tgWebAppBotInline) {
      // eslint-disable-next-line no-console
      console.error(
        '[@core-ease/telegram-kit] Inline mode is disabled for this bot. Read more about inline mode: https://core.telegram.org/bots/inline'
      );
      throwWebAppError(WebAppErrorName.InlineModeDisabled);
    }
    const q = query || '';
    if (q.length > 256) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Inline query is too long', q);
      throwWebAppError(WebAppErrorName.InlineQueryInvalid);
    }
    const chatTypes: string[] = [];
    if (chooseChatTypes) {
      if (!Array.isArray(chooseChatTypes)) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Choose chat types should be an array', chooseChatTypes);
        throwWebAppError(WebAppErrorName.InlineChooseChatTypesInvalid);
      }
      const goodTypes: Record<string, number> = { users: 1, bots: 1, groups: 1, channels: 1 };
      for (const chatType of chooseChatTypes) {
        if (!goodTypes[chatType]) {
          // eslint-disable-next-line no-console
          console.error('[@core-ease/telegram-kit] Choose chat type is invalid', chatType);
          throwWebAppError(WebAppErrorName.InlineChooseChatTypeInvalid);
        }
        if (goodTypes[chatType] != 2) {
          goodTypes[chatType] = 2;
          chatTypes.push(chatType);
        }
      }
    }
    this.kernel.webView.postEvent('web_app_switch_inline_query', undefined, { query: q, chat_types: chatTypes });
  }
}
