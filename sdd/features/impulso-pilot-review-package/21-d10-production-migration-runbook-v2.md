# 21 — Runbook D10 v2: migración de producción y despliegue coordinado (BORRADOR DOCUMENTAL)

> **RELEASE NO AUTORIZADO.** Este documento es preparación: no autoriza, no ordena y no ejecuta nada. Complementa y corrige, sin
> reescribirlos, `sdd/features/impulso-pilot-release-plan/d10-production-migration-and-deploy-plan-v1.md` (D10 v1) y los informes 18, 19 y 20.
> No contiene secretos, URLs de conexión ni UUID. Ningún gate AI-xx / G1–G4 ni revisión profesional, de seguridad, Hermes o legal se da por aceptado.

Etiquetas de procedencia: **[LOCAL]** observado en archivos/repo ahora · **[OPERADOR]** reportado por Toni/operador o por auditorías
previas, no re-observado · **[INFERIDO]** · **[DESCONOCIDO]**.

## 1. Estado y alcance

| Dato | Valor | Procedencia |
|---|---|---|
| Rama / HEAD local | `development` / `0978402`; cambios sin commitear solo documentales (informes 18–20 e `INDEX.md`) | [LOCAL] (`git status`, `git log`) |
| Código con las 6 migraciones | `2b9842a` (código), `0978402` (informes) sobre `ed4bb64` | [LOCAL] |
| Línea base de producción conocida | `77f852aa` (Vercel production, `main`, 2026-10-03) | [OPERADOR] / auditoría 19 |
| Backend vivo en Render | `70fd1d4…` (2026-09-14, «complete P7 release hardening»); sin cambios en `backend/` entre `70fd1d4` y `77f852aa` | [OPERADOR] + [LOCAL] (`git log 70fd1d4..77f852aa -- backend` vacío) |
| Alcance de este documento | plan de migración y despliegue; **no** incluye ejecución ni consultas remotas | — |

No se hizo `fetch`: las refs remotas son las de seguimiento local. Este documento no supone que `production`/`main` sigan en `77f852aa`.

## 2. Topología observada / reportada

| Elemento | Hecho | Procedencia |
|---|---|---|
| Frontend | Vercel, proyecto `anclora-impulso` (Next.js), conectado por Git. **Producción = rama `main`**; el resto de ramas (incl. `staging`, `production`) crean *previews* | [OPERADOR] + auditoría 19 (metadatos de despliegues) |
| Backend | Render, servicio `Anclora-Impulso` (`srv-d6ps41v5r7bs73dvrudg`), `rootDir=backend`, rama `main`, **`autoDeploy=yes`**, Live en `70fd1d4`; sin despliegues de `944eb67`, `ed4bb64`, `0978402` | [OPERADOR] |
| API que usa el frontend | `NEXT_PUBLIC_API_URL` en todos los scopes, apuntando al backend Render de producción ⇒ **los previews de `staging` no están aislados** | [OPERADOR] |
| Destino de BD | Neon, host compartido con producción (consulta de solo lectura previa autorizada por Toni) | [OPERADOR] |
| Promoción | `promote.yml`: solo fast-forward de refs, sin migraciones ni despliegues propios | [LOCAL] (`.github/workflows/promote.yml`) |
| Consecuencia | **mover `main` actualiza Vercel producción y, por auto-deploy, despliega el backend nuevo en Render sin migraciones** | [INFERIDO] a partir de lo anterior |
| Discrepancia de arquitectura | `PRODUCTION_RUNTIME.md`: «Vercel Serverless Functions» + migraciones «Supabase»; `DEPLOY.md`: Railway/Render + Neon; repo y auditorías: Express + Prisma + Neon + Render | [LOCAL] — **sin resolver** |
| Plataforma/runner de migraciones | **no confirmado** (Prisma `migrate deploy` es lo que usa el repo/CI; el contrato de producción dice `MANUAL_OR_CONSOLE`) | [LOCAL] / [DESCONOCIDO] |

## 3. Bloqueos antes de cualquier migración

