
const DEFAULT_POOL_SIZE = 1;

export class LottieWorkerPool {
	private workers: Worker[] = [];
	private nextIndex = -1;
	private size: number;

	constructor(size: number = DEFAULT_POOL_SIZE) {
		this.size = Math.max(1, size);
	}

	setSize(size: number): void {
		if (size < 1)
			throw new Error("lottie: worker pool size must be at least 1");
		this.size = size;
		while (this.workers.length > size) {
			this.workers.pop()?.terminate();
		}
	}

	getWorker(): Worker {
			if (this.workers.length < this.size) {
				const worker = new Worker(
					new URL("./lottie.worker.js", import.meta.url),
				{ type: "module" },
			);
			this.workers.push(worker);
			this.nextIndex = this.workers.length - 1;
			return worker;
		}
		this.nextIndex = (this.nextIndex + 1) % this.workers.length;
		return this.workers[this.nextIndex];
	}

	getAllWorkers(): Worker[] {
		while (this.workers.length < this.size) this.getWorker();
		return [...this.workers];
	}

	terminateAll(): void {
		for (const worker of this.workers) worker.terminate();
		this.workers = [];
		this.nextIndex = -1;
	}
}

export const defaultWorkerPool = new LottieWorkerPool();
