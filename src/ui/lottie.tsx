import * as React from 'react';
import { Lottie, type LottieConfig, type LottieEventPayload } from '../_internal/animation/lottie/main/Lottie';
import type { LottieSource as LottieSourceConfig, PlayerState } from '../_internal/animation/lottie/core/types';

export type LottieSource = LottieSourceConfig;
export type LottieAnimation = unknown;
export type PlayMode = 'once' | 'loop';
export type { PlayerState };

export interface LottiePlayerHandle {
  readonly lottie: Lottie;
  readonly element: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  play(): void;
  pause(): void;
  stop(): void;
  seek(frame: number): void;
  destroy(): void;
}

export interface LottiePlayerProps extends Omit<LottieConfig, 'canvas'>, Omit<React.HTMLAttributes<HTMLDivElement>, 'onLoad' | 'onError'> {
  onLoad?: (payload: LottieEventPayload) => void;
  onError?: (payload: LottieEventPayload) => void;
  onComplete?: (payload: LottieEventPayload) => void;
  lottieRefCallback?: (lottie: Lottie | null) => void;
  playOnClick?: boolean;
}

export const LottiePlayer = React.forwardRef<LottiePlayerHandle, LottiePlayerProps>(function LottiePlayer(props, ref) {
  const { src, data, speed, loop, direction, autoplay, fitzModifier, layerColorReplacements, quality, workerCount, pool, forceRender, reportFrames, wasmUrl, onLoad, onError, onComplete, lottieRefCallback, playOnClick, className, ...rest } = props;
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const playerRef = React.useRef<Lottie | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const lottie = new Lottie({ canvas, src, data, speed, loop, direction, autoplay, fitzModifier, layerColorReplacements, quality, workerCount, pool, forceRender, reportFrames, wasmUrl });
    playerRef.current = lottie;
    lottieRefCallback?.(lottie);
    const handleLoad = (payload: LottieEventPayload) => { setLoaded(true); onLoad?.(payload); };
    const handleError = (payload: LottieEventPayload) => { setLoaded(false); onError?.(payload); };
    const handleComplete = (payload: LottieEventPayload) => onComplete?.(payload);
    lottie.on('load', handleLoad);
    lottie.on('error', handleError);
    lottie.on('complete', handleComplete);
    return () => {
      lottie.off('load', handleLoad);
      lottie.off('error', handleError);
      lottie.off('complete', handleComplete);
      lottieRefCallback?.(null);
      playerRef.current = null;
      lottie.destroy();
    };
  }, [src, data]);

  React.useEffect(() => { if (speed !== undefined) playerRef.current?.setSpeed(speed); }, [speed]);
  React.useEffect(() => { if (loop !== undefined) playerRef.current?.setLoop(loop); }, [loop]);
  React.useEffect(() => { if (direction !== undefined) playerRef.current?.setDirection(direction); }, [direction]);
  React.useImperativeHandle(ref, () => ({
    get lottie() { return playerRef.current as Lottie; },
    get element() { return canvasRef.current?.parentElement as HTMLDivElement; },
    get canvas() { return canvasRef.current as HTMLCanvasElement; },
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    stop: () => playerRef.current?.stop(),
    seek: (frame: number) => playerRef.current?.seek(frame),
    destroy: () => playerRef.current?.destroy(),
  }), []);

  return <div className={className} {...rest}><canvas ref={canvasRef} className={loaded ? 'lottie-ready' : undefined} onClick={playOnClick ? () => playerRef.current?.play() : undefined} /></div>;
});
LottiePlayer.displayName = 'LottiePlayer';
export { Lottie as LottieAnimationController };
export function loadLottieSource(source: LottieSource): LottieSource { return source; }
export function renderDocumentFrame(): void { throw new Error('Direct frame rendering is not supported; use LottiePlayer.'); }
