# 39 — Diseño: tope por usuario para la generación de rutinas (B2-F1) (v1, 2026-10-13)

> **Propuesta de diseño. No se ha modificado código ni producción.** Responde al hallazgo B2-F1 de `38-…`. Los valores numéricos
> son decisiones de producto/coste de Toni; los de aquí son propuestas de ingeniería, no límites aprobados. No acepta AI-08 ni gate.

## 1. Problema (verificado en código)

`POST /api/workouts/generate` llama al proveedor de IA si existe `GROQ_API_KEY` (`workouts.service.ts`, `if (env.groqApiKey)`) y **no
tiene cuota ni limitador por usuario**. Lo acotan solo: 100 peticiones/15 min por IP (`app.ts:119`), 2 ejecuciones en vuelo por
usuario y 3 intentos por clave de idempotencia. Registro abierto y sin verificación de e-mail ⇒ cuentas desechables sin coste.
Cada clave de idempotencia distinta es una llamada al proveedor.

## 2. Opciones

| | A. Contar el libro de idempotencia (recomendada) | B. Contar rutinas con `generationMode='ai'` | C. Limitador en memoria por usuario |
|---|---|---|---|
| Idea | En `beginIdempotent`, bajo el bloqueo consultivo que ya existe por (usuario, operación), contar registros `completed` + `in_progress` de la ventana | Contar filas `workouts` del usuario con modo `ai` en la ventana, antes de llamar al proveedor | `express-rate-limit` con clave `userId` |
| Atomicidad | **Estricta** (misma transacción y bloqueo que la admisión) | Aproximada: el exceso puede llegar a `maxConcurrent − 1` (2) | Por instancia |
| Cuenta ejecuciones en *fallback* | Sí (también protege BD/CPU) | No (solo las que costaron proveedor) | Sí |
| Cambios de esquema | **Ninguno** (usa `createdAt`, `status`) | Ninguno | Ninguno |
| Sobrevive a reinicios (plan Free duerme) | Sí | Sí | **No** |
| Esfuerzo | Medio-bajo (~1 función + parámetros + tests) | Bajo | Bajo |
| Valoración | **Recomendada** | Válida si solo importa el coste | **Descartada**: se reinicia al dormirse la instancia |

## 3. Diseño propuesto (opción A)

1. **Parámetro nuevo** en `beginIdempotent`: `windowLimit?: { seconds: number; max: number }`.
2. **Dentro de la misma transacción y bloqueo** (tras `pg_advisory_xact_lock`), antes de crear o retomar un registro, contar:
   `idempotency_records` donde `userId`, `operation`, `createdAt >= now − seconds` y `status ∈ {completed, in_progress}`.
   Si `count ≥ max` ⇒ devolver un nuevo resultado `{ kind: 'quota_exhausted', windowResetsAt, retryAfterSeconds }`.
3. **Lo que no consume:** los *replays* (no crean registro), las claves en estado `failed` (liberan su unidad) y las peticiones
   rechazadas por límite.
4. **Respuesta:** `429` con `reason: 'quota_exhausted'`, `windowResetsAt` y `Retry-After`, igual que el coach (misma forma que ya
   consume el cliente).
5. **Configuración** (variables de entorno con valores por defecto seguros): `WORKOUT_GENERATE_WINDOW_MINUTES`,
   `WORKOUT_GENERATE_WINDOW_LIMIT`.
6. **Interruptor de coste global (opcional, fase 2):** `WORKOUT_GENERATE_GLOBAL_DAILY_LIMIT`: recuento de todos los usuarios en 24 h;
   si se supera, **degradar a plantilla sin llamar al proveedor** (no a 429), con `fallbackReason = 'ai_budget_exceeded'`.
7. **Compatibilidad:** sin migración. El retenido de registros (24 h por defecto) cubre ventanas ≤ 24 h. Si la ventana fuera mayor,
   habría que subir `IDEMPOTENCY_RETENTION_HOURS`.

## 4. Decisiones de Toni

| # | Decisión | Propuesta | Por qué |
|---|---|---|---|
| 1 | Opción | **A** | Estricta, sin esquema, sobrevive a reinicios |
| 2 | Al superar el tope | **429** (como el coach) · alternativa: degradar a plantilla | 429 es coherente y simple. Degradar da mejor experiencia y coste cero, pero añade una razón de *fallback* nueva (pasa por el gate de copy de Hermes) y deja escrituras sin cota |
| 3 | Límite por usuario y ventana | **10 por hora** (propuesta de ingeniería) | Uso legítimo previsto de 1–3 por sesión; no hay datos de uso real. **No** es un límite comercial aprobado |
| 4 | Interruptor global diario | **Fase 2**; valor a decidir con el coste real del proveedor (no lo conozco) | Acota el peor caso aunque se creen cuentas |
| 5 | Fricción de registro | Decisión aparte: verificación de e-mail y/o limitador de registro por IP | El tope por usuario no frena el abuso con cuentas nuevas; solo lo encarece |

## 5. Plan de implementación (si se aprueba)

| Paso | Qué | Verificación |
|---|---|---|
| 1 | Pruebas primero (BD aislada): límite 3 con 12 peticiones concurrentes ⇒ exactamente 3 ejecutadas y 9 `429`; *replay* no consume; `failed` no consume; ámbito por usuario; ventana que expira | Suite de integración existente + nuevas |
| 2 | Implementar en `idempotency.service.ts` y `workouts.service.ts`, con variables en `config/env.ts` | Tipos, lint, tests |
| 3 | CI en verde en `development` | GitHub Actions |
| 4 | Despliegue manual del backend en Render (no requiere migración) | `/health/simple`, Stage D (D1, D3) reutilizable |
| 5 | Sonda de producción con QA: ráfaga acotada hasta el tope | Coste real: hasta el tope en llamadas al proveedor |

**Riesgos:** (a) tope demasiado bajo bloquea uso legítimo — se mitiga con variable de entorno y valor revisable sin código;
(b) el recuento añade una consulta por petición dentro de una transacción ya existente (coste despreciable a escala piloto);
(c) cambia contrato observable (nuevo 429) — hay que comprobar que el cliente lo muestra con mensaje útil.

## 6. Lo que este diseño NO resuelve

- Abuso con cuentas nuevas (fricción de registro, decisión 5).
- Coste del coach (ya tiene su propia cuota, y está desactivado).
- Que el valor del tope sea el correcto comercialmente (AI-15/AI-19).
- La evidencia de Stage D para concurrencia bajo cuota (D2) solo se obtendría con la sonda del paso 5.
