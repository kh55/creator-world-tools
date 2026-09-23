import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'char-count',
  title: '文字数カウント',
  description: '文字数・空白を除いた文字数・バイト数（UTF-8 / Shift_JIS）・行数・原稿用紙の枚数をリアルタイムで数えます。',
  category: 'text',
  icon: '🔢',
  keywords: ['文字数', 'カウント', '文字数カウント', 'バイト数', '原稿用紙', '行数', 'レポート', 'counter'],
  order: 1,
};
