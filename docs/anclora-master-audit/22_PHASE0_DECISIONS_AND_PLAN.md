# 22 — Fase 0: decisiones consolidadas y plan definitivo

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

**Fecha:** 2026-11-10 · **Repo/rama:** `anclora-impulso` / `development` · **HEAD = origin/development:** `af5f38d`
**Alcance:** contrasta los informes 20 (Codex) y 21 (Antigravity) con el código, workflows y contratos vigentes. Solo análisis: sin cambios de código, commits, pushes ni promociones. Los tests no se han vuelto a ejecutar.

## 1. Estado verificado

- `origin/main = staging = production = f29e772`. `development` va 2 commits por delante (`0e0b897`, `af5f38d` = A/AUD-024). **A no está promocionado.**
- Árbol: 64 rutas pendientes = B 16 + C 11 + D 5 (32 de código) + 32 de auditoría/snapshots/propuesta (incluye 20 y 21). Los 62 de Codex y los 63 de Antigravity eran correctos para su corte; la diferencia son los propios informes 20 y 21.
- B/C/D no se solapan y no hay migraciones (coinciden ambos informes).

## 2. Discrepancias resueltas

| # | Tema | Informe 20 (Codex) | Informe 21 (Antigravity) | Realidad verificada | Decisión |
|---|---|---|---|---|---|
| 1 | Variables del proxy | `NEXT_PUBLIC_API_PROXY` + `API_PROXY_TARGET` | `BACKEND_URL`, ruta `/api/backend/:path*` | `next.config.mjs` usa solo `API_PROXY_TARGET` (origen sin path, **build-time**); `lib/api/base-url.ts` usa `NEXT_PUBLIC_API_PROXY=true` y base `/api`. `BACKEND_URL` no existe en el código. Reescritura `/api/:path*` excluye `/api/logs` y `/api/csp-report`. | **Codex correcto.** Antigravity erróneo (variable, ruta y diagrama). Ambas variables deben fijarse en Vercel **antes del build** de Preview; sin ellas el frontend sigue en modo directo (seguro). |
| 2 | Cookie | — | `refresh_token` | Nombre `refreshToken`, `HttpOnly`, `SameSite=Lax`, `Secure` solo si `NODE_ENV=production`, `path=/api/auth`. Funciona únicamente same-origin vía proxy. | Corregir nomenclatura en la matriz de pruebas. Verificar `Secure` en Preview. |
| 3 | Despliegue de Render | Manual (`autoDeploy=no`) | "CI despliega el backend en Render" | `PRODUCTION_RUNTIME.md`: Render con Auto-Deploy Off, rama `development`, despliegue manual desde dashboard. Un único servicio atiende Preview y producción. | **Codex correcto.** Ningún push despliega el backend; se despliega a mano y solo con aprobación de Toni. |
| 4 | Retrocompatibilidad de B | Backend primero | Backend retrocompatible | `extractRefreshToken` prioriza la cookie y cae al body; el refresh JSON sigue en la respuesta. Ambos coinciden. | Backend → frontend. No retirar refresh JSON en B (TASK-031 posterior). |
| 5 | Orden de integración | Congelar A; D → C → B; docs aparte | D → C → B → docs | D independiente; C no depende de B; B no depende de C. `promote.yml` (full) exige `development == source_sha`, así que promociona **todo** lo que haya en development. | Orden común D → C → B, un commit por paquete, docs al final. **Añadir paso 0 de Codex:** decidir A antes de empujar nada (decisión D1). |
| 6 | Seguridad del workflow de promoción | Conflicto D-0044 vs D-0050/0052 | `gate.mjs` choca con D-0052; descartarlo | `promote_full` ya exige dispatch desde `development`, `source_sha` explícito, igualdad con `origin/development`, rechaza estados `failure/error` y divergencia, y hace fast-forward. AOS Lean (D-0052, aprobada 2026-11-09) y el contrato local reconocen `PROMOTE=FULL` como dispatch afirmativo. D-0044 §5 regula la admisión local L0/L1 y la fase previa; queda acotada por Lean. **Pero:** el job acepta checks *pendientes* y consulta solo el *combined status* legacy (no los check-runs de Actions), por lo que en la práctica **no impone CI verde**. Inferencia por semántica de la API de GitHub; no verificada contra GitHub. | Ambos informes parcialmente correctos. Conflicto normativo: **resuelto por precedencia** (Lean + contrato local). No se aplica `gate.mjs` en Impulso; el endurecimiento es asunto de Governance, no bloquea Fase 0. Riesgo aceptado explícitamente (D6). |
| 7 | Afirmaciones no verificadas | Sin tests ejecutados (declarado) | "68 backend / 92 frontend PASS", "58 tablas verificadas" | Sin evidencia adjunta en el informe 21; las 58 tablas proceden del informe 17 §14.6 (lectura de solo lectura previa). | Tratar los conteos de tests como **no verificados** hasta repetirlos por paquete. No se citan como evidencia de cierre. |
| 8 | Normas de comunicación | — | D-2026-0053 "propuesta" | Estado: Propuesta; el `AGENTS.md` ya contiene la regla. | Sin acción en Impulso. |
| 9 | `.anclora/PRODUCTION_RUNTIME.md` en C | Aprobar/excluir | Lo trata como parte normal de C | Es una fila nueva en el registro de cambios del contrato (verificación Neon 2026-11-09), no código. | Separar de C; requiere visto bueno de Toni (D3). |
| 10 | Segundo incidente | Cerrar como "no verificado" | No lo trata | Sin evidencia concreta. | Cerrar como no verificado (D5). |
| 11 | Snapshots `.patch` y `gate.mjs` | Derivados/propuesta | `.patch` redundantes; `gate.mjs` a Governance | Coinciden. | No se commitean con código; ver D4. |

