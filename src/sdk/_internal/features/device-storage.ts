/**
 * `Telegram.WebApp.DeviceStorage`.
 */

import { WebAppKernel } from '../core/kernel';
import type { ErrCallback } from '../types';

export class DeviceStorage {
  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('device_storage_key_saved', this.handleEvent);
    kernel.webView.onEvent('device_storage_key_received', this.handleEvent);
    kernel.webView.onEvent('device_storage_cleared', this.handleEvent);
    kernel.webView.onEvent('device_storage_failed', this.handleEvent);
  }

  private handleEvent = (eventType: string, eventData: any): void => {
    if (!eventData.req_id || !this.kernel.hasCallback(eventData.req_id)) return;
    const entry = this.kernel.takeCallback(eventData.req_id);
    let res: any = null;
    let err: string | null = null;
    if (eventType == 'device_storage_failed') {
      err = eventData.error || 'UNKNOWN_ERROR';
    } else if (eventType == 'device_storage_key_received') {
      res = eventData.value;
    } else {
      res = true;
    }
    entry?.callback?.(err, res);
  };

  private invoke(method: string, params: Record<string, any>, callback?: ErrCallback): this {
    this.kernel.requireVersion('9.0', 'DeviceStorage');
    const reqId = this.kernel.registerCallback(callback);
    this.kernel.webView.postEvent(method, undefined, { req_id: reqId, ...params });
    return this;
  }

  setItem(key: string, value: string, callback?: ErrCallback): this {
    return this.invoke('web_app_device_storage_save_key', { key, value }, callback);
  }

  getItem(key: string, callback?: ErrCallback<string>): this {
    return this.invoke('web_app_device_storage_get_key', { key }, callback);
  }

  removeItem(key: string, callback?: ErrCallback): this {
    return this.invoke('web_app_device_storage_save_key', { key, value: null }, callback);
  }

  clear(callback?: ErrCallback): this {
    return this.invoke('web_app_device_storage_clear', {}, callback);
  }
}
