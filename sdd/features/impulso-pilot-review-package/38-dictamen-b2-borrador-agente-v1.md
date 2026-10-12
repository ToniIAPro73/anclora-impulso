# 38 — BORRADOR de dictamen B2 (integridad e idempotencia, AI-08) — preparado por el agente para revisión de Toni

> **Borrador, no dictamen.** Redactado por el agente que implementó el código revisado: **no independiente**. Toni lo revisa,
> lo contrasta y, solo si lo hace suyo, lo firma. No acepta AI-08 ni gate alguno. Plantilla: `33-…` §5 y §6. Pareja: `37-…`.

> **Verificación en producción (2026-10-13):** B2-F1 desplegado (`41a427a`) y comprobado con la sonda D8: 10 aceptadas y la undécima
> `429 quota_exhausted` (`32-…` §7).
>
> **Actualización posterior (2026-10-13):** B2-F1 está **corregido en código** (commit `4eb8e1b`, `39-design-workout-generation-quota-v1.md`):
> tope por usuario de 10 generaciones/hora contado desde el libro de idempotencia, con 9 tests nuevos y control negativo; CI en verde.
> **No está desplegado en producción** (Render sigue en `c0333f3`) ni verificado allí. Este borrador conserva su texto original
> (revisión sobre `c0333f3`) y no se reescribe; al firmar, Toni debe decidir si el dictamen se refiere a `c0333f3` o a `4eb8e1b`.

## 0. Alcance real

| Aspecto | Valor |
|---|---|
| Versión | `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d` (en producción) |
| Método | Lectura estática + evidencia existente: 23 suites / 141 tests en PostgreSQL 16 aislado (resultado previo, **no re-ejecutado**) + Stage D en producción (`32-…`) |
| **Leído** | `idempotency.service.ts` (completo), `middleware/idempotency.ts`, `coach.service.ts` (líneas 150–330: reconciliación, reserva, liberación), `workouts.service.ts` (generación idempotente, actualización transaccional), `errorHandler.ts` (mapeo P2003), `app.ts` (limitadores) |
| **No leído** | `coach.service.ts` fuera de las líneas indicadas, `purge-expired.ts`, esquema Prisma y migraciones en detalle, los tests de integración |
| Evidencia de producción | D1 atomicidad ✔, D3 idempotencia ✔, D7 ✔; **D2 no evaluable** (coach desactivado); D5/D6 no aplican (1 instancia) |

## 1. Respuestas a I1–I6 (propuestas)

