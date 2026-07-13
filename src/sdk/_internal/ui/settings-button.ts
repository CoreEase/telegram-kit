/**
 * `Telegram.WebApp.SettingsButton` - port of the `SettingsButton` IIFE.
 */

import { WebAppKernel } from '../core/kernel';
import type { VoidCallback } from '../types';

export class SettingsButton {
  private _isVisible = false;
  private curButtonState: string | null = null;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('settings_button_pressed', this.handleSettingsButtonPressed);
  }

  private handleSettingsButtonPressed = (): void => {
    this.kernel.receiveWebViewEvent('settingsButtonClicked');
  };

  get isVisible(): boolean {
    return this._isVisible;
  }

  set isVisible(val: boolean) {
    this.setParams({ is_visible: val });
  }

  private checkVersion(): boolean {
    return this.kernel.warnIfUnsupported('6.10', 'SettingsButton');
  }

  private buttonParams() {
    return { is_visible: this._isVisible };
  }

  private updateButton(): void {
    const params = this.buttonParams();
    const state = JSON.stringify(params);
    if (this.curButtonState === state) {
      return;
    }
    this.curButtonState = state;
    this.kernel.webView.postEvent('web_app_setup_settings_button', undefined, params);
  }

  setParams(params: { is_visible?: boolean }): this {
    if (!this.checkVersion()) {
      return this;
    }
    if (typeof params.is_visible !== 'undefined') {
      this._isVisible = !!params.is_visible;
    }
    this.updateButton();
    return this;
  }

  onClick(callback: VoidCallback): this {
    if (this.checkVersion()) {
      this.kernel.onWebViewEvent('settingsButtonClicked', callback);
    }
    return this;
  }

  offClick(callback: VoidCallback): this {
    if (this.checkVersion()) {
      this.kernel.offWebViewEvent('settingsButtonClicked', callback);
    }
    return this;
  }

  show(): this {
    return this.setParams({ is_visible: true });
  }

  hide(): this {
    return this.setParams({ is_visible: false });
  }
}
