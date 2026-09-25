import { describe, expect, it } from 'vitest';
import { ALGORITHMS, findMatch, hashBytes, hashText, normalizeHash } from './logic';

// FIPS 180 / RFC 1321 のテストベクトル（"abc"）
const ABC = {
  MD5: '900150983cd24fb0d6963f7d28e17f72',
  'SHA-1': 'a9993e364706816aba3e25717850c26c9cd0d89d',
  'SHA-256': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  'SHA-384':
    'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
  'SHA-512':
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
};

describe('hashText / hashBytes', () => {
  it('5 種類のハッシュをまとめて計算する', async () => {
    expect(await hashText('abc')).toEqual(ABC);
    expect(ALGORITHMS).toEqual(['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']);
  });

  it('テキストは UTF-8 として計算する', async () => {
    const bytes = new TextEncoder().encode('日本語');
    expect(await hashText('日本語')).toEqual(await hashBytes(bytes));
  });

  it('空の入力も計算できる', async () => {
    const r = await hashBytes(new Uint8Array(0));
    expect(r.MD5).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(r['SHA-256']).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('normalizeHash', () => {
  it('大文字・空白・コロン区切りを取り除いて小文字にする', () => {
    expect(normalizeHash('  A9:99:3E  ')).toBe('a9993e');
  });

  it('sha256sum の出力（ハッシュ  ファイル名）から先頭のハッシュだけを取り出す', () => {
    expect(normalizeHash('ba7816bf8f01  app.zip')).toBe('ba7816bf8f01');
  });

  it('16 進数以外を含むなら空にする', () => {
    expect(normalizeHash('xyz')).toBe('');
  });
});

describe('findMatch', () => {
  it('一致したアルゴリズムを返す（大文字でも一致）', () => {
    expect(findMatch(ABC, ABC['SHA-256'].toUpperCase())).toBe('SHA-256');
    expect(findMatch(ABC, ABC.MD5)).toBe('MD5');
  });

  it('一致しなければ null、空なら undefined', () => {
    expect(findMatch(ABC, 'deadbeef')).toBeNull();
    expect(findMatch(ABC, '   ')).toBeUndefined();
  });
});
