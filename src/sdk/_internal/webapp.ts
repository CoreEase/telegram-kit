/**
 * `Telegram.WebApp` - the public-facing composition root.
 *
 * This class owns no protocol logic itself; it wires the kernel + every
 * feature module together (dependency injection) and re-exposes their
 * public surface under the exact same property/method names as the
 * original monolithic script, so existing integrations keep working
 * unchanged (just typed, and testable module-by-module now).
 *
 * Adding a new feature later means: write a small class in `features/`,
 * `sensors/`, `ui/` or `theme/` that takes a `WebAppKernel`, then
 * instantiate + expose it here. No other module needs to change.
 */

import { TelegramWebView, Utils } from './core/webview';
import { WebAppKernel } from './core/kernel';
import { byteLength, urlParseQueryString } from './core/utils';
import { WebAppErrorName, throwWebAppError } from './core/errors';

import { ThemeManager } from './theme/theme-manager';
import { ViewportManager } from './theme/viewport-manager';

import { BackButton } from './ui/back-button';
import { BottomButton } from './ui/bottom-button';
import { SettingsButton } from './ui/settings-button';
import { DebugBottomBar } from './ui/debug-bottom-bar';
import { PopupManager } from './ui/popup';
import { ScanQrManager } from './ui/scan-qr';

import { HapticFeedback } from './features/haptic-feedback';
import { CloudStorage } from './features/cloud-storage';
import { DeviceStorage } from './features/device-storage';
import { SecureStorage } from './features/secure-storage';
import { BiometricManager } from './features/biometric-manager';
import { LocationManager } from './features/location-manager';
import { InvoiceManager } from './features/invoice';
import { ClipboardManager } from './features/clipboard';
import { ContactManager } from './features/contact';
import { HomeScreenManager } from './features/home-screen';
import { DownloadFileManager } from './features/download-file';
import { SharingManager } from './features/sharing';
import { EmojiStatusManager } from './features/emoji-status';
import { LinkManager } from './features/links';

import { Accelerometer } from './sensors/accelerometer';
import { Gyroscope } from './sensors/gyroscope';
import { DeviceOrientation } from './sensors/device-orientation';

import type {
  CloseOptions,
  ColorScheme,
  DownloadFileParams,
  HomeScreenStatus,
  OpenLinkOptions,
  OpenTelegramLinkOptions,
  PopupParams,
  SafeAreaInset,
  ScanQrPopupParams,
  ShareToStoryParams,
  ThemeParams,
  WebAppInitDataUnsafe,
} from './types';

export class WebApp {
  private readonly kernel: WebAppKernel;

  private webAppInitData = '';
  private webAppInitDataUnsafe: WebAppInitDataUnsafe = {};
  private webAppPlatform = 'unknown';
  private webAppIsActive = true;

  private readonly theme: ThemeManager;
  private readonly viewport: ViewportManager;
  private readonly debugBar: DebugBottomBar;

  readonly BackButton: BackButton;
  readonly MainButton: BottomButton;
  readonly SecondaryButton: BottomButton;
  readonly SettingsButton: SettingsButton;
  readonly HapticFeedback: HapticFeedback;
  readonly CloudStorage: CloudStorage;
  readonly DeviceStorage: DeviceStorage;
  readonly SecureStorage: SecureStorage;
  readonly BiometricManager: BiometricManager;
  readonly LocationManager: LocationManager;
  readonly Accelerometer: Accelerometer;
  readonly DeviceOrientation: DeviceOrientation;
  readonly Gyroscope: Gyroscope;

  private readonly popups: PopupManager;
  private readonly scanQr: ScanQrManager;
  private readonly invoices: InvoiceManager;
  private readonly clipboard: ClipboardManager;
  private readonly contact: ContactManager;
  private readonly homeScreen: HomeScreenManager;
  private readonly downloadFileManager: DownloadFileManager;
  private readonly sharing: SharingManager;
  private readonly emojiStatus: EmojiStatusManager;
  private readonly links: LinkManager;

