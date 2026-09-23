// localStorage のラッパー。保存するのは設定値と「最近使ったツール」だけで、入力データは保存しない。
// プライベートモード等でストレージが使えない場合は、保存せず既定値で動く。
const PREFIX = 'cwt:';

function getStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' || localStorage === null ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): unknown {
  const store = getStore();
  if (!store) return undefined;
  try {
    const raw = store.getItem(PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function write(key: string, value: unknown): void {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // 容量超過・無効化時は保存しない
  }
}

export function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const v = readRaw(key);
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function readBool(key: string, fallback: boolean): boolean {
  const v = readRaw(key);
  return typeof v === 'boolean' ? v : fallback;
}

export function readInt(key: string, fallback: number, min: number, max: number): number {
  const v = readRaw(key);
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
}

export function toolKey(slug: string, name: string): string {
  return `tool:${slug}:${name}`;
}

const RECENT_KEY = 'recent';
export const RECENT_MAX = 6;

export function getRecent(): string[] {
  const v = readRaw(RECENT_KEY);
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === 'string').slice(0, RECENT_MAX);
}

export function pushRecent(slug: string): string[] {
  const next = [slug, ...getRecent().filter((s) => s !== slug)].slice(0, RECENT_MAX);
  write(RECENT_KEY, next);
  return next;
}
