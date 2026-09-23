import { describe, expect, it } from 'vitest';
import { decodeBytes, sjisByteLength } from './encoding';

const utf8 = (s: string) => new TextEncoder().encode(s);
// 「名前,年齢\r\n太郎,20\r\n」の Shift_JIS バイト列
const SJIS_CSV = new Uint8Array([
  0x96, 0xbc, 0x91, 0x4f, 0x2c, 0x94, 0x4e, 0x97, 0xee, 0x0d, 0x0a, 0x91, 0xbe, 0x98, 0x59, 0x2c,
  0x32, 0x30, 0x0d, 0x0a,
]);

describe('decodeBytes', () => {
  it('auto: UTF-8 として読めれば UTF-8', () => {
    expect(decodeBytes(utf8('あいう'), 'auto')).toEqual({
      ok: true,
      value: { text: 'あいう', encoding: 'utf-8' },
    });
  });

  it('auto: UTF-8 で読めなければ Shift_JIS', () => {
    expect(decodeBytes(SJIS_CSV, 'auto')).toEqual({
      ok: true,
      value: { text: '名前,年齢\r\n太郎,20\r\n', encoding: 'shift_jis' },
    });
  });

  it('UTF-8 の BOM を取り除く', () => {
    const r = decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]), 'auto');
    expect(r.ok && r.value.text).toBe('a');
  });

  it('utf-8 指定で UTF-8 として不正ならエラー', () => {
    const r = decodeBytes(SJIS_CSV, 'utf-8');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('Shift_JIS');
  });

  it('shift_jis 指定なら Shift_JIS で読む', () => {
    const r = decodeBytes(SJIS_CSV, 'shift_jis');
    expect(r.ok && r.value.text).toBe('名前,年齢\r\n太郎,20\r\n');
  });

  it('auto でどちらでも読めなければエラー', () => {
    expect(decodeBytes(new Uint8Array([0xff, 0xff]), 'auto').ok).toBe(false);
  });
});

describe('sjisByteLength', () => {
  it('ASCII と半角カナは 1 バイト', () => {
    expect(sjisByteLength('abc\n')).toEqual({ bytes: 4, unencodable: 0 });
    expect(sjisByteLength('ｱｲｳ')).toEqual({ bytes: 3, unencodable: 0 });
  });

  it('全角文字（NEC 特殊文字を含む）は 2 バイト', () => {
    expect(sjisByteLength('あ漢①')).toEqual({ bytes: 6, unencodable: 0 });
  });

  it('Shift_JIS で表せない文字は件数を別に数える', () => {
    expect(sjisByteLength('a😀あ')).toEqual({ bytes: 3, unencodable: 1 });
  });

  it('空文字は 0', () => {
    expect(sjisByteLength('')).toEqual({ bytes: 0, unencodable: 0 });
  });
});