| # | Bloqueo | Qué se necesita | Estado |
|---|---|---|---|
| B1 | Servicio real del backend, runner autorizado y método seguro para Prisma (resolver la discrepancia §2) | decisión escrita de Toni | **ABIERTO** |
| B2 | Confirmar la base objetivo sin imprimir URL ni secretos | comprobación futura autorizada (p. ej. proyecto/rama Neon por etiqueta y por el identificador del servicio; comparación por huella, no por valor) | ABIERTO |
| B3 | Snapshot/backup verificable de Neon (rama punto-en-el-tiempo o export) y plan de recuperación | autorización separada; identificador del backup anotado | ABIERTO |
| B4 | Historial y checksum de **todas** las migraciones pendientes en el destino | lectura autorizada futura de `_prisma_migrations`; la evidencia actual **solo** cubre la migración 5 | ABIERTO |
| B5 | **`ADMIN_USER_IDS` ausente** en Render [OPERADOR]: con el código nuevo nadie tendría privilegios admin (fallo cerrado) | UUID real designado por Toni, fijado por el operador **antes** del backend; no se inventa ni se busca entre usuarios | **BLOQUEO** |
| B6 | Modos de runtime: `SECURITY_CONFIG_MODE`, `AUTH_ACCEPT_LEGACY_TOKENS`, `IDEMPOTENCY_KEY_ENFORCEMENT`, `IDEMPOTENCY_LEGACY_SUNSET_AT` (ausentes en Render [OPERADOR]) | decisión documentada (propuesta de arranque, §7) | ABIERTO |
| B7 | Auto-deploy de `main` en Render y `NEXT_PUBLIC_API_URL` por scope | decisión sobre cómo impedir que el backend nuevo salga antes de migrar (§6) | ABIERTO |
| B8 | Revisiones pendientes: seguridad AI-06-AC10, profesional AI-03, Hermes (copy del aviso de fallback; `restrictedDesc` aún cita `ADMIN_EMAILS`), legal L1–L8 | documentos firmados | PENDIENTES |
| B9 | E2E general sobre el árbol final y programación de purgas (idempotencia, sesiones, handoffs) | ejecución autorizada / decisión | PENDIENTE |

## 4. Plan de migraciones

Fuente: SQL completo de cada `backend/prisma/migrations/<nombre>/migration.sql` y `backend/prisma/schema.prisma` en `0978402` [LOCAL].
Directorio: 26 migraciones + `migration_lock.toml`; línea base: 20 (`20251120020551_init` … `20260914130000_add_health_plans`). El conjunto
«nuevas» = las seis `20261012…` (revalidado por nombre y orden; el diff literal contra `77f852aa` no se ejecutó). **No se afirma que
las seis falten en producción**: solo hay evidencia de que falta la 5.

| # | Migración | SHA-256 (completo) | Objetos | Dependencias | Compatibilidad | Lock / backfill (sin estimar duración) |
|---|---|---|---|---|---|---|
| 1 | `20261012030000_add_workout_generation_provenance` | `940e0cbbae4fe472f32d9e6db952a8a71f2cce6078d32295c278fe7a8801d9f9` | `workouts` +3 columnas, `NOT NULL DEFAULT 'unknown'`, CHECK de valores | `workouts` | expand; código antiguo las ignora | `ADD COLUMN` con DEFAULT constante (metadatos en PG ≥ 11); el `CHECK` valida la tabla con bloqueo breve; sin backfill |
| 2 | `20261012030100_add_idempotency_records` | `3c4df0099f2e83c0aacad8444647a25ffc28d14d146b36487558a9c0fb804584` | tabla `idempotency_records` (CHECK, único `(userId,operation,key)`, FK a `users` CASCADE) | `users` | expand (tabla nueva) | tabla vacía |
| 3 | `20261012030200_add_auth_sessions` | `d79b1dc14ab414def77cc926237a963021a83bae60d52a4b36d99bd41b1b0c45` | `users.disabledAt` nullable; tablas `auth_sessions`, `refresh_tokens`, índices, FKs | `users` | expand | `ADD COLUMN` nullable |
| 4 | `20261012040000_add_coach_usage_operational_counters` | `63f6e084eddab7de6dd4a58a3dae808f54d018bb412554ecd7be19c42b4ebb25` | `coach_usage_windows` +2 contadores DEFAULT 0 | `coach_usage_windows` | expand | metadatos |
| 5 | `20261012050000_add_idempotency_quota_reservation` | `4becd718c9cd71fb9222ff3ea485729030abd71c20da8ea428647f1d57039ece` | `idempotency_records` +4 columnas, +índice `reservedWindowId` | **migración 2** | expand | `ADD COLUMN`/`CREATE INDEX` sobre tabla recién creada |
| 6 | `20261012090000_add_oauth_handoffs` | `cd8d9e7955ea5a9d6a7a7d729a7f42fb6c510087afb17657fbb7e0b39c8aa888` | tabla `oauth_handoffs` (único `codeHash`, índice `expiresAt`, FK a `users` CASCADE) | `users` | expand | tabla vacía |

