import { Lottie, type LottieConfig, type LottieEventPayload } from '../_internal/animation/lottie/main/Lottie';

export interface CreateLottiePlayerOptions extends Omit<LottieConfig, 'canvas'> {
  className?: string;
  playOnClick?: boolean;
  onLoad?: (payload: LottieEventPayload) => void;
  onError?: (payload: LottieEventPayload) => void;
  onComplete?: (payload: LottieEventPayload) => void;
}

export interface LottiePlayerHandle {
  readonly lottie: Lottie;
  readonly element: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  destroy(): void;
}

export function createLottiePlayer(container: HTMLElement, options: CreateLottiePlayerOptions): LottiePlayerHandle {
  const { className, playOnClick, onLoad, onError, onComplete, ...config } = options;
  const element = document.createElement('div');
  element.className = className || 'lottie-player';
  const canvas = document.createElement('canvas');
  element.appendChild(canvas);
  container.appendChild(element);
  const lottie = new Lottie({ ...config, canvas });
  const handleLoad = (payload: LottieEventPayload) => onLoad?.(payload);
  const handleError = (payload: LottieEventPayload) => onError?.(payload);
  const handleComplete = (payload: LottieEventPayload) => onComplete?.(payload);
  const handleClick = () => lottie.play();
  lottie.on('load', handleLoad);
  lottie.on('error', handleError);
  lottie.on('complete', handleComplete);
  if (playOnClick) canvas.addEventListener('click', handleClick);
  return { lottie, element, canvas, destroy() { lottie.off('load', handleLoad); lottie.off('error', handleError); lottie.off('complete', handleComplete); if (playOnClick) canvas.removeEventListener('click', handleClick); lottie.destroy(); element.remove(); } };
}
