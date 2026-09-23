import { describe, expect, it } from 'vitest';
import { isRawNumber, locate, parseJson, supportsRawJSON } from './json';

describe('parseJson', () => {
  it('Node 22 では JSON.rawJSON が使える（テスト前提の確認）', () => {
    expect(supportsRawJSON).toBe(true);
  });

  it('オブジェクトを読める', () => {
    const r = parseJson('{"a":[1,"x",null,true]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.value.value)).toBe('{"a":[1,"x",null,true]}');
  });

  it('大きな整数や小数表記をそのまま保つ', () => {
    const r = parseJson('{"id":12345678901234567890,"v":1.0,"e":1e3}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r.value.value)).toBe('{"id":12345678901234567890,"v":1.0,"e":1e3}');
    expect(r.value.precisionWarning).toBe(false);
    const obj = r.value.value as Record<string, unknown>;
    expect(isRawNumber(obj.id)).toBe(true);
    expect(isRawNumber({ rawJSON: '1' })).toBe(false);
  });

  it('空入力はエラー', () => {
    expect(parseJson('  \n').ok).toBe(false);
  });

  it('構文エラーは行・列を返す', () => {
    const r = parseJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain('JSON の構文エラー');
    expect(r.error.line).toBe(3);
    expect(r.error.column).toBe(1);
  });
});

describe('locate', () => {
  it('"line X column Y" 形式を読む', () => {
    expect(locate('', 'bad (line 2 column 5)')).toEqual({ line: 2, column: 5 });
  });

  it('"position N" 形式から行・列を計算する', () => {
    expect(locate('ab\ncd', 'Unexpected token at position 4')).toEqual({ line: 2, column: 2 });
  });

  it('位置情報がなければ空', () => {
    expect(locate('x', 'JSON Parse error: Expected')).toEqual({});
  });
});
