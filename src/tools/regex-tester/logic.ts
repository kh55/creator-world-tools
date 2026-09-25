import { err, ok, type Result } from '../../lib/result';

export const FLAG_OPTIONS = ['i', 'm', 's', 'u'] as const;

export interface RegexRequest {
  pattern: string;
  /** FLAG_OPTIONS の組み合わせ（g は常に付ける） */
  flags: string;
  text: string;
  /** 置換文字列。null なら置換しない */
  replacement: string | null;
  maxMatches: number;
}

export interface MatchInfo {
  index: number;
  end: number;
  text: string;
  /** 番号付きグループ（$1, $2 …）。マッチしなかったグループは null */
  groups: (string | null)[];
  named: Record<string, string | null>;
}

export interface RegexResult {
  matches: MatchInfo[];
  total: number;
  truncated: boolean;
  replaced: string | null;
}

// Web Worker の中で実行する（重い正規表現でもタブが固まらないよう、呼び出し側が時間で打ち切る）
export function runRegex(req: RegexRequest): Result<RegexResult> {
  if (req.pattern === '') return err('正規表現を入力してください');
  if (![...req.flags].every((f) => (FLAG_OPTIONS as readonly string[]).includes(f))) {
    return err(`使えないフラグです（使えるのは ${FLAG_OPTIONS.join(' ')}）`);
  }
  let re: RegExp;
  try {
    re = new RegExp(req.pattern, `g${req.flags}`);
  } catch (e) {
    return err(`正規表現の構文エラー: ${e instanceof Error ? e.message : String(e)}`);
  }
  const matches: MatchInfo[] = [];
  let total = 0;
  for (const m of req.text.matchAll(re)) {
    total++;
    if (matches.length >= req.maxMatches) continue;
    const named: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(m.groups ?? {})) named[k] = v ?? null;
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1).map((g) => g ?? null),
      named,
    });
  }
  return ok({
    matches,
    total,
    truncated: total > matches.length,
    replaced: req.replacement === null ? null : req.text.replace(re, req.replacement),
  });
}