  constructor(readonly webView: TelegramWebView) {
    const kernel = new WebAppKernel(webView);
    this.kernel = kernel;
    const initParams = webView.initParams;

    // -- initData / initDataUnsafe -------------------------------------
    if (initParams.tgWebAppData && initParams.tgWebAppData.length) {
      this.webAppInitData = initParams.tgWebAppData;
      const parsed = urlParseQueryString(this.webAppInitData) as WebAppInitDataUnsafe;
      for (const key in parsed) {
        const val = (parsed as any)[key];
        try {
          if ((val?.substr(0, 1) == '{' && val?.substr(-1) == '}') || (val?.substr(0, 1) == '[' && val?.substr(-1) == ']')) {
            (parsed as any)[key] = JSON.parse(val);
          }
        } catch (e) {
          // leave raw string on parse failure
        }
      }
      this.webAppInitDataUnsafe = parsed;
    }

    if (initParams.tgWebAppPlatform) {
      this.webAppPlatform = initParams.tgWebAppPlatform;
    }

    // -- Theme / viewport ------------------------------------------------
    this.theme = new ThemeManager(kernel);
    this.viewport = new ViewportManager(kernel);
    this.debugBar = new DebugBottomBar(kernel, () => this.theme.getBottomBarColor());

    // -- UI --------------------------------------------------------------
    this.BackButton = new BackButton(kernel);
    this.MainButton = new BottomButton('main', kernel, this.theme, this.debugBar);
    this.SecondaryButton = new BottomButton('secondary', kernel, this.theme, this.debugBar);
    this.SettingsButton = new SettingsButton(kernel);
    this.popups = new PopupManager(kernel);
    this.scanQr = new ScanQrManager(kernel);

    // -- Features ----------------------------------------------------------
    this.HapticFeedback = new HapticFeedback(kernel);
    this.CloudStorage = new CloudStorage(kernel);
    this.DeviceStorage = new DeviceStorage(kernel);
    this.SecureStorage = new SecureStorage(kernel);
    this.BiometricManager = new BiometricManager(kernel);
    this.LocationManager = new LocationManager(kernel);
    this.invoices = new InvoiceManager(kernel);
    this.clipboard = new ClipboardManager(kernel);
    this.contact = new ContactManager(kernel);
    this.homeScreen = new HomeScreenManager(kernel);
    this.downloadFileManager = new DownloadFileManager(kernel);
    this.sharing = new SharingManager(kernel);
    this.emojiStatus = new EmojiStatusManager(kernel);
    this.links = new LinkManager(kernel);

    // -- Sensors -----------------------------------------------------------
    this.Accelerometer = new Accelerometer(kernel);
    this.DeviceOrientation = new DeviceOrientation(kernel);
    this.Gyroscope = new Gyroscope(kernel);

    // -- Cross-module wiring (mirrors the interleaved calls in the
    //    original single closure) -----------------------------------------
    this.debugBar.onHeightChanged = () => this.viewport.setViewportHeight();
    this.theme.onBottomBarColorApplied = () => {
      this.debugBar.refreshColor();
      this.SecondaryButton.setParams({});
    };

    kernel.webView.onEvent('theme_changed', this.handleThemeChanged);
    kernel.webView.onEvent('viewport_changed', this.viewport.handleViewportChanged);
    kernel.webView.onEvent('safe_area_changed', this.viewport.handleSafeAreaChanged);
    kernel.webView.onEvent('content_safe_area_changed', this.viewport.handleContentSafeAreaChanged);
    kernel.webView.onEvent('visibility_changed', this.handleVisibilityChanged);
    kernel.webView.onEvent('fullscreen_changed', this.viewport.handleFullscreenChanged);
    kernel.webView.onEvent('fullscreen_failed', this.viewport.handleFullscreenFailed);
    kernel.webView.onEvent('custom_method_invoked', kernel.onCustomMethodInvoked);

    window.addEventListener('resize', this.viewport.onWindowResize);
    if (webView.isIframe) {
      document.addEventListener('click', this.links.handleDocumentClick);
    }

    // -- Initial sync with native client -----------------------------------
    this.theme.updateHeaderColor();
    this.theme.updateBackgroundColor();
    this.theme.updateBottomBarColor();
    this.viewport.setViewportHeight();
    if (initParams.tgWebAppShowSettings) {
      this.SettingsButton.show();
    }

    kernel.webView.postEvent('web_app_request_theme');
    kernel.webView.postEvent('web_app_request_viewport');
    kernel.webView.postEvent('web_app_request_safe_area');
    kernel.webView.postEvent('web_app_request_content_safe_area');
  }

