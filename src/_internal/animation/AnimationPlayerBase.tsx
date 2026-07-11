import * as React from 'react';
import { LottieAnimationController, type PlayMode, type PlayerState } from './lottie/animation';
import { loadTgsSource, type TgsSource } from './lottie/loader';
import type { LottieAnimation } from './lottie/types';

export interface AnimationPlayerHandle {
  play(): void;
  pause(): void;
  stop(): void;
  togglePlay(): void;
  seek(value: number | string): void;
  setSpeed(speed: number): void;
  setDirection(direction: 1 | -1): void;
  setLoop(loop: boolean | number): void;
  setMode(mode: PlayMode): void;
  setSegment(segment: [number, number] | null): void;
  getCurrentFrame(): number;
  getTotalFrames(): number;
  getState(): PlayerState;
  getAnimationData(): LottieAnimation | null;
  getCanvas(): HTMLCanvasElement | null;
}

export interface AnimationPlayerBaseProps {
  src: TgsSource;
  autoplay?: boolean;
  loop?: boolean | number;
  speed?: number;
  direction?: 1 | -1;
  mode?: PlayMode;
  segments?: [number, number];
  hover?: boolean;
  pauseWhenOffscreen?: boolean;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onComplete?: () => void;
  onLoop?: () => void;
  onFrame?: (info: { frame: number; progress: number }) => void;
  onError?: (errors?: string[]) => void;
  validate?: (doc: LottieAnimation) => string[];
}

const DEFAULT_SIZE = 512;

function useResolvedCssSize(width?: number | string, height?: number | string) {
  return {
    width: width ?? '100%',
    height: height ?? '100%',
  };
}

