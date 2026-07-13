/**
 * Shared implementation for the three near-identical motion sensors
 * (`Accelerometer`, `Gyroscope`, `DeviceOrientation`). All three follow the
 * exact same start/stop/changed/failed event protocol in the original SDK,
 * differing only in event names and payload shape - so we factor that
 * protocol out once here and let each sensor supply its own config +
 * payload mapping.
 */

import { WebAppKernel } from '../core/kernel';

export interface MotionSensorEventNames {
  started: string;
  stopped: string;
  changed: string;
  failed: string;
  webViewStarted: string;
  webViewStopped: string;
  webViewChanged: string;
  webViewFailed: string;
  startCommand: string;
  stopCommand: string;
  minVersion: string;
  displayName: string;
}

type StartCallback = (success: boolean) => void;
type StopCallback = (success: boolean) => void;

export abstract class MotionSensorBase<TValues extends Record<string, any>> {
  protected _isStarted = false;
  protected values: TValues;

  private startCallbacks: StartCallback[] = [];
  private stopCallbacks: StopCallback[] = [];

  protected constructor(
    protected readonly kernel: WebAppKernel,
    private readonly names: MotionSensorEventNames,
    initialValues: TValues
  ) {
    this.values = initialValues;
    kernel.webView.onEvent(names.started, this.handleStarted);
    kernel.webView.onEvent(names.stopped, this.handleStopped);
    kernel.webView.onEvent(names.changed, this.handleChanged);
    kernel.webView.onEvent(names.failed, this.handleFailed);
  }

  get isStarted(): boolean {
    return this._isStarted;
  }

  private handleStarted = (): void => {
    this._isStarted = true;
    if (this.startCallbacks.length > 0) {
      this.startCallbacks.forEach((cb) => cb(true));
      this.startCallbacks = [];
    }
    this.kernel.receiveWebViewEvent(this.names.webViewStarted);
  };

  private handleStopped = (): void => {
    this._isStarted = false;
    if (this.stopCallbacks.length > 0) {
      this.stopCallbacks.forEach((cb) => cb(true));
      this.stopCallbacks = [];
    }
    this.kernel.receiveWebViewEvent(this.names.webViewStopped);
  };

  private handleChanged = (_eventType: string, eventData: any): void => {
    this.values = this.mapChangedPayload(eventData);
    this.kernel.receiveWebViewEvent(this.names.webViewChanged);
  };

  private handleFailed = (_eventType: string, eventData: any): void => {
    if (this.startCallbacks.length > 0) {
      this.startCallbacks.forEach((cb) => cb(false));
      this.startCallbacks = [];
    }
    this.kernel.receiveWebViewEvent(this.names.webViewFailed, { error: eventData.error });
  };

  /** Subclasses map the raw `*_changed` event payload onto their typed value shape. */
  protected abstract mapChangedPayload(eventData: any): TValues;

  protected checkVersion(): boolean {
    return this.kernel.warnIfUnsupported(this.names.minVersion, this.names.displayName);
  }

  protected buildStartParams(refreshRate: unknown): { refresh_rate?: number } {
    const params: { refresh_rate?: number } = {};
    const rate = parseInt(String(refreshRate ?? 1000));
    if (isNaN(rate) || rate < 20 || rate > 1000) {
      // eslint-disable-next-line no-console
      console.warn(`[@core-ease/telegram-kit] ${this.names.displayName} refresh_rate is invalid`, rate);
    } else {
      params.refresh_rate = rate;
    }
    return params;
  }

  protected doStart(reqParams: Record<string, any>, callback?: StartCallback): void {
    if (callback) this.startCallbacks.push(callback);
    this.kernel.webView.postEvent(this.names.startCommand, undefined, reqParams);
  }

  stop(callback?: StopCallback): this {
    if (!this.checkVersion()) return this;
    if (callback) this.stopCallbacks.push(callback);
    this.kernel.webView.postEvent(this.names.stopCommand);
    return this;
  }
}
