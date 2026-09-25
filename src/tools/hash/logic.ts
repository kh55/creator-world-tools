import SparkMD5 from 'spark-md5';

export const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];
export type Hashes = Record<Algorithm, string>;

const SHA = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// SHA 系はブラウザ標準の Web Crypto、MD5 は Web Crypto にないため spark-md5 で計算する
export async function hashBytes(bytes: Uint8Array<ArrayBuffer>): Promise<Hashes> {
  const sha = await Promise.all(SHA.map(async (a) => [a, toHex(await crypto.subtle.digest(a, bytes))] as const));
  const md5 = SparkMD5.ArrayBuffer.hash(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { MD5: md5, ...Object.fromEntries(sha) } as Hashes;
}

export function hashText(text: string): Promise<Hashes> {
  return hashBytes(new TextEncoder().encode(text));
}

// 比較用に期待値を正規化する。sha256sum の「ハッシュ  ファイル名」形式にも対応
export function normalizeHash(input: string): string {
  const first = input.trim().split(/\s+/)[0] ?? '';
  const hex = first.replace(/:/g, '').toLowerCase();
  return /^[0-9a-f]+$/.test(hex) ? hex : '';
}

/** 一致したアルゴリズム。一致なしは null、比較する値がなければ undefined */
export function findMatch(hashes: Hashes, expected: string): Algorithm | null | undefined {
  if (expected.trim() === '') return undefined;
  const target = normalizeHash(expected);
  return ALGORITHMS.find((a) => hashes[a] === target) ?? null;
}
