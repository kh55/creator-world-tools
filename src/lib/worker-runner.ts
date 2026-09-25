// Web Worker に処理を依頼し、時間内に返事がなければ Worker ごと止める。
// 正規表現の暴走（ReDoS）のように、止める手段が Worker の終了しかない処理に使う。

export interface WorkerLike {
  postMessage(msg: unknown): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
}

export type Outcome<T> = { status: 'done'; value: T } | { status: 'timeout' } | { status: 'cancelled' };

interface Pending<T> {
  id: number;
  resolve: (o: Outcome<T>) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createRunner<Req, Res>(factory: () => WorkerLike, timeoutMs = 1000) {
  let worker: WorkerLike | null = null;
  let pending: Pending<Res> | null = null;
  let nextId = 1;

  function discard() {
    worker?.terminate();
    worker = null;
  }

  function finish(o: Outcome<Res>) {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.resolve(o);
    pending = null;
  }

  function getWorker(): WorkerLike {
    if (worker) return worker;
    const w = factory();
    w.onmessage = (e) => {
      const { id, result } = e.data as { id: number; result: Res };
      if (pending && pending.id === id) finish({ status: 'done', value: result });
    };
    worker = w;
    return w;
  }

  return {
    run(request: Req): Promise<Outcome<Res>> {
      if (pending) {
        // 実行中の Worker は処理を中断できないため、作り直す
        finish({ status: 'cancelled' });
        discard();
      }
      const id = nextId++;
      return new Promise<Outcome<Res>>((resolve) => {
        const timer = setTimeout(() => {
          finish({ status: 'timeout' });
          discard();
        }, timeoutMs);
        pending = { id, resolve, timer };
        getWorker().postMessage({ id, request });
      });
    },
    dispose() {
      finish({ status: 'cancelled' });
      discard();
    },
  };
}
