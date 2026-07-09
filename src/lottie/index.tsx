import * as React from 'react';
import {
  createAnimationPlayerComponent,
  type AnimationPlayerHandle,
  type AnimationPlayerBaseProps,
} from '../_internal/animation/AnimationPlayerBase';
import { loadTgsSource } from '../_internal/animation/lottie/loader';

export type { TgsSource as LottieSource } from '../_internal/animation/lottie/loader';
export type { LottieAnimation } from '../_internal/animation/lottie/types';
export type { PlayMode, PlayerState } from '../_internal/animation/lottie/animation';

export type LottiePlayerHandle = AnimationPlayerHandle;

export interface LottiePlayerProps extends Omit<AnimationPlayerBaseProps, 'validate'> {}

const BaseAnimationPlayer = createAnimationPlayerComponent('LottiePlayer', 'Lottie animation');

export const LottiePlayer = React.forwardRef<LottiePlayerHandle, LottiePlayerProps>(
  function LottiePlayer(props, ref) {
    return <BaseAnimationPlayer {...props} ref={ref} />;
  }
);

LottiePlayer.displayName = 'LottiePlayer';

export { loadTgsSource as loadLottieSource };

export { LottieAnimationController } from '../_internal/animation/lottie/animation';
export { renderDocumentFrame } from '../_internal/animation/lottie/engine';
