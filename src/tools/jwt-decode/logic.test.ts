import { describe, expect, it } from 'vitest';
import { textToBase64 } from '../base64/logic';
import { decodeJwt, tokenStatus } from './logic';

const b64url = (obj: unknown) => textToBase64(typeof obj === 'string' ? obj : JSON.stringify(obj), true);
const HEADER = { alg: 'HS256', typ: 'JWT' };
const PAYLOAD = { sub: '123', name: '太郎', iat: 1700000000, exp: 1700003600 };
const TOKEN = `${b64url(HEADER)}.${b64url(PAYLOAD)}.c2lnbmF0dXJl`;

const decode = (t: string) => {
  const r = decodeJwt(t);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('decodeJwt', () => {
  it('ヘッダーとペイロードを整形して返す（日本語も読める）', () => {
    const d = decode(TOKEN);
    expect(JSON.parse(d.headerJson)).toEqual(HEADER);
    expect(d.payloadJson).toBe(JSON.stringify(PAYLOAD, null, 2));
    expect(d.signature).toBe('c2lnbmF0dXJl');
    expect(d.algorithm).toBe('HS256');
  });

  it('exp・iat・nbf をミリ秒で取り出す', () => {
    expect(decode(TOKEN).times).toEqual([
      { name: 'iat', ms: 1700000000000 },
      { name: 'exp', ms: 1700003600000 },
    ]);
  });

  it('先頭の "Bearer " と前後の空白を無視する', () => {
    expect(decode(`  Bearer ${TOKEN}\n`).algorithm).toBe('HS256');
  });

  it('大きな整数のクレームも桁を落とさない', () => {
    const t = `${b64url(HEADER)}.${b64url('{"id":12345678901234567890}')}.x`;
    expect(decode(t).payloadJson).toBe('{\n  "id": 12345678901234567890\n}');
  });

  it('区切りの数が違う・暗号化された JWT・壊れた JSON はエラー', () => {
    expect(decodeJwt('abc').ok).toBe(false);
    const jwe = decodeJwt('a.b.c.d.e');
    expect(!jwe.ok && jwe.error.message).toContain('JWE');
    const bad = decodeJwt(`${b64url(HEADER)}.${b64url('{not json')}.x`);
    expect(!bad.ok && bad.error.message).toContain('ペイロード');
    expect(decodeJwt('').ok).toBe(false);
  });
});

describe('tokenStatus', () => {
  const times = [
    { name: 'nbf' as const, ms: 1000 },
    { name: 'exp' as const, ms: 5000 },
  ];

  it('有効期限と開始時刻を判定する', () => {
    expect(tokenStatus(times, 3000)).toBe('valid');
    expect(tokenStatus(times, 5000)).toBe('expired');
    expect(tokenStatus(times, 500)).toBe('not-yet-valid');
    expect(tokenStatus([], 3000)).toBe('no-expiry');
  });
});