Orden: lexicográfico por nombre (1→6); Prisma aplica cada migración en su propia transacción [D10 v1 §6]. «Expand» describe el SQL leído; **no
prueba** reversibilidad de datos: los `Rollback` de los comentarios son referencia no validada.

Para cada paso, comprobación **previa** (futura, autorizada): fila ausente en `_prisma_migrations` y objetos ausentes; **posterior**: fila con
`finished_at` y checksum igual al de la tabla; objetos presentes; recuentos de `users` y `workouts` iguales a los previos; filas históricas de
`workouts` con `generationMode='unknown'`. **Parada** ante cualquier error, estado parcial, checksum distinto o recuentos distintos: no
desplegar backend y escalar a revisión humana. Duración y locks reales: **DESCONOCIDOS** (volumen de tablas no inspeccionado).

## 5. Migración 5: tratamiento especial

| Aspecto | Hecho | Procedencia |
|---|---|---|
| Checksum final | `4becd718c9cd71fb9222ff3ea485729030abd71c20da8ea428647f1d57039ece` = SHA-256 del `migration.sql` local | [LOCAL] (verificado en este trabajo) |
| Historial | editada tras una aplicación inicial en la BD **local aislada**; versión inicial no conservada; retirada y reaplicada solo allí (04:29:42Z). Historia en `MIGRATION-5.md` y doc 10 §11 | [LOCAL] |
| Producción | `_prisma_migrations` sin la migración 5 y sin sus 4 columnas ni el índice | [OPERADOR] (consulta de solo lectura previa de Toni); no re-consultado |
| Otros entornos | **desconocido**; no se extrapola | [DESCONOCIDO] |

**Regla de parada:** si en **cualquier** entorno destino aparece la migración 5 con un checksum distinto de `4becd718…039ece` o con
estado parcial (fila sin `finished_at`, columnas a medias), **no aplicar nada**, detener y pedir revisión humana. **No** se edita una
migración ya aplicada ni se re-baselinea con `migrate resolve` sin decisión explícita y backup. La edición histórica ya ocurrió
solo en la BD sintética; el fichero no debe volver a modificarse.

## 6. Despliegue coordinado

Dependencias: **migraciones → backend → frontend** (D10 v1 §2–3). Backend nuevo con esquema antiguo **rompe**; frontend nuevo con
backend antiguo funciona salvo el login OAuth (`/auth/oauth/exchange` inexistente: fallo seguro). El flujo OAuth con código de un
solo uso exige backend y frontend del mismo SHA; la auto-vinculación por email está retirada (usuarios existentes que dependían de ella
necesitarán su método original; cuentas locales preregistradas con emails ajenos siguen existiendo).

**Riesgo estructural:** `main` dispara a la vez Vercel (producción) y Render (`autoDeploy=yes` [OPERADOR]). Por tanto, antes de mover `main`
debe existir (acción futura que requiere aprobación; **no se asume que exista el mecanismo**): (a) las migraciones aplicadas y
verificadas, (b) `ADMIN_USER_IDS` definido, y (c) una de estas opciones, a decidir: pausar *Auto-Deploy* del servicio Render durante la
ventana y desplegar manualmente tras migrar; o usar «After CI checks»/filtros de ruta si el proveedor los ofrece; o una rama de
despliegue distinta. Las capacidades reales de Render/Vercel **no están verificadas**.

