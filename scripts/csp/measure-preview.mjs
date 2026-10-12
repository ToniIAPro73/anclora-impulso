#!/usr/bin/env node
/**
 * Measures a protected Vercel PREVIEW for the CSP P2 decision (B1-F2): response time and nonce stamping of public pages.
 * Read-only GETs; no credentials of the application are used. Access to the protected preview uses a short-lived OIDC
 * token minted with the caller's own Vercel CLI session (never printed, never written).
 *
 *   node scripts/csp/measure-preview.mjs <preview-origin> [--samples=10] [--label=name] [--out=file.json]
 *
 * Output per page: TTFB and total time (median / p90 / max, ms), number of <script> tags with and without nonce, and whether
 * the nonce in the HTML equals the nonce announced in the Report-Only header.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const PROJECT = process.env.VERCEL_PROJECT ?? "anclora-impulso";
const SCOPE = process.env.VERCEL_SCOPE ?? "pmi140979-6354s-projects";
const PAGES = ["/", "/landing", "/auth/login", "/legal", "/privacy", "/terms"];

const args = process.argv.slice(2);
const origin = args.find((a) => /^https:\/\//.test(a));
const opt = (name, d) => (args.find((a) => a.startsWith(`--${name}=`)) ?? "").slice(name.length + 3) || d;
const samples = Number(opt("samples", "10"));
const label = opt("label", "preview");
const out = opt("out", "");

if (!origin || !/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) {
  console.error("usage: measure-preview.mjs https://<preview>.vercel.app [--samples=N] [--label=x] [--out=file]");
  process.exit(2);
}
if (!Number.isInteger(samples) || samples < 3 || samples > 30) {
  console.error("samples must be between 3 and 30");
  process.exit(2);
}

const token = execFileSync("vc", ["project", "token", PROJECT, "--scope", SCOPE], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
if (!token) {
  console.error("could not mint a Vercel token (is the CLI authenticated?)");
  process.exit(1);
}
const headers = { "x-vercel-trusted-oidc-idp-token": token, "cache-control": "no-cache" };

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]);
};

async function once(path) {
  const t0 = performance.now();
  const res = await fetch(origin + path, { headers, redirect: "manual" });
  const ttfb = performance.now() - t0;
  const html = await res.text();
  const total = performance.now() - t0;
  return { status: res.status, ttfb, total, html, ro: res.headers.get("content-security-policy-report-only") ?? "", cache: res.headers.get("x-vercel-cache") ?? "" };
}

const results = [];
for (const path of PAGES) {
  await once(path); // warm-up (not counted)
  const runs = [];
  for (let i = 0; i < samples; i += 1) runs.push(await once(path));
  const last = runs[runs.length - 1];
  const scripts = last.html.match(/<script\b[^>]*>/gi) ?? [];
  const withNonce = scripts.filter((s) => /\snonce="/i.test(s)).length;
  const announced = /'nonce-([^']+)'/.exec(last.ro)?.[1] ?? null;
  const inHtml = [...last.html.matchAll(/\snonce="([^"]+)"/gi)].map((m) => m[1]);
  results.push({
    path,
    status: last.status,
    ttfbMs: { median: pct(runs.map((r) => r.ttfb), 50), p90: pct(runs.map((r) => r.ttfb), 90), max: pct(runs.map((r) => r.ttfb), 100) },
    totalMs: { median: pct(runs.map((r) => r.total), 50), p90: pct(runs.map((r) => r.total), 90) },
    scriptTags: scripts.length,
    withNonce,
    withoutNonce: scripts.length - withNonce,
    nonceMatchesHeader: announced !== null && inHtml.length > 0 && inHtml.every((n) => n === announced),
    vercelCache: last.cache,
    htmlBytes: last.html.length,
  });
}

console.log(`# ${label} — ${origin} — ${samples} samples/page (after 1 warm-up), ${new Date().toISOString()}`);
console.log("page".padEnd(14), "status", "ttfb med/p90/max (ms)", "total med (ms)", "scripts", "nonce", "no-nonce", "match", "cache");
for (const r of results) {
  console.log(
    r.path.padEnd(14), String(r.status).padEnd(6),
    `${r.ttfbMs.median}/${r.ttfbMs.p90}/${r.ttfbMs.max}`.padEnd(21),
    String(r.totalMs.median).padEnd(14), String(r.scriptTags).padEnd(7), String(r.withNonce).padEnd(5), String(r.withoutNonce).padEnd(8),
    String(r.nonceMatchesHeader).padEnd(5), r.vercelCache,
  );
}
if (out) writeFileSync(out, JSON.stringify({ label, origin, samples, at: new Date().toISOString(), results }, null, 2));
