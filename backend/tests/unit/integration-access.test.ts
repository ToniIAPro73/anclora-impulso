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
});
