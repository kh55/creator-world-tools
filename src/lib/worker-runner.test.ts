import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunner, type WorkerLike } from './worker-runner';

class FakeWorker implements WorkerLike {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;
  postMessage(msg: unknown) {
    this.posted.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  reply(result: unknown) {
    const { id } = this.posted[this.posted.length - 1] as { id: number };
    this.onmessage?.({ data: { id, result } });
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createRunner', () => {
  it('Worker の返事を結果として返す', async () => {
    const workers: FakeWorker[] = [];
    const runner = createRunner<string, number>(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const p = runner.run('hello');
    expect(workers[0].posted).toEqual([{ id: 1, request: 'hello' }]);
    workers[0].reply(42);
    await expect(p).resolves.toEqual({ status: 'done', value: 42 });
  });

  it('時間内に返事がなければ Worker を止めて timeout を返し、次は新しい Worker を使う', async () => {
    vi.useFakeTimers();
    const workers: FakeWorker[] = [];
    const runner = createRunner<string, number>(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    }, 1000);
    const p = runner.run('slow');
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toEqual({ status: 'timeout' });
    expect(workers[0].terminated).toBe(true);
    void runner.run('next');
    expect(workers).toHaveLength(2);
  });

  it('実行中に次の依頼が来たら前の依頼を取り消し、Worker を作り直す', async () => {
    const workers: FakeWorker[] = [];
    const runner = createRunner<string, number>(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const first = runner.run('a');
    const second = runner.run('b');
    await expect(first).resolves.toEqual({ status: 'cancelled' });
    expect(workers[0].terminated).toBe(true);
    workers[1].reply(7);
    await expect(second).resolves.toEqual({ status: 'done', value: 7 });
  });

  it('返事が終わった Worker は使い回す', async () => {
    const workers: FakeWorker[] = [];
    const runner = createRunner<string, number>(() => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    });
    const p = runner.run('a');
    workers[0].reply(1);
    await p;
    void runner.run('b');
    expect(workers).toHaveLength(1);
  });
});
