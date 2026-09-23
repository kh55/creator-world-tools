import { describe, expect, it } from 'vitest';
import { checkFileSize, formatBytes, MAX_FILE_BYTES, readFileBytes } from './file';

describe('file', () => {
  it('上限は 50MB', () => {
    expect(MAX_FILE_BYTES).toBe(50 * 1024 * 1024);
  });

  it('上限以下は ok、超えたら日本語のエラー', () => {
    expect(checkFileSize(MAX_FILE_BYTES).ok).toBe(true);
    const r = checkFileSize(MAX_FILE_BYTES + 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('50MB');
  });

  it('formatBytes は単位を付ける', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('readFileBytes は Blob の中身を返す', async () => {
    const bytes = await readFileBytes(new Blob([new Uint8Array([1, 2, 3])]));
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });
});