Secuencia propuesta (todo *sujeto a autorización*): R0 confirmar B1–B5 → R1 backup → R2 lectura de `_prisma_migrations` y estado → R3
aplicar migraciones 1→6 con parada ante cualquier desviación → R4 fijar variables del backend → R5 desplegar backend (SHA verificado) y
verificar → R6 desplegar frontend del mismo SHA → R7 observación. El adelanto de `staging`/`production` no cambia producción de
Vercel pero crea previews contra la API compartida (§2): evitarlo mientras no haya API aislada.

## 7. Verificación posterior (futura, no destructiva)

| Qué | Evidencia | Notas |
|---|---|---|
| Migraciones | 6 filas con `finished_at` y checksums iguales a §4; objetos presentes | lectura autorizada |
| Versión desplegada | SHA del despliegue en Render y Vercel = SHA verificado | metadatos de panel |
| Salud | `/health/ready` del backend nuevo | **requiere autorización**: es una petición al servicio |
| Auth / OAuth / admin | humo con la **identidad QA dedicada** y datos sintéticos; nunca la cuenta personal ni el administrador real como QA | **requiere autorización explícita** |
| Generación / idempotencia | una rutina con `Idempotency-Key` y repetición | idem |
| Logs | ausencia de `auth.email_canonical_conflict` masivo, 5xx y fallos de refresh | metadatos de observabilidad; sin datos personales |

Configuración de arranque propuesta (decisión de Toni, no inspeccionada): `SECURITY_CONFIG_MODE=warn`, `AUTH_ACCEPT_LEGACY_TOKENS=true`,
`IDEMPOTENCY_KEY_ENFORCEMENT=warn`; endurecer más tarde según D10 v1 §5. `ADMIN_EMAILS` **ya no concede nada** (D10 v1 §7 queda desfasado).

## 8. Rollback y recuperación

| Plano | Procedimiento | Límites |
|---|---|---|
| Código | redesplegar el artefacto anterior (Render: despliegue previo; Vercel: rollback a `77f852aa`). El esquema aditivo es compatible con el código antiguo | las sesiones del backend nuevo dejan de valer (re-login); sin pérdida de datos. Mover una rama atrás **no** revierte un despliegue |
| Esquema | forward-only; **no** borrar tablas/columnas ni revertir migraciones expand-only como recuperación | retirar objetos exige backup de esas tablas, ventana, código que ya no los use y autorización aparte |
| Datos | restauración desde backup/rama punto-en-el-tiempo solo por decisión de Toni, con pérdida de escrituras posteriores a evaluar | **punto de no retorno**: escrituras de usuarios sobre las tablas nuevas tras el despliegue |

Detenerse y escalar ante: checksum distinto, migración parcial, recuentos distintos, error de arranque del backend con
`SECURITY_CONFIG_MODE=enforce`, o cualquier despliegue automático inesperado.

## 9. Matriz de gates

| Gate | Evidencia requerida | Estado actual | Responsable/decisor | Bloquea |
|---|---|---|---|---|
| B1 plataforma y runner | decisión escrita | abierto | Toni | migración y release |
| B2 destino de BD correcto | comprobación por etiqueta/huella, sin URL | no hecha | Toni + operador | migración |
| B3 backup | identificador y verificación | no hecho | operador | migración |
| B4 historial/checksums destino | lectura de `_prisma_migrations` | solo migración 5 (reportada) | operador (autorizado) | migración |
| B5 `ADMIN_USER_IDS` | variable presente con UUID designado | **ausente** [OPERADOR] | Toni | backend |
| B6 modos de runtime | decisión documentada | pendiente | Toni | backend |
| B7 auto-deploy `main` | mecanismo decidido | abierto | Toni | `main` |
| AI-06-AC10 seguridad humana | informe firmado | pendiente | revisor de seguridad | lanzamiento |
| AI-03 profesional ejercicio | acta | pendiente | profesional | lanzamiento |
| Hermes copy | aprobación por cadena | pendiente | Hermes | lanzamiento |
| Legal L1–L8 | dictamen | pendiente | letrado | lanzamiento |
| E2E general sobre árbol final | ejecución | no ejecutado | agente/QA | release |
| Purgas programadas | job/scheduler | no existe | Toni | observabilidad/storage |
| G1–G4 | — | **no evaluados; ninguno aprobado** | Toni | — |

## 10. Checklist de autorización futura (preguntas para Toni)

