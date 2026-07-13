/**
 * `Telegram.WebApp.HapticFeedback`.
 */

import { WebAppKernel } from '../core/kernel';
import { WebAppErrorName, throwWebAppError } from '../core/errors';
import type { HapticImpactStyle, HapticNotificationType } from '../types';

type TriggerParams =
  | { type: 'impact'; impact_style: HapticImpactStyle }
  | { type: 'notification'; notification_type: HapticNotificationType }
  | { type: 'selection_change' };

export class HapticFeedback {
  constructor(private readonly kernel: WebAppKernel) {}

  private trigger(params: TriggerParams): this {
    if (!this.kernel.warnIfUnsupported('6.1', 'HapticFeedback')) {
      return this;
    }
    if (params.type == 'impact') {
      if (
        params.impact_style != 'light' &&
        params.impact_style != 'medium' &&
        params.impact_style != 'heavy' &&
        params.impact_style != 'rigid' &&
        params.impact_style != 'soft'
      ) {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Haptic impact style is invalid', params.impact_style);
        throwWebAppError(WebAppErrorName.HapticImpactStyleInvalid);
      }
    } else if (params.type == 'notification') {
      if (params.notification_type != 'error' && params.notification_type != 'success' && params.notification_type != 'warning') {
        // eslint-disable-next-line no-console
        console.error('[@core-ease/telegram-kit] Haptic notification type is invalid', params.notification_type);
        throwWebAppError(WebAppErrorName.HapticNotificationTypeInvalid);
      }
    } else if (params.type == 'selection_change') {
      // no params needed
    } else {
      // eslint-disable-next-line no-console
      console.error('[@core-ease/telegram-kit] Haptic feedback type is invalid', (params as any).type);
      throwWebAppError(WebAppErrorName.HapticFeedbackTypeInvalid);
    }
    this.kernel.webView.postEvent('web_app_trigger_haptic_feedback', undefined, params);
    return this;
  }

  impactOccurred(style: HapticImpactStyle): this {
    return this.trigger({ type: 'impact', impact_style: style });
  }

  notificationOccurred(type: HapticNotificationType): this {
    return this.trigger({ type: 'notification', notification_type: type });
  }

  selectionChanged(): this {
    return this.trigger({ type: 'selection_change' });
  }
}
