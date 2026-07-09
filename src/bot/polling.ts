import type { Update, GetUpdatesParams } from '../types/bot';

export interface PollingOptions {
  timeout?: number;
  limit?: number;
  allowedUpdates?: string[];
  onError?: (error: Error) => void;
  retryAfterMs?: number;
}

export type UpdateHandler = (update: Update) => void | Promise<void>;

export class TelegramPoller {
  private running = false;
  private offset = 0;
  private abortController: AbortController | null = null;

  constructor(
    private readonly getUpdates: (params?: GetUpdatesParams) => Promise<Update[]>,
    private readonly handler: UpdateHandler,
    private readonly options: PollingOptions = {}
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    void this._loop();
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.abortController = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private async _loop(): Promise<void> {
    const {
      timeout = 30,
      limit = 100,
      allowedUpdates,
      onError,
      retryAfterMs = 5000,
    } = this.options;

    while (this.running) {
      this.abortController = new AbortController();
      try {
        const updates = await this.getUpdates({
          offset: this.offset,
          timeout,
          limit,
          allowed_updates: allowedUpdates,
        });

        for (const update of updates) {
          if (!this.running) break;
          this.offset = update.update_id + 1;
          try {
            await this.handler(update);
          } catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
          }
        }
      } catch (err) {
        if (!this.running) break;
        const error = err instanceof Error ? err : new Error(String(err));
        onError?.(error);
        await _sleep(retryAfterMs);
      }
    }
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
