import type {
	FitzModifier,
	LayerColorReplacementInput,
	LoopConfig,
	PlayDirection,
	PlayerEventName,
	PlayerFrameSnapshot,
	PlayerState,
	RenderQuality,
	LottieColorConfig,
	LottieError,
	LottiePlaybackConfig,
	LottieSource,
} from "../core/types";
import { defaultWorkerPool, LottieWorkerPool } from "../worker/pool";
import type {
	MainToWorkerMessage,
	WorkerToMainMessage,
} from "../worker/protocol";
import { fetchAnimationBytes } from "./cache";
import { DEFAULT_WASM_URL } from "./wasm-url";

export interface LottieConfig
	extends LottieSource,
		LottiePlaybackConfig,
		LottieColorConfig {
	canvas: HTMLCanvasElement;
	wasmUrl?: string | URL;
	quality?: Partial<RenderQuality>;

	workerCount?: number;

	pool?: LottieWorkerPool;

	forceRender?: boolean;

	reportFrames?: boolean;
}

export type LottieEventName = PlayerEventName | "error";

export interface LottieEventPayload {
	frames?: PlayerFrameSnapshot;
	error?: LottieError;
}

export type LottieListener = (payload: LottieEventPayload) => void;

export function configureLottie(options: { workerCount?: number }): void {
	if (options.workerCount !== undefined)
		defaultWorkerPool.setSize(options.workerCount);
}

const intersectionRegistry = new Map<string, Lottie>();
const sharedIntersectionObserver: IntersectionObserver | null =
	typeof IntersectionObserver === "undefined"
		? null
		: new IntersectionObserver((entries) => {
				for (const entry of entries) {
					const id = (entry.target as HTMLElement).dataset.lottieId;
					if (id)
						intersectionRegistry.get(id)?.setObservable(entry.isIntersecting);
				}
			});

let idCounter = 0;
function generateId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	idCounter += 1;
	return `lottie-${Date.now()}-${idCounter}`;
}

export class Lottie {
	readonly id = generateId();
	state: PlayerState = "loading";
	frames: PlayerFrameSnapshot = { current: 0, total: 0 };
	lastError: LottieError | null = null;

	private readonly config: LottieConfig;
	private readonly canvas: HTMLCanvasElement;
	private readonly pool: LottieWorkerPool;
	private worker: Worker | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private resizeRaf = 0;
	private destroyed = false;
	private readonly listeners = new Map<
		LottieEventName,
		Set<LottieListener>
	>();

	constructor(config: LottieConfig) {
		this.config = config;
		this.canvas = config.canvas;
		this.pool =
			config.pool ??
			(config.workerCount !== undefined
				? new LottieWorkerPool(config.workerCount)
				: defaultWorkerPool);

		requestAnimationFrame(() => {
			if (!this.destroyed) this.start();
		});
	}

