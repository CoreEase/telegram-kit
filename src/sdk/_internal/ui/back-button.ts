/**
 * `Telegram.WebApp.BackButton` - port of the `BackButton` IIFE.
 */

import { WebAppKernel } from '../core/kernel';
import type { VoidCallback } from '../types';

export class BackButton {
  private _isVisible = false;
  private curButtonState: string | null = null;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('back_button_pressed', this.handleBackButtonPressed);
  }

  private handleBackButtonPressed = (): void => {
    this.kernel.receiveWebViewEvent('backButtonClicked');
  };

  get isVisible(): boolean {
    return this._isVisible;
  }

  set isVisible(val: boolean) {
    this.setParams({ is_visible: val });
  }

  private checkVersion(): boolean {
    return this.kernel.warnIfUnsupported('6.1', 'BackButton');
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
    this.kernel.webView.postEvent('web_app_setup_back_button', undefined, params);
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
      this.kernel.onWebViewEvent('backButtonClicked', callback);
    }
    return this;
  }

  offClick(callback: VoidCallback): this {
    if (this.checkVersion()) {
      this.kernel.offWebViewEvent('backButtonClicked', callback);
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