  private handleThemeChanged = (_eventType: string, eventData: any): void => {
    if (eventData.theme_params) {
      this.theme.setThemeParams(eventData.theme_params);
      this.MainButton.setParams({});
      this.SecondaryButton.setParams({});
      this.theme.updateHeaderColor();
      this.theme.updateBackgroundColor();
      this.theme.updateBottomBarColor();
      this.kernel.receiveWebViewEvent('themeChanged');
    }
  };

  private handleVisibilityChanged = (_eventType: string, eventData: any): void => {
    if (eventData.is_visible) {
      this.webAppIsActive = true;
      this.kernel.receiveWebViewEvent('activated');
    } else {
      this.webAppIsActive = false;
      this.kernel.receiveWebViewEvent('deactivated');
    }
  };

  // -----------------------------------------------------------------------
  // Public read-only properties
  // -----------------------------------------------------------------------

  get initData(): string {
    return this.webAppInitData;
  }
  get initDataUnsafe(): WebAppInitDataUnsafe {
    return this.webAppInitDataUnsafe;
  }
  get version(): string {
    return this.kernel.version;
  }
  get platform(): string {
    return this.webAppPlatform;
  }
  get colorScheme(): ColorScheme {
    return this.theme.colorScheme;
  }
  get themeParams(): ThemeParams {
    return this.theme.getThemeParams();
  }
  get isExpanded(): boolean {
    return this.viewport.isExpanded;
  }
  get viewportHeight(): number {
    return this.viewport.viewportHeight;
  }
  get viewportStableHeight(): number {
    return this.viewport.viewportStableHeight;
  }
  get safeAreaInset(): SafeAreaInset {
    return this.viewport.safeAreaInset;
  }
  get contentSafeAreaInset(): SafeAreaInset {
    return this.viewport.contentSafeAreaInset;
  }
  get isFullscreen(): boolean {
    return this.viewport.isFullscreen;
  }
  get isActive(): boolean {
    return this.webAppIsActive;
  }

  get isClosingConfirmationEnabled(): boolean {
    return this.viewport.isClosingConfirmationEnabled;
  }
  set isClosingConfirmationEnabled(val: boolean) {
    this.viewport.setClosingConfirmation(val);
  }

  get isVerticalSwipesEnabled(): boolean {
    return this.viewport.isVerticalSwipesEnabled;
  }
  set isVerticalSwipesEnabled(val: boolean) {
    this.viewport.toggleVerticalSwipes(val);
  }

  get isOrientationLocked(): boolean {
    return this.viewport.isOrientationLocked;
  }
  set isOrientationLocked(val: boolean) {
    this.viewport.toggleOrientationLock(val);
  }

  get headerColor(): string | null | undefined {
    return this.theme.getHeaderColor();
  }
  set headerColor(val: string) {
    this.theme.setHeaderColor(val);
  }

  get backgroundColor(): string | undefined {
    return this.theme.getBackgroundColor();
  }
  set backgroundColor(val: string) {
    this.theme.setBackgroundColor(val);
  }

  get bottomBarColor(): string {
    return this.theme.getBottomBarColor();
  }
  set bottomBarColor(val: string) {
    this.theme.setBottomBarColor(val);
  }

  // -----------------------------------------------------------------------
  // Methods
  // -----------------------------------------------------------------------

  isVersionAtLeast(ver: string): boolean {
    return this.kernel.versionAtLeast(ver);
  }

  setHeaderColor(colorKey: string): void {
    this.headerColor = colorKey;
  }
  setBackgroundColor(color: string): void {
    this.backgroundColor = color;
  }
  setBottomBarColor(color: string): void {
    this.bottomBarColor = color;
  }
  enableClosingConfirmation(): void {
    this.isClosingConfirmationEnabled = true;
  }
  disableClosingConfirmation(): void {
    this.isClosingConfirmationEnabled = false;
  }
  enableVerticalSwipes(): void {
    this.isVerticalSwipesEnabled = true;
  }
  disableVerticalSwipes(): void {
    this.isVerticalSwipesEnabled = false;
  }
  lockOrientation(): void {
    this.isOrientationLocked = true;
  }
  unlockOrientation(): void {
    this.isOrientationLocked = false;
  }
  requestFullscreen(): void {
    this.viewport.requestFullscreen();
  }
  exitFullscreen(): void {
    this.viewport.exitFullscreen();
  }

