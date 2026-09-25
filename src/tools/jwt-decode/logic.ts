import { isRawNumber, parseJson } from '../../lib/json';
import { err, ok, type Result } from '../../lib/result';
import { base64ToBytes, bytesToText } from '../base64/logic';

export type TimeClaim = 'iat' | 'nbf' | 'exp';

export interface DecodedJwt {
  headerJson: string;
  payloadJson: string;
  signature: string;
  algorithm: string;
  times: { name: TimeClaim; ms: number }[];
}

function decodePart(part: string, label: string): Result<unknown> {
  const bytes = base64ToBytes(part);
  const text = bytes.ok ? bytesToText(bytes.value) : null;
  if (text === null) return err(`${label}を Base64URL として読めません`);
  const parsed = parseJson(text);
  if (!parsed.ok) return err(`${label}が JSON として正しくありません`);
  return ok(parsed.value.value);
}

const asNumber = (v: unknown): number | null =>
  typeof v === 'number' ? v : isRawNumber(v) ? Number(v.rawJSON) : null;

/** JWT（JWS 形式）のヘッダーとペイロードを読む。署名は検証しない */
export function decodeJwt(input: string): Result<DecodedJwt> {
  const token = input.trim().replace(/^Bearer\s+/i, '');
  if (token === '') return err('JWT を入力してください');
  const parts = token.split('.');
  if (parts.length === 5) return err('暗号化された JWT（JWE）は、鍵がないと中身を表示できません');
  if (parts.length !== 3) return err('JWT は「ヘッダー.ペイロード.署名」の 3 つの部分をドットでつないだ形式です');

  const header = decodePart(parts[0], 'ヘッダー');
  if (!header.ok) return header;
  const payload = decodePart(parts[1], 'ペイロード');
  if (!payload.ok) return payload;

  const h = header.value as Record<string, unknown> | null;
  const p = payload.value as Record<string, unknown> | null;
  const times: DecodedJwt['times'] = [];
  if (p !== null && typeof p === 'object') {
    for (const name of ['iat', 'nbf', 'exp'] as const) {
      const n = asNumber(p[name]);
      if (n !== null) times.push({ name, ms: n * 1000 });
    }
  }
  return ok({
    headerJson: JSON.stringify(header.value, null, 2),
    payloadJson: JSON.stringify(payload.value, null, 2),
    signature: parts[2],
    algorithm: h !== null && typeof h === 'object' && typeof h.alg === 'string' ? h.alg : '',
    times,
  });
}

export type TokenStatus = 'valid' | 'expired' | 'not-yet-valid' | 'no-expiry';

export function tokenStatus(times: DecodedJwt['times'], nowMs: number): TokenStatus {
  const exp = times.find((t) => t.name === 'exp');
  const nbf = times.find((t) => t.name === 'nbf');
  if (nbf && nowMs < nbf.ms) return 'not-yet-valid';
  if (exp && nowMs >= exp.ms) return 'expired';
  return exp ? 'valid' : 'no-expiry';
}
