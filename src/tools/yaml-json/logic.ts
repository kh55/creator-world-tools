import { parseAllDocuments, stringify } from 'yaml';
import { isRawNumber, parseJson, toRawJSON } from '../../lib/json';
import { err, ok, type Result } from '../../lib/result';

export const DIRECTIONS = ['yaml-to-json', 'json-to-yaml'] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const INDENTS = ['2', '4'] as const;

export interface ConvertOptions {
  indent: 2 | 4;
}

// 大きな整数の精度を保つため、整数は BigInt として読み、JSON には元の桁のまま出す
function bigintReplacer(_key: string, v: unknown): unknown {
  if (typeof v !== 'bigint') return v;
  return toRawJSON(v.toString()) ?? Number(v);
}

export function yamlToJson(yaml: string, opts: ConvertOptions): Result<string> {
  if (yaml.trim() === '') return err('入力が空です');
  const docs = parseAllDocuments(yaml, { intAsBigInt: true });
  if (docs.length === 0) return err('入力が空です');
  for (const doc of docs) {
    const e = doc.errors[0];
    if (e) {
      const pos = e.linePos?.[0];
      return err(`YAML の構文エラー: ${e.message.split('\n')[0]}`, pos ? { line: pos.line, column: pos.col } : {});
    }
  }
  let values: unknown[];
  try {
    // maxAliasCount でエイリアスの大量展開（Billion Laughs 攻撃）を防ぐ
    values = docs.map((d) => d.toJS({ maxAliasCount: 100 }) as unknown);
  } catch {
    return err('エイリアス（*参照）の展開が多すぎるため変換を中止しました');
  }
  const value = values.length === 1 ? values[0] : values;
  return ok(JSON.stringify(value, bigintReplacer, opts.indent));
}

// parseJson が保持した数値の元の表記を、YAML に出せる値（整数は BigInt）に戻す
function fromRaw(v: unknown): unknown {
  if (isRawNumber(v)) return /^-?\d+$/.test(v.rawJSON) ? BigInt(v.rawJSON) : Number(v.rawJSON);
  if (Array.isArray(v)) return v.map(fromRaw);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromRaw(x)]));
  }
  return v;
}

export function jsonToYaml(json: string, opts: ConvertOptions): Result<string> {
  const parsed = parseJson(json);
  if (!parsed.ok) return parsed;
  return ok(stringify(fromRaw(parsed.value.value), { indent: opts.indent }));
}
