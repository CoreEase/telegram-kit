/**
 * `WebApp.readTextFromClipboard`.
 */

import { WebAppKernel } from '../core/kernel';

type ClipboardCallback = (data: string | null) => void;

export class ClipboardManager {
  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('clipboard_text_received', this.handleClipboardTextReceived);
  }

  private handleClipboardTextReceived = (_eventType: string, eventData: any): void => {
    if (!eventData.req_id || !this.kernel.hasCallback(eventData.req_id)) return;
    const entry = this.kernel.takeCallback(eventData.req_id);
    const data = typeof eventData.data !== 'undefined' ? eventData.data : null;
    entry?.callback?.(data);
    this.kernel.receiveWebViewEvent('clipboardTextReceived', { data });
  };

  readTextFromClipboard(callback?: ClipboardCallback): void {
    this.kernel.requireVersion('6.4', 'readTextFromClipboard');
    const reqId = this.kernel.registerCallback(callback as any);
    this.kernel.webView.postEvent('web_app_read_text_from_clipboard', undefined, { req_id: reqId });
  }
}
