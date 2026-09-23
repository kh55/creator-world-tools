import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeForSearch, searchTextOf } from './search';

describe('search', () => {
  it('全角英数と大文字を正規化する', () => {
    expect(normalizeForSearch('ＣＳＶ Json')).toBe('csv json');
  });

  it('空のクエリはすべてにマッチ', () => {
    expect(matchesQuery('csv json', '')).toBe(true);
    expect(matchesQuery('csv json', '   ')).toBe(true);
  });

  it('空白区切りの語をすべて含むときだけマッチ（全角空白も区切り）', () => {
    const hay = searchTextOf(['CSV ⇔ JSON 変換', '表データを変換', 'excel']);
    expect(matchesQuery(hay, 'ｃｓｖ')).toBe(true);
    expect(matchesQuery(hay, 'csv　excel')).toBe(true);
    expect(matchesQuery(hay, 'csv yaml')).toBe(false);
  });
});
