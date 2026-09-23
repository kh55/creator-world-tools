// トップページのツール検索（ブラウザ内で絞り込むだけで、通信はしない）
export function normalizeForSearch(s: string): string {
  return s.normalize('NFKC').toLowerCase();
}

export function searchTextOf(parts: string[]): string {
  return normalizeForSearch(parts.join(' '));
}

export function matchesQuery(haystack: string, query: string): boolean {
  const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
