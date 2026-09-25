import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'jwt-decode',
  title: 'JWT デコード',
  description: 'JWT のヘッダーとペイロードを読みやすく表示し、有効期限（exp）などを日時に変換します。トークンは送信されません。',
  category: 'encode',
  icon: '🎫',
  keywords: ['jwt', 'json web token', 'デコード', 'decode', 'トークン', 'token', 'exp', 'bearer', 'oauth', 'id token'],
  order: 4,
};
