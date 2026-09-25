import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'unix-time',
  title: 'UNIX 時間の変換',
  description: 'UNIX タイムスタンプと日時を相互に変換します。秒・ミリ秒の自動判定、タイムゾーン・夏時間に対応。',
  category: 'convert',
  icon: '🕒',
  keywords: ['unix', 'unixtime', 'unix time', 'タイムスタンプ', 'timestamp', 'epoch', 'エポック秒', '日時', '変換', 'タイムゾーン', 'utc', 'jst'],
  order: 3,
};
