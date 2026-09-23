import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRecent,
  pushRecent,
  RECENT_MAX,
  readBool,
  readChoice,
  readInt,
  readRaw,
  toolKey,
  write,
} from './storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

class BrokenStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem() {
    throw new Error('QuotaExceededError');
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage', () => {
  it('cwt: プレフィックス付きの JSON で読み書きする', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    write('a', { x: 1 });
    expect(mem.getItem('cwt:a')).toBe('{"x":1}');
    expect(readRaw('a')).toEqual({ x: 1 });
  });

  it('toolKey はツール名前空間を作る', () => {
    expect(toolKey('csv-json', 'delimiter')).toBe('tool:csv-json:delimiter');
  });

  it('readChoice は許可された値だけを返し、それ以外は既定値', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:c', '"tab"');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('tab');
    mem.setItem('cwt:c', '"pipe"');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('comma');
    mem.setItem('cwt:c', '{壊れた JSON');
    expect(readChoice('c', ['comma', 'tab'] as const, 'comma')).toBe('comma');
  });

  it('readBool / readInt は型と範囲を検査する', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:b', 'true');
    expect(readBool('b', false)).toBe(true);
    mem.setItem('cwt:b', '"yes"');
    expect(readBool('b', false)).toBe(false);
    mem.setItem('cwt:n', '16');
    expect(readInt('n', 8, 4, 128)).toBe(16);
    mem.setItem('cwt:n', '999');
    expect(readInt('n', 8, 4, 128)).toBe(8);
    mem.setItem('cwt:n', '1.5');
    expect(readInt('n', 8, 4, 128)).toBe(8);
  });

  it('ストレージが例外を投げても既定値で動く', () => {
    vi.stubGlobal('localStorage', new BrokenStorage());
    expect(() => write('a', 1)).not.toThrow();
    expect(readChoice('c', ['a', 'b'] as const, 'a')).toBe('a');
    expect(getRecent()).toEqual([]);
    expect(pushRecent('x')).toEqual(['x']);
  });

  it('localStorage が存在しなくても動く', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(readBool('b', true)).toBe(true);
    expect(() => write('a', 1)).not.toThrow();
  });

  it('pushRecent は重複を除いて先頭に追加し、最大件数で切る', () => {
    vi.stubGlobal('localStorage', new MemoryStorage());
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) pushRecent(s);
    expect(getRecent()).toEqual(['g', 'f', 'e', 'd', 'c', 'b']);
    expect(getRecent()).toHaveLength(RECENT_MAX);
    pushRecent('d');
    expect(getRecent()).toEqual(['d', 'g', 'f', 'e', 'c', 'b']);
  });

  it('getRecent は文字列以外を捨てる', () => {
    const mem = new MemoryStorage();
    vi.stubGlobal('localStorage', mem);
    mem.setItem('cwt:recent', '["a", 1, null, "b"]');
    expect(getRecent()).toEqual(['a', 'b']);
  });
});
