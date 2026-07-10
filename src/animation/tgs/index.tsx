import * as React from 'react';
import {
  createAnimationPlayerComponent,
  type AnimationPlayerHandle,
  type AnimationPlayerBaseProps,
} from '../../_internal/animation/AnimationPlayerBase';
import { checkTgsCompliance } from '../../_internal/animation/lottie/validate';
import { loadTgsSource } from '../../_internal/animation/lottie/loader';

export type { TgsSource } from '../../_internal/animation/lottie/loader';
export type { LottieAnimation } from '../../_internal/animation/lottie/types';
export type { PlayMode, PlayerState } from '../../_internal/animation/lottie/animation';

export type TgsPlayerHandle = AnimationPlayerHandle;

export interface TgsPlayerProps extends Omit<AnimationPlayerBaseProps, 'validate'> {
  strict?: boolean;
}

const BaseAnimationPlayer = createAnimationPlayerComponent('TgsPlayer', 'Telegram animated sticker');

export const TgsPlayer = React.forwardRef<TgsPlayerHandle, TgsPlayerProps>(function TgsPlayer(
  props,
  ref
) {
  const { strict = true, ...rest } = props;
  return (
    <BaseAnimationPlayer
      {...rest}
      ref={ref}
      validate={strict ? checkTgsCompliance : undefined}
    />
  );
});

TgsPlayer.displayName = 'TgsPlayer';

export { loadTgsSource };
export { checkTgsCompliance };
export { LottieAnimationController } from '../../_internal/animation/lottie/animation';
export { renderDocumentFrame } from '../../_internal/animation/lottie/engine';
export { gunzip, isGzip } from '../../_internal/animation/inflate/gunzip';
