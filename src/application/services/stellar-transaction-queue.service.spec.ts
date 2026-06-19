import { StellarTransactionQueue } from './stellar-transaction-queue.service';

describe('StellarTransactionQueue', () => {
  let queue: StellarTransactionQueue;

  beforeEach(() => {
    queue = new StellarTransactionQueue();
  });

  it('serializes 10 concurrent enqueues in order', async () => {
    const order: number[] = [];

    const jobs = Array.from({ length: 10 }, (_, i) =>
      queue.enqueue(async () => {
        order.push(i);
        return i;
      }),
    );

    const results = await Promise.all(jobs);

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('does not block subsequent jobs when one fails', async () => {
    const results: string[] = [];

    await expect(
      queue.enqueue(async () => {
        results.push('fail');
        throw new Error('job failed');
      }),
    ).rejects.toThrow('job failed');

    await queue.enqueue(async () => {
      results.push('ok');
      return 'ok';
    });

    expect(results).toEqual(['fail', 'ok']);
  });

  it('awaits in-flight chain on onModuleDestroy', async () => {
    let completed = false;

    const job = queue.enqueue(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      completed = true;
    });

    const destroyPromise = queue.onModuleDestroy();
    await job;
    await destroyPromise;

    expect(completed).toBe(true);
  });

  it('tracks and releases in-flight idempotency keys', async () => {
    const key = 'test-key';

    expect(queue.hasInFlightKey(key)).toBe(false);

    const job = queue.enqueue(
      async () => {
        expect(queue.hasInFlightKey(key)).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'done';
      },
      key,
    );

    expect(queue.hasInFlightKey(key)).toBe(true);
    await job;
    expect(queue.hasInFlightKey(key)).toBe(false);
  });
});
