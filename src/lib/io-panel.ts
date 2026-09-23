// 入力（貼り付け / ドラッグ&ドロップ / ファイル選択）→ ツールの処理 → 出力（コピー / ダウンロード）の共通部品
import { decodeBytes } from './encoding';
import { checkFileSize, copyText, downloadBlob, readFileBytes } from './file';

export const AUTO_RUN_MAX_CHARS = 1_000_000;
const DEBOUNCE_MS = 250;

export interface DownloadSpec {
  filename: string;
  mime: string;
  data: BlobPart[];
}

export interface IOPanelOptions {
  /** 入力を処理する。空入力では runOnEmpty が true のときだけ呼ばれる */
  run(input: string): void;
  /** ファイルを独自に読む場合に指定。入力欄に入れる文字列を返す。null なら入力欄を変えず run もしない */
  readFile?(file: File, bytes: Uint8Array<ArrayBuffer>): string | null | Promise<string | null>;
  runOnEmpty?: boolean;
}

export interface IOPanel {
  readonly input: HTMLTextAreaElement;
  readonly output: HTMLTextAreaElement | null;
  setOutput(text: string, download?: DownloadSpec, opts?: { copyable?: boolean }): void;
  setError(message: string): void;
  setInfo(message: string): void;
  clearMessages(): void;
  rerun(): void;
}

export function bindIOPanel(root: HTMLElement, options: IOPanelOptions): IOPanel {
  const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const input = q<HTMLTextAreaElement>('[data-input]')!;
  const fileInput = q<HTMLInputElement>('[data-file]')!;
  const drop = q<HTMLElement>('[data-drop]')!;
  const runBtn = q<HTMLButtonElement>('[data-run]')!;
  const clearBtn = q<HTMLButtonElement>('[data-clear]')!;
  const msg = q<HTMLElement>('[data-msg]')!;
  const output = q<HTMLTextAreaElement>('[data-output]');
  const copyBtn = q<HTMLButtonElement>('[data-copy]');
  const downloadBtn = q<HTMLButtonElement>('[data-download]');
  let download: DownloadSpec | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const panel: IOPanel = {
    input,
    output,
    setOutput(text, dl, opts = {}) {
      panel.clearMessages();
      if (output) output.value = text;
      download = dl;
      if (copyBtn) copyBtn.disabled = text === '' || opts.copyable === false;
      if (downloadBtn) downloadBtn.disabled = !dl;
    },
    setError(message) {
      panel.setOutput('');
      msg.textContent = message;
      msg.className = 'msg msg-error';
    },
    setInfo(message) {
      msg.textContent = message;
      msg.className = 'msg msg-info';
    },
    clearMessages() {
      msg.textContent = '';
      msg.className = 'msg';
    },
    rerun() {
      runNow();
    },
  };

  // 想定外の例外でも古い出力を残さず、エラーとして表示する
  function fail(e: unknown) {
    console.error(e);
    panel.setError('処理中にエラーが発生しました。入力を小さくして試してください');
  }

  function runNow() {
    clearTimeout(timer);
    if (input.value.trim() === '' && !options.runOnEmpty) {
      panel.setOutput('');
      return;
    }
    try {
      options.run(input.value);
    } catch (e) {
      fail(e);
    }
  }

  function scheduleRun() {
    clearTimeout(timer);
    if (input.value.length > AUTO_RUN_MAX_CHARS) {
      panel.setInfo(`入力が大きいため自動${runBtn.textContent}を止めています。「${runBtn.textContent}」を押してください`);
      return;
    }
    timer = setTimeout(runNow, DEBOUNCE_MS);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const size = checkFileSize(file.size);
    if (!size.ok) {
      panel.setError(size.error.message);
      return;
    }
    let text: string | null;
    try {
      const bytes = await readFileBytes(file);
      if (options.readFile) {
        text = await options.readFile(file, bytes);
      } else {
        const decoded = decodeBytes(bytes, 'auto');
        if (!decoded.ok) {
          panel.setError(decoded.error.message);
          return;
        }
        text = decoded.value.text;
      }
    } catch (e) {
      fail(e);
      return;
    }
    if (text === null) return;
    input.value = text;
    runNow();
  }

  input.addEventListener('input', scheduleRun);
  runBtn.addEventListener('click', runNow);
  clearBtn.addEventListener('click', () => {
    input.value = '';
    fileInput.value = '';
    runNow();
  });
  fileInput.addEventListener('change', () => {
    void handleFile(fileInput.files?.[0]);
    fileInput.value = '';
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragging');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragging');
    void handleFile(e.dataTransfer?.files[0]);
  });
  copyBtn?.addEventListener('click', async () => {
    const result = await copyText(output?.value ?? '', output);
    panel.setInfo(
      result === 'copied'
        ? 'コピーしました'
        : '出力を選択しました。Ctrl+C（Mac は ⌘C）でコピーしてください',
    );
  });
  downloadBtn?.addEventListener('click', () => {
    if (download) downloadBlob(download.data, download.filename, download.mime);
  });

  return panel;
}
