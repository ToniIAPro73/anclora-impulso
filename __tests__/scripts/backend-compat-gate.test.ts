/** @jest-environment node */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SCRIPT = resolve(__dirname, '../../scripts/release/check-backend-compat.sh')
let dir: string

const git = (...args: string[]) => {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stdout.trim()
}
const commit = (file: string, body: string) => {
  mkdirSync(join(dir, file, '..'), { recursive: true })
  writeFileSync(join(dir, file), body)
  git('add', '-A')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', body)
  return git('rev-parse', 'HEAD')
}
const gate = (render: string, source: string) =>
  spawnSync('bash', [SCRIPT, render, source], { cwd: dir, encoding: 'utf8' })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'compat-'))
  git('init', '-q')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('check-backend-compat.sh', () => {
  it('passes when only frontend files changed since the Render deploy', () => {
    const render = commit('backend/a.ts', 'a')
    const source = commit('app/page.tsx', 'f')
    expect(gate(render, source).status).toBe(0)
  })

  it('blocks when backend/ changed and Render has not deployed it', () => {
    const render = commit('backend/a.ts', 'a')
    const source = commit('backend/a.ts', 'b')
    const r = gate(render, source)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('PROMOTION_BLOCKED_BACKEND_CONTENT_MISMATCH')
  })

  it('blocks when Render is ahead but backend/ content differs', () => {
    const source = commit('backend/a.ts', 'a')
    const render = commit('backend/a.ts', 'b')
    const r = gate(render, source)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('PROMOTION_BLOCKED_BACKEND_CONTENT_MISMATCH')
  })

  it('passes when Render is ahead but backend/ remains identical', () => {
    const source = commit('backend/a.ts', 'same')
    const render = commit('app/page.tsx', 'frontend')
    expect(gate(render, source).status).toBe(0)
  })

  it('blocks when the Render commit is unknown or malformed', () => {
    const source = commit('backend/a.ts', 'a')
    expect(gate('f'.repeat(40), source).stdout).toContain('BACKEND_COMPAT_UNVERIFIABLE')
    expect(gate('not-a-sha', source).status).toBe(1)
  })

  it('blocks diverged histories whose backend differs', () => {
    const base = commit('backend/a.ts', 'a')
    git('checkout', '-q', '-b', 'other')
    const render = commit('backend/a.ts', 'r')
    git('checkout', '-q', base)
    const source = commit('backend/a.ts', 's')
    const r = gate(render, source)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('PROMOTION_BLOCKED_BACKEND_CONTENT_MISMATCH')
  })
})
