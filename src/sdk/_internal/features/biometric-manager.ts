/**
 * `Telegram.WebApp.BiometricManager`.
 */

import { WebAppKernel } from '../core/kernel';
import { strTrim } from '../core/utils';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { BiometricAuthenticateParams, BiometricRequestAccessParams, BiometricType } from '../types';

type InitCallback = () => void;
type AccessCallback = (granted: boolean) => void;
type AuthCallback = (authenticated: boolean, token: string | null) => void;
type TokenCallback = (applied: boolean) => void;

export class BiometricManager {
  private _isInited = false;
  private _isBiometricAvailable = false;
  private _biometricType: BiometricType = 'unknown';
  private _isAccessRequested = false;
  private _isAccessGranted = false;
  private _isBiometricTokenSaved = false;
  private _deviceId = '';

  private initCallbacks: InitCallback[] = [];
  private accessRequestState: { callback?: AccessCallback } | false = false;
  private authRequestState: { callback?: AuthCallback } | false = false;
  private tokenRequestState: { callback?: TokenCallback } | false = false;

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('biometry_info_received', this.handleInfoReceived);
    kernel.webView.onEvent('biometry_auth_requested', this.handleAuthRequested);
    kernel.webView.onEvent('biometry_token_updated', this.handleTokenUpdated);
  }

  get isInited(): boolean {
    return this._isInited;
  }
  get isBiometricAvailable(): boolean {
    return this._isInited && this._isBiometricAvailable;
  }
  get biometricType(): BiometricType {
    return this._biometricType || 'unknown';
  }
  get isAccessRequested(): boolean {
    return this._isAccessRequested;
  }
  get isAccessGranted(): boolean {
    return this._isAccessRequested && this._isAccessGranted;
  }
  get isBiometricTokenSaved(): boolean {
    return this._isBiometricTokenSaved;
  }
  get deviceId(): string {
    return this._deviceId || '';
  }

  private handleInfoReceived = (_eventType: string, eventData: any): void => {
    this._isInited = true;
    if (eventData.available) {
      this._isBiometricAvailable = true;
      this._biometricType = eventData.type || 'unknown';
      if (eventData.access_requested) {
        this._isAccessRequested = true;
        this._isAccessGranted = !!eventData.access_granted;
        this._isBiometricTokenSaved = !!eventData.token_saved;
      } else {
        this._isAccessRequested = false;
        this._isAccessGranted = false;
        this._isBiometricTokenSaved = false;
      }
    } else {
      this._isBiometricAvailable = false;
      this._biometricType = 'unknown';
      this._isAccessRequested = false;
      this._isAccessGranted = false;
      this._isBiometricTokenSaved = false;
    }
    this._deviceId = eventData.device_id || '';

    if (this.initCallbacks.length > 0) {
      this.initCallbacks.forEach((cb) => cb());
      this.initCallbacks = [];
    }
    if (this.accessRequestState) {
      const state = this.accessRequestState;
      this.accessRequestState = false;
      state.callback?.(this._isAccessGranted);
    }
    this.kernel.receiveWebViewEvent('biometricManagerUpdated');
  };

  private handleAuthRequested = (_eventType: string, eventData: any): void => {
    const isAuthenticated = eventData.status == 'authorized';
    const biometricToken = eventData.token || '';
    if (this.authRequestState) {
      const state = this.authRequestState;
      this.authRequestState = false;
      state.callback?.(isAuthenticated, isAuthenticated ? biometricToken : null);
    }
    this.kernel.receiveWebViewEvent(
      'biometricAuthRequested',
      isAuthenticated ? { isAuthenticated: true, biometricToken } : { isAuthenticated: false }
    );
  };

  private handleTokenUpdated = (_eventType: string, eventData: any): void => {
    let applied = false;
    if (this._isBiometricAvailable && this._isAccessRequested) {
      if (eventData.status == 'updated') {
        this._isBiometricTokenSaved = true;
        applied = true;
      } else if (eventData.status == 'removed') {
        this._isBiometricTokenSaved = false;
        applied = true;
      }
    }
    if (this.tokenRequestState) {
      const state = this.tokenRequestState;
      this.tokenRequestState = false;
      state.callback?.(applied);
    }
    this.kernel.receiveWebViewEvent('biometricTokenUpdated', { isUpdated: applied });
  };

  private checkVersion(): boolean {
    return this.kernel.warnIfUnsupported('7.2', 'BiometricManager');
  }

  private checkInit(): true {
    if (!this._isInited) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] BiometricManager should be inited before using.');
      throwWebAppError(WebAppErrorName.BiometricManagerNotInited);
    }
    return true;
  }

  init(callback?: InitCallback): this {
    if (!this.checkVersion()) return this;
    if (this._isInited) return this;
    if (callback) this.initCallbacks.push(callback);
    this.kernel.webView.postEvent('web_app_biometry_get_info');
    return this;
  }

  requestAccess(params: BiometricRequestAccessParams, callback?: AccessCallback): this {
    if (!this.checkVersion()) return this;
    this.checkInit();
    if (!this._isBiometricAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometrics is not available on this device.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricsNotAvailable);
    }
    if (this.accessRequestState) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Access is already requested');
      throwWebAppError(WebAppErrorName.BiometricManagerAccessRequested);
    }
    const popupParams: { reason?: string } = {};
    if (typeof params.reason !== 'undefined') {
      const reason = strTrim(params.reason);
      if (reason.length > 128) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Biometric reason is too long', reason);
        throwWebAppError(WebAppErrorName.BiometricRequestAccessParamInvalid);
      }
      if (reason.length > 0) popupParams.reason = reason;
    }
    this.accessRequestState = { callback };
    this.kernel.webView.postEvent('web_app_biometry_request_access', undefined, popupParams);
    return this;
  }

  authenticate(params: BiometricAuthenticateParams, callback?: AuthCallback): this {
    if (!this.checkVersion()) return this;
    this.checkInit();
    if (!this._isBiometricAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometrics is not available on this device.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricsNotAvailable);
    }
    if (!this.isAccessGranted) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometric access was not granted by the user.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricAccessNotGranted);
    }
    if (this.authRequestState) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Authentication request is already in progress.');
      throwWebAppError(WebAppErrorName.BiometricManagerAuthenticationRequested);
    }
    const popupParams: { reason?: string } = {};
    if (typeof params.reason !== 'undefined') {
      const reason = strTrim(params.reason);
      if (reason.length > 128) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Biometric reason is too long', reason);
        throwWebAppError(WebAppErrorName.BiometricRequestAccessParamInvalid);
      }
      if (reason.length > 0) popupParams.reason = reason;
    }
    this.authRequestState = { callback };
    this.kernel.webView.postEvent('web_app_biometry_request_auth', undefined, popupParams);
    return this;
  }

  updateBiometricToken(token: string, callback?: TokenCallback): this {
    if (!this.checkVersion()) return this;
    token = token || '';
    if (token.length > 1024) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Token is too long', token);
      throwWebAppError(WebAppErrorName.BiometricManagerTokenInvalid);
    }
    this.checkInit();
    if (!this._isBiometricAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometrics is not available on this device.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricsNotAvailable);
    }
    if (!this.isAccessGranted) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometric access was not granted by the user.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricAccessNotGranted);
    }
    if (this.tokenRequestState) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Token request is already in progress.');
      throwWebAppError(WebAppErrorName.BiometricManagerTokenUpdateRequested);
    }
    this.tokenRequestState = { callback };
    this.kernel.webView.postEvent('web_app_biometry_update_token', undefined, { token });
    return this;
  }

  openSettings(): this {
    if (!this.checkVersion()) return this;
    this.checkInit();
    if (!this._isBiometricAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometrics is not available on this device.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricsNotAvailable);
    }
    if (!this._isAccessRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Biometric access was not requested yet.');
      throwWebAppError(WebAppErrorName.BiometricManagerBiometricsAccessNotRequested);
    }
    if (this._isAccessGranted) {
      // eslint-disable-next-line no-console
      console.warn('[@core-ease/telegram-kit] Biometric access was granted by the user, no need to go to settings.');
      return this;
    }
    this.kernel.webView.postEvent('web_app_biometry_open_settings');
    return this;
  }
}
