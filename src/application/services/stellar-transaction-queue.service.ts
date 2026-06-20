import { Injectable, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class StellarTransactionQueue implements OnModuleDestroy {
  private queue: Promise<void> = Promise.resolve();
  private readonly inFlightKeys = new Set<string>();

  hasInFlightKey(key: string): boolean {
    return this.inFlightKeys.has(key);
  }

  trackInFlightKey(key: string): void {
    this.inFlightKeys.add(key);
  }

  untrackInFlightKey(key: string): void {
    this.inFlightKeys.delete(key);
  }

  enqueue<T>(job: () => Promise<T>, idempotencyKey?: string): Promise<T> {
    if (idempotencyKey) {
      this.inFlightKeys.add(idempotencyKey);
    }

    const result = this.queue.then(async () => {
      try {
        return await job();
      } finally {
        if (idempotencyKey) {
          this.inFlightKeys.delete(idempotencyKey);
        }
      }
    });

    this.queue = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue;
  }
}
