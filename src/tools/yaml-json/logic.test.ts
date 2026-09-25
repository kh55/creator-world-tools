import { describe, expect, it } from 'vitest';
import { jsonToYaml, yamlToJson } from './logic';

const y2j = (yaml: string, indent: 2 | 4 = 2) => {
  const r = yamlToJson(yaml, { indent });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const j2y = (json: string, indent: 2 | 4 = 2) => {
  const r = jsonToYaml(json, { indent });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('yamlToJson', () => {
  it('YAML を JSON にする', () => {
    expect(y2j('a: 1\nb: [x, y]\nc: true\nd: null')).toBe(
      '{\n  "a": 1,\n  "b": [\n    "x",\n    "y"\n  ],\n  "c": true,\n  "d": null\n}',
    );
  });

  it('インデント 4 に対応', () => {
    expect(y2j('a: 1', 4)).toBe('{\n    "a": 1\n}');
  });

  it('大きな整数の精度を落とさない', () => {
    expect(y2j('id: 12345678901234567890')).toBe('{\n  "id": 12345678901234567890\n}');
  });

  it('日付のような値は文字列のまま（YAML 1.2）', () => {
    expect(y2j('d: 2026-09-25')).toBe('{\n  "d": "2026-09-25"\n}');
  });

  it('--- で区切った複数の文書は配列にする', () => {
    expect(JSON.parse(y2j('a: 1\n---\nb: 2'))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('構文エラーは行・列を返す', () => {
    const r = yamlToJson('a: [1, 2\nb: 3', { indent: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.line).toBe(2);
      expect(r.error.column).toBe(1);
      expect(r.error.message).toContain('YAML の構文エラー');
    }
  });

  it('エイリアスを大量に展開させる入力はエラーにする', () => {
    const bomb = [
      'a: &a [x,x,x,x,x,x,x,x,x]',
      'b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]',
      'c: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]',
      'd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]',
      'e: [*d,*d,*d,*d,*d,*d,*d,*d,*d]',
    ].join('\n');
    const r = yamlToJson(bomb, { indent: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('エイリアス');
  });

  it('空入力はエラー', () => {
    expect(yamlToJson('  \n', { indent: 2 }).ok).toBe(false);
  });
});

describe('jsonToYaml', () => {
  it('JSON を YAML にする', () => {
    expect(j2y('{"a":1,"b":["x",{"c":true}],"d":null}')).toBe('a: 1\nb:\n  - x\n  - c: true\nd: null\n');
  });

  it('インデント 4 に対応', () => {
    expect(j2y('{"a":{"b":1}}', 4)).toBe('a:\n    b: 1\n');
  });

  it('大きな整数の精度を落とさない', () => {
    expect(j2y('{"id":12345678901234567890}')).toBe('id: 12345678901234567890\n');
  });

  it('YAML で特別な意味を持つ文字列は引用符で囲む', () => {
    expect(j2y('{"a":"true","b":"123","c":"x: y"}')).toBe('a: "true"\nb: "123"\nc: "x: y"\n');
  });

  it('JSON の構文エラーは位置付きで返す', () => {
    const r = jsonToYaml('{"a":1,}', { indent: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.line).toBe(1);
  });

  it('YAML → JSON → YAML で元に戻る', () => {
    const yaml = 'name: app\nports:\n  - 80\n  - 443\nenv:\n  DEBUG: "false"\n';
    expect(j2y(y2j(yaml))).toBe(yaml);
  });
});
