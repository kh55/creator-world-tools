import { describe, expect, it } from 'vitest';
import { compareTexts, type CompareOptions } from './logic';

const opts = (over: Partial<CompareOptions> = {}): CompareOptions => ({
  mode: 'line',
  ignoreWhitespace: false,
  ignoreCase: false,
  ...over,
});
const cmp = (a: string, b: string, over: Partial<CompareOptions> = {}) => {
  const r = compareTexts(a, b, opts(over));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('compareTexts', () => {
  it('行単位の差分と追加・削除の件数', () => {
    const r = cmp('a\nb\nc\n', 'a\nB\nc\nd\n');
    expect(r.parts).toEqual([
      { type: 'equal', value: 'a\n' },
      { type: 'removed', value: 'b\n' },
      { type: 'added', value: 'B\n' },
      { type: 'equal', value: 'c\n' },
      { type: 'added', value: 'd\n' },
    ]);
    expect([r.added, r.removed]).toEqual([2, 1]);
    expect(r.identical).toBe(false);
  });

  it('同じ内容なら identical', () => {
    expect(cmp('a\nb', 'a\nb').identical).toBe(true);
  });

  it('改行コードの違い（CRLF と LF）は差分にしない', () => {
    expect(cmp('a\r\nb\r\n', 'a\nb\n').identical).toBe(true);
  });

  it('空白の違いを無視できる（行の途中の連続空白も）', () => {
    expect(cmp('a  b\n c\n', 'a b\nc \n').identical).toBe(false);
    expect(cmp('a  b\n c\n', 'a b\nc \n', { ignoreWhitespace: true }).identical).toBe(true);
  });

  it('大文字・小文字の違いを無視できる', () => {
    expect(cmp('Hello\n', 'hello\n', { ignoreCase: true }).identical).toBe(true);
  });

  it('文字単位の差分', () => {
    const r = cmp('今日は晴れです', '今日は雨です', { mode: 'char' });
    expect(r.parts).toEqual([
      { type: 'equal', value: '今日は' },
      { type: 'removed', value: '晴れ' },
      { type: 'added', value: '雨' },
      { type: 'equal', value: 'です' },
    ]);
    expect([r.added, r.removed]).toEqual([1, 2]);
  });

  it('単語単位の差分', () => {
    const r = cmp('the quick fox', 'the slow fox', { mode: 'word' });
    expect(r.parts.filter((p) => p.type !== 'equal')).toEqual([
      { type: 'removed', value: 'quick' },
      { type: 'added', value: 'slow' },
    ]);
  });

  it('両方とも空ならエラー', () => {
    expect(compareTexts('', '', opts()).ok).toBe(false);
  });

  it('差分が大きすぎて時間内に終わらなければエラー', () => {
    const a = Array.from({ length: 20000 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 20000 }, (_, i) => `b${i}`).join('\n');
    const r = compareTexts(a, b, { ...opts({ mode: 'char' }), timeoutMs: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('大きすぎ');
  });
});
