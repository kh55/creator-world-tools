import { err, ok, type Result } from '../../lib/result';

export type Unit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

export const UNIT_LABELS: Record<Unit, string> = {
  seconds: '秒',
  milliseconds: 'ミリ秒',
  microseconds: 'マイクロ秒',
  nanoseconds: 'ナノ秒',
};

// Date が扱える範囲（±1 億日）
const MAX_MS = 8.64e15;

// 桁数で単位を判定する（1e11 秒 ≒ 西暦 5138 年までを秒とみなす）
export function parseTimestamp(input: string): Result<{ ms: number; unit: Unit }> {
  const s = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return err('数値（UNIX タイムスタンプ）を入力してください');
  const n = Number(s);
  const abs = Math.abs(n);
  const [unit, ms]: [Unit, number] =
    abs < 1e11
      ? ['seconds', n * 1000]
      : abs < 1e14
        ? ['milliseconds', n]
        : abs < 1e17
          ? ['microseconds', n / 1e3]
          : ['nanoseconds', n / 1e6];
  if (Math.abs(ms) > MAX_MS) return err('扱える範囲を超えています');
  return ok({ ms: Math.round(ms), unit });
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(ms: number, timeZone: string): WallClock {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
      era: 'short',
    });
    formatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(ms).map((p) => [p.type, p.value]));
  const year = Number(parts.year);
  return {
    year: parts.era === 'BC' ? 1 - year : year,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** そのタイムゾーンの UTC からの時差（ミリ秒） */
function offsetMs(ms: number, timeZone: string): number {
  const w = wallClock(ms, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

export function formatOffset(offset: number): string {
  const minutes = Math.round(offset / 60000);
  return `${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
}

export function formatInZone(ms: number, timeZone: string): string {
  const w = wallClock(ms, timeZone);
  const date = `${w.year < 0 ? '-' : ''}${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
  const time = `${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
  return `${date} ${time} (${formatOffset(offsetMs(ms, timeZone))})`;
}

const LOCAL_PATTERN =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/;
const WITH_OFFSET = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;

/** 日時の文字列を UNIX ミリ秒にする。時差の指定がなければ timeZone の壁時計の時刻として読む */
export function parseDateTime(input: string, timeZone: string): Result<number> {
  const s = input.trim();
  if (WITH_OFFSET.test(s)) {
    const ms = Date.parse(s.replace(' ', 'T'));
    return Number.isNaN(ms) ? err('日時として読めません') : ok(ms);
  }
  const m = LOCAL_PATTERN.exec(s);
  if (!m) return err('「2026-09-25 12:34:56」のような形式で入力してください');
  const [year, month, day, hour = 0, minute = 0, second = 0] = m.slice(1, 7).map((v) => Number(v ?? 0));
  const millis = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const check = new Date(wall);
  const valid =
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day &&
    check.getUTCHours() === hour &&
    check.getUTCMinutes() === minute &&
    check.getUTCSeconds() === second;
  if (!valid) return err('存在しない日時です');
  // 時差は時刻によって変わる（夏時間）ため、2 回求めて合わせる
  const guess = wall - offsetMs(wall, timeZone);
  return ok(wall - offsetMs(guess, timeZone));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400000],
  ['month', 30 * 86400000],
  ['day', 86400000],
  ['hour', 3600000],
  ['minute', 60000],
  ['second', 1000],
];

const relativeFormat = new Intl.RelativeTimeFormat('ja', { numeric: 'always' });

export function relativeTime(ms: number, nowMs: number): string {
  const diff = ms - nowMs;
  const [unit, size] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? UNITS[UNITS.length - 1];
  return relativeFormat.format(Math.round(diff / size), unit);
}

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
