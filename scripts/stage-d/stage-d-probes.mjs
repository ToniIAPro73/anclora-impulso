#!/usr/bin/env node
/**
 * Stage D probes (A-08-01 §5) — HTTP-level, run against the deployed API with the dedicated QA identity.
 * Decision: IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12 (option C). Procedure: sdd/features/impulso-pilot-review-package/31-stage-d-probes-design-v1.md
 *
 * SAFE BY DEFAULT: without --execute it only prints the plan and the request budget; it opens no connection.
 * To execute, ALL of these are required (a missing one aborts before any network call):
 *   --execute
 *   STAGE_D_CONFIRM=I-AUTHORIZE-<STAGE_D_WINDOW_ID>      (the window id is chosen and announced by Toni)
 *   STAGE_D_QA_EMAIL / STAGE_D_QA_PASSWORD               (dedicated QA identity; never Toni's personal account)
 *   STAGE_D_BASE_URL host in the allowlist below
 * The password is read from the environment only; it is never printed, stored or written to evidence.
 * Never run it with real users' credentials. Never raise the request budget to "load test".
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ALLOWED_HOSTS = new Set(["anclora-impulso.onrender.com", "127.0.0.1", "localhost"]);
const REQUEST_BUDGET = 40; // hard cap; the global production limiter is 100 requests / 15 min per IP
const BURST = { coach: 4, idempotency: 5 }; // intentionally small
const EXPECTED_MAX_CONCURRENT = Number(process.env.STAGE_D_EXPECTED_MAX_CONCURRENT ?? 2);

const args = new Set(process.argv.slice(2));
const execute = args.has("--execute");
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean);
const wants = (name) => only.length === 0 || only.includes(name);
const baseUrl = (process.env.STAGE_D_BASE_URL ?? "https://anclora-impulso.onrender.com").replace(/\/+$/, "");
const windowId = process.env.STAGE_D_WINDOW_ID ?? "";

function fail(msg) {
  console.error(`stage-d: ${msg}`);
  process.exit(2);
}

const host = new URL(baseUrl).hostname;
if (!ALLOWED_HOSTS.has(host)) fail(`host not in the allowlist: ${host}`);

const plan = [
  { id: "D0", name: "warm-up + login", requests: 3 },
  { id: "D1", name: "atomicity: forced failure after the delete on a QA routine", requests: 6 },
  { id: "D2a", name: `coach admission under a burst of ${BURST.coach} simultaneous requests (provider calls: up to the concurrency cap)`, requests: BURST.coach },
  { id: "D3", name: `idempotency: same key x${BURST.idempotency} in parallel, then sequential, then different body`, requests: BURST.idempotency + 6 },
];
const total = plan.reduce((n, p) => n + p.requests, 0);

if (!execute) {
  console.log("DRY RUN (no network). Plan:");
  for (const p of plan) console.log(`  ${p.id}  ${p.name}  [~${p.requests} requests]`);
  console.log(`  total ≈ ${total} requests (budget ${REQUEST_BUDGET}); target ${baseUrl}`);
  console.log("  D2b (quota exhaustion) is NOT executed in production: it would require ≥ the window limit of provider calls.");
  console.log("  D4 pooler: by construction (declared by Toni). D5/D6: not applicable (single instance). D7: read-only SQL by Toni (see design doc).");
  process.exit(0);
}

if (!windowId || !/^[A-Za-z0-9._-]{4,40}$/.test(windowId)) fail("STAGE_D_WINDOW_ID missing or malformed");
if (process.env.STAGE_D_CONFIRM !== `I-AUTHORIZE-${windowId}`) fail("STAGE_D_CONFIRM does not match the window id");
const email = process.env.STAGE_D_QA_EMAIL;
const password = process.env.STAGE_D_QA_PASSWORD;
if (!email || !password) fail("QA credentials missing");
if (!/^qa\./i.test(email)) fail("refusing: the account is not a dedicated QA identity (expected qa.* prefix)");
if (total > REQUEST_BUDGET) fail("planned requests exceed the budget");

// ---- evidence directory (never reused) -------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const runDir = join(process.cwd(), "artifacts", "stage-d", `${stamp}-${randomUUID().slice(0, 8)}`);
mkdirSync(runDir, { recursive: true });
const transcript = [];
let used = 0;
let token = "";

function redact(v) {
  return typeof v === "string" ? v.replace(/(Bearer\s+)[\w.-]+/gi, "$1***") : v;
}

async function call(label, method, path, { body, headers = {}, auth = true, expectedStatuses } = {}) {
  if (used >= REQUEST_BUDGET) throw new Error("request budget exhausted");
  used += 1;
  const started = Date.now();
  const h = { "content-type": "application/json", ...headers };
  if (auth && token) h.authorization = `Bearer ${token}`;
  let status = 0;
  let json = null;
  let rawHeaders = {};
  try {
    const res = await fetch(`${baseUrl}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    status = res.status;
    rawHeaders = {
      "idempotent-replayed": res.headers.get("idempotent-replayed"),
      deprecation: res.headers.get("deprecation"),
      "retry-after": res.headers.get("retry-after"),
    };
    json = await res.json().catch(() => null);
  } catch (e) {
    status = -1;
    json = { fetchError: String(e?.message ?? e) };
  }
  const entry = {
    label, method, path, status, ms: Date.now() - started, headers: rawHeaders,
    // body is reduced to its shape + well-known non-sensitive fields; tokens and passwords are never recorded
    bodyKeys: json && typeof json === "object" ? Object.keys(json).slice(0, 12) : null,
    reason: json?.reason ?? json?.error?.reason ?? null,
    message: typeof (json?.message ?? json?.error) === "string" ? redact(json.message ?? json.error).slice(0, 160) : null,
    windowResetsAt: json?.windowResetsAt ?? json?.usage?.windowResetsAt ?? null,
  };
  transcript.push(entry);
  const unexpected5xx = status >= 500 && !(expectedStatuses ?? []).includes(status);
  if (unexpected5xx || status === -1) throw Object.assign(new Error(`stop rule: ${label} -> ${status}`), { stopRule: true });
  return { status, json, headers: rawHeaders };
}

const results = [];
// pass: true | false | null (null = NOT EVALUABLE in this environment; never counted as a pass)
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  console.log(`${pass === null ? "N/E " : pass ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function warmUp() {
  for (let i = 0; i < 12; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/health/simple`);
      if (r.ok) return i;
    } catch { /* cold start */ }
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error("service did not warm up within ~96 s");
}