1. ¿Autorizas, con fecha y ventana, la lectura de `_prisma_migrations` del destino (solo checksum, nombre y `finished_at`)?
2. ¿Qué mecanismo usarás para impedir que `main` despliegue el backend antes de migrar (pausar Auto-Deploy, filtro, otra rama)?
3. ¿Qué plataforma y runner son los oficiales para migrar (B1) y quién tiene acceso?
4. ¿Quién y dónde fijará `ADMIN_USER_IDS` con el UUID designado (sin pasarlo por chat)?
5. ¿Qué modos de `SECURITY_CONFIG_MODE`, `AUTH_ACCEPT_LEGACY_TOKENS` e `IDEMPOTENCY_KEY_ENFORCEMENT` quieres al arrancar?
6. ¿Dónde está y cómo se verifica el backup previo?
7. ¿Aceptas el efecto de retirar la auto-vinculación OAuth sobre usuarios existentes y qué comunicación/soporte habrá?
8. ¿Qué revisiones (seguridad, profesional, Hermes, legal) esperas cerradas antes de producción y cuáles aceptas como riesgo?
9. ¿Habrá una API/BD de staging real antes de volver a promover `staging`?

## 11. Riesgos y decisiones pendientes

| Riesgo | Impacto | Estado |
|---|---|---|
| Previews de `staging` comparten backend y BD con producción | tráfico de preview sobre datos reales | abierto; hipótesis [OPERADOR] |
| `main` despliega backend sin migraciones por auto-deploy | caída de la API de producción | abierto (B7) |
| `ADMIN_USER_IDS` ausente | nadie administra tras desplegar | bloqueo (B5) |
| Migración 5 con historial de edición local | divergencia si algún entorno aplicó la versión previa | evidencia solo para producción; parada §5 |
| Auto-vinculación OAuth retirada | usuarios que dependían de ella pierden ese acceso | decisión de producto pendiente |
| Cuentas locales preregistradas con emails ajenos | siguen existiendo | decisión de soporte |
| Contrato `PRODUCTION_RUNTIME.md` vs. realidad | runner/plataforma inciertos | B1 |
| Frontend nuevo ya desplegado como preview contra API antigua | OAuth no funcional en previews | informativo |
| Tokens en `localStorage`, cookie de transacción OAuth sin firmar, 401 intermitente sin causa | residual | riesgos conocidos, sin cambio |

## 12. Anexo: plantilla futura — **PLANTILLA FUTURA — NO EJECUTADA**

Solo se incluye lo respaldado por el repo (`backend/package.json`: `prisma:deploy` = `prisma migrate deploy`; CI usa
`pnpm exec prisma migrate deploy`). No se ofrece ningún `psql`/SQL contra producción ni se demuestra que el runner sea el definitivo (B1);
el diseño de la comprobación de destino por huella queda por definir.

```bash
# PLANTILLA FUTURA — NO EJECUTADA. Requiere B1–B5 cerrados y autorización escrita de Toni.
# Fail-closed: aborta salvo confirmación humana explícita del destino. NO PEGAR SECRETOS EN ESTE FICHERO.
set -euo pipefail
: "${EXPECTED_TARGET_LABEL:?etiqueta del destino confirmada por Toni (p. ej. proyecto Neon + rama)}"
read -r -p "Escribe exactamente '${EXPECTED_TARGET_LABEL}' para confirmar el destino: " CONFIRM
[ "$CONFIRM" = "$EXPECTED_TARGET_LABEL" ] || { echo "Destino no confirmado: abortado"; exit 3; }
export DATABASE_URL="<PRODUCTION_DIRECT_DATABASE_URL>"        # inyectada por el operador desde su gestor; nunca escrita aquí
cd backend
pnpm exec prisma migrate status          # 1) SOLO lectura: debe listar exactamente las migraciones pendientes esperadas
# detenerse y revisar la salida con un humano; solo entonces:
# pnpm exec prisma migrate deploy        # 2) aplicar 1→6 (autorización separada; B3 backup verificado)
```

No se incluye ninguna orden para fijar `ADMIN_USER_IDS` (`<APPROVED_ADMIN_UUID>`), pausar Auto-Deploy ni desplegar: dependen de
capacidades de Render/Vercel no verificadas y de decisiones pendientes.

