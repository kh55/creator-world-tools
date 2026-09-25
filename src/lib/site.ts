export const SITE = {
  name: 'Creator World Tools',
  tagline: 'ブラウザだけで完結する、登録不要の便利ツール集',
  url: 'https://tools.creator-world.net',
} as const;

// すべて任意。未設定なら広告・解析のタグを出力しない
export const env = {
  adsenseClient: import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '',
  slotTool: import.meta.env.PUBLIC_ADSENSE_SLOT_TOOL ?? '',
  slotFooter: import.meta.env.PUBLIC_ADSENSE_SLOT_FOOTER ?? '',
  cfAnalyticsToken: import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '',
  gtmId: import.meta.env.PUBLIC_GTM_ID ?? '',
};
