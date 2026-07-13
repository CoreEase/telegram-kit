import { WebAppKernel } from '../core/kernel';
import { MotionSensorBase } from './motion-sensor-base';
import type { DeviceOrientationStartParams } from '../types';

interface DeviceOrientationValues {
  absolute: boolean;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}

export class DeviceOrientation extends MotionSensorBase<DeviceOrientationValues> {
  constructor(kernel: WebAppKernel) {
    super(
      kernel,
      {
        started: 'device_orientation_started',
        stopped: 'device_orientation_stopped',
        changed: 'device_orientation_changed',
        failed: 'device_orientation_failed',
        webViewStarted: 'deviceOrientationStarted',
        webViewStopped: 'deviceOrientationStopped',
        webViewChanged: 'deviceOrientationChanged',
        webViewFailed: 'deviceOrientationFailed',
        startCommand: 'web_app_start_device_orientation',
        stopCommand: 'web_app_stop_device_orientation',
        minVersion: '8.0',
        displayName: 'DeviceOrientation',
      },
      { absolute: false, alpha: null, beta: null, gamma: null }
    );
  }

  protected mapChangedPayload(eventData: any): DeviceOrientationValues {
    return {
      absolute: !!eventData.absolute,
      alpha: eventData.alpha,
      beta: eventData.beta,
      gamma: eventData.gamma,
    };
  }

  get absolute(): boolean {
    return this.values.absolute;
  }
  get alpha(): number | null {
    return this.values.alpha;
  }
  get beta(): number | null {
    return this.values.beta;
  }
  get gamma(): number | null {
    return this.values.gamma;
  }

  start(params: DeviceOrientationStartParams = {}, callback?: (success: boolean) => void): this {
    if (!this.checkVersion()) return this;
    const reqParams = this.buildStartParams(params.refresh_rate) as Record<string, any>;
    reqParams.need_absolute = !!params.need_absolute;
    this.doStart(reqParams, callback);
    return this;
  }
}
