import { describe, expect, it } from 'vitest';
import { describeError, err, ok } from './result';

describe('result', () => {
  it('ok は値を包む', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('err は位置情報を任意で持つ', () => {
    expect(err('だめ')).toEqual({ ok: false, error: { message: 'だめ' } });
    expect(err('だめ', { line: 2, column: 3 })).toEqual({
      ok: false,
      error: { message: 'だめ', line: 2, column: 3 },
    });
  });

  it('describeError は位置があれば先頭に付ける', () => {
    expect(describeError({ message: 'x' })).toBe('x');
    expect(describeError({ message: 'x', line: 2, column: 3 })).toBe('2 行 3 列: x');
    expect(describeError({ message: 'x', line: 2 })).toBe('2 行: x');
  });
});
