# History integrity F1 — Test plan v1

All tests: `backend/tests/integration/history-integrity-f1.test.ts`, isolated PostgreSQL, synthetic users and exercises.

| Test | Criterion |
|---|---|
| catalogue sync archives unlisted exercises, keeps their history, is idempotent | F1-AC01, F1-AC02 |
| catalogue sync archives duplicates by name instead of deleting | F1-AC01 |
| admin delete archives a referenced exercise, deletes an unreferenced one | F1-AC03 |
| direct SQL delete of a referenced exercise fails on the FK | F1-AC06 |
| archived exercises leave listing, metadata and generation, stay readable by id | F1-AC08 |
| deleting a routine with sessions keeps all history and hides the routine | F1-AC04 |
| deleting a routine without sessions removes it | F1-AC05 |
| direct SQL delete of a routine with sessions fails on the FK | F1-AC06 |
| deleting a user still removes routines and sessions | F1-AC07 |
| no session on an archived routine; no routine with an archived exercise | F1-AC09 |
| Neon branch rehearsal | F1-AC10 (manual, pending) |
| full backend suite, typecheck, build | F1-AC11 |
