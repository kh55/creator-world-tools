import { sjisByteLength } from '../../lib/encoding';

export const MANUSCRIPT_COLS = 20;
export const MANUSCRIPT_ROWS = 20;

export interface CharStats {
  /** 文字数（改行を除く、空白を含む） */
  chars: number;
  /** 空白・改行を除いた文字数 */
  charsNoSpace: number;
  utf8Bytes: number;
  sjisBytes: number;
  /** Shift_JIS で表せない文字の数 */
  sjisUnencodable: number;
  lines: number;
  /** 400 字詰め原稿用紙に書いたときの行数（段落の途中の禁則処理は考慮しない） */
  manuscriptLines: number;
  manuscriptPages: number;
}

let segmenter: Intl.Segmenter | null | undefined;

// 見た目の 1 文字（書記素）単位に分割する。Intl.Segmenter がない古いブラウザではコードポイント単位
export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ja', { granularity: 'grapheme' }) : null;
  }
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

export function countChars(text: string): CharStats {
  const normalized = text.replace(/\r\n?/g, '\n');
  const gs = graphemes(normalized);
  const paragraphs = normalized === '' ? [] : normalized.split('\n');
  const manuscriptLines = paragraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(graphemes(p).length / MANUSCRIPT_COLS)),
    0,
  );
  const sjis = sjisByteLength(normalized);
  return {
    chars: gs.filter((g) => g !== '\n').length,
    charsNoSpace: gs.filter((g) => !/^\s+$/u.test(g)).length,
    utf8Bytes: new TextEncoder().encode(normalized).length,
    sjisBytes: sjis.bytes,
    sjisUnencodable: sjis.unencodable,
    lines: paragraphs.length,
    manuscriptLines,
    manuscriptPages: Math.ceil(manuscriptLines / MANUSCRIPT_ROWS),
  };
}
