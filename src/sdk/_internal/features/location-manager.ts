/**
 * `Telegram.WebApp.LocationManager`.
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { LocationData } from '../types';

type InitCallback = () => void;
type GetLocationCallback = (data: LocationData | null) => void;

export class LocationManager {
  private _isInited = false;
  private _isLocationAvailable = false;
  private _isAccessRequested = false;
  private _isAccessGranted = false;

  private initCallbacks: InitCallback[] = [];
  private getRequestCallbacks: GetLocationCallback[] = [];

  constructor(private readonly kernel: WebAppKernel) {
    kernel.webView.onEvent('location_checked', this.handleLocationChecked);
    kernel.webView.onEvent('location_requested', this.handleLocationRequested);
  }

  get isInited(): boolean {
    return this._isInited;
  }
  get isLocationAvailable(): boolean {
    return this._isInited && this._isLocationAvailable;
  }
  get isAccessRequested(): boolean {
    return this._isAccessRequested;
  }
  get isAccessGranted(): boolean {
    return this._isAccessRequested && this._isAccessGranted;
  }

  private handleLocationChecked = (_eventType: string, eventData: any): void => {
    this._isInited = true;
    if (eventData.available) {
      this._isLocationAvailable = true;
      if (eventData.access_requested) {
        this._isAccessRequested = true;
        this._isAccessGranted = !!eventData.access_granted;
      } else {
        this._isAccessRequested = false;
        this._isAccessGranted = false;
      }
    } else {
      this._isLocationAvailable = false;
      this._isAccessRequested = false;
      this._isAccessGranted = false;
    }

    if (this.initCallbacks.length > 0) {
      this.initCallbacks.forEach((cb) => cb());
      this.initCallbacks = [];
    }
    this.kernel.receiveWebViewEvent('locationManagerUpdated');
  };

  private handleLocationRequested = (_eventType: string, eventData: any): void => {
    let locationData: LocationData | null = null;
    if (eventData.available) {
      locationData = {
        latitude: eventData.latitude,
        longitude: eventData.longitude,
        altitude: null,
        course: null,
        speed: null,
        horizontal_accuracy: null,
        vertical_accuracy: null,
        course_accuracy: null,
        speed_accuracy: null,
      };
      if (typeof eventData.altitude !== 'undefined' && eventData.altitude !== null) {
        locationData.altitude = eventData.altitude;
      }
      if (typeof eventData.course !== 'undefined' && eventData.course !== null) {
        locationData.course = eventData.course % 360;
      }
      if (typeof eventData.speed !== 'undefined' && eventData.speed !== null) {
        locationData.speed = eventData.speed;
      }
      if (typeof eventData.horizontal_accuracy !== 'undefined' && eventData.horizontal_accuracy !== null) {
        locationData.horizontal_accuracy = eventData.horizontal_accuracy;
      }
      if (typeof eventData.vertical_accuracy !== 'undefined' && eventData.vertical_accuracy !== null) {
        locationData.vertical_accuracy = eventData.vertical_accuracy;
      }
      if (typeof eventData.course_accuracy !== 'undefined' && eventData.course_accuracy !== null) {
        locationData.course_accuracy = eventData.course_accuracy;
      }
      if (typeof eventData.speed_accuracy !== 'undefined' && eventData.speed_accuracy !== null) {
        locationData.speed_accuracy = eventData.speed_accuracy;
      }
    }

    if (!eventData.available || !this._isLocationAvailable || !this._isAccessRequested || !this._isAccessGranted) {
      this.initCallbacks.push(() => this.locationResponse(locationData));
      this.kernel.webView.postEvent('web_app_check_location');
    } else {
      this.locationResponse(locationData);
    }
  };

  private locationResponse(response: LocationData | null): void {
    if (this.getRequestCallbacks.length > 0) {
      this.getRequestCallbacks.forEach((cb) => cb(response));
      this.getRequestCallbacks = [];
    }
    if (response !== null) {
      this.kernel.receiveWebViewEvent('locationRequested', { locationData: response });
    }
  }

  private checkVersion(): boolean {
    return this.kernel.warnIfUnsupported('8.0', 'LocationManager');
  }

  private checkInit(): true {
    if (!this._isInited) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] LocationManager should be inited before using.');
      throwWebAppError(WebAppErrorName.LocationManagerNotInited);
    }
    return true;
  }

  init(callback?: InitCallback): this {
    if (!this.checkVersion()) return this;
    if (this._isInited) return this;
    if (callback) this.initCallbacks.push(callback);
    this.kernel.webView.postEvent('web_app_check_location');
    return this;
  }

  getLocation(callback: GetLocationCallback): this {
    if (!this.checkVersion()) return this;
    this.checkInit();
    if (!this._isLocationAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Location is not available on this device.');
      throwWebAppError(WebAppErrorName.LocationManagerLocationNotAvailable);
    }
    this.getRequestCallbacks.push(callback);
    this.kernel.webView.postEvent('web_app_request_location');
    return this;
  }

  openSettings(): this {
    if (!this.checkVersion()) return this;
    this.checkInit();
    if (!this._isLocationAvailable) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Location is not available on this device.');
      throwWebAppError(WebAppErrorName.LocationManagerLocationNotAvailable);
    }
    if (!this._isAccessRequested) {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Location access was not requested yet.');
      throwWebAppError(WebAppErrorName.LocationManagerLocationAccessNotRequested);
    }
    if (this._isAccessGranted) {
      // eslint-disable-next-line no-console
      console.warn('[@core-ease/telegram-kit] Location access was granted by the user, no need to go to settings.');
      return this;
    }
    this.kernel.webView.postEvent('web_app_open_location_settings');
    return this;
  }
}