## 13. Confirmación

Solo lectura local y redacción: no se ejecutaron consultas remotas, migraciones, pruebas, builds, despliegues, promociones ni cambios de
configuración; no se leyó ningún `.env*`. **RELEASE NO AUTORIZADO.**

---
## Addendum v2.1 (2026-10-12) — referencia de estado y correcciones factuales (texto anterior sin cambios)
- Estado de las nueve preguntas del §10: ver `22-d10-checklist-resolution-v1.md`. 1 resuelta con evidencia local (Q5), 1 con dato del
  operador (Q9, estado actual) y 7 pendientes de Toni y/o de consulta autorizada.
- **Corrección factual al §7 y B6:** con `SECURITY_CONFIG_MODE`, `AUTH_ACCEPT_LEGACY_TOKENS` e `IDEMPOTENCY_KEY_ENFORCEMENT` ausentes, el
  código arranca por defecto en `warn` / `true` / `warn` (`backend/src/config/env.ts`): coincide con la configuración inicial propuesta, por
  lo que no es necesario fijarlas para el primer arranque.
- **Precisión sobre B5:** entradas de `ADMIN_USER_IDS` que no sean UUID canónico se descartan en silencio; tras fijarla hay que comprobar
  que el administrador designado obtiene acceso (y un usuario normal, 403).
- **Punto abierto adicional (B1/B2):** `schema.prisma` no declara `directUrl`; si el destino usa pooler, la migración puede requerir
  conexión directa. No asumido.
- `RELEASE NO AUTORIZADO` permanece vigente.

---
## Addendum v2.2 (2026-10-12) — decisiones de planificación registradas (texto anterior sin cambios)
Detalle y matriz en `22-d10-checklist-resolution-v1.md` (addendum v1.1). Cambios de estado respecto de v2.1:
- **Q1:** lectura de `migration_name`/`checksum`/`finished_at` **autorizada pero NO ejecutada** (sin herramienta que garantice el alcance); B4 sigue
  abierto hasta ejecución manual supervisada.
- **Q3 / B1:** se registra **`ANCLORA_AUTHORITY_CONFLICT`** para la acción «migrar producción» (contrato canónico Supabase frente a
  Express/Prisma/Neon/Render). Se detiene esa acción hasta que Toni actualice el contrato o confirme su aplicación. El modelo de runtime
  local `PRODUCTION_BACKED` sigue vigente en el contrato; su configuración efectiva **no se verificó**; las bases Docker locales son un fallback
  reportado, no un entorno aprobado.
- **Q4 / B5:** Toni fijará personalmente el UUID; cierre solo con confirmación y prueba funcional posterior.
- **Q5 / B6:** defaults `warn`/`true`/`warn` como compatibilidad transitoria **propuesta**; legacy habilitado es riesgo temporal.
- **Q6 / B3:** bloqueado hasta backup ejecutado y verificable bajo autorización.
- **Q7:** el impacto de retirar la auto-vinculación **no** se acepta; es bloqueo del cambio OAuth.
- **Q9:** decisión actual: no crear staging; los previews no son seguros para pruebas que escriban datos.
- Las plantillas del §12 siguen **NO EJECUTADAS**; no deben usarse mientras exista el conflicto de autoridad.
`RELEASE NO AUTORIZADO` permanece vigente.

---
## Addendum v2.3 (2026-10-12) — arquitectura y runner decididos (texto anterior sin cambios)
- La contradicción de §2 («Supabase vs Prisma/Neon/Render») queda **resuelta documentalmente**: contrato canónico actualizado
  (`.anclora/PRODUCTION_RUNTIME.md` v2.1). Detalle en `23-d10-architecture-and-runner-decision.md`.
- Runner para §4/§12: `.github/workflows/production-migrations.yml` (manual, entorno `production-migrations`, SHA completo, sin deploy).
  Sustituye a la plantilla genérica del §12 como camino previsto; **implementado local, no verificado, no ejecutado**.
- Siguen vigentes los bloqueos B2–B9 (ledger, backup, migración 5, `ADMIN_USER_IDS`, auto-deploy de `main`, revisiones). El §12 sigue
  **NO EJECUTADO**. `RELEASE NO AUTORIZADO`.
