import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { StarView } from "../_internal/star/view";
import {
  STAR_PRESETS,
  type StarHapticKind,
  type StarLook,
  type StarVariant,
} from "../_internal/star/layer";

export type { StarVariant, StarHapticKind, StarLook };

export interface PremiumStarProps {
  variant?: StarVariant;
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  active?: boolean;
  reduceMotion?: "auto" | boolean;
  colors?: number[];
  particleColor?: number | null;
  idleAnimations?: boolean;
  look?: Partial<StarLook>;
  fallback?: ReactNode;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onHaptic?: (kind: StarHapticKind) => void;
}

export interface PremiumStarHandle {
  spin(opts?: { mirror?: boolean; explode?: boolean }): void;
  explode(): void;
}

export const PremiumStar = forwardRef<PremiumStarHandle, PremiumStarProps>(
  function PremiumStar(props, ref) {
    const {
      variant = "stars",
      width = "100%",
      height = "100%",
      className,
      style,
      active = true,
      reduceMotion = "auto",
      fallback = null,
    } = props;
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<StarView | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      let view: StarView;
      try {
        view = new StarView(host, variant);
      } catch (e) {
        setFailed(true);
        propsRef.current.onError?.(e);
        return;
      }

      viewRef.current = view;
      view.layer.onReady = () => propsRef.current.onReady?.();
      view.layer.onError = (e) => {
        setFailed(true);
        propsRef.current.onError?.(e);
      };
      view.layer.onHaptic = (k) => propsRef.current.onHaptic?.(k);
      const p = propsRef.current;
      const preset = STAR_PRESETS[variant];
      view.layer.setColors(p.colors ?? preset.colors, p.particleColor);
      setFailed(false);
      return () => {
        view.dispose();
        viewRef.current = null;
      };
    }, [variant]);

    useEffect(() => {
      const v = viewRef.current;
      if (!v || failed) return;
      v.setActive(active);
      v.setReduceMotionMode(reduceMotion);
      v.layer.setIdleAnimations(props.idleAnimations ?? true);
      if (props.look) v.layer.setLook(props.look);
    }, [active, reduceMotion, props.idleAnimations, props.look, failed]);
    const colorsKey = props.colors?.join(",");

    useEffect(() => {
      const v = viewRef.current;
      if (!v || failed || !props.colors) return;
      v.layer.setColors(props.colors, props.particleColor);
    }, [colorsKey, props.particleColor, failed]);

    useImperativeHandle(
      ref,
      () => ({
        spin: (o) => viewRef.current?.layer.spin(o),
        explode: () => viewRef.current?.layer.explode(),
      }),
      [],
    );
    return (
      <div
        ref={hostRef}
        className={className}
        style={{ position: "relative", width, height, ...style }}
      >
        {failed ? fallback : null}
      </div>
    );
  },
);
