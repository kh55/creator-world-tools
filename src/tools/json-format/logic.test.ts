import { describe, expect, it } from 'vitest';
import { formatJson, sortKeysDeep, type FormatOptions } from './logic';

const opts = (over: Partial<FormatOptions> = {}): FormatOptions => ({
  mode: 'format',
  indent: '2',
  sortKeys: false,
  ...over,
});

const text = (r: ReturnType<typeof formatJson>) => (r.ok ? r.value.text : r.error.message);

describe('formatJson', () => {
  it('インデント 2 / 4 / タブで整形する', () => {
    expect(text(formatJson('{"a":[1,2]}', opts()))).toBe('{\n  "a": [\n    1,\n    2\n  ]\n}');
    expect(text(formatJson('{"a":1}', opts({ indent: '4' })))).toBe('{\n    "a": 1\n}');
    expect(text(formatJson('{"a":1}', opts({ indent: 'tab' })))).toBe('{\n\t"a": 1\n}');
  });

  it('圧縮する', () => {
    expect(text(formatJson('{\n  "a": [1, 2],\n  "b": "x y"\n}', opts({ mode: 'minify' })))).toBe(
      '{"a":[1,2],"b":"x y"}',
    );
  });

  it('キーを再帰的に並べ替える（配列の順序は保つ）', () => {
    expect(
      text(formatJson('{"b":1,"a":{"d":[{"z":1,"y":2}],"c":0}}', opts({ mode: 'minify', sortKeys: true }))),
    ).toBe('{"a":{"c":0,"d":[{"y":2,"z":1}]},"b":1}');
  });

  it('大きな整数や小数表記を変えない', () => {
    expect(
      text(formatJson('{"id":12345678901234567890,"v":1.0}', opts({ mode: 'minify', sortKeys: true }))),
    ).toBe('{"id":12345678901234567890,"v":1.0}');
  });

  it('__proto__ キーを通常のキーとして扱う', () => {
    expect(text(formatJson('{"__proto__":1,"a":2}', opts({ mode: 'minify', sortKeys: true })))).toBe(
      '{"__proto__":1,"a":2}',
    );
  });

  it('構文エラーは位置付きで返す', () => {
    const r = formatJson('{"a":1,}', opts());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(1);
      expect(r.error.column).toBe(8);
    }
  });
});

describe('sortKeysDeep', () => {
  it('プリミティブはそのまま返す', () => {
    expect(sortKeysDeep(1)).toBe(1);
    expect(sortKeysDeep(null)).toBe(null);
  });
});
