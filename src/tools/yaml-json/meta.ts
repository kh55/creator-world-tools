import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'yaml-json',
  title: 'YAML ⇔ JSON 変換',
  description: 'YAML と JSON を相互に変換します。構文エラーの位置表示、複数文書（---）、大きな整数の精度保持に対応。',
  category: 'convert',
  icon: '📐',
  keywords: ['yaml', 'yml', 'json', '変換', 'コンバーター', 'converter', 'docker compose', 'github actions', 'kubernetes', '設定ファイル'],
  order: 2,
};
