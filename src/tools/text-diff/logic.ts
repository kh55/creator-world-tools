import { diffChars, diffLines, diffWordsWithSpace, type ChangeObject } from 'diff';
import { err, ok, type Result } from '../../lib/result';

export const MODES = ['line', 'word', 'char'] as const;
export type Mode = (typeof MODES)[number];

export interface CompareOptions {
  mode: Mode;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  /** 差分計算を打ち切るまでの時間（大きな入力でタブが固まらないようにする） */
  timeoutMs?: number;
}

export interface DiffPart {
  type: 'equal' | 'added' | 'removed';
  value: string;
}

export interface DiffResult {
  parts: DiffPart[];
  /** 追加・削除の量（行モードは行数、単語・文字モードは単語数・文字数） */
  added: number;
  removed: number;
  identical: boolean;
}

export function compareTexts(a: string, b: string, opts: CompareOptions): Result<DiffResult> {
  if (a === '' && b === '') return err('比較する 2 つのテキストを入力してください');
  const left = a.replace(/\r\n?/g, '\n');
  const right = b.replace(/\r\n?/g, '\n');
  const normalize = (s: string) => {
    let v = opts.ignoreWhitespace ? s.replace(/\s+/g, ' ').trim() : s;
    if (opts.ignoreCase) v = v.toLowerCase();
    return v;
  };
  const common = {
    timeout: opts.timeoutMs ?? 2000,
    comparator: (l: string, r: string) => normalize(l) === normalize(r),
  };
  let changes: ChangeObject<string>[] | undefined;
  if (opts.mode === 'line') changes = diffLines(left, right, common);
  else if (opts.mode === 'word') changes = diffWordsWithSpace(left, right, common);
  else changes = diffChars(left, right, common);
  if (!changes) return err('差分が大きすぎるため、時間内に比較できませんでした。行単位で比較するか、テキストを分けてください');

  const parts: DiffPart[] = changes.map((c) => ({
    type: c.added ? 'added' : c.removed ? 'removed' : 'equal',
    value: c.value,
  }));
  const sum = (type: DiffPart['type']) =>
    changes.filter((_, i) => parts[i].type === type).reduce((n, c) => n + (c.count ?? 0), 0);
  const added = sum('added');
  const removed = sum('removed');
  return ok({ parts, added, removed, identical: added === 0 && removed === 0 });
}
