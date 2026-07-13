/**
 * `WebApp.showScanQrPopup` / `closeScanQrPopup`.
 */

import { WebAppKernel } from '../core/kernel';
import { strTrim } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { ScanQrPopupParams } from '../types';

/** Return `true` from the callback to close the popup automatically. */
type ScanQrCallback = (data: string | null) => boolean | void;

interface PendingScanQr {
  callback?: ScanQrCallback;
}

export class ScanQrManager {
  private pending: PendingScanQr | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('qr_text_received', this.handleQrTextReceived);
    kernel.webView.onEvent('scan_qr_popup_closed', this.handleScanQrPopupClosed);
  }

  private handleQrTextReceived = (_eventType: string, eventData: any): void => {
    if (this.pending) {
      const popupData = this.pending;
      const data = typeof eventData.data !== 'undefined' ? eventData.data : null;
      if (popupData.callback) {
        if (popupData.callback(data)) {
          this.pending = false;
          this.kernel.webView.postEvent('web_app_close_scan_qr_popup', undefined);
        }
      }
      this.kernel.receiveWebViewEvent('qrTextReceived', { data });
    }
  };

  private handleScanQrPopupClosed = (): void => {
    this.pending = false;
    this.kernel.receiveWebViewEvent('scanQrPopupClosed');
  };

  showScanQrPopup(params: ScanQrPopupParams, callback?: ScanQrCallback): void {
    this.kernel.requireVersion('6.4', 'showScanQrPopup');
    if (this.pending) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup is already opened');
      throwWebAppError(WebAppErrorName.ScanQrPopupOpened);
    }
    const popupParams: { text?: string } = {};
    if (typeof params.text !== 'undefined') {
      const text = strTrim(params.text);
      if (text.length > 64) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Scan QR popup text is too long', text);
        throwWebAppError(WebAppErrorName.ScanQrPopupParamInvalid);
      }
      if (text.length > 0) {
        popupParams.text = text;
      }
    }
    this.pending = { callback };
    this.kernel.webView.postEvent('web_app_open_scan_qr_popup', undefined, popupParams);
  }

  closeScanQrPopup(): void {
    this.kernel.requireVersion('6.4', 'closeScanQrPopup');
    this.pending = false;
    this.kernel.webView.postEvent('web_app_close_scan_qr_popup', undefined);
  }
}
