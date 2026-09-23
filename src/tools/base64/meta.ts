import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'base64',
  title: 'Base64 エンコード・デコード',
  description: 'テキストやファイルを Base64 に変換、または Base64 から元に戻します。URL セーフ形式にも対応。',
  category: 'encode',
  icon: '🔡',
  keywords: ['base64', 'エンコード', 'デコード', 'encode', 'decode', '変換', 'data url', '画像'],
  order: 1,
};
