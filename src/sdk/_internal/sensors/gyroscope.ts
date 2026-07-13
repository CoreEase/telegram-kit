import { WebAppKernel } from '../core/kernel';
import { MotionSensorBase } from './motion-sensor-base';
import type { MotionSensorStartParams } from '../types';

interface GyroscopeValues {
  x: number | null;
  y: number | null;
  z: number | null;
}

export class Gyroscope extends MotionSensorBase<GyroscopeValues> {
  constructor(kernel: WebAppKernel) {
    super(
      kernel,
      {
        started: 'gyroscope_started',
        stopped: 'gyroscope_stopped',
        changed: 'gyroscope_changed',
        failed: 'gyroscope_failed',
        webViewStarted: 'gyroscopeStarted',
        webViewStopped: 'gyroscopeStopped',
        webViewChanged: 'gyroscopeChanged',
        webViewFailed: 'gyroscopeFailed',
        startCommand: 'web_app_start_gyroscope',
        stopCommand: 'web_app_stop_gyroscope',
        minVersion: '8.0',
        displayName: 'Gyroscope',
      },
      { x: null, y: null, z: null }
    );
  }

  protected mapChangedPayload(eventData: any): GyroscopeValues {
    return { x: eventData.x, y: eventData.y, z: eventData.z };
  }

  get x(): number | null {
    return this.values.x;
  }
  get y(): number | null {
    return this.values.y;
  }
  get z(): number | null {
    return this.values.z;
  }

  start(params: MotionSensorStartParams = {}, callback?: (success: boolean) => void): this {
    if (!this.checkVersion()) return this;
    const reqParams = this.buildStartParams(params.refresh_rate);
    this.doStart(reqParams, callback);
    return this;
  }
}
