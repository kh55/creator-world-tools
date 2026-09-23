export const CATEGORIES = ['convert', 'format', 'encode', 'text', 'generate'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  convert: '変換',
  format: '整形',
  encode: 'エンコード',
  text: 'テキスト',
  generate: '生成',
};

export interface ToolMeta {
  /** URL: /tools/<slug>/。フォルダ名と一致させる */
  slug: string;
  title: string;
  /** meta description とカードの説明文（120 字以内） */
  description: string;
  category: Category;
  /** 絵文字 1 文字 */
  icon: string;
  /** トップページ検索用 */
  keywords: string[];
  /** カテゴリ内の並び順（昇順、未指定は末尾） */
  order?: number;
}
