import Papa from 'papaparse';
import { isRawNumber, parseJson } from '../../lib/json';
import { err, ok, type Result } from '../../lib/result';

export const DELIMITERS = [',', '\t', ';'] as const;
export type Delimiter = (typeof DELIMITERS)[number];
export const DELIMITER_KEYS = ['comma', 'tab', 'semicolon'] as const;
export type DelimiterKey = (typeof DELIMITER_KEYS)[number];

export function delimiterOf(key: DelimiterKey): Delimiter {
  return DELIMITERS[DELIMITER_KEYS.indexOf(key)];
}

export const DIRECTIONS = ['csv-to-json', 'json-to-csv'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const PREVIEW_ROWS = 100;

export interface Table {
  columns: string[];
  rows: string[][];
  totalRows: number;
}

function tableOf(columns: string[], rows: string[][]): Table {
  return { columns, rows: rows.slice(0, PREVIEW_ROWS), totalRows: rows.length };
}

// 行数が多いと Math.max(...rows) は引数が多すぎてスタックあふれになるため reduce で求める
function maxWidth(rows: unknown[][]): number {
  return rows.reduce((max, r) => Math.max(max, r.length), 0);
}

function numberedColumns(width: number): string[] {
  return Array.from({ length: width }, (_, i) => `列${i + 1}`);
}

export function uniqueKeys(head: string[], width: number): string[] {
  const used = new Set<string>();
  return Array.from({ length: width }, (_, i) => {
    const base = head[i]?.trim() ? head[i] : `列${i + 1}`;
    let key = base;
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
    used.add(key);
    return key;
  });
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (isRawNumber(v)) return v.rawJSON;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function csvToJson(
  csv: string,
  opts: { delimiter: Delimiter; header: boolean },
): Result<{ json: string; table: Table }> {
  const text = csv.replace(/^﻿/, '');
  if (text.trim() === '') return err('入力が空です');
  // ヘッダーの扱い（空・重複・列数不一致）を自前で制御するため、常に配列として読む
  // 完全な空行だけを飛ばす（',' だけの行はすべて空のセルの行として残す）
  const parsed = Papa.parse<string[]>(text, { delimiter: opts.delimiter, skipEmptyLines: true });
  const quoteError = parsed.errors.find((e) => e.type === 'Quotes');
  if (quoteError) {
    return err(`${(quoteError.row ?? 0) + 1} 行目付近で引用符（"）が閉じられていません`);
  }
  const rows = parsed.data;
  const width = maxWidth(rows);

  if (!opts.header) {
    return ok({ json: JSON.stringify(rows, null, 2), table: tableOf(numberedColumns(width), rows) });
  }
  const [head = [], ...body] = rows;
  const keys = uniqueKeys(head, width);
  const objects = body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
  const padded = body.map((r) => keys.map((_, i) => r[i] ?? ''));
  return ok({ json: JSON.stringify(objects, null, 2), table: tableOf(keys, padded) });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !isRawNumber(v);
}

export function jsonToCsv(
  json: string,
  opts: { delimiter: Delimiter },
): Result<{ csv: string; table: Table }> {
  const parsed = parseJson(json);
  if (!parsed.ok) return parsed;
  const v = parsed.value.value;
  const items: unknown[] | null = Array.isArray(v) ? v : isPlainObject(v) ? [v] : null;
  if (!items) return err('JSON は配列（またはオブジェクト）にしてください');
  if (items.length === 0) return err('配列が空です');

  const unparse = { delimiter: opts.delimiter, newline: '\r\n' };
  if (items.every(Array.isArray)) {
    const data = (items as unknown[][]).map((r) => r.map(cellText));
    const width = maxWidth(data);
    return ok({ csv: Papa.unparse(data, unparse), table: tableOf(numberedColumns(width), data) });
  }
  if (items.every(isPlainObject)) {
    const fields: string[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      for (const k of Object.keys(item)) {
        if (!seen.has(k)) {
          seen.add(k);
          fields.push(k);
        }
      }
    }
    const data = items.map((item) => fields.map((f) => cellText(item[f])));
    return ok({ csv: Papa.unparse({ fields, data }, unparse), table: tableOf(fields, data) });
  }
  return err('配列の要素は「すべてオブジェクト」か「すべて配列」にしてください');
}
