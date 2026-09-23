import { err, ok, type Result } from './result';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function checkFileSize(size: number): Result<true> {
  if (size > MAX_FILE_BYTES) {
    return err(`ファイルが大きすぎます（上限 50MB、選択されたファイル ${formatBytes(size)}）`);
  }
  return ok(true);
}

export async function readFileBytes(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBlob(parts: BlobPart[], filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob(parts, { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  // クリック直後に revoke すると一部ブラウザでダウンロードが失敗するため少し待つ
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(
  text: string,
  fallback?: HTMLTextAreaElement | null,
): Promise<'copied' | 'selected'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    fallback?.focus();
    fallback?.select();
    return 'selected';
  }
}
