// src/tools/<slug>/ を自動で収集する。ツールの追加はフォルダを置くだけでよい。
import { buildRegistry } from './registry-core';
import type { ToolMeta } from './tool-meta';

const metas = import.meta.glob<{ meta?: ToolMeta }>('../tools/*/meta.ts', { eager: true });
const components = import.meta.glob('../tools/*/Tool.astro');
const guides = import.meta.glob('../tools/*/guide.md');

export const tools: ToolMeta[] = buildRegistry({
  metas,
  components: Object.keys(components),
  guides: Object.keys(guides),
});
