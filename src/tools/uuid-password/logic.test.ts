import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS,
  CHARSETS,
  generatePassword,
  generatePasswords,
  generateUuids,
  randomInt,
  uuidV4,
  uuidV7,
  type PasswordOptions,
  type RandomFill,
} from './logic';

// テスト用の決定的な乱数（xorshift32）
function seeded(seed = 12345): RandomFill {
  let x = seed;
  return (buf) => {
    for (let i = 0; i < buf.length; i++) {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      buf[i] = x & 0xff;
    }
  };
}
const zeros: RandomFill = (buf) => buf.fill(0);

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUID', () => {
  it('v4 の形式とバージョン・バリアントのビット', () => {
    expect(uuidV4(seeded())).toMatch(V4);
    expect(uuidV4(zeros)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('v7 は先頭 48 ビットにミリ秒のタイムスタンプを入れる', () => {
    expect(uuidV7(0x0123456789ab, zeros)).toBe('01234567-89ab-7000-8000-000000000000');
    expect(uuidV7(Date.now(), seeded())).toMatch(V7);
  });

  it('個数を検査し、v7 は生成順に並べる', () => {
    expect(generateUuids('v4', 0).ok).toBe(false);
    expect(generateUuids('v4', 101).ok).toBe(false);
    const r = generateUuids('v7', 20, seeded(), 1_700_000_000_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toHaveLength(20);
      expect([...r.value].sort()).toEqual(r.value);
    }
    const v4 = generateUuids('v4', 5, seeded());
    expect(v4.ok && new Set(v4.value).size).toBe(5);
  });
});

describe('randomInt', () => {
  it('偏りを避けるため範囲外の値は捨てて引き直す', () => {
    const seq = [0xff, 0xff, 0xff, 0xff, 0, 0, 0, 5];
    let i = 0;
    const scripted: RandomFill = (buf) => {
      for (let j = 0; j < buf.length; j++) buf[j] = seq[i++];
    };
    expect(randomInt(3, scripted)).toBe(2);
    expect(i).toBe(8);
  });
});

const base: PasswordOptions = {
  length: 16,
  upper: true,
  lower: true,
  digits: true,
  symbols: false,
  excludeAmbiguous: false,
};

describe('generatePassword', () => {
  it('指定した長さで、選んだ文字種をすべて含む', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = generatePassword({ ...base, length: 4, symbols: true }, seeded(seed));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.value).toHaveLength(4);
      expect(r.value).toMatch(/[A-Z]/);
      expect(r.value).toMatch(/[a-z]/);
      expect(r.value).toMatch(/[0-9]/);
      expect([...r.value].some((c) => CHARSETS.symbols.includes(c))).toBe(true);
    }
  });

  it('選んでいない文字種は含まない', () => {
    const r = generatePassword({ ...base, upper: false, digits: false, length: 64 }, seeded());
    expect(r.ok && r.value).toMatch(/^[a-z]{64}$/);
  });

  it('紛らわしい文字を除外できる', () => {
    const r = generatePassword({ ...base, length: 128, excludeAmbiguous: true }, seeded(7));
    expect(r.ok).toBe(true);
    if (r.ok) expect([...r.value].filter((c) => AMBIGUOUS.includes(c))).toEqual([]);
  });

  it('長さ・文字種の指定が不正ならエラー', () => {
    expect(generatePassword({ ...base, length: 3 }).ok).toBe(false);
    expect(generatePassword({ ...base, length: 129 }).ok).toBe(false);
    expect(generatePassword({ ...base, length: 8.5 }).ok).toBe(false);
    expect(generatePassword({ ...base, upper: false, lower: false, digits: false }).ok).toBe(false);
  });

  it('複数個をまとめて生成できる', () => {
    const r = generatePasswords(base, 5, seeded());
    expect(r.ok && r.value).toHaveLength(5);
    expect(generatePasswords(base, 21).ok).toBe(false);
  });
});
