import { err, ok, type Result } from './result';

// JSON.rawJSON / JSON.isRawJSON（ES2025）が使えるブラウザでは、数値を元の表記のまま保持して
// 大きな整数の精度落ちや 1.0 → 1 のような書き換えを防ぐ。使えない場合は警告だけ出す。
interface RawJSONApi {
  rawJSON(text: string): unknown;
  isRawJSON(v: unknown): boolean;
}
const api = JSON as unknown as Partial<RawJSONApi>;

export const supportsRawJSON =
  typeof api.rawJSON === 'function' && typeof api.isRawJSON === 'function';

export function isRawNumber(v: unknown): v is { rawJSON: string } {
  return supportsRawJSON && api.isRawJSON!(v);
}

export interface ParsedJson {
  value: unknown;
  precisionWarning: boolean;
}

const BIG_NUMBER = /(?<![\w.])-?\d{16,}/;

export function parseJson(text: string): Result<ParsedJson> {
  if (text.trim() === '') return err('入力が空です');
  try {
    if (supportsRawJSON) {
      const value: unknown = JSON.parse(text, (_key, v: unknown, ctx?: { source?: string }) =>
        typeof v === 'number' && ctx?.source !== undefined ? api.rawJSON!(ctx.source) : v,
      );
      return ok({ value, precisionWarning: false });
    }
    return ok({ value: JSON.parse(text) as unknown, precisionWarning: BIG_NUMBER.test(text) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err(`JSON の構文エラー: ${message}`, locate(text, message));
  }
}

// ブラウザごとに異なるエラーメッセージから位置を取り出す
// V8: "... at position 10 (line 2 column 3)" / Firefox: "... at line 2 column 3 of the JSON data"
export function locate(text: string, message: string): { line?: number; column?: number } {
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };
  const pos = /position (\d+)/.exec(message);
  if (pos) {
    const lines = text.slice(0, Number(pos[1])).split('\n');
    return { line: lines.length, column: lines[lines.length - 1].length + 1 };
  }
  return {};
}
