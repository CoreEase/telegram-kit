import { WebAppKernel } from '../core/kernel';
import { MotionSensorBase } from './motion-sensor-base';
import type { MotionSensorStartParams } from '../types';

interface AccelerometerValues {
  x: number | null;
  y: number | null;
  z: number | null;
}

export class Accelerometer extends MotionSensorBase<AccelerometerValues> {
  constructor(kernel: WebAppKernel) {
    super(
      kernel,
      {
        started: 'accelerometer_started',
        stopped: 'accelerometer_stopped',
        changed: 'accelerometer_changed',
        failed: 'accelerometer_failed',
        webViewStarted: 'accelerometerStarted',
        webViewStopped: 'accelerometerStopped',
        webViewChanged: 'accelerometerChanged',
        webViewFailed: 'accelerometerFailed',
        startCommand: 'web_app_start_accelerometer',
        stopCommand: 'web_app_stop_accelerometer',
        minVersion: '8.0',
        displayName: 'Accelerometer',
      },
      { x: null, y: null, z: null }
    );
  }

  protected mapChangedPayload(eventData: any): AccelerometerValues {
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
