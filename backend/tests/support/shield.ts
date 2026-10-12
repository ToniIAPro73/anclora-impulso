import fs from 'fs';
import path from 'path';

/**
 * Names of every environment variable the backend reads, mapped to ''. Spawned server processes get this so
 * Prisma's client loader cannot merge backend/.env into their environment (it only fills UNDEFINED keys).
 */
export function shieldEnv(): Record<string, string> {
  const backend = path.resolve(__dirname, '../..');
  const names = new Set<string>(['GROQ_API_KEY', 'OPENAI_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']);

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        for (const m of fs.readFileSync(full, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) names.add(m[1]);
      }
    }
  };
  walk(path.join(backend, 'src'));

  const example = path.join(backend, '.env.example');
  if (fs.existsSync(example)) {
    for (const m of fs.readFileSync(example, 'utf8').matchAll(/^[#\s]*([A-Z][A-Z0-9_]+)=/gm)) names.add(m[1]);
  }

  for (const keep of ['NODE_ENV', 'PATH', 'HOME', 'PORT']) names.delete(keep);
  return Object.fromEntries([...names].map((n) => [n, '']));
}
