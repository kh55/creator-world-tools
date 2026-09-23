import { describe, expect, it } from 'vitest';
import { countChars, graphemes } from './logic';

describe('graphemes', () => {
  it('絵文字の結合や濁点の結合文字を 1 文字として数える', () => {
    expect(graphemes('👨‍👩‍👧')).toHaveLength(1);
    expect(graphemes('が')).toHaveLength(1);
    expect(graphemes('🇯🇵')).toHaveLength(1);
  });
});

describe('countChars', () => {
  it('空文字はすべて 0', () => {
    expect(countChars('')).toEqual({
      chars: 0,
      charsNoSpace: 0,
      utf8Bytes: 0,
      sjisBytes: 0,
      sjisUnencodable: 0,
      lines: 0,
      manuscriptLines: 0,
      manuscriptPages: 0,
    });
  });

  it('文字数は改行を含まず、空白は含む', () => {
    const s = countChars('a b　c\nd');
    expect(s.chars).toBe(6);
    expect(s.charsNoSpace).toBe(4);
    expect(s.lines).toBe(2);
  });

  it('CRLF も 1 つの改行として扱う', () => {
    const s = countChars('a\r\nb\rc');
    expect(s.chars).toBe(3);
    expect(s.lines).toBe(3);
  });

  it('バイト数を UTF-8 と Shift_JIS で数える', () => {
    const s = countChars('aあ😀');
    expect(s.utf8Bytes).toBe(1 + 3 + 4);
    expect(s.sjisBytes).toBe(3);
    expect(s.sjisUnencodable).toBe(1);
  });

  it('400 字詰め原稿用紙に換算する（段落ごとに改行）', () => {
    expect(countChars('あ'.repeat(400))).toMatchObject({ manuscriptLines: 20, manuscriptPages: 1 });
    expect(countChars('あ'.repeat(401))).toMatchObject({ manuscriptLines: 21, manuscriptPages: 2 });
    expect(countChars('あ\n\nい')).toMatchObject({ manuscriptLines: 3, manuscriptPages: 1 });
  });
});
