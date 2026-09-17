
export const FitzModifier = {
	None: 0,
	Type12: 1,
	Type3: 2,
	Type4: 3,
	Type5: 4,
	Type6: 5,
} as const;
export type FitzModifier = (typeof FitzModifier)[keyof typeof FitzModifier];

export interface LayerColorReplacementInput {
	layerNamePrefix: string;

	color: number;
}

export interface RenderQuality {
	antialias: boolean;

	curveTolerance: number;
}

export const DEFAULT_RENDER_QUALITY: RenderQuality = {
	antialias: true,
	curveTolerance: 0.125,
};

export type PlayerState =
	| "idle"
	| "loading"
	| "ready"
	| "playing"
	| "paused"
	| "stopped"
	| "complete"
	| "error"
	| "destroyed";

export type PlayerEventName =
	| "load"
	| "frame"
	| "loopComplete"
	| "complete"
	| "play"
	| "pause"
	| "stop"
	| "error"
	| "destroy";

export interface PlayerFrameSnapshot {
	current: number;
	total: number;
}

export type PlayDirection = 1 | -1;

export type LoopConfig = boolean | number;

export interface PlayerEngineConfig {
	frameCount: number;
	frameRate: number;
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
	initialFrame?: number;
}

export interface LottieSource {
	src?: string;
	data?: string | Uint8Array;
}

export interface LottiePlaybackConfig {
	speed?: number;
	loop?: LoopConfig;
	direction?: PlayDirection;
	autoplay?: boolean;
}

export interface LottieColorConfig {
	fitzModifier?: FitzModifier;
	layerColorReplacements?: LayerColorReplacementInput[];
}

export type LottieErrorReason = "fetch" | "decompress" | "parse" | "wasm";

export interface LottieError {
	reason: LottieErrorReason;
	message: string;
}
