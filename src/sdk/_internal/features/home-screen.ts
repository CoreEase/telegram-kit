/**
 * `WebApp.addToHomeScreen` / `WebApp.checkHomeScreenStatus`.
 */

import { WebAppKernel } from '../core/kernel';
import type { HomeScreenStatus } from '../types';

type StatusCallback = (status: HomeScreenStatus) => void;

export class HomeScreenManager {
  private statusCallbacks: StatusCallback[] = [];

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('home_screen_added', this.handleAdded);
    kernel.webView.onEvent('home_screen_checked', this.handleChecked);
  }

  private handleAdded = (): void => {
    this.kernel.receiveWebViewEvent('homeScreenAdded');
  };

  private handleChecked = (_eventType: string, eventData: any): void => {
    const status: HomeScreenStatus = eventData.status || 'unknown';
    if (this.statusCallbacks.length > 0) {
      this.statusCallbacks.forEach((cb) => cb(status));
      this.statusCallbacks = [];
    }
    this.kernel.receiveWebViewEvent('homeScreenChecked', { status });
  };

  addToHomeScreen(): void {
    this.kernel.requireVersion('8.0', 'addToHomeScreen');
    this.kernel.webView.postEvent('web_app_add_to_home_screen');
  }

  checkHomeScreenStatus(callback?: StatusCallback): void {
    this.kernel.requireVersion('8.0', 'checkHomeScreenStatus');
    if (callback) this.statusCallbacks.push(callback);
    this.kernel.webView.postEvent('web_app_check_home_screen');
  }
}
