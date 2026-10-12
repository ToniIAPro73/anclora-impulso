/**
 * Preload (node --require) that records, for the process and its children:
 *  - every attempt to stat/open/read a file whose basename starts with ".env" (paths only, never contents);
 *  - the NAMES (never values) of environment variables added to process.env after startup.
 * Output: appended lines to $ENV_PROBE_LOG. Used by scripts/verify-runner-isolation.sh and the E2E runner.
 */
const fs = require('fs');
const path = require('path');

const LOG = process.env.ENV_PROBE_LOG;
if (LOG) {
  const startKeys = new Set(Object.keys(process.env));
  const seen = new Set();

  const note = (op, target) => {
    try {
      const resolved = path.resolve(String(target));
      if (!/^\.env/.test(path.basename(resolved))) return;
      const key = `${op}\t${resolved}`;
      if (seen.has(key)) return;
      seen.add(key);
      fs.appendFileSync(LOG, `access\t${key}\tpid=${process.pid}\n`);
    } catch { /* never break the host process */ }
  };

  for (const name of ['statSync', 'lstatSync', 'existsSync', 'readFileSync', 'openSync', 'accessSync', 'readFile', 'stat', 'lstat', 'open', 'access']) {
    const original = fs[name];
    if (typeof original !== 'function') continue;
    fs[name] = function patched(target, ...rest) {
      note(name, target);
      return Reflect.apply(original, this, [target, ...rest]);
    };
  }
  for (const name of ['readFile', 'stat', 'lstat', 'open', 'access']) {
    const original = fs.promises && fs.promises[name];
    if (typeof original !== 'function') continue;
    fs.promises[name] = function patched(target, ...rest) {
      note(`promises.${name}`, target);
      return Reflect.apply(original, this, [target, ...rest]);
    };
  }

  let dumped = false;
  const dump = () => {
    if (dumped) return;
    dumped = true;
    try {
      const added = Object.keys(process.env).filter((k) => !startKeys.has(k)).sort();
      fs.appendFileSync(LOG, `env-added\tpid=${process.pid}\t${added.join(',')}\n`);
    } catch { /* ignore */ }
  };
  setTimeout(dump, Number(process.env.ENV_PROBE_DUMP_MS || 15000)).unref();
  process.on('exit', dump);
  process.on('SIGTERM', () => { dump(); process.exit(0); });
}
