import { defaultWorkerPool, LottieWorkerPool } from "../worker/pool";
import type {
	MainToWorkerMessage,
	WorkerToMainMessage,
} from "../worker/protocol";
import { DEFAULT_WASM_URL } from "./wasm-url";

export interface InitializeLottieOptions {

	workerCount?: number;

	pool?: LottieWorkerPool;
	wasmUrl?: string | URL;
}

let idCounter = 0;
function generateRequestId(): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	idCounter += 1;
	return `lottie-warmup-${Date.now()}-${idCounter}`;
}

export function initializeLottie(
	options: InitializeLottieOptions = {},
): Promise<void> {
	const pool =
		options.pool ??
		(options.workerCount !== undefined
			? new LottieWorkerPool(options.workerCount)
			: defaultWorkerPool);
	const wasmUrl = (options.wasmUrl ?? DEFAULT_WASM_URL).toString();
	const workers = pool.getAllWorkers();

	return Promise.all(
		workers.map(
			(worker) =>
				new Promise<void>((resolve, reject) => {
					const requestId = generateRequestId();
					const onMessage = (ev: MessageEvent<WorkerToMainMessage>): void => {
						const data = ev.data;
						if (data.type !== "warmed" && data.type !== "warmup-error") return;
						if (data.requestId !== requestId) return;
						worker.removeEventListener("message", onMessage);
						if (data.type === "warmed") resolve();
						else reject(new Error(data.message));
					};
					worker.addEventListener("message", onMessage);
					worker.postMessage({
						type: "warmup",
						requestId,
						wasmUrl,
					} satisfies MainToWorkerMessage);
				}),
		),
	).then(() => undefined);
}
