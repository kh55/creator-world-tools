import type { ToolMeta } from '../../lib/tool-meta';

export const meta: ToolMeta = {
  slug: 'hash',
  title: 'ハッシュ計算（SHA-256・MD5）',
  description: '文字列やファイルの MD5・SHA-1・SHA-256・SHA-384・SHA-512 を計算します。期待値と照合してファイルの改ざんを確認できます。',
  category: 'encode',
  icon: '#️⃣',
  keywords: ['ハッシュ', 'hash', 'sha256', 'sha-256', 'sha1', 'sha512', 'md5', 'チェックサム', 'checksum', '改ざん', 'ダイジェスト'],
  order: 3,
};
