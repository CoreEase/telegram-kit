/**
 * `Telegram.WebApp.CloudStorage`.
 */

import { WebAppKernel } from '../core/kernel';
import type { ErrCallback, ItemsCallback } from '../types';

export class CloudStorage {
  constructor(private readonly kernel: WebAppKernel) {}

  private invoke(method: string, params: Record<string, any>, callback?: ErrCallback): this {
    this.kernel.requireVersion('6.9', 'CloudStorage');
    this.kernel.invokeCustomMethod(method, params, callback);
    return this;
  }

  setItem(key: string, value: string, callback?: ErrCallback): this {
    return this.invoke('saveStorageValue', { key, value }, callback);
  }

  getItem(key: string, callback?: ErrCallback<string>): this {
    return this.getItems(
      [key],
      callback ? (err, res) => (err ? callback(err) : callback(null, res?.[key])) : undefined
    );
  }

  getItems(keys: string[], callback?: ItemsCallback): this {
    return this.invoke('getStorageValues', { keys }, callback);
  }

  removeItem(key: string, callback?: ErrCallback): this {
    return this.removeItems([key], callback);
  }

  removeItems(keys: string[], callback?: ErrCallback): this {
    return this.invoke('deleteStorageValues', { keys }, callback);
  }

  getKeys(callback?: ErrCallback<string[]>): this {
    return this.invoke('getStorageKeys', {}, callback);
  }
}
