import { describe, expect, it } from 'vitest';
import { runRegex, type RegexRequest } from './logic';

const req = (over: Partial<RegexRequest>): RegexRequest => ({
  pattern: '',
  flags: '',
  text: '',
  replacement: null,
  maxMatches: 1000,
  ...over,
});
const run = (over: Partial<RegexRequest>) => {
  const r = runRegex(req(over));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('runRegex', () => {
  it('すべてのマッチの位置と文字列を返す', () => {
    expect(run({ pattern: '\\d+', text: 'a1 b22' }).matches).toEqual([
      { index: 1, end: 2, text: '1', groups: [], named: {} },
      { index: 4, end: 6, text: '22', groups: [], named: {} },
    ]);
  });

  it('フラグ i を反映する', () => {
    expect(run({ pattern: 'abc', flags: 'i', text: 'ABC abc' }).matches).toHaveLength(2);
  });

  it('番号付き・名前付きのキャプチャグループ', () => {
    const [m] = run({ pattern: '(?<y>\\d{4})-(\\d{2})', text: '2026-09' }).matches;
    expect(m.groups).toEqual(['2026', '09']);
    expect(m.named).toEqual({ y: '2026' });
  });

  it('マッチしなかったグループは null', () => {
    const [m] = run({ pattern: '(a)|(b)', text: 'b' }).matches;
    expect(m.groups).toEqual([null, 'b']);
  });

  it('長さ 0 のマッチでも無限ループしない', () => {
    expect(run({ pattern: '^', flags: 'm', text: 'a\nb' }).matches.map((m) => m.index)).toEqual([0, 2]);
  });

  it('u フラグで絵文字を 1 文字として扱う', () => {
    expect(run({ pattern: '.', flags: 'u', text: '😀' }).matches).toHaveLength(1);
  });

  it('マッチ数の上限で打ち切る', () => {
    const r = run({ pattern: 'a', text: 'a'.repeat(1500), maxMatches: 1000 });
    expect(r.matches).toHaveLength(1000);
    expect(r.truncated).toBe(true);
    expect(r.total).toBe(1500);
  });

  it('置換結果を返す（$1 や $<name> を使える）', () => {
    expect(run({ pattern: '(?<y>\\d{4})-(\\d{2})', text: '2026-09', replacement: '$2/$<y>' }).replaced).toBe('09/2026');
    expect(run({ pattern: 'x', text: 'x' }).replaced).toBeNull();
  });

  it('構文エラー・空のパターン・使えないフラグはエラー', () => {
    const bad = runRegex(req({ pattern: '(', text: 'x' }));
    expect(!bad.ok && bad.error.message).toContain('正規表現の構文エラー');
    expect(runRegex(req({ pattern: '', text: 'x' })).ok).toBe(false);
    expect(runRegex(req({ pattern: 'a', flags: 'x', text: 'a' })).ok).toBe(false);
  });
});
