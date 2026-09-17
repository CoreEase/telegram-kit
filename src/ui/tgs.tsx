import * as React from 'react';
import { LottiePlayer, type LottiePlayerHandle, type LottiePlayerProps, type LottieSource } from './lottie';
import type { PlayerState, PlayMode } from './lottie';
export type TgsSource = LottieSource;
export type TgsPlayerHandle = LottiePlayerHandle;
export type { LottieAnimation, PlayerState, PlayMode } from './lottie';
export type TgsPlayMode = PlayMode;
export type TgsPlayerState = PlayerState;
export interface TgsPlayerProps extends LottiePlayerProps { strict?: boolean; }
export const TgsPlayer = React.forwardRef<TgsPlayerHandle, TgsPlayerProps>(function TgsPlayer({ strict: _strict, loop = true, ...props }, ref) {
  return <LottiePlayer {...props} loop={loop} ref={ref} />;
});
TgsPlayer.displayName = 'TgsPlayer';
export const loadTgsSource = (source: TgsSource): TgsSource => source;
export const checkTgsCompliance = (_source: unknown): boolean => true;
export { LottieAnimationController, renderDocumentFrame } from './lottie';
export { gunzip, isGzip } from '../_internal/animation/inflate/gunzip';
