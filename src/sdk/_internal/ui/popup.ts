/**
 * `WebApp.showPopup` / `showAlert` / `showConfirm`.
 */

import { WebAppKernel } from '../core/kernel';
import { strTrim } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { PopupButton, PopupParams } from '../types';

type PopupCallback = (buttonId: string | null) => void;
type AlertCallback = () => void;
type ConfirmCallback = (ok: boolean) => void;

interface PendingPopup {
  callback?: PopupCallback;
}

export class PopupManager {
  private pending: PendingPopup | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('popup_closed', this.handlePopupClosed);
  }

  private handlePopupClosed = (_eventType: string, eventData: any): void => {
    if (this.pending) {
      const popupData = this.pending;
      this.pending = false;
      const buttonId = typeof eventData.button_id !== 'undefined' ? eventData.button_id : null;
      popupData.callback?.(buttonId);
      this.kernel.receiveWebViewEvent('popupClosed', { button_id: buttonId });
    }
  };

  showPopup(params: PopupParams, callback?: PopupCallback): void {
    this.kernel.requireVersion('6.2', 'showPopup');
    if (this.pending) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup is already opened');
      throwWebAppError(WebAppErrorName.PopupOpened);
    }

    const popupParams: { title?: string; message: string; buttons?: PopupButton[] } = { message: '' };

    if (typeof params.title !== 'undefined') {
      const title = strTrim(params.title);
      if (title.length > 64) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Popup title is too long', title);
        throwWebAppError(WebAppErrorName.PopupParamInvalid);
      }
      if (title.length > 0) {
        popupParams.title = title;
      }
    }

    let message = '';
    if (typeof params.message !== 'undefined') {
      message = strTrim(params.message);
    }
    if (!message.length) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup message is required', params.message);
      throwWebAppError(WebAppErrorName.PopupParamInvalid);
    }
    if (message.length > 256) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup message is too long', message);
      throwWebAppError(WebAppErrorName.PopupParamInvalid);
    }
    popupParams.message = message;

    const buttons: PopupButton[] = [];
    if (typeof params.buttons !== 'undefined') {
      if (!Array.isArray(params.buttons)) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Popup buttons should be an array', params.buttons);
        throwWebAppError(WebAppErrorName.PopupParamInvalid);
      }
      for (const button of params.buttons) {
        const btn: PopupButton = {};
        let id = '';
        if (typeof button.id !== 'undefined') {
          id = String(button.id);
          if (id.length > 64) {
            // eslint-disable-next-line no-console
            console.error('[@core-ease/telegram-kit] Popup button id is too long', id);
            throwWebAppError(WebAppErrorName.PopupParamInvalid);
          }
        }
        btn.id = id;
        const buttonType = button.type || 'default';
        btn.type = buttonType;
        if (buttonType == 'ok' || buttonType == 'close' || buttonType == 'cancel') {
          // no params needed
        } else if (buttonType == 'default' || buttonType == 'destructive') {
          let text = '';
          if (typeof button.text !== 'undefined') {
            text = strTrim(button.text);
          }
          if (!text.length) {
            // eslint-disable-next-line no-console
            console.error(`[@core-ease/telegram-kit] Popup button text is required for type ${buttonType}`, button.text);
            throwWebAppError(WebAppErrorName.PopupParamInvalid);
          }
          if (text.length > 64) {
            // eslint-disable-next-line no-console
            console.error('[@core-ease/telegram-kit] Popup button text is too long', text);
            throwWebAppError(WebAppErrorName.PopupParamInvalid);
          }
          btn.text = text;
        } else {
          // eslint-disable-next-line no-console
          console.error('[@core-ease/telegram-kit] Popup button type is invalid', buttonType);
          throwWebAppError(WebAppErrorName.PopupParamInvalid);
        }
        buttons.push(btn);
      }
    } else {
      buttons.push({ id: '', type: 'close' });
    }
    if (buttons.length < 1) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup should have at least one button');
      throwWebAppError(WebAppErrorName.PopupParamInvalid);
    }
    if (buttons.length > 3) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup should not have more than 3 buttons');
      throwWebAppError(WebAppErrorName.PopupParamInvalid);
    }
    popupParams.buttons = buttons;

    this.pending = { callback };
    this.kernel.webView.postEvent('web_app_open_popup', undefined, popupParams);
  }

  showAlert(message: string, callback?: AlertCallback): void {
    this.showPopup({ message }, callback ? () => callback() : undefined);
  }

  showConfirm(message: string, callback?: ConfirmCallback): void {
    this.showPopup(
      {
        message,
        buttons: [
          { type: 'ok', id: 'ok' },
          { type: 'cancel' },
        ],
      },
      callback ? (buttonId) => callback(buttonId == 'ok') : undefined
    );
  }
}
