import { describe, expect, it } from 'vitest';
import { cellText, csvToJson, jsonToCsv, uniqueKeys } from './logic';

const c2j = (csv: string, header = true, delimiter: ',' | '\t' | ';' = ',') => {
  const r = csvToJson(csv, { delimiter, header });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const j2c = (json: string, delimiter: ',' | '\t' | ';' = ',') => {
  const r = jsonToCsv(json, { delimiter });
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('csvToJson', () => {
  it('ヘッダー付き CSV をオブジェクトの配列にする（値は文字列）', () => {
    expect(JSON.parse(c2j('name,age\r\n太郎,20\r\n花子,31\r\n').json)).toEqual([
      { name: '太郎', age: '20' },
      { name: '花子', age: '31' },
    ]);
  });

  it('ヘッダーなしなら配列の配列にする', () => {
    expect(JSON.parse(c2j('a,b\nc,d', false).json)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('タブ・セミコロン区切りに対応', () => {
    expect(JSON.parse(c2j('a\tb\n1\t2', true, '\t').json)).toEqual([{ a: '1', b: '2' }]);
    expect(JSON.parse(c2j('a;b\n1;2', true, ';').json)).toEqual([{ a: '1', b: '2' }]);
  });

  it('引用符内のカンマ・改行・二重引用符を扱う', () => {
    expect(JSON.parse(c2j('a,b\n"x,y","1\n2 ""q"""').json)).toEqual([{ a: 'x,y', b: '1\n2 "q"' }]);
  });

  it('先頭の BOM と空行を無視する', () => {
    expect(JSON.parse(c2j('﻿a,b\n\n1,2\n\n').json)).toEqual([{ a: '1', b: '2' }]);
  });

  it('列数が多い行は余った列にも名前を付けて欠落させない', () => {
    expect(JSON.parse(c2j('a,b\n1,2,3\n4').json)).toEqual([
      { a: '1', b: '2', 列3: '3' },
      { a: '4', b: '', 列3: '' },
    ]);
  });

  it('空・重複したヘッダーに一意な名前を付ける', () => {
    expect(JSON.parse(c2j('name,,name\n1,2,3').json)).toEqual([{ name: '1', 列2: '2', name_2: '3' }]);
  });

  it('プレビュー用の表は先頭 100 行まで', () => {
    const csv = ['n', ...Array.from({ length: 150 }, (_, i) => String(i))].join('\n');
    const { table } = c2j(csv);
    expect(table.columns).toEqual(['n']);
    expect(table.rows).toHaveLength(100);
    expect(table.totalRows).toBe(150);
  });

  it('閉じていない引用符はエラー', () => {
    const r = csvToJson('a,b\n"x,1', { delimiter: ',', header: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('引用符');
  });

  it('空入力はエラー', () => {
    expect(csvToJson(' \n', { delimiter: ',', header: true }).ok).toBe(false);
  });
});

describe('jsonToCsv', () => {
  it('オブジェクトの配列はキーの和集合をヘッダーにする', () => {
    expect(j2c('[{"a":1,"b":"x"},{"b":"y","c":true}]').csv).toBe('a,b,c\r\n1,x,\r\n,y,true');
  });

  it('配列の配列はそのまま行にする', () => {
    expect(j2c('[["a","b"],[1,null]]').csv).toBe('a,b\r\n1,');
  });

  it('単独のオブジェクトは 1 行として扱う', () => {
    expect(j2c('{"a":1}').csv).toBe('a\r\n1');
  });

  it('入れ子の値は JSON 文字列にし、必要に応じて引用符で囲む', () => {
    expect(j2c('[{"a":{"x":1},"b":"p,q","c":"say \\"hi\\""}]').csv).toBe(
      'a,b,c\r\n"{""x"":1}","p,q","say ""hi"""',
    );
  });

  it('大きな整数を変えない', () => {
    expect(j2c('[{"id":12345678901234567890}]').csv).toBe('id\r\n12345678901234567890');
  });

  it('区切り文字を指定できる', () => {
    expect(j2c('[{"a":1,"b":2}]', '\t').csv).toBe('a\tb\r\n1\t2');
  });

  it('配列でもオブジェクトでもない・空配列・混在はエラー', () => {
    expect(jsonToCsv('1', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('[]', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('[{"a":1},[1]]', { delimiter: ',' }).ok).toBe(false);
    expect(jsonToCsv('{"a":', { delimiter: ',' }).ok).toBe(false);
  });

  it('CSV → JSON → CSV で元に戻る', () => {
    const csv = 'name,note\r\n太郎,"a,b"\r\n花子,"x\ny"';
    expect(j2c(c2j(csv).json).csv).toBe(csv);
  });
});

describe('helpers', () => {
  it('uniqueKeys は幅に合わせて補完する', () => {
    expect(uniqueKeys(['a', 'a', ''], 4)).toEqual(['a', 'a_2', '列3', '列4']);
  });

  it('cellText は値を文字列にする', () => {
    expect(cellText(null)).toBe('');
    expect(cellText(undefined)).toBe('');
    expect(cellText(false)).toBe('false');
    expect(cellText([1, 2])).toBe('[1,2]');
  });
});
