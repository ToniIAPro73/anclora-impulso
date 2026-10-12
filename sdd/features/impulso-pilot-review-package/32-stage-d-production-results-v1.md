# 32 — Resultados Stage D en producción, ventana `win-20261012a` (v1, 2026-10-12)

> Registro de evidencia. **No acepta AI-08, AI-06, ni gate alguno** y no sustituye la revisión independiente (B2).
> Procedimiento: `30-…` §11 · diseño de sondas: `31-…` · decisión `IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12`.
> Ejecutado por Toni con la identidad QA dedicada; el agente analizó el resultado y la evidencia archivada.

## 1. Identificación

| Campo | Valor |
|---|---|
| Ventana | `win-20261012a` (inicio ≈ 21:30 UTC, 2026-10-12; ≈ 1–2 min) |
| Destino | `anclora-impulso.onrender.com` (Render, plan Free, 1 instancia, commit `c0333f3`) |
| Código de las sondas | `scripts/stage-d/stage-d-probes.mjs` (commit `0331de1`; el parche posterior solo reclasifica D2a) |
| Identidad | QA dedicada (CREATED el mismo día); sin usuarios reales ni datos personales |
| Peticiones | 21 de 40 presupuestadas; sin parada por regla de seguridad |
| Evidencia local | `artifacts/stage-d/20261012T213050Z-0fdb8e5e/` (no versionada; `artifacts/` está ignorado) |
| SHA-256 `results.json` | `0799b0ba997539bff08d7cf00619afac90cae653706d4cb039de41263b388f99` |
| SHA-256 `transcript.json` | `c6823a2fa1f8ac5d00bda866b4434ec113edec315b48571f935a2d91bebee65c` |
| Manifiesto | verificado (`shasum -c`: ambos OK) |

## 2. Resultados

| Sonda | Resultado | Qué se observó | Lectura |
|---|---|---|---|
| D0 login | **PASS** | warm-up 0 reintentos; login 200 | Servicio operativo; identidad QA válida |
| D1 atomicidad | **PASS** | `PUT` con `exerciseId` inexistente → **400**; los ejercicios de la rutina antes = después | El fallo tras el `deleteMany` hizo rollback en la topología real (pooler). El 400 procede del mapeo del error FK por el manejador; `updateWorkout` no tiene validación previa (código) |
| D2a coach | **NO EVALUABLE** | 4/4 respuestas **503** | En el código, el único 503 de esa ruta es «LLM coach is disabled» (`coach.service.ts:406`): bandera `LLM_COACH_ENABLED` distinta de `true`. **El mensaje no quedó en la evidencia de esta ejecución** (el script leía `message`, no `error`; corregido). No se observó comportamiento de admisión |
| D3 idempotencia | **PASS** | Misma clave ×5 en paralelo: **1 × 201** + **4 × 409** («en curso», con `retryAfterSeconds`); secuencial → **200 con `Idempotent-Replayed: true`**; cuerpo distinto → **422**; rutinas +1 exacto (1 → 2) | Semántica de ledger verificada en la topología real; sin duplicación de efecto |
| Limpieza | OK | 2 × `DELETE` 204 (rutinas creadas por las sondas) | Usuario QA conservado |

## 3. Por qué D2a no es un fallo de integridad

- No hubo ningún 5xx inesperado ni efecto parcial: el coach está **desactivado por configuración**, coherente con que AI-14 no tiene UI
  de coach (`INDEX.md`). Producción no se ha modificado para forzarlo (regla §11.2.5).
- **Consecuencia:** los mecanismos de cuota y de concurrencia del coach **no tienen evidencia de Stage D**. Si algún día se activa
  `LLM_COACH_ENABLED=true`, D2a (y la decisión sobre D2b) pasa a ser **obligatorio antes de exponerlo**.
- El script marcó inicialmente D2a como `FAIL`; era una clasificación incorrecta del script. Parcheado: ahora emite `N/E`
  (no evaluable) y nunca lo cuenta como paso.

## 4. Controles del Stage D (A-08-01 §5)

| Control | Estado | Evidencia / nota |
|---|---|---|
| D1 atomicidad | **Cumplido en producción** (alcance: actualización de rutina, 1 caso) | §2 |
| D2 cuota concurrente | **Sin evidencia** (coach desactivado) | Pendiente si se activa el coach |
| D3 idempotencia | **Cumplido en producción** (alcance: `POST /api/workouts/generate`, 1 clave) | §2 |
| D4 pooler | **Cumplido por construcción**, según declaración de Toni | No verificado por el agente; las sondas D1 y D3 pasaron por el mismo camino |
| D5 multi-instancia | **No aplica** | Plan Free, 1 instancia |
| D6 reloj entre instancias | **No aplica** | idem |
| D7 motor y estado | **Cumplido (registro)** | Consultas de solo lectura por Toni en Neon `main`: `PostgreSQL 17.11 (7d7ea2a) on aarch64-unknown-linux-gnu`; `_prisma_migrations`: **applied = 26, failed = 0**. Versión local de las pruebas: PostgreSQL 16, por tanto **la diferencia 16 → 17 queda registrada**; D1 y D3 pasan sobre el motor real (17) |

## 5. Límites

- Una ráfaga de 5 desde un solo cliente prueba admisión en **una** instancia, no concurrencia distribuida ni carga sostenida.
- Un caso por control: no es una batería de regresión. Los resultados locales (23 suites / 141 tests) siguen siendo la base amplia.
- D1 y D3 ejercitan la ruta por el pooler, pero no se verificó que **el modo de conexión del servicio** sea realmente pooler.
- No se verificó si la generación de D3 usó el proveedor de IA o el fallback determinista (el script no registra `generationMode`).
- **No acepta AI-08**: faltan revisión independiente (B2) y aceptación de AI-01, y D2 no tiene evidencia (coach desactivado); ni tampoco las revisiones de AI-06.
- D7 registra versión y estado: no demuestra equivalencia de comportamiento entre PostgreSQL 16 y 17 más allá de los dos casos ejercitados.

## 6. Balance del Stage D (A-08-01 §5)

| Resultado | Controles |
|---|---|
| Cumplidos con evidencia en producción | D1, D3, D7 (y D4 por construcción, declarado) |
| No evaluables | D2 (coach desactivado por configuración) |
| No aplican | D5, D6 (una instancia) |

Stage D **no queda completo**: falta D2, que solo es evaluable activando el coach, y no se ha hecho. Mientras el coach siga
desactivado, el riesgo asociado no está expuesto a usuarios; si se activa, D2 es requisito previo.