## 3. Plan definitivo (continuar Fase 0)

0. **Congelar A.** Decidir si `af5f38d` se promociona antes de integrar nada (D1). Mientras no se decida, no hay commits ni pushes de B/C/D.
1. **Precondiciones de Toni (solo confirmaciones, sin valores):** en Render `JWT_SECRET` ≥32 caracteres, `JWT_REFRESH_SECRET` ≥32 y distinto, ambos no por defecto, `NODE_ENV=production`, `FRONTEND_URL` y `FRONTEND_PREVIEW_HOST_SUFFIXES` correctos. Es requisito para desplegar C (guard de arranque: crash-loop si falla).
2. **D** (redacción + probes QA): tests focales sintéticos → "commit y push ok" de D. Sin impacto en runtime ni configuración.
3. **C** (guards JWT, cohortes, aislamiento BD de tests), sin la fila de `PRODUCTION_RUNTIME.md`: tests unitarios de backend focales; confirmar que el test trasladado a `tests/unit` lo recoge Jest; nunca integración contra Neon. Push → despliegue manual de Render solo tras paso 1 y con aprobación; comprobar arranque.
4. **B backend** (cookie/OAuth): ya incluido en el push de B; el backend es retrocompatible. Desplegar Render manualmente tras C y verificar login por body/cookie.
5. **B frontend:** fijar en Vercel Preview `NEXT_PUBLIC_API_PROXY=true` y `API_PROXY_TARGET=<origen Render>` y reconstruir. QA con `qa.impulso@anclora.local` (`agent-browser`): login, cookie `HttpOnly`/`Secure`/`Lax`/`/api/auth`, refresh, logout, expiración/401, pestañas/concurrencia, OAuth y rate limit tras el proxy. Sin tokens en la salida.
6. **Documentación:** commit separado de `docs/anclora-master-audit/` (00–22 y README). Excluir `proposals/promotion-gate/` (remitir a Governance) y decidir los `.patch` (D4).
7. **Cierre:** `git status` limpio, CI del SHA final, aceptación expresa de Toni de residuos (AUD-001 JSON, riesgo del gate, incidente no verificado). Solo entonces **Fase 0 COMPLETA**. Promoción: únicamente `PROMOTE=FULL` con el SHA revisado en Preview.

Criterios de cierre: los de §8 de los informes 20/21, con estas correcciones: proxy con `API_PROXY_TARGET`/`NEXT_PUBLIC_API_PROXY`, despliegue de Render manual, conteos de tests re-ejecutados y no heredados.

## 4. Decisiones que requieren aprobación de Toni

| ID | Decisión | Recomendación |
|---|---|---|
| D1 | ¿Promocionar A (`af5f38d`) antes de empujar D/C/B? (el workflow arrastra todo lo que haya en `development`) | Sí: `PROMOTE=FULL` de A primero y luego D → C → B. Alternativa: promoción conjunta al final, con A bajo el mismo riesgo que B/C. |
| D2 | Confirmar en Render la configuración del paso 1 y autorizar el despliegue manual de C y de B | Confirmar antes de empujar C. |
| D3 | Fila de `.anclora/PRODUCTION_RUNTIME.md` (verificación Neon 2026-11-09) | Aprobarla y commitearla aparte con la documentación; no mezclar con C. |
| D4 | Destino de `.patch`, `*-files.txt` y `gate.mjs` | No commitear `gate.mjs` (pasar a Governance); conservar `.patch`/listas fuera del repo o descartarlos tras integrar. |
| D5 | Segundo incidente | Cerrar como "no verificado". |
| D6 | Riesgo del gate de promoción (acepta checks pendientes, no mira check-runs) | Aceptar para Fase 0 y abrir tarea en Governance; no tocar `promote.yml` desde Impulso. |
| D7 | AUD-001: mantener refresh en JSON tras B | Mantener; abrir TASK-031 después. |
| D8 | `scripts/qa/` | Conservar como utilidades permanentes. |
