import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Appearance } from "../_internal/gram/animation";
import type { DiamondStyle } from "../_internal/gram/style";
import type {
  RefractionGeometry,
  RefractionSource,
} from "../_internal/gram/renderer";
import type { HapticKind } from "../_internal/gram/layer";
import {
  InteractiveDiamondView,
  PremiumDiamondView,
  type ExpansionStyle,
  type InteractiveAnimationMode,
  type MotionState,
  type Point,
} from "../_internal/gram/view";

export type GramDiamondAppearance = "blue" | "white" | "cool";

const APPEARANCE: Record<GramDiamondAppearance, Appearance> = {
  blue: Appearance.blue,
  white: Appearance.white,
  cool: Appearance.cool,
};

export interface GramDiamondProps {
  variant?: "premium" | "interactive";
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  lightBackground?: boolean;
  active?: boolean;
  reduceMotion?: "auto" | boolean;
  touchAction?: string;
  fallback?: ReactNode;
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onHaptic?: (kind: HapticKind, intensity?: number) => void;
  diamondStyle?: Partial<DiamondStyle>;
  appearance?: GramDiamondAppearance;
  diamondWidth?: number;
  expansionStyle?: ExpansionStyle;
  expandedCenter?: Point | null;
  animationMode?: InteractiveAnimationMode;
  animateOnAppear?: boolean;
  tapToSpin?: boolean;
  onExpansionChanged?: (expanded: boolean) => void;
  onLanding?: (power: number) => void;
  onMotionUpdated?: (state: MotionState | null) => void;
  onRefractionUpdated?: (geometry: RefractionGeometry | null) => void;
  refractionSource?: RefractionSource | null;
}

export interface GramDiamondHandle {
  spin(velocity: number, decay?: number): void;
  pushFromBelow(strength?: number): void;
  emitStarBurst(): void;
  playOnce(): void;
  cancelInteraction(): void;
  updateTransferState(isSending: boolean, animateCompletion: boolean): void;
  beginReceivingTransfer(startTimeSeconds: number, completionDelay: number): void;
  endReceivingTransfer(): void;
}

function toNumber(value: number | string | undefined, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export const GramDiamond = forwardRef<GramDiamondHandle, GramDiamondProps>(
  function GramDiamond(props, ref) {
    const {
      variant = "premium",
      width,
      height,
      className,
      style,
      lightBackground = false,
      active = true,
      reduceMotion = "auto",
      touchAction = "none",
      fallback = null,
    } = props;

    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<
      InteractiveDiamondView | PremiumDiamondView | null
    >(null);
    const propsRef = useRef(props);
    propsRef.current = props;

    const [failed, setFailed] = useState(false);
    const [box, setBox] = useState<{ width: number; height: number }>({
      width: 0,
      height: 0,
    });

    useEffect(() => {
      const el = hostRef.current;
      if (!el) return;

      const measure = () =>
        setBox({ width: el.clientWidth, height: el.clientHeight });

      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);

      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      let view: InteractiveDiamondView | PremiumDiamondView;

      try {
        view =
          variant === "interactive"
            ? new InteractiveDiamondView(host)
            : new PremiumDiamondView(host);
      } catch (error) {
        setFailed(true);
        propsRef.current.onError?.(error);
        return;
      }

      viewRef.current = view;

      view.layer.onReady = () => propsRef.current.onReady?.();
      view.layer.onError = (error) => {
        setFailed(true);
        propsRef.current.onError?.(error);
      };
      view.layer.onHaptic = (kind) => propsRef.current.onHaptic?.(kind);

      if (view instanceof InteractiveDiamondView) {
        view.onHaptic = (kind, intensity) =>
          propsRef.current.onHaptic?.(kind, intensity);
        view.onExpansionChanged = (expanded) =>
          propsRef.current.onExpansionChanged?.(expanded);
        view.onLanding = (power) => propsRef.current.onLanding?.(power);
        view.onMotionUpdated = (state) =>
          propsRef.current.onMotionUpdated?.(state);
        view.onRefractionUpdated = (geometry) =>
          propsRef.current.onRefractionUpdated?.(geometry);
      }

      setFailed(false);
      setBox({ width: host.clientWidth, height: host.clientHeight });

      return () => {
        view.dispose();
        viewRef.current = null;
      };
    }, [variant]);

    useEffect(() => {
      const view = viewRef.current;
      if (!view || failed) return;

      view.setReduceMotionMode(reduceMotion);

      if (view instanceof InteractiveDiamondView) {
        const w = toNumber(width, 96);
        const h = toNumber(height, w);

        view.update({
          size: { width: w, height: h },
          diamondWidth: props.diamondWidth ?? w,
          isVisible: active,
          lightBackground,
          appearance: APPEARANCE[props.appearance ?? "blue"],
          expansionStyle: props.expansionStyle ?? "centered",
          expandedCenter: props.expandedCenter ?? null,
          animationMode: props.animationMode ?? "continuous",
          animateOnAppear: props.animateOnAppear ?? false,
          tapToSpin: props.tapToSpin ?? false,
          touchAction,
        });

        view.updateRefractionSource(props.refractionSource ?? null);
      } else if (box.width > 0 && box.height > 0) {
        view.update({
          size: box,
          lightBackground,
          style: props.diamondStyle,
          touchAction,
          isVisible: active,
        });
      }
    }, [
      variant,
      failed,
      box,
      width,
      height,
      lightBackground,
      active,
      reduceMotion,
      touchAction,
      props.diamondStyle,
      props.diamondWidth,
      props.appearance,
      props.expansionStyle,
      props.expandedCenter,
      props.animationMode,
      props.animateOnAppear,
      props.tapToSpin,
      props.refractionSource,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        spin: (velocity, decay = 0.7) =>
          viewRef.current?.layer.spin(velocity, decay),
        pushFromBelow: (strength = 1) =>
          viewRef.current?.layer.pushFromBelow(strength),
        emitStarBurst: () => viewRef.current?.layer.emitStarBurst(),
        playOnce: () => {
          const view = viewRef.current;
          if (view instanceof InteractiveDiamondView) view.playOnce();
        },
        cancelInteraction: () => {
          const view = viewRef.current;
          if (view instanceof InteractiveDiamondView) view.cancelInteraction();
        },
        updateTransferState: (isSending, animateCompletion) =>
          viewRef.current?.layer.updateTransferState(
            isSending,
            animateCompletion,
          ),
        beginReceivingTransfer: (startTimeSeconds, completionDelay) =>
          viewRef.current?.layer.beginReceivingTransfer(
            startTimeSeconds,
            completionDelay,
          ),
        endReceivingTransfer: () =>
          viewRef.current?.layer.endReceivingTransfer(),
      }),
      [],
    );

    const resolvedWidth =
      width ?? (variant === "interactive" ? 96 : "100%");

    const resolvedHeight =
      height ??
      (variant === "interactive"
        ? typeof resolvedWidth === "number"
          ? resolvedWidth
          : 96
        : "100%");

    return (
      <div
        ref={hostRef}
        className={className}
        style={{
          position: "relative",
          width: resolvedWidth,
          height: resolvedHeight,
          overflow: "visible",
          ...style,
        }}
      >
        {failed ? fallback : null}
      </div>
    );
  },
);

export type {
  DiamondStyle,
  HapticKind,
  ExpansionStyle,
  InteractiveAnimationMode,
  MotionState,
  Point,
};
