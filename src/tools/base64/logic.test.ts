import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToText, guessFileType, textToBase64 } from './logic';

const decodeText = (s: string) => {
  const r = base64ToBytes(s);
  if (!r.ok) throw new Error(r.error.message);
  return bytesToText(r.value);
};

describe('encode', () => {
  it('UTF-8 テキストをエンコードする', () => {
    expect(textToBase64('hello', false)).toBe('aGVsbG8=');
    expect(textToBase64('あ', false)).toBe('44GC');
  });

  it('URL セーフ形式は +/ を -_ にし、パディングを除く', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbf]);
    expect(bytesToBase64(bytes, false)).toBe('+/+/');
    expect(bytesToBase64(bytes, true)).toBe('-_-_');
    expect(textToBase64('a', true)).toBe('YQ');
  });
});

describe('decode', () => {
  it('標準形式・改行や空白を含む入力を読む', () => {
    expect(decodeText('aGVs\nbG8=')).toBe('hello');
    expect(decodeText('  44GC  ')).toBe('あ');
  });

  it('URL セーフ形式・パディングなしを読む', () => {
    expect(decodeText('YQ')).toBe('a');
    const r = base64ToBytes('-_-_');
    expect(r.ok && Array.from(r.value)).toEqual([0xfb, 0xff, 0xbf]);
  });

  it('data URL の接頭辞を取り除く', () => {
    expect(decodeText('data:text/plain;base64,aGVsbG8=')).toBe('hello');
  });

  it('不正な文字・長さはエラー', () => {
    expect(base64ToBytes('abc$').ok).toBe(false);
    expect(base64ToBytes('abcde').ok).toBe(false);
    expect(base64ToBytes('').ok).toBe(false);
  });

  it('大きなデータを往復できる', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    const r = base64ToBytes(bytesToBase64(bytes, false));
    expect(r.ok && r.value).toEqual(bytes);
  });
});

describe('bytesToText', () => {
  it('UTF-8 テキストでなければ null', () => {
    expect(bytesToText(new Uint8Array([0xff, 0xfe, 0x00]))).toBeNull();
    expect(bytesToText(new Uint8Array([0x61, 0x00, 0x62]))).toBeNull();
    expect(bytesToText(new TextEncoder().encode('ok\n\tタブ'))).toBe('ok\n\tタブ');
  });
});

describe('guessFileType', () => {
  it('先頭のバイトから種類を推定する', () => {
    expect(guessFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toEqual({ ext: 'png', mime: 'image/png' });
    expect(guessFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
    expect(guessFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toEqual({ ext: 'pdf', mime: 'application/pdf' });
    expect(guessFileType(new Uint8Array([1, 2, 3]))).toEqual({ ext: 'bin', mime: 'application/octet-stream' });
  });
});