export function createAnimationPlayerComponent(displayName: string, defaultAriaLabel: string) {
  const Component = React.forwardRef<AnimationPlayerHandle, AnimationPlayerBaseProps>(
    function AnimationPlayer(props, ref) {
      const {
        src,
        autoplay = false,
        loop = false,
        speed = 1,
        direction = 1,
        mode = 'normal',
        segments,
        hover = false,
        pauseWhenOffscreen = true,
        width,
        height,
        className,
        style,
        ariaLabel = defaultAriaLabel,
        onReady,
        onPlay,
        onPause,
        onStop,
        onComplete,
        onLoop,
        onFrame,
        onError,
        validate,
      } = props;

      const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
      const controllerRef = React.useRef<LottieAnimationController | null>(null);
      const containerRef = React.useRef<HTMLDivElement | null>(null);
      const docRef = React.useRef<LottieAnimation | null>(null);
      const wasPlayingBeforeFreeze = React.useRef(false);

      const callbacksRef = React.useRef(props);
      callbacksRef.current = props;

      React.useImperativeHandle(
        ref,
        () => ({
          play: () => controllerRef.current?.play(),
          pause: () => controllerRef.current?.pause(),
          stop: () => controllerRef.current?.stop(),
          togglePlay: () => controllerRef.current?.togglePlay(),
          seek: (value) => controllerRef.current?.seek(value),
          setSpeed: (s) => controllerRef.current?.setSpeed(s),
          setDirection: (d) => controllerRef.current?.setDirection(d),
          setLoop: (l) => controllerRef.current?.setLoop(l),
          setMode: (m) => controllerRef.current?.setMode(m),
          setSegment: (seg) => controllerRef.current?.setSegment(seg),
          getCurrentFrame: () => controllerRef.current?.getCurrentFrame() ?? 0,
          getTotalFrames: () => controllerRef.current?.getTotalFrames() ?? 0,
          getState: () => controllerRef.current?.getState() ?? 'loading',
          getAnimationData: () => docRef.current,
          getCanvas: () => canvasRef.current,
        }),
        []
      );

      React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const controller = new LottieAnimationController({
          canvas,
          loop,
          autoplay,
          speed,
          direction,
          mode,
          segments,
        });
        controllerRef.current = controller;

        const offReady = controller.on('ready', () => callbacksRef.current.onReady?.());
        const offPlay = controller.on('play', () => callbacksRef.current.onPlay?.());
        const offPause = controller.on('pause', () => callbacksRef.current.onPause?.());
        const offStop = controller.on('stop', () => callbacksRef.current.onStop?.());
        const offComplete = controller.on('complete', () => callbacksRef.current.onComplete?.());
        const offLoop = controller.on('loop', () => callbacksRef.current.onLoop?.());
        const offFrame = controller.on('frame', (d) => callbacksRef.current.onFrame?.(d));
        const offError = controller.on('error', (d) => callbacksRef.current.onError?.(d?.errors));

        return () => {
          offReady();
          offPlay();
          offPause();
          offStop();
          offComplete();
          offLoop();
          offFrame();
          offError();
          controller.destroy();
          controllerRef.current = null;
        };
      }, []);

      React.useEffect(() => {
        let cancelled = false;
        const controller = controllerRef.current;
        if (!controller) return;

        loadTgsSource(src)
          .then((doc) => {
            if (cancelled) return;

            if (validate) {
              const errors = validate(doc);
              if (errors.length > 0) {
                callbacksRef.current.onError?.(errors);
              }
            }

            docRef.current = doc;
            controller.setDocument(doc);
            if (autoplay) controller.play();
          })
          .catch((err: Error) => {
            if (cancelled) return;
            controller.setError([err.message]);
            callbacksRef.current.onError?.([err.message]);
          });

        return () => {
          cancelled = true;
        };
      }, [src, validate]);

      React.useEffect(() => controllerRef.current?.setSpeed(speed), [speed]);
      React.useEffect(() => controllerRef.current?.setDirection(direction), [direction]);
      React.useEffect(() => controllerRef.current?.setLoop(loop), [loop]);
      React.useEffect(() => controllerRef.current?.setMode(mode), [mode]);
      React.useEffect(() => controllerRef.current?.setSegment(segments ?? null), [segments]);

      React.useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const applySize = () => {
          const rect = container.getBoundingClientRect();
          const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
          const w = Math.max(1, Math.round((rect.width || DEFAULT_SIZE) * dpr));
          const h = Math.max(1, Math.round((rect.height || DEFAULT_SIZE) * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            controllerRef.current?.resize(w, h);
          }
        };

        applySize();

        if (typeof ResizeObserver !== 'undefined') {
          const ro = new ResizeObserver(applySize);
          ro.observe(container);
          return () => ro.disconnect();
        }
        return undefined;
      }, []);

      React.useEffect(() => {
        if (!pauseWhenOffscreen) return;
        const container = containerRef.current;
        if (!container || typeof IntersectionObserver === 'undefined') return;

        const io = new IntersectionObserver((entries) => {
          const entry = entries[0];
          const controller = controllerRef.current;
          if (!controller) return;

          if (entry.isIntersecting) {
            controller.unfreeze();
          } else if (controller.getState() === 'playing') {
            controller.freeze();
          }
        });
        io.observe(container);
        return () => io.disconnect();
      }, [pauseWhenOffscreen]);

      React.useEffect(() => {
        if (typeof document === 'undefined') return;
        const onVisibility = () => {
          const controller = controllerRef.current;
          if (!controller) return;
          if (document.hidden) {
            if (controller.getState() === 'playing') {
              wasPlayingBeforeFreeze.current = true;
              controller.freeze();
            }
          } else if (wasPlayingBeforeFreeze.current) {
            wasPlayingBeforeFreeze.current = false;
            controller.unfreeze();
          }
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
      }, []);

      const handleMouseEnter = React.useCallback(() => {
        if (hover) controllerRef.current?.play();
      }, [hover]);

      const handleMouseLeave = React.useCallback(() => {
        if (hover) controllerRef.current?.stop();
      }, [hover]);

      const cssSize = useResolvedCssSize(width, height);

      return (
        <div
          ref={containerRef}
          className={className}
          style={{ width: cssSize.width, height: cssSize.height, lineHeight: 0, ...style }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="img"
          aria-label={ariaLabel}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      );
    }
  );

  Component.displayName = displayName;
  return Component;
}
