import { CATEGORIES, CATEGORY_LABELS, type Category, type ToolMeta } from './tool-meta';

export interface ToolSources {
  /** tools 配下の meta.ts を eager で glob した結果（パス → モジュール） */
  metas: Record<string, { meta?: ToolMeta }>;
  /** Tool.astro のパス一覧 */
  components: string[];
  /** guide.md のパス一覧 */
  guides: string[];
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function folderOf(path: string): string {
  return /\/tools\/([^/]+)\/[^/]+$/.exec(path)?.[1] ?? path;
}

export function compareTools(a: ToolMeta, b: ToolMeta): number {
  const byCategory = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  if (byCategory !== 0) return byCategory;
  const ao = a.order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.title.localeCompare(b.title, 'ja');
}

export function buildRegistry(src: ToolSources): ToolMeta[] {
  const problems: string[] = [];
  const tools: ToolMeta[] = [];
  const seen = new Set<string>();
  const components = new Set(src.components.map(folderOf));
  const guides = new Set(src.guides.map(folderOf));
  const metaFolders = new Set(Object.keys(src.metas).map(folderOf));

  for (const [path, mod] of Object.entries(src.metas)) {
    const folder = folderOf(path);
    const meta = mod.meta;
    if (!meta) {
      problems.push(`${folder}: meta.ts が meta を export していません`);
      continue;
    }
    if (meta.slug !== folder) {
      problems.push(`${folder}: slug "${meta.slug}" がフォルダ名 "${folder}" と一致しません`);
    }
    if (!SLUG_PATTERN.test(meta.slug)) {
      problems.push(`${folder}: slug "${meta.slug}" は英小文字・数字・ハイフンのみ使えます`);
    }
    if (seen.has(meta.slug)) problems.push(`slug "${meta.slug}" が重複しています`);
    if (!(CATEGORIES as readonly string[]).includes(meta.category)) {
      problems.push(`${folder}: カテゴリ "${meta.category}" は未定義です`);
    }
    if (meta.description.length > 120) {
      problems.push(`${folder}: description は 120 字以内にしてください`);
    }
    if (!components.has(folder)) problems.push(`${folder}: Tool.astro がありません`);
    if (!guides.has(folder)) problems.push(`${folder}: guide.md がありません`);
    seen.add(meta.slug);
    tools.push(meta);
  }

  for (const folder of new Set([...components, ...guides])) {
    if (!metaFolders.has(folder)) problems.push(`${folder}: meta.ts がありません`);
  }

  if (problems.length > 0) {
    throw new Error(`ツール登録エラー:\n- ${problems.join('\n- ')}`);
  }
  return tools.sort(compareTools);
}

export function groupByCategory(
  tools: ToolMeta[],
): { category: Category; label: string; tools: ToolMeta[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    tools: tools.filter((t) => t.category === category).sort(compareTools),
  })).filter((g) => g.tools.length > 0);
}
