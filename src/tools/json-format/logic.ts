import { isRawNumber, parseJson } from '../../lib/json';
import { ok, type Result } from '../../lib/result';

export const MODES = ['format', 'minify'] as const;
export type Mode = (typeof MODES)[number];
export const INDENTS = ['2', '4', 'tab'] as const;
export type Indent = (typeof INDENTS)[number];

export interface FormatOptions {
  mode: Mode;
  indent: Indent;
  sortKeys: boolean;
}

export interface Formatted {
  text: string;
  precisionWarning: boolean;
}

export function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (v !== null && typeof v === 'object' && !isRawNumber(v)) {
    // null プロトタイプにして "__proto__" キーも通常のプロパティとして保持する
    const out = Object.create(null) as Record<string, unknown>;
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

export function formatJson(text: string, opts: FormatOptions): Result<Formatted> {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const value = opts.sortKeys ? sortKeysDeep(parsed.value.value) : parsed.value.value;
  const space = opts.mode === 'minify' ? undefined : opts.indent === 'tab' ? '\t' : Number(opts.indent);
  return ok({ text: JSON.stringify(value, null, space), precisionWarning: parsed.value.precisionWarning });
}
