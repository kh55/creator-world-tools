// 正規表現を別スレッドで実行する Web Worker。暴走しても呼び出し側が terminate() で止められる。
import { runRegex, type RegexRequest } from './logic';

const scope = self as unknown as {
  onmessage: ((e: { data: { id: number; request: RegexRequest } }) => void) | null;
  postMessage(msg: unknown): void;
};

scope.onmessage = (e) => {
  const { id, request } = e.data;
  scope.postMessage({ id, result: runRegex(request) });
};
