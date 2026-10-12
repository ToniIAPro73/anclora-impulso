const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|^code$|code[-_]?verifier|verifier|handoff|credential|avatardataurl/i;
const MAX_DEPTH = 6;

/** Deep-copies a value replacing the content of sensitive keys; safe for logging. Never mutates the input. */
export function redactSensitive(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_DEPTH) {
    return '[truncated]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactSensitive(inner, depth + 1);
  }
  return out;
}

/** Removes the query string: query values (OAuth codes, tokens) must not reach logs. */
export function stripQueryString(url: string | undefined): string {
  if (!url) return '';
  const index = url.indexOf('?');
  return index === -1 ? url : `${url.slice(0, index)}?[query-redacted]`;
}

const SECRET_PARAMS = 'code|state|token|access_token|refresh_token|id_token|accessToken|refreshToken|client_secret|clientSecret|password|secret|api_key|apikey|key|authorization|code_verifier|verifier|codeVerifier|handoffCode';

/**
 * Best-effort redaction of secrets inside FREE TEXT (error messages, stacks, URLs). It complements, and does not
 * replace, structural redaction of objects: arbitrary prose can always hold something the patterns do not know.
 */
export function redactText(text: string | undefined | null): string {
  if (!text) return text ?? '';
  return text
    .replace(new RegExp(`([?&;]\\s*(?:${SECRET_PARAMS})=)[^&\\s"'<>]+`, 'gi'), '$1[REDACTED]')
    .replace(new RegExp(`((?:${SECRET_PARAMS})["']?\\s*[:=]\\s*["']?)[A-Za-z0-9._~+/=-]{8,}`, 'gi'), '$1[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[jwt]')
    .replace(/rt1\.[A-Za-z0-9_-]{10,}/g, 'rt1.[REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"@]*@/gi, 'postgresql://[REDACTED]@');
}
