/**
 * Viewport & window-chrome manager.
 *
 * Covers everything related to the app's visible area and window behavior:
 * viewport height/expansion, safe-area insets, fullscreen state,
 * orientation lock, the closing confirmation dialog and vertical swipe
 * toggling. All of it was interleaved with theme code in the original
 * single closure; split out here since it is a clearly separate concern.
 */

import { WebAppKernel } from '../core/kernel';
import { sessionStorageGet, sessionStorageSet } from '../core/utils';
import type { SafeAreaInset } from '../types';

export class ViewportManager {
  private viewportHeightPx: number | false = false;
  private viewportStableHeightPx: number | false = false;
  private _isExpanded = true;

  private _safeAreaInset: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };
  private _contentSafeAreaInset: SafeAreaInset = { top: 0, bottom: 0, left: 0, right: 0 };

  private _isFullscreen = false;
  private _isOrientationLocked = false;
  private _isClosingConfirmationEnabled = false;
  private _isVerticalSwipesEnabled = true;

  private lastWindowHeight = typeof window !== 'undefined' ? window.innerHeight : 0;

  constructor(private readonly kernel: WebAppKernel) {
    if (kernel.initParams.tgWebAppFullscreen) {
      this.setFullscreen(true);
    }
    const storedFullscreen = sessionStorageGet<string>('isFullscreen');
    if (storedFullscreen) {
      this.setFullscreen(storedFullscreen == 'yes');
    }

    const storedOrientationLock = sessionStorageGet<string>('isOrientationLocked');
    if (storedOrientationLock) {
      this.setOrientationLock(storedOrientationLock == 'yes');
    }

    this.onWindowResize = this.onWindowResize.bind(this);
  }

  // ---------------------------------------------------------------------
  // Getters mirroring the public WebApp properties
  // ---------------------------------------------------------------------

  get isExpanded(): boolean {
    return this._isExpanded;
  }

  get viewportHeight(): number {
    const raw = this.viewportHeightPx === false ? window.innerHeight : this.viewportHeightPx;
    return raw - this.kernel.bottomBarHeightPx;
  }

  get viewportStableHeight(): number {
    const raw = this.viewportStableHeightPx === false ? window.innerHeight : this.viewportStableHeightPx;
    return raw - this.kernel.bottomBarHeightPx;
  }

  get safeAreaInset(): SafeAreaInset {
    return this._safeAreaInset;
  }

  get contentSafeAreaInset(): SafeAreaInset {
    return this._contentSafeAreaInset;
  }

  get isFullscreen(): boolean {
    return this._isFullscreen;
  }

  get isOrientationLocked(): boolean {
    return this._isOrientationLocked;
  }

  get isClosingConfirmationEnabled(): boolean {
    return this._isClosingConfirmationEnabled;
  }

  get isVerticalSwipesEnabled(): boolean {
    return this._isVerticalSwipesEnabled;
  }

  // ---------------------------------------------------------------------
  // Viewport height
  // ---------------------------------------------------------------------

  /** Re-applies the current viewport CSS vars; call after bottom-bar height changes too. */
  setViewportHeight(data?: { height: number; is_expanded?: boolean; is_state_stable?: boolean }): void {
    let emitEvent = false;
    if (typeof data !== 'undefined') {
      this._isExpanded = !!data.is_expanded;
      this.viewportHeightPx = data.height;
      if (data.is_state_stable) {
        this.viewportStableHeightPx = data.height;
      }
      emitEvent = true;
    }
    const bottomBarHeight = this.kernel.bottomBarHeightPx;
    const height =
      this.viewportHeightPx !== false
        ? this.viewportHeightPx - bottomBarHeight + 'px'
        : bottomBarHeight
        ? `calc(100vh - ${bottomBarHeight}px)`
        : '100vh';
    const stableHeight =
      this.viewportStableHeightPx !== false
        ? this.viewportStableHeightPx - bottomBarHeight + 'px'
        : bottomBarHeight
        ? `calc(100vh - ${bottomBarHeight}px)`
        : '100vh';
    this.kernel.setCssProperty('viewport-height', height);
    this.kernel.setCssProperty('viewport-stable-height', stableHeight);

    if (emitEvent) {
      this.kernel.receiveWebViewEvent('viewportChanged', { isStateStable: !!data!.is_state_stable });
    }
  }

  handleViewportChanged = (_eventType: string, eventData: any): void => {
    if (eventData.height) {
      window.removeEventListener('resize', this.onWindowResize);
      this.setViewportHeight(eventData);
    }
  };

  onWindowResize(): void {
    if (this.lastWindowHeight != window.innerHeight) {
      this.lastWindowHeight = window.innerHeight;
      this.kernel.receiveWebViewEvent('viewportChanged', { isStateStable: true });
    }
  }

  // ---------------------------------------------------------------------
  // Safe area insets
  // ---------------------------------------------------------------------

  setSafeAreaInset(data?: Partial<SafeAreaInset>): void {
    if (typeof data !== 'undefined') {
      if (typeof data.top !== 'undefined') this._safeAreaInset.top = data.top;
      if (typeof data.bottom !== 'undefined') this._safeAreaInset.bottom = data.bottom;
      if (typeof data.left !== 'undefined') this._safeAreaInset.left = data.left;
      if (typeof data.right !== 'undefined') this._safeAreaInset.right = data.right;
      this.kernel.receiveWebViewEvent('safeAreaChanged');
    }
    this.kernel.setCssProperty('safe-area-inset-top', this._safeAreaInset.top + 'px');
    this.kernel.setCssProperty('safe-area-inset-bottom', this._safeAreaInset.bottom + 'px');
    this.kernel.setCssProperty('safe-area-inset-left', this._safeAreaInset.left + 'px');
    this.kernel.setCssProperty('safe-area-inset-right', this._safeAreaInset.right + 'px');
  }

  handleSafeAreaChanged = (_eventType: string, eventData: any): void => {
    if (eventData) this.setSafeAreaInset(eventData);
  };

  setContentSafeAreaInset(data?: Partial<SafeAreaInset>): void {
    if (typeof data !== 'undefined') {
      if (typeof data.top !== 'undefined') this._contentSafeAreaInset.top = data.top;
      if (typeof data.bottom !== 'undefined') this._contentSafeAreaInset.bottom = data.bottom;
      if (typeof data.left !== 'undefined') this._contentSafeAreaInset.left = data.left;
      if (typeof data.right !== 'undefined') this._contentSafeAreaInset.right = data.right;
      this.kernel.receiveWebViewEvent('contentSafeAreaChanged');
    }
    this.kernel.setCssProperty('content-safe-area-inset-top', this._contentSafeAreaInset.top + 'px');
    this.kernel.setCssProperty('content-safe-area-inset-bottom', this._contentSafeAreaInset.bottom + 'px');
    this.kernel.setCssProperty('content-safe-area-inset-left', this._contentSafeAreaInset.left + 'px');
    this.kernel.setCssProperty('content-safe-area-inset-right', this._contentSafeAreaInset.right + 'px');
  }

  handleContentSafeAreaChanged = (_eventType: string, eventData: any): void => {
    if (eventData) this.setContentSafeAreaInset(eventData);
  };

  // ---------------------------------------------------------------------
  // Closing confirmation / vertical swipes
  // ---------------------------------------------------------------------

  setClosingConfirmation(needConfirmation: boolean): void {
    if (!this.kernel.warnIfUnsupported('6.2', 'Closing confirmation')) {
      return;
    }
    this._isClosingConfirmationEnabled = !!needConfirmation;
    this.kernel.webView.postEvent('web_app_setup_closing_behavior', undefined, {
      need_confirmation: this._isClosingConfirmationEnabled,
    });
  }

  toggleVerticalSwipes(enableSwipes: boolean): void {
    if (!this.kernel.warnIfUnsupported('7.7', 'Changing swipes behavior')) {
      return;
    }
    this._isVerticalSwipesEnabled = !!enableSwipes;
    this.kernel.webView.postEvent('web_app_setup_swipe_behavior', undefined, {
      allow_vertical_swipe: this._isVerticalSwipesEnabled,
    });
  }

  // ---------------------------------------------------------------------
  // Fullscreen
  // ---------------------------------------------------------------------

  private setFullscreen(isFullscreen: boolean): void {
    this._isFullscreen = !!isFullscreen;
    sessionStorageSet('isFullscreen', this._isFullscreen ? 'yes' : 'no');
  }

  handleFullscreenChanged = (_eventType: string, eventData: any): void => {
    this.setFullscreen(eventData.is_fullscreen);
    this.kernel.receiveWebViewEvent('fullscreenChanged');
  };

  handleFullscreenFailed = (_eventType: string, eventData: any): void => {
    if (eventData.error == 'ALREADY_FULLSCREEN' && !this._isFullscreen) {
      this.setFullscreen(true);
    }
    this.kernel.receiveWebViewEvent('fullscreenFailed', { error: eventData.error });
  };

  requestFullscreen(): void {
    this.kernel.requireVersion('8.0', 'requestFullscreen');
    this.kernel.webView.postEvent('web_app_request_fullscreen');
  }

  exitFullscreen(): void {
    this.kernel.requireVersion('8.0', 'exitFullscreen');
    this.kernel.webView.postEvent('web_app_exit_fullscreen');
  }

  // ---------------------------------------------------------------------
  // Orientation lock
  // ---------------------------------------------------------------------

  private setOrientationLock(isLocked: boolean): void {
    this._isOrientationLocked = !!isLocked;
    sessionStorageSet('isOrientationLocked', this._isOrientationLocked ? 'yes' : 'no');
  }

  toggleOrientationLock(locked: boolean): void {
    if (!this.kernel.warnIfUnsupported('8.0', 'Orientation locking')) {
      return;
    }
    this.setOrientationLock(locked);
    this.kernel.webView.postEvent('web_app_toggle_orientation_lock', undefined, {
      locked: this._isOrientationLocked,
    });
  }
}
