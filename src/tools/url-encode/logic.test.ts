import { describe, expect, it } from 'vitest';
import { decodeComponent, encodeComponent, parseQuery } from './logic';

const value = <T>(r: { ok: true; value: T } | { ok: false; error: { message: string } }) =>
  r.ok ? r.value : `ERR:${r.error.message}`;

describe('encodeComponent', () => {
  it('予約文字と日本語をエンコードする', () => {
    expect(value(encodeComponent('a b&c=あ/?'))).toBe('a%20b%26c%3D%E3%81%82%2F%3F');
  });

  it('対になっていないサロゲートはエラー', () => {
    expect(encodeComponent('\ud800').ok).toBe(false);
  });
});

describe('decodeComponent', () => {
  it('デコードする', () => {
    expect(value(decodeComponent('%E3%81%82%20b', false))).toBe('あ b');
  });

  it('+ を空白として扱うか選べる', () => {
    expect(value(decodeComponent('a+b', false))).toBe('a+b');
    expect(value(decodeComponent('a+b', true))).toBe('a b');
  });

  it('不正なパーセントエンコーディングはエラー', () => {
    expect(decodeComponent('%E3%81', false).ok).toBe(false);
    expect(decodeComponent('%zz', false).ok).toBe(false);
  });
});

describe('parseQuery', () => {
  it('URL のクエリをキーと値に分解する（重複キー・エンコード済みも）', () => {
    expect(parseQuery('https://example.com/p?q=%E3%81%82&tag=a&tag=b+c#top')).toEqual([
      { key: 'q', value: 'あ' },
      { key: 'tag', value: 'a' },
      { key: 'tag', value: 'b c' },
    ]);
  });

  it('クエリ文字列だけでも分解する', () => {
    expect(parseQuery('?a=1&b=')).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '' },
    ]);
    expect(parseQuery('a=1#x')).toEqual([{ key: 'a', value: '1' }]);
  });

  it('クエリがなければ null', () => {
    expect(parseQuery('https://example.com/')).toBeNull();
    expect(parseQuery('ただの文章')).toBeNull();
    expect(parseQuery('')).toBeNull();
  });
});
