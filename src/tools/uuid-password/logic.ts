import { err, ok, type Result } from '../../lib/result';

export type RandomFill = (buf: Uint8Array<ArrayBuffer>) => void;

// 乱数は暗号論的に安全な crypto.getRandomValues だけを使う
export const cryptoRandom: RandomFill = (buf) => {
  crypto.getRandomValues(buf);
};

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function formatUuid(b: Uint8Array): string {
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function uuidV4(rand: RandomFill = cryptoRandom): string {
  const b = new Uint8Array(16);
  rand(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

// RFC 9562: 先頭 48 ビットが Unix ミリ秒、残りがランダム
export function uuidV7(nowMs: number = Date.now(), rand: RandomFill = cryptoRandom): string {
  const b = new Uint8Array(16);
  rand(b);
  let ts = nowMs;
  for (let i = 5; i >= 0; i--) {
    b[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  return formatUuid(b);
}

export const UUID_VERSIONS = ['v4', 'v7'] as const;
export type UuidVersion = (typeof UUID_VERSIONS)[number];
export const COUNT_MIN = 1;
export const UUID_COUNT_MAX = 100;
export const PASSWORD_COUNT_MAX = 20;

function checkCount(count: number, max: number): string | null {
  return Number.isInteger(count) && count >= COUNT_MIN && count <= max
    ? null
    : `個数は ${COUNT_MIN}〜${max} で指定してください`;
}

export function generateUuids(
  version: UuidVersion,
  count: number,
  rand: RandomFill = cryptoRandom,
  nowMs: number = Date.now(),
): Result<string[]> {
  const bad = checkCount(count, UUID_COUNT_MAX);
  if (bad) return err(bad);
  const list = Array.from({ length: count }, () => (version === 'v4' ? uuidV4(rand) : uuidV7(nowMs, rand)));
  // 同じミリ秒内の v7 は並び順が保証されないため、生成順（時刻順）に並べて返す
  return ok(version === 'v7' ? list.sort() : list);
}

export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!#$%&()*+,-./:;<=>?@[]^_{}~',
} as const;
type CharsetKey = keyof typeof CHARSETS;
const CHARSET_KEYS = Object.keys(CHARSETS) as CharsetKey[];

export const AMBIGUOUS = 'Il1O0o|';
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

// 0 以上 n 未満の一様な整数。剰余による偏りを避けるため、範囲外の値は捨てて引き直す
export function randomInt(n: number, rand: RandomFill = cryptoRandom): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint8Array(4);
  for (;;) {
    rand(buf);
    const x = ((buf[0] << 24) >>> 0) + (buf[1] << 16) + (buf[2] << 8) + buf[3];
    if (x < limit) return x % n;
  }
}

export function generatePassword(o: PasswordOptions, rand: RandomFill = cryptoRandom): Result<string> {
  if (!Number.isInteger(o.length) || o.length < PASSWORD_MIN || o.length > PASSWORD_MAX) {
    return err(`長さは ${PASSWORD_MIN}〜${PASSWORD_MAX} で指定してください`);
  }
  const sets = CHARSET_KEYS.filter((k) => o[k]).map((k) =>
    o.excludeAmbiguous ? [...CHARSETS[k]].filter((c) => !AMBIGUOUS.includes(c)).join('') : CHARSETS[k],
  );
  if (sets.length === 0) return err('文字の種類を 1 つ以上選んでください');
  const all = sets.join('');
  // 選んだ文字種を最低 1 文字ずつ含めてから残りを埋め、最後に並びを混ぜる
  const chars = sets.map((s) => s[randomInt(s.length, rand)]);
  while (chars.length < o.length) chars.push(all[randomInt(all.length, rand)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rand);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return ok(chars.join(''));
}

export function generatePasswords(
  o: PasswordOptions,
  count: number,
  rand: RandomFill = cryptoRandom,
): Result<string[]> {
  const bad = checkCount(count, PASSWORD_COUNT_MAX);
  if (bad) return err(bad);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = generatePassword(o, rand);
    if (!r.ok) return r;
    list.push(r.value);
  }
  return ok(list);
}
