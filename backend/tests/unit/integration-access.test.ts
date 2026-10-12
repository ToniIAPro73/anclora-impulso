import { evaluateIntegrationAccess } from '../support/db-target';

const LOCAL = 'postgresql://u:p@127.0.0.1:54329/anclora_impulso_test';

describe('evaluateIntegrationAccess (R6: runner variables are not proof)', () => {
  it('rejects runner variables that point at a remote URL', () => {
    const r = evaluateIntegrationAccess({
      databaseUrl: 'postgresql://u:p@db.example.invalid:54329/anclora_impulso_test',
      scriptPort: '54329',
      scriptName: 'anclora_impulso_test',
    });
    expect(r.allowed).toBe(false);
  });

  it('rejects runner variables that do not match the URL', () => {
    expect(evaluateIntegrationAccess({ databaseUrl: LOCAL, scriptPort: '5432', scriptName: 'anclora_impulso_test' }).allowed).toBe(false);
    expect(evaluateIntegrationAccess({ databaseUrl: LOCAL, scriptPort: '54329', scriptName: 'other' }).allowed).toBe(false);
  });

  it('rejects incomplete runner variables and missing URL', () => {
    expect(evaluateIntegrationAccess({ databaseUrl: LOCAL, scriptPort: '54329' }).allowed).toBe(false);
    expect(evaluateIntegrationAccess({ databaseUrl: undefined, scriptPort: '54329', scriptName: 'x' }).allowed).toBe(false);
  });

  it('accepts matching loopback runner variables', () => {
    expect(evaluateIntegrationAccess({ databaseUrl: LOCAL, scriptPort: '54329', scriptName: 'anclora_impulso_test' }).allowed).toBe(true);
  });

  it('CI flag alone is not enough: needs loopback :5432/impulso_test', () => {
    expect(evaluateIntegrationAccess({ databaseUrl: 'postgresql://u:p@prod.example.invalid:5432/impulso_test', ci: 'true' }).allowed).toBe(false);
    expect(evaluateIntegrationAccess({ databaseUrl: 'postgresql://u:p@127.0.0.1:5432/impulso', ci: 'true' }).allowed).toBe(false);
    expect(evaluateIntegrationAccess({ databaseUrl: 'postgresql://u:p@127.0.0.1:5432/impulso_test', ci: 'true' }).allowed).toBe(true);
  });

  it('denies by default', () => {
    expect(evaluateIntegrationAccess({ databaseUrl: LOCAL }).allowed).toBe(false);
  });

  describe('NF-1: components, not substrings (query/scheme/user)', () => {
    const run = (databaseUrl: string, scriptUser?: string) =>
      evaluateIntegrationAccess({ databaseUrl, scriptPort: '54329', scriptName: 'anclora_impulso_test', scriptUser });

    it('rejects a local-looking tail behind a remote authority', () => {
      expect(run('postgresql://u:p@remote.invalid:5432/other?decoy=@127.0.0.1:54329/anclora_impulso_test').allowed).toBe(false);
      expect(run('postgresql://u:p@remote.invalid:5432/x/@127.0.0.1:54329/anclora_impulso_test').allowed).toBe(false);
    });

    it('rejects parameters that can change the effective destination', () => {
      for (const q of ['host=remote.invalid', 'hostaddr=192.0.2.1', 'port=5432', 'schema=public&host=remote.invalid', '%68ost=remote.invalid', 'schema=public&schema=public', 'schema=other']) {
        expect(run(`${LOCAL}?${q}`).allowed).toBe(false);
      }
      expect(run(`${LOCAL}#@remote.invalid`).allowed).toBe(false);
    });

    it('rejects other schemes and accepts the canonical URL, with or without schema=public', () => {
      expect(run('mysql://u:p@127.0.0.1:54329/anclora_impulso_test').allowed).toBe(false);
      expect(run('postgres://u:p@127.0.0.1:54329/anclora_impulso_test').allowed).toBe(false);
      expect(run(LOCAL).allowed).toBe(true);
      expect(run(`${LOCAL}?schema=public`).allowed).toBe(true);
    });

    it('compares the user when the runner announces it', () => {
      expect(run(LOCAL, 'u').allowed).toBe(true);
      expect(run(LOCAL, 'admin').allowed).toBe(false);
      expect(run('postgresql://u%40x:p@127.0.0.1:54329/anclora_impulso_test', 'u@x').allowed).toBe(true);
    });
  });
});
