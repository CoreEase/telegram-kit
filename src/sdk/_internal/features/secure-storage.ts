/**
 * `Telegram.WebApp.SecureStorage`.
 */

import { WebAppKernel } from '../core/kernel';

type SecureStorageCallback = (error: string | null, result?: any, canRestore?: boolean) => void;

export class SecureStorage {
  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('secure_storage_key_saved', this.handleEvent);
    kernel.webView.onEvent('secure_storage_key_received', this.handleEvent);
    kernel.webView.onEvent('secure_storage_key_restored', this.handleEvent);
    kernel.webView.onEvent('secure_storage_cleared', this.handleEvent);
    kernel.webView.onEvent('secure_storage_failed', this.handleEvent);
  }

  private handleEvent = (eventType: string, eventData: any): void => {
    if (!eventData.req_id || !this.kernel.hasCallback(eventData.req_id)) return;
    const entry = this.kernel.takeCallback(eventData.req_id);
    let res: any = null;
    let err: string | null = null;
    let canRestore: boolean | null = null;
    if (eventType == 'secure_storage_failed') {
      err = eventData.error || 'UNKNOWN_ERROR';
    } else if (eventType == 'secure_storage_key_received') {
      res = eventData.value;
      if (eventData.can_restore) {
        canRestore = true;
      }
    } else if (eventType == 'secure_storage_key_restored') {
      res = eventData.value;
    } else {
      res = true;
    }
    entry?.callback?.(err, res, canRestore);
  };

  private invoke(method: string, params: Record<string, any>, callback?: SecureStorageCallback): this {
    this.kernel.requireVersion('9.0', 'SecureStorage');
    const reqId = this.kernel.registerCallback(callback as any);
    this.kernel.webView.postEvent(method, undefined, { req_id: reqId, ...params });
    return this;
  }

  setItem(key: string, value: string, callback?: SecureStorageCallback): this {
    return this.invoke('web_app_secure_storage_save_key', { key, value }, callback);
  }

  getItem(key: string, callback?: SecureStorageCallback): this {
    return this.invoke('web_app_secure_storage_get_key', { key }, callback);
  }

  restoreItem(key: string, callback?: SecureStorageCallback): this {
    return this.invoke('web_app_secure_storage_restore_key', { key }, callback);
  }

  removeItem(key: string, callback?: SecureStorageCallback): this {
    return this.invoke('web_app_secure_storage_save_key', { key, value: null }, callback);
  }

  clear(callback?: SecureStorageCallback): this {
    return this.invoke('web_app_secure_storage_clear', {}, callback);
  }
}
