import { describe, expect, it } from 'vitest';
import { formatInZone, parseDateTime, parseTimestamp, relativeTime } from './logic';

const ts = (input: string) => {
  const r = parseTimestamp(input);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const dt = (input: string, tz: string) => {
  const r = parseDateTime(input, tz);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('parseTimestamp', () => {
  it('桁数から秒・ミリ秒・マイクロ秒・ナノ秒を判定する', () => {
    expect(ts('1700000000')).toEqual({ ms: 1700000000000, unit: 'seconds' });
    expect(ts('1700000000000')).toEqual({ ms: 1700000000000, unit: 'milliseconds' });
    expect(ts('1700000000000000')).toEqual({ ms: 1700000000000, unit: 'microseconds' });
    expect(ts('1700000000000000000')).toEqual({ ms: 1700000000000, unit: 'nanoseconds' });
  });

  it('小数・負の値・前後の空白に対応', () => {
    expect(ts(' 1700000000.5 ')).toEqual({ ms: 1700000000500, unit: 'seconds' });
    expect(ts('-1')).toEqual({ ms: -1000, unit: 'seconds' });
  });

  it('数値でない・範囲外はエラー', () => {
    expect(parseTimestamp('abc').ok).toBe(false);
    expect(parseTimestamp('').ok).toBe(false);
    expect(parseTimestamp('9'.repeat(30)).ok).toBe(false);
  });
});

describe('formatInZone', () => {
  it('指定したタイムゾーンの日時と UTC からの時差を返す', () => {
    expect(formatInZone(1700000000000, 'Asia/Tokyo')).toBe('2023-11-15 07:13:20 (+09:00)');
    expect(formatInZone(1700000000000, 'UTC')).toBe('2023-11-14 22:13:20 (+00:00)');
  });

  it('夏時間を反映する', () => {
    expect(formatInZone(1700000000000, 'America/New_York')).toBe('2023-11-14 17:13:20 (-05:00)');
    expect(formatInZone(1690000000000, 'America/New_York')).toBe('2023-07-22 00:26:40 (-04:00)');
  });

  it('1970 年より前も扱える', () => {
    expect(formatInZone(-1000, 'UTC')).toBe('1969-12-31 23:59:59 (+00:00)');
  });
});

describe('parseDateTime', () => {
  it('タイムゾーンの壁時計の時刻として読む', () => {
    expect(dt('2023-11-15 07:13:20', 'Asia/Tokyo')).toBe(1700000000000);
    expect(dt('2023/11/15 07:13:20', 'Asia/Tokyo')).toBe(1700000000000);
    expect(dt('2023-11-14T17:13:20', 'America/New_York')).toBe(1700000000000);
    expect(dt('2023-07-22 00:26:40', 'America/New_York')).toBe(1690000000000);
  });

  it('日付だけならその日の 0 時、秒がなければ 0 秒', () => {
    expect(dt('2023-11-15', 'UTC')).toBe(Date.UTC(2023, 10, 15));
    expect(dt('2023-11-15 07:13', 'Asia/Tokyo')).toBe(1699999980000);
  });

  it('Z や時差が書いてあればそれに従う', () => {
    expect(dt('2023-11-14T22:13:20Z', 'Asia/Tokyo')).toBe(1700000000000);
    expect(dt('2023-11-15T07:13:20+09:00', 'UTC')).toBe(1700000000000);
  });

  it('存在しない日付や読めない形式はエラー', () => {
    expect(parseDateTime('2023-13-01', 'UTC').ok).toBe(false);
    expect(parseDateTime('2023-02-30', 'UTC').ok).toBe(false);
    expect(parseDateTime('きのう', 'UTC').ok).toBe(false);
  });
});

describe('relativeTime', () => {
  it('現在からの相対時間を日本語で返す', () => {
    const now = 1700000000000;
    expect(relativeTime(now - 3 * 86400000, now)).toBe('3 日前');
    expect(relativeTime(now + 2 * 3600000, now)).toBe('2 時間後');
    expect(relativeTime(now - 30 * 1000, now)).toBe('30 秒前');
    expect(relativeTime(now - 400 * 86400000, now)).toBe('1 年前');
  });
});
