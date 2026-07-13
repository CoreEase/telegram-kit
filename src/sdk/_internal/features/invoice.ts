/**
 * `WebApp.openInvoice`.
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';

type InvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';
type InvoiceCallback = (status: InvoiceStatus) => void;

interface OpenInvoiceState {
  url: string;
  callback?: InvoiceCallback;
}

export class InvoiceManager {
  private openInvoices: Record<string, OpenInvoiceState> = {};

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('invoice_closed', this.handleInvoiceClosed);
  }

  private handleInvoiceClosed = (_eventType: string, eventData: any): void => {
    if (eventData.slug && this.openInvoices[eventData.slug]) {
      const invoiceData = this.openInvoices[eventData.slug];
      delete this.openInvoices[eventData.slug];
      invoiceData.callback?.(eventData.status);
      this.kernel.receiveWebViewEvent('invoiceClosed', { url: invoiceData.url, status: eventData.status });
    }
  };

  openInvoice(url: string, callback?: InvoiceCallback): void {
    const a = document.createElement('A') as HTMLAnchorElement;
    a.href = url;
    const match = a.pathname.match(/^\/(\$|invoice\/)([A-Za-z0-9\-_=]+)$/);
    const slug = match?.[2];
    if ((a.protocol != 'http:' && a.protocol != 'https:') || a.hostname != 't.me' || !match || !slug) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Invoice url is invalid', url);
      throwWebAppError(WebAppErrorName.InvoiceUrlInvalid);
    }
    this.kernel.requireVersion('6.1', 'openInvoice');
    if (this.openInvoices[slug as string]) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Invoice is already opened');
      throwWebAppError(WebAppErrorName.InvoiceOpened);
    }
    this.openInvoices[slug as string] = { url, callback };
    this.kernel.webView.postEvent('web_app_open_invoice', undefined, { slug });
  }
}