async function main() {
  const attempts = await warmUp();
  console.log(`warm-up ok (${attempts} retries)`);

  // D0 login — one attempt only: the auth limiter allows 5 failed attempts / 15 min
  const login = await call("login", "POST", "/api/auth/login", { auth: false, body: { email, password } });
  token = login.json?.accessToken ?? login.json?.tokens?.accessToken ?? login.json?.data?.accessToken ?? login.json?.token ?? "";
  if (login.status !== 200 || !token) {
    record("D0", false, `login failed (status ${login.status}); stopping, no further attempts`);
    return;
  }
  record("D0", true, "login ok");

  const created = [];

  // D1 atomicity
  if (wants("D1")) {
    const ex = await call("exercises", "GET", "/api/exercises?limit=1");
    const exerciseId = ex.json?.exercises?.[0]?.id ?? ex.json?.data?.[0]?.id ?? ex.json?.[0]?.id;
    if (!exerciseId) {
      record("D1", false, "could not obtain a valid exercise id");
    } else {
      const mk = await call("create-workout", "POST", "/api/workouts", {
        body: { name: `stage-d-probe-${stamp}`, exercises: [{ exerciseId, sets: 3, reps: 10, rest: 60, order: 0 }] },
      });
      const wid = mk.json?.workout?.id ?? mk.json?.data?.id ?? mk.json?.id;
      if (!wid) {
        record("D1", false, `create failed (status ${mk.status})`);
      } else {
        created.push(wid);
        const before = await call("get-before", "GET", `/api/workouts/${wid}`);
        const put = await call("forced-failure", "PUT", `/api/workouts/${wid}`, {
          body: { exercises: [{ exerciseId: randomUUID(), sets: 3, reps: 10, rest: 60, order: 0 }] },
          expectedStatuses: [500],
        });
        const after = await call("get-after", "GET", `/api/workouts/${wid}`);
        const ids = (r) => (r.json?.workout?.exercises ?? r.json?.data?.exercises ?? r.json?.exercises ?? []).map((e) => e.exerciseId).sort().join(",");
        const failedAsExpected = put.status >= 400;
        record("D1", failedAsExpected && ids(before) !== "" && ids(before) === ids(after),
          `forced failure status ${put.status}; exercises before=${ids(before) ? "present" : "missing"} equal after=${ids(before) === ids(after)}`);
      }
    }
  }

  // D2a coach admission under a small burst
  if (wants("D2a")) {
    const reqs = Array.from({ length: BURST.coach }, (_, i) =>
      call(`coach-${i}`, "POST", "/api/v1/coach/messages", {
        headers: { "Idempotency-Key": randomUUID() },
        body: { message: "Stage D admission probe, answer in one short sentence." },
        expectedStatuses: [503],
      }).catch((e) => ({ status: -2, error: e })));
    const out = await Promise.all(reqs);
    if (out.every((r) => r.status === 503)) {
      // 503 "LLM coach is disabled" (coach.service.ts): the feature flag is off, so admission cannot be observed
      record("D2a", null, "NOT EVALUABLE: every request answered 503 (coach disabled by configuration); no admission behaviour observed");
    } else {
    const ok = out.filter((r) => r.status >= 200 && r.status < 300).length;
    const limited = out.filter((r) => r.status === 429).length;
    const reasons = out.filter((r) => r.status === 429).map((r) => r.json?.reason ?? r.json?.error?.reason ?? "?");
    record("D2a", ok <= EXPECTED_MAX_CONCURRENT && ok + limited === out.length,
      `2xx=${ok} (cap ${EXPECTED_MAX_CONCURRENT}), 429=${limited} reasons=[${reasons.join(",")}], other=${out.length - ok - limited}`);
    }
  }

  // D3 idempotency
  if (wants("D3")) {
    const listBefore = await call("list-before", "GET", "/api/workouts");
    const countOf = (r) => (r.json?.workouts ?? r.json?.data ?? r.json ?? []).length;
    const key = randomUUID();
    const body = { workoutType: "strength", duration: 30, difficulty: "beginner", trainingEnvironment: "home" };
    const par = await Promise.all(Array.from({ length: BURST.idempotency }, (_, i) =>
      call(`gen-par-${i}`, "POST", "/api/workouts/generate", { headers: { "Idempotency-Key": key }, body })
        .catch((e) => ({ status: -2, error: e }))));
    // first execution answers 201; a replay answers 200 with `Idempotent-Replayed: true` (workouts.controller.ts)
    const executedRows = par.filter((r) => r.status === 201);
    const executed = executedRows.length;
    const replays = par.filter((r) => r.status === 200 && r.headers?.["idempotent-replayed"] === "true").length;
    const inProgress = par.filter((r) => r.status === 409).length;
    const seq = await call("gen-seq", "POST", "/api/workouts/generate", { headers: { "Idempotency-Key": key }, body });
    const conflict = await call("gen-conflict", "POST", "/api/workouts/generate", {
      headers: { "Idempotency-Key": key }, body: { ...body, duration: 45 },
    });
    const listAfter = await call("list-after", "GET", "/api/workouts");
    const delta = countOf(listAfter) - countOf(listBefore);
    const createdId = executedRows[0]?.json?.id;
    if (createdId) created.push(createdId);
    record("D3", executed === 1 && seq.status === 200 && seq.headers?.["idempotent-replayed"] === "true" && conflict.status === 422 && delta === 1,
      `executed=${executed} replays=${replays} in-progress=${inProgress} sequential=${seq.status}/replayed=${seq.headers?.["idempotent-replayed"]} conflict=${conflict.status} routinesDelta=${delta}`);
  }

  // cleanup of the routines created by the probes (the QA user itself is never deleted)
  for (const wid of created) {
    try { await call("cleanup", "DELETE", `/api/workouts/${wid}`); } catch { /* best effort, recorded in transcript */ }
  }
}

let stopped = null;
try {
  await main();
} catch (e) {
  stopped = String(e?.message ?? e);
  console.error(`STOPPED: ${stopped}`);
}

writeFileSync(join(runDir, "results.json"), JSON.stringify({
  decision: "IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12", windowId, baseHost: host, startedAt: stamp,
  requestsUsed: used, budget: REQUEST_BUDGET, stopped, results,
}, null, 2));
writeFileSync(join(runDir, "transcript.json"), JSON.stringify(transcript, null, 2));
const lines = readdirSync(runDir).sort().filter((f) => statSync(join(runDir, f)).isFile())
  .map((f) => `${createHash("sha256").update(readFileSync(join(runDir, f))).digest("hex")}  ${f}`);
writeFileSync(join(runDir, "MANIFEST.sha256"), `${lines.join("\n")}\n`);
console.log(`evidence: ${runDir}`);
process.exit(stopped || results.some((r) => r.pass === false) ? 1 : 0);
