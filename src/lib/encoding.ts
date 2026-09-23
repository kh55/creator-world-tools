import { err, ok, type Result } from './result';

export type InputEncoding = 'auto' | 'utf-8' | 'shift_jis';
export const INPUT_ENCODINGS: readonly InputEncoding[] = ['auto', 'utf-8', 'shift_jis'];

export interface Decoded {
  text: string;
  encoding: 'utf-8' | 'shift_jis';
}

// TextDecoder は既定で UTF-8 の BOM を取り除く
export function decodeBytes(bytes: Uint8Array, encoding: InputEncoding): Result<Decoded> {
  if (encoding === 'shift_jis') {
    return ok({ text: new TextDecoder('shift_jis').decode(bytes), encoding: 'shift_jis' });
  }
  try {
    return ok({ text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' });
  } catch {
    if (encoding === 'utf-8') {
      return err('UTF-8 として読み込めませんでした。文字コードに「Shift_JIS」を選んでください');
    }
    try {
      return ok({
        text: new TextDecoder('shift_jis', { fatal: true }).decode(bytes),
        encoding: 'shift_jis',
      });
    } catch {
      return err('文字コードを判定できませんでした（UTF-8 / Shift_JIS 以外の可能性があります）');
    }
  }
}

// Shift_JIS の 2 バイト文字の集合。ブラウザ標準の Shift_JIS デコーダ（WHATWG 準拠、
// NEC/IBM 拡張を含む）で全 2 バイト符号を 1 度だけデコードして作る（約 9,600 文字、数ミリ秒）。
let doubleByteChars: Set<string> | null = null;

function getDoubleByteChars(): Set<string> {
  if (doubleByteChars) return doubleByteChars;
  const set = new Set<string>();
  const decoder = new TextDecoder('shift_jis');
  const pair = new Uint8Array(2);
  for (let lead = 0x81; lead <= 0xfc; lead++) {
    if (lead >= 0xa0 && lead <= 0xdf) continue;
    for (let trail = 0x40; trail <= 0xfc; trail++) {
      if (trail === 0x7f) continue;
      pair[0] = lead;
      pair[1] = trail;
      const s = decoder.decode(pair);
      const cp = s.codePointAt(0) ?? 0;
      const isPrivateUse = cp >= 0xe000 && cp <= 0xf8ff;
      if (s !== '�' && [...s].length === 1 && !isPrivateUse) set.add(s);
    }
  }
  doubleByteChars = set;
  return set;
}

export interface SjisLength {
  bytes: number;
  unencodable: number;
}

export function sjisByteLength(text: string): SjisLength {
  let bytes = 0;
  let unencodable = 0;
  const dbl = getDoubleByteChars();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7f || (cp >= 0xff61 && cp <= 0xff9f)) bytes += 1;
    else if (dbl.has(ch)) bytes += 2;
    else unencodable += 1;
  }
  return { bytes, unencodable };
}
