import { describe, expect, it } from 'vitest';
import { cleanMessage, isRawNumber, locate, mayChangeNumbers, parseJson, supportsRawJSON } from './json';

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

describe('エラーメッセージ', () => {
  it('位置を取り出せたら、メッセージから位置の記述を削る（V8）', () => {
    const r = parseJson('{"a":1,}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.line).toBe(1);
    expect(r.error.message).not.toMatch(/position \d+|line \d+ column \d+/);
  });

  it('Firefox や古い V8 の形式からも位置の記述を削る', () => {
    expect(cleanMessage('JSON.parse: expected property name at line 1 column 8 of the JSON data')).toBe(
      'JSON.parse: expected property name',
    );
    expect(cleanMessage('Unexpected token } in JSON at position 7')).toBe('Unexpected token } in JSON');
  });
});

describe('mayChangeNumbers（JSON.rawJSON がないブラウザ向けの警告判定）', () => {
  it('読み込み直すと表記が変わる数値があれば true', () => {
    expect(mayChangeNumbers('{"a":1.0}')).toBe(true);
    expect(mayChangeNumbers('[1e3]')).toBe(true);
    expect(mayChangeNumbers('{"id":12345678901234567890}')).toBe(true);
    expect(mayChangeNumbers('[0.12345678901234567890]')).toBe(true);
  });

  it('表記が変わらない数値だけなら false', () => {
    expect(mayChangeNumbers('{"a":1,"b":-2.5,"c":0,"d":123456789012345}')).toBe(false);
  });

  it('文字列の中の数字は対象にしない', () => {
    expect(mayChangeNumbers('{"v":"1.0","id":"12345678901234567890","e":"a\\"1.0"}')).toBe(false);
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