  addToHomeScreen(): void {
    this.homeScreen.addToHomeScreen();
  }
  checkHomeScreenStatus(callback?: (status: HomeScreenStatus) => void): void {
    this.homeScreen.checkHomeScreenStatus(callback);
  }

  onEvent(eventType: string, callback: (...args: any[]) => void): void {
    this.kernel.onWebViewEvent(eventType, callback);
  }
  offEvent(eventType: string, callback: (...args: any[]) => void): void {
    this.kernel.offWebViewEvent(eventType, callback);
  }

  sendData(data: string): void {
    if (!data || !data.length) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Data is required', data);
      throwWebAppError(WebAppErrorName.DataInvalid);
    }
    if (byteLength(data) > 4096) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Data is too long', data);
      throwWebAppError(WebAppErrorName.DataInvalid);
    }
    this.kernel.webView.postEvent('web_app_data_send', undefined, { data });
  }

  switchInlineQuery(query: string, chooseChatTypes?: string[]): void {
    this.sharing.switchInlineQuery(query, chooseChatTypes, this.kernel.initParams);
  }

  openLink(url: string, options?: OpenLinkOptions): void {
    this.links.openLink(url, options);
  }
  openTelegramLink(url: string, options?: OpenTelegramLinkOptions): void {
    this.links.openTelegramLink(url, options);
  }

  openInvoice(url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void {
    this.invoices.openInvoice(url, callback);
  }

  showPopup(params: PopupParams, callback?: (buttonId: string | null) => void): void {
    this.popups.showPopup(params, callback);
  }
  showAlert(message: string, callback?: () => void): void {
    this.popups.showAlert(message, callback);
  }
  showConfirm(message: string, callback?: (ok: boolean) => void): void {
    this.popups.showConfirm(message, callback);
  }

  showScanQrPopup(params: ScanQrPopupParams, callback?: (data: string | null) => boolean | void): void {
    this.scanQr.showScanQrPopup(params, callback);
  }
  closeScanQrPopup(): void {
    this.scanQr.closeScanQrPopup();
  }

  readTextFromClipboard(callback?: (data: string | null) => void): void {
    this.clipboard.readTextFromClipboard(callback);
  }

  requestWriteAccess(callback?: (granted: boolean) => void): void {
    this.contact.requestWriteAccess(callback);
  }
  requestContact(callback?: (sent: boolean, eventPayload: Record<string, any>) => void): void {
    this.contact.requestContact(callback);
  }

  downloadFile(params: DownloadFileParams, callback?: (isDownloading: boolean) => void): void {
    this.downloadFileManager.downloadFile(params, callback);
  }

  shareToStory(mediaUrl: string, params?: ShareToStoryParams): void {
    this.sharing.shareToStory(mediaUrl, params);
  }
  shareMessage(msgId: string, callback?: (sent: boolean) => void): void {
    this.sharing.shareMessage(msgId, callback);
  }
  requestChat(reqId: string, callback?: (sent: boolean) => void): void {
    this.sharing.requestChat(reqId, callback);
  }

  setEmojiStatus(customEmojiId: string, params?: { duration?: number }, callback?: (applied: boolean) => void): void {
    this.emojiStatus.setEmojiStatus(customEmojiId, params, callback);
  }
  requestEmojiStatusAccess(callback?: (granted: boolean) => void): void {
    this.emojiStatus.requestEmojiStatusAccess(callback);
  }

  invokeCustomMethod(method: string, params?: Record<string, any>, callback?: (err: any, res: any) => void): void {
    this.kernel.invokeCustomMethod(method, params, callback);
  }

  hideKeyboard(): void {
    this.kernel.webView.postEvent('web_app_hide_keyboard');
  }
  ready(): void {
    this.kernel.webView.postEvent('web_app_ready');
  }
  expand(): void {
    this.kernel.webView.postEvent('web_app_expand');
  }
  close(options: CloseOptions = {}): void {
    const reqParams: { return_back?: boolean } = {};
    if (this.kernel.versionAtLeast('7.6') && options.return_back) {
      reqParams.return_back = true;
    }
    this.kernel.webView.postEvent('web_app_close', undefined, reqParams);
  }
}

export { Utils };
