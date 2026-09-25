import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'text-diff',
  title: 'テキスト差分の比較',
  description: '2 つのテキストの違いを行・単語・文字の単位で色分けして表示します。空白や大文字小文字の違いを無視する設定も可能。',
  category: 'text',
  icon: '🆚',
  keywords: ['差分', 'diff', '比較', '違い', 'テキスト比較', '文章比較', 'compare', '変更点', '校正'],
  order: 2,
};
