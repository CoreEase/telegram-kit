import type {
	FitzModifier,
	LayerColorReplacementInput,
	LoopConfig,
	PlayDirection,
	PlayerEventName,
	PlayerFrameSnapshot,
	PlayerState,
	RenderQuality,
	LottieError,
} from "../core/types";

export interface WorkerInitConfig {
	canvas: OffscreenCanvas;

	animationData: Uint8Array;

	wasmUrl?: string;
	width: number;
	height: number;
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
	fitzModifier?: FitzModifier;
	layerColorReplacements?: LayerColorReplacementInput[];
	quality?: Partial<RenderQuality>;

	forceRender?: boolean;

	reportFrames?: boolean;
}

export type MainToWorkerMessage =
	| { type: "init"; id: string; config: WorkerInitConfig }
	| { type: "resize"; id: string; width: number; height: number }
	| { type: "observability"; id: string; observable: boolean }
	| {
			type: "control";
			id: string;
			action: "play" | "pause" | "stop" | "destroy";
	  }
	| { type: "tweak"; id: string; action: "speed"; value: number }
	| { type: "tweak"; id: string; action: "loop"; value: LoopConfig }
	| { type: "tweak"; id: string; action: "direction"; value: PlayDirection }
	| { type: "tweak"; id: string; action: "seek"; value: number }
	| {
			type: "recolor";
			id: string;
			fitzModifier?: FitzModifier;
			layerColorReplacements?: LayerColorReplacementInput[];
	  }
	| { type: "warmup"; requestId: string; wasmUrl?: string };

export type WorkerToMainMessage =
	| {
			type: "meta";
			id: string;
			width: number;
			height: number;
			frameRate: number;
			frameCount: number;
	  }
	| {
			type: "state";
			id: string;
			state: PlayerState;
			frames: PlayerFrameSnapshot;
	  }
	| {
			type: "event";
			id: string;
			event: PlayerEventName;
			frames: PlayerFrameSnapshot;
	  }
	| { type: "error"; id: string; error: LottieError }
	| { type: "warmed"; requestId: string }
	| { type: "warmup-error"; requestId: string; message: string };
