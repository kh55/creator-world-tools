import { err, ok, type Result } from '../../lib/result';

export const MODES = ['encode', 'decode'] as const;
export type Mode = (typeof MODES)[number];

export function encodeComponent(text: string): Result<string> {
  try {
    return ok(encodeURIComponent(text));
  } catch {
    return err('エンコードできない文字（対になっていないサロゲート）が含まれています');
  }
}

export function decodeComponent(text: string, plusAsSpace: boolean): Result<string> {
  try {
    return ok(decodeURIComponent(plusAsSpace ? text.replace(/\+/g, ' ') : text));
  } catch {
    return err('正しくないパーセントエンコーディングが含まれています（% の後に 16 進数 2 桁が続いていない、または UTF-8 として不完全）');
  }
}

export interface QueryParam {
  key: string;
  value: string;
}

export function parseQuery(input: string): QueryParam[] | null {
  const s = input.trim();
  if (s === '') return null;
  let query: string;
  try {
    query = new URL(s).search;
  } catch {
    if (!s.includes('=')) return null;
    query = s.split('#')[0];
  }
  // URLSearchParams は + を空白として、不正な % はそのまま扱う
  const params = [...new URLSearchParams(query)].map(([key, value]) => ({ key, value }));
  return params.length > 0 ? params : null;
}
