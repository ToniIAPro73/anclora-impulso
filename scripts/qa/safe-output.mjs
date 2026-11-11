// Shared output guard for QA probes. Every printed string passes through safe(): headers, bearer/refresh/JWT
// shapes, database URLs and the QA password (when loaded) are replaced. Probes print booleans and status codes only.
const PATTERNS = [
  /\b(authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*[^\r\n"']+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g,
  /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  /rt1\.[A-Za-z0-9_-]{10,}/g,
  /postgres(?:ql)?:\/\/[^\s'"@]*@/gi,
];

export function safe(value) {
  let text = value instanceof Error ? `${value.name}: ${value.message}` : String(value ?? '');
  for (const pattern of PATTERNS) text = text.replace(pattern, '[REDACTED]');
  const secret = process.env.QA_PASSWORD;
  if (secret) text = text.split(secret).join('[REDACTED]');
  return text.split('\n')[0].slice(0, 200);
}

export function report(object) {
  console.log(JSON.stringify(object));
}