	on(event: LottieEventName, cb: LottieListener): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(cb);
	}

	off(event: LottieEventName, cb: LottieListener): void {
		this.listeners.get(event)?.delete(cb);
	}

	play(): void {
		this.send({ type: "control", id: this.id, action: "play" });
	}

	pause(): void {
		this.send({ type: "control", id: this.id, action: "pause" });
	}

	stop(): void {
		this.send({ type: "control", id: this.id, action: "stop" });
	}

	seek(frame: number): void {
		this.send({ type: "tweak", id: this.id, action: "seek", value: frame });
	}

	setSpeed(speed: number): void {
		this.send({ type: "tweak", id: this.id, action: "speed", value: speed });
	}

	setLoop(loop: LoopConfig): void {
		this.send({ type: "tweak", id: this.id, action: "loop", value: loop });
	}

	setDirection(direction: PlayDirection): void {
		this.send({
			type: "tweak",
			id: this.id,
			action: "direction",
			value: direction,
		});
	}

	setFitzModifier(fitzModifier: FitzModifier): void {
		this.send({
			type: "recolor",
			id: this.id,
			fitzModifier,
			layerColorReplacements: this.config.layerColorReplacements,
		});
	}

	setLayerColors(layerColorReplacements: LayerColorReplacementInput[]): void {
		this.send({
			type: "recolor",
			id: this.id,
			fitzModifier: this.config.fitzModifier,
			layerColorReplacements,
		});
	}

	setObservable(observable: boolean): void {
		this.send({ type: "observability", id: this.id, observable });
	}

	destroy(): void {
		if (this.destroyed) return;
		this.worker?.postMessage({
			type: "control",
			id: this.id,
			action: "destroy",
		} satisfies MainToWorkerMessage);
		this.destroyed = true;
		this.worker?.removeEventListener("message", this.onMessage);
		this.worker = null;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
		sharedIntersectionObserver?.unobserve(this.canvas);
		intersectionRegistry.delete(this.id);
		this.listeners.clear();
	}

	private start(): void {
		this.canvas.dataset.lottieId = this.id;

		const offscreen = this.canvas.transferControlToOffscreen();
		this.worker = this.pool.getWorker();
		this.worker.addEventListener("message", this.onMessage);

		intersectionRegistry.set(this.id, this);
		sharedIntersectionObserver?.observe(this.canvas);

		if (typeof ResizeObserver !== "undefined") {
			this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
			this.resizeObserver.observe(this.canvas);
		}

		const { width, height } = this.measure();
		void this.loadAndInit(offscreen, width, height);
	}

	private async loadAndInit(
		offscreen: OffscreenCanvas,
		width: number,
		height: number,
	): Promise<void> {
		let bytes: Uint8Array;
		try {
			bytes = await this.resolveSourceBytes();
		} catch (error) {
			this.handleError({
				reason: "fetch",
				message: error instanceof Error ? error.message : String(error),
			});
			return;
		}
		if (this.destroyed || !this.worker) return;

		const payload = bytes.slice();
		const message: MainToWorkerMessage = {
			type: "init",
			id: this.id,
			config: {
				canvas: offscreen,
				animationData: payload,
				wasmUrl: (this.config.wasmUrl ?? DEFAULT_WASM_URL).toString(),
				width,
				height,
				speed: this.config.speed,
				loop: this.config.loop,
				direction: this.config.direction,
				autoplay: this.config.autoplay,
				fitzModifier: this.config.fitzModifier,
				layerColorReplacements: this.config.layerColorReplacements,
				quality: this.config.quality,
				forceRender: this.config.forceRender,
				reportFrames: this.config.reportFrames,
			},
		};
		this.worker.postMessage(message, [offscreen, payload.buffer]);
	}

	private async resolveSourceBytes(): Promise<Uint8Array> {
		const { data, src } = this.config;
		if (data !== undefined)
			return typeof data === "string" ? new TextEncoder().encode(data) : data;
		if (src) return fetchAnimationBytes(src);
		throw new Error("lottie: LottieConfig requires either `src` or `data`");
	}

	private measure(): { width: number; height: number } {
		const rect = this.canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		return {
			width: Math.max(1, Math.round((rect.width || 1) * dpr)),
			height: Math.max(1, Math.round((rect.height || 1) * dpr)),
		};
	}

	private scheduleResize(): void {
		if (this.resizeRaf) return;
		this.resizeRaf = requestAnimationFrame(() => {
			this.resizeRaf = 0;
			if (this.destroyed) return;
			const { width, height } = this.measure();
			this.send({ type: "resize", id: this.id, width, height });
		});
	}

	private send(message: MainToWorkerMessage): void {
		if (this.destroyed || !this.worker) return;
		this.worker.postMessage(message);
	}

	private readonly onMessage = (
		ev: MessageEvent<WorkerToMainMessage>,
	): void => {
		const msg = ev.data;

		if (msg.type === "warmed" || msg.type === "warmup-error") return;
		if (msg.id !== this.id) return;
		switch (msg.type) {
			case "meta":
				this.frames = { current: 0, total: msg.frameCount };
				this.state = "ready";
				this.emit("load", { frames: this.frames });
				break;
			case "event":
				this.frames = msg.frames;
				this.state = eventToState(msg.event, this.state);
				this.emit(msg.event, { frames: msg.frames });
				break;
			case "error":
				this.handleError(msg.error);
				break;
		}
	};

	private handleError(error: LottieError): void {
		this.state = "error";
		this.lastError = error;
		this.emit("error", { error });
	}

	private emit(event: LottieEventName, payload: LottieEventPayload): void {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const cb of set) cb(payload);
	}
}

function eventToState(
	event: PlayerEventName,
	current: PlayerState,
): PlayerState {
	switch (event) {
		case "play":
			return "playing";
		case "pause":
			return "paused";
		case "stop":
			return "stopped";
		case "complete":
			return "complete";
		default:
			return current;
	}
}
