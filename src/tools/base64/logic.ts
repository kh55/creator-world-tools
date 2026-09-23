import { err, ok, type Result } from '../../lib/result';

export const MODES = ['encode', 'decode'] as const;
export type Mode = (typeof MODES)[number];

export function bytesToBase64(bytes: Uint8Array, urlSafe: boolean): string {
  let bin = '';
  const CHUNK = 0x8000; // String.fromCharCode の引数が多すぎるとスタックあふれになるため分割する
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const b64 = btoa(bin);
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64;
}

export function textToBase64(text: string, urlSafe: boolean): string {
  return bytesToBase64(new TextEncoder().encode(text), urlSafe);
}

export function base64ToBytes(input: string): Result<Uint8Array<ArrayBuffer>> {
  let s = input
    .trim()
    .replace(/^data:[^,]*;base64,/i, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (s === '') return err('入力が空です');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return err('Base64 として使えない文字が含まれています');
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) return err('Base64 の長さが正しくありません（途中で切れている可能性があります）');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return ok(out);
}

export function bytesToText(bytes: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    // タブ・改行以外の制御文字を含むならバイナリとみなす
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text) ? null : text;
  } catch {
    return null;
  }
}

const SIGNATURES: { bytes: number[]; ext: string; mime: string }[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], ext: 'png', mime: 'image/png' },
  { bytes: [0xff, 0xd8, 0xff], ext: 'jpg', mime: 'image/jpeg' },
  { bytes: [0x47, 0x49, 0x46, 0x38], ext: 'gif', mime: 'image/gif' },
  { bytes: [0x25, 0x50, 0x44, 0x46], ext: 'pdf', mime: 'application/pdf' },
  { bytes: [0x50, 0x4b, 0x03, 0x04], ext: 'zip', mime: 'application/zip' },
];

export function guessFileType(bytes: Uint8Array): { ext: string; mime: string } {
  for (const sig of SIGNATURES) {
    if (sig.bytes.every((b, i) => bytes[i] === b)) return { ext: sig.ext, mime: sig.mime };
  }
  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  if (isWebp) return { ext: 'webp', mime: 'image/webp' };
  return { ext: 'bin', mime: 'application/octet-stream' };
}
