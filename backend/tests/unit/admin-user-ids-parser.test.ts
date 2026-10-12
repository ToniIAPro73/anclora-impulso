/**
 * Parser of ADMIN_USER_IDS (backend/src/config/env.ts) and the membership decision of isAdminUserId.
 * Pure unit test: no database, no network, no .env* (dotenv is mocked so the module cannot load a file),
 * synthetic UUIDs only. process.env is restored after every case; each case loads the module in isolation.
 */
jest.mock('dotenv', () => ({ __esModule: true, default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const C = '0f0f0f0f-1a2b-4c3d-8e4f-0a1b2c3d4e5f';

const original = { ids: process.env.ADMIN_USER_IDS, emails: process.env.ADMIN_EMAILS };

function load(value: string | undefined, emails?: string) {
  if (value === undefined) delete process.env.ADMIN_USER_IDS;
  else process.env.ADMIN_USER_IDS = value;
  if (emails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = emails;
  let loaded!: { ids: string[]; emails: string[]; isAdmin: (id?: string | null) => boolean };
  jest.isolateModules(() => {
    const { env } = require('../../src/config/env');
    const { isAdminUserId } = require('../../src/middleware/admin');
    loaded = { ids: [...env.adminUserIds], emails: [...env.adminEmails], isAdmin: isAdminUserId };
  });
  return loaded;
}

afterEach(() => {
  if (original.ids === undefined) delete process.env.ADMIN_USER_IDS; else process.env.ADMIN_USER_IDS = original.ids;
  if (original.emails === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = original.emails;
});

describe('ADMIN_USER_IDS parser (current behaviour of env.ts)', () => {
  it('1. a canonical UUID is recognised', () => {
    const r = load(A);
    expect(r.ids).toEqual([A]);
    expect(r.isAdmin(A)).toBe(true);
  });

  it('2. several UUIDs separated by comma are distinct entries', () => {
    const r = load(`${A},${B},${C}`);
    expect(r.ids).toEqual([A, B, C]);
    expect([A, B, C].every((id) => r.isAdmin(id))).toBe(true);
  });

  it('3. spaces around every element are trimmed', () => {
    const r = load(`  ${A} ,\t${B}  , ${C}\t`);
    expect(r.ids).toEqual([A, B, C]);
  });

  it('4. upper-case hexadecimal is lower-cased, and membership is case-insensitive on the candidate id', () => {
    const r = load(B.toUpperCase());
    expect(r.ids).toEqual([B]);
    expect(r.isAdmin(B)).toBe(true);
    expect(r.isAdmin(B.toUpperCase())).toBe(true);
    expect(r.isAdmin(`  ${B} `)).toBe(true); // isAdminUserId trims its argument as well
  });

  it('5. duplicates are NOT de-duplicated in the array, and do not change the authorization decision', () => {
    const r = load(`${A},${A.toUpperCase()},${A}`);
    expect(r.ids).toEqual([A, A, A]); // documented current behaviour
    expect(r.isAdmin(A)).toBe(true);
    expect(r.isAdmin(B)).toBe(false);
  });

  it('6. non-UUID entries are dropped SILENTLY (no error); valid neighbours survive', () => {
    expect(() => load(`not-a-uuid,${A},123,${A.slice(0, -1)},${A}x,,`)).not.toThrow();
    const r = load(`not-a-uuid,${A},123,${A.slice(0, -1)},${A}x,,`);
    expect(r.ids).toEqual([A]);
    expect(r.isAdmin('not-a-uuid')).toBe(false);
  });

  it('6b. a malformed value leaves NOBODY as admin (fail closed)', () => {
    const r = load('this-is-not-a-uuid');
    expect(r.ids).toEqual([]);
    expect(r.isAdmin(A)).toBe(false);
  });

  it('7. an empty (or blank) variable yields an empty list', () => {
    expect(load('').ids).toEqual([]);
    expect(load('   ').ids).toEqual([]);
    expect(load(',,,').ids).toEqual([]);
  });

  it('8. an absent variable yields the default: empty list, nobody is admin', () => {
    const r = load(undefined);
    expect(r.ids).toEqual([]);
    expect(r.isAdmin(A)).toBe(false);
    expect(r.isAdmin(undefined)).toBe(false);
    expect(r.isAdmin(null)).toBe(false);
    expect(r.isAdmin('')).toBe(false);
  });

  it('9. separators other than comma are not accepted (the whole element fails the UUID check)', () => {
    expect(load(`${A};${B}`).ids).toEqual([]);
    expect(load(`${A} ${B}`).ids).toEqual([]);
    expect(load(`${A}\n${B}`).ids).toEqual([]);
    expect(load(`${A}|${B}`).ids).toEqual([]);
    expect(load(`[${A}]`).ids).toEqual([]);
    expect(load(`"${A}"`).ids).toEqual([]);
  });

  it('formats that look like UUIDs but are not canonical are rejected', () => {
    const noHyphens = A.replace(/-/g, '');
    const braces = `{${A}}`;
    const urn = `urn:uuid:${A}`;
    const nonHex = A.replace('1', 'g');
    for (const bad of [noHyphens, braces, urn, nonHex]) {
      expect(load(bad).ids).toEqual([]);
    }
  });

  it('ADMIN_EMAILS grants nothing: no fallback, the legacy list is only parsed', () => {
    const r = load(undefined, 'someone@example.test');
    expect(r.emails).toEqual(['someone@example.test']);
    expect(r.ids).toEqual([]);
    expect(r.isAdmin('someone@example.test')).toBe(false);
    expect(r.isAdmin(A)).toBe(false);
  });

  it('membership is by exact id only (no prefix / substring matching)', () => {
    const r = load(A);
    expect(r.isAdmin(A.slice(0, 8))).toBe(false);
    expect(r.isAdmin(`${A}0`)).toBe(false);
    expect(r.isAdmin(B)).toBe(false);
  });
});
