/**
 * `WebApp.downloadFile`.
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { DownloadFileParams } from '../types';

type DownloadCallback = (isDownloading: boolean) => void;

export class DownloadFileManager {
  private requested: { callback?: DownloadCallback } | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('file_download_requested', this.handleFileDownloadRequested);
  }

  private handleFileDownloadRequested = (_eventType: string, eventData: any): void => {
    if (!this.requested) return;
    const requestData = this.requested;
    this.requested = false;
    const isDownloading = eventData.status == 'downloading';
    requestData.callback?.(isDownloading);
    this.kernel.receiveWebViewEvent('fileDownloadRequested', { status: isDownloading ? 'downloading' : 'cancelled' });
  };

  downloadFile(params: DownloadFileParams, callback?: DownloadCallback): void {
    this.kernel.requireVersion('8.0', 'downloadFile');
    if (this.requested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Popup is already opened');
      throwWebAppError(WebAppErrorName.DownloadFilePopupOpened);
    }
    const a = document.createElement('A') as HTMLAnchorElement;
    const dlParams: { url?: string; file_name?: string } = {};

    if (!params || !params.url || !params.url.length) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Url is required');
      throwWebAppError(WebAppErrorName.DownloadFileParamInvalid);
    }
    a.href = params.url;
    if (a.protocol != 'https:') {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Url protocol is not supported', params.url);
      throwWebAppError(WebAppErrorName.DownloadFileParamInvalid);
    }
    dlParams.url = a.href;

    if (!params || !params.file_name || !params.file_name.length) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] File name is required');
      throwWebAppError(WebAppErrorName.DownloadFileParamInvalid);
    }
    dlParams.file_name = params.file_name;

    this.requested = { callback };
    this.kernel.webView.postEvent('web_app_request_file_download', undefined, dlParams);
  }
}