| # | Pregunta | Respuesta propuesta | Razonamiento y evidencia |
|---|---|---|---|
| I1 | ¿Basta *compare-and-set* con relectura, o hace falta bloqueo de fila? | **Basta**, con la salvedad de la lectura estática. La decisión corre en una transacción con bloqueo consultivo por (usuario, operación) (`idempotency.service.ts:94`); cada transición es un CAS sobre `ownerToken`, `status`, `lockedUntil` y `attempts` (`:134-147`), con hasta 4 relecturas (`:116`). La finalización no está serializada por ese bloqueo, pero exige `ownerToken` + `in_progress` (`:211-213`) y va en la transacción del efecto | Producción: 5 peticiones simultáneas con la misma clave → 1 ejecución, 4 × 409 (D3) |
| I2 | ¿El *fence* de reconciliación es correcto para un dueño lento pero vivo? | **Correcto para la integridad**: la reconciliación cambia `ownerToken` y marca `failed` (`coach.service.ts:157-158`); la finalización tardía del dueño anterior falla por propiedad y su efecto se revierte (`IdempotencyOwnershipLostError`). **Coste**: la llamada al proveedor puede duplicarse (se factura dos veces), y un `504` se declara «resultado desconocido» (`coach.service.ts:317-324`) | Lectura estática; cubierto por tests locales (review-r1-r2) |
| I3 | ¿Orden de bloqueos completo? | **Sin ciclo encontrado por lectura.** Coach: fila de ventana → fila de registro (`coach.service.ts:155`, `:239-253`). Idempotencia: bloqueo consultivo → fila de registro, sin tocar ventanas (`idempotency.service.ts:94-195`). Para formar un ciclo haría falta que `begin` pidiera la ventana, y no lo hace. **No** se reprodujo el interbloqueo histórico y no hay prueba dinámica contra producción | Conclusión **débil** (solo lectura) |
| I4 | ¿La evidencia local + Stage D satisface «tests en staging» según A-08-01? | **Parcialmente.** Accept 1 (atomicidad) y Accept 3 (reintento no duplica) tienen evidencia en el motor real (PostgreSQL 17.11, por pooler). **Accept 2 (concurrencia no supera cuota) no tiene evidencia de Stage D**: el coach está desactivado y la generación de rutinas **no tiene cuota** (ver B2-F1) | `32-…` §4 |
| I5 | ¿Topes experimentales (3 / 5 / 2) aceptables como protección operativa? | **Aceptables como protección técnica, no como política comercial.** Son valores de ingeniería (`env.ts:96-110`): 3 intentos por clave, 5 fallos por ventana, 2 en vuelo. No acotan el coste total (B2-F1) | `env.ts` |
| I6 | ¿Migración 5 editada tras una aplicación local? | **Aceptable y ya cerrada**: checksum canónico fijado, aplicada en producción (run #1) y verificada en el ledger. El riesgo solo afectaba a BD locales que aplicaron la versión anterior | Ledger: 6 filas terminadas |

## 2. Hallazgos

| ID | Severidad | Hallazgo | Evidencia | Efecto | Propuesta |
|---|---|---|---|---|---|
| **B2-F1** | **Media** | **`POST /api/workouts/generate` no tiene cuota ni limitador por usuario.** Solo lo acotan: 100 peticiones / 15 min por IP, 2 ejecuciones en vuelo por usuario y 3 intentos por clave. El registro es abierto y sin verificación de e-mail. `GROQ_API_KEY` existe en producción (declarado por Toni) | grep: ningún limitador en el servicio, controlador ni ruta; `app.ts:119-141` | **Exposición de coste** de proveedor de IA y abuso por cuentas desechables; contradice la premisa de `CLAUDE.md` (5 IA/hora) | Decidir un tope por usuario/ventana (como el del coach) o un limitador por usuario antes de abrir tráfico real. Es de la familia AI-15/AI-19 |
| B2-F2 | Baja | Las purgas de idempotencia, sesiones y *handoffs* existen pero **no están programadas**; las tablas solo crecen | `purgeExpiredIdempotencyRecords`, `session.service.ts:226`, `oauth-handoff.service.ts:103` | Sin impacto a escala piloto; crecimiento sin cota después | Programar el trabajo de mantenimiento antes de tráfico real |
| B2-F3 | Baja | Coste duplicado ante un dueño lento pero vivo (I2) | `coach.service.ts:157-158`, `idempotency.service.ts:545` | Gasto de proveedor duplicado, sin efecto duplicado | Aceptar y documentar; ajustar `lockSeconds` al *timeout* real |
| B2-F4 | Baja | Un usuario puede agotar el tope de fallos por ventana y quedar sin coach el resto de la ventana (`operational_failure_cap`) | `coach.service.ts:272-278` | Autodenegación; no cruza usuarios | Aceptable |
| B2-F5 | Info | El contador de uso de tokens antiguos es **por proceso** y se reinicia al dormirse la instancia Free | `session.service.ts:29-41` | No sirve para decidir (ver B1) | Decidir por fecha |
| B2-F6 | Info | El `PUT` de rutina con referencia inexistente devuelve **400 «Referencia inválida»** (P2003), no 500 | `errorHandler.ts` (bloque P2003); Stage D D1 | Coherente; el rollback es observable | — |

## 3. Qué parece correcto

- Actualización de rutina en una sola transacción (borrado + creación): un fallo no deja la rutina sin ejercicios (`workouts.service.ts:277-302`); verificado en producción (D1).
- Idempotencia de generación: la finalización del registro va en la **misma** transacción que el efecto (`workouts.service.ts`, `generateWorkout(..., completeIdempotent)`); un dueño desplazado revierte el efecto.
- Clave de idempotencia acotada al usuario y a la operación (`idempotency.service.ts:90`): no hay *replay* entre usuarios.
- Reserva de cuota del coach con UPDATE condicional atómico (`requestCount < límite`) y liberación única por reconciliación (`coach.service.ts:239-247`).
- Conflicto por cuerpo distinto → 422; en curso → 409 con `retryAfterSeconds` (observado en producción).

## 4. Límites y decisión propuesta

- **Sin evidencia de Stage D para D2** y para concurrencia multi-instancia (no aplica hoy).
- Una lectura de un solo revisor, **no independiente**, de código que él mismo escribió.

**Decisión propuesta para tu alcance (a confirmar por ti):** `requiere cambios (menores)` por **B2-F1** (cuota/limitador de
generación) y B2-F2 (purga programada); mecanismos de atomicidad e idempotencia, «sin cambios requeridos en el alcance local y
verificado parcialmente en producción». **No aceptes AI-08** con este documento: faltan revisión independiente, AI-01 y D2.

## 5. Antes de firmar, comprueba tú

1. Confirma B2-F1 con tus ojos: busca `rateLimit` y `Limiter` en `backend/src` y verifica que solo existen en `app.ts`.
2. Decide el tope aceptable de generaciones de rutina por usuario y hora (es producto/coste, no solo técnica).
3. Decide si el coach seguirá desactivado hasta tener D2.

Firma: ______________________   Fecha: __________   (sin firma, este documento no tiene valor de dictamen)
