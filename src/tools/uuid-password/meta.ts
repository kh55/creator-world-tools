import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'uuid-password',
  title: 'UUID・パスワード生成',
  description: 'UUID（v4 / v7）と安全なランダムパスワードを生成します。長さや文字の種類、紛らわしい文字の除外を指定可能。',
  category: 'generate',
  icon: '🎲',
  keywords: ['uuid', 'guid', 'v4', 'v7', 'パスワード', 'password', '生成', 'ジェネレーター', 'generator', 'ランダム'],
  order: 1,
};
