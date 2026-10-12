/** Redacts secrets/credentials from diagnostic text. Used by the failure reporter. */
const RULES = [
  [/postgres(?:ql)?:\/\/[^\s'"@]*@/gi, 'postgresql://***@'],
  [/Bearer\s+[A-Za-z0-9._~+\/-]+=*/g, 'Bearer ***'],
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g, '[jwt]'],
  [/rt1\.[A-Za-z0-9_-]{10,}/g, 'rt1.[refresh]'],
  [/("?(?:password|passwordHash|refreshToken|accessToken|authorization|secret|apiKey|token)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi, '$1"[REDACTED]"'],
  [/\b[0-9a-f]{40,}\b/gi, '[hex]'],
];

function sanitize(text) {
  if (typeof text !== 'string') return text;
  return RULES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

module.exports = { sanitize };
