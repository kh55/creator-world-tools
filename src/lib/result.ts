export interface ToolError {
  message: string;
  line?: number;
  column?: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ToolError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(
  message: string,
  pos: { line?: number; column?: number } = {},
): { ok: false; error: ToolError } {
  return { ok: false, error: { message, ...pos } };
}

export function describeError(e: ToolError): string {
  if (e.line === undefined) return e.message;
  const where = e.column === undefined ? `${e.line} 行` : `${e.line} 行 ${e.column} 列`;
  return `${where}: ${e.message}`;
}
