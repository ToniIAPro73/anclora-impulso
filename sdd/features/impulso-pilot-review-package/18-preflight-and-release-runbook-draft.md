# 18 — Preflight y borrador de runbook de migración/promoción (2026-10-12)

> **BORRADOR OPERATIVO. No es una autorización ni una orden.** Solo hubo inspección de lectura y redacción (ver §10).
> Todo comando figura como `PROPUESTO — NO EJECUTADO`. Ningún valor secreto, UUID de administrador ni cadena de conexión aparece aquí.
> No cambia el estado de ninguna tarea AI-xx ni gate (G1–G4); no sustituye a las revisiones profesional, de seguridad, Hermes o legal.

Nivel de certeza usado: **verificado** (comprobado ahora en ficheros o consulta de solo lectura) · **inferido** (deducido de evidencia
indirecta) · **desconocido** (requiere consulta autorizada a un proveedor).

## 1. Estado Git comprobado

| Dato | Valor | Certeza |
|---|---|---|
| `HEAD` / rama local | `0978402` / `development`, árbol limpio (0 entradas) | verificado (`git status`, `git log --decorate`) |
| Commits de este incremento | `2b9842a` (código/tests/tooling), `0978402` (informes) sobre `ed4bb64` | verificado |
| `origin/development` (ref de seguimiento local) | `0978402` | verificado (ref local; sin `fetch` ahora) |
| `origin/staging` (ref de seguimiento local) | `ed4bb64` | verificado como ref local; **puede estar desfasada**, no se hizo `fetch` |
| `origin/production`, `origin/main` | `77f852aa` según el estado comunicado y el historial de la sesión | **reportado, no verificado ahora** (la consulta git sobre ese SHA fue denegada por permisos) |
| CI de `0978402` | success, run `38237901438`, workflow CI — https://github.com/ToniIAPro73/anclora-impulso/actions/runs/38237901438 | verificado (consulta de solo lectura con `gh`) |
| Historial del workflow *Promote / Environment* | ejecuciones success: `77f852a` ×3 (2026-10-03 13:48–13:49, secuencia staging→production→main), `944eb67` (2026-10-12 07:09Z), `ed4bb64` (2026-10-12 07:41Z), `511274f` (2026-09-24) | verificado (`gh run list`) |

Consecuencia importante: **`staging` ya recibió por el workflow las versiones `944eb67` y `ed4bb64`**, es decir, ya contiene la lógica de
sesiones/idempotencia que exige esquema nuevo (ver §3). Lo que no se sabe es si algún servicio la desplegó.

## 2. Resumen ejecutivo

| Destino | ¿Se puede promover ahora? | Motivo principal |
|---|---|---|
| **`staging`** | **No recomendado hasta confirmar** | no se ha verificado qué hace el avance de la rama (despliegue, BD, OAuth); el manifiesto declara una única BD de producción y prohíbe BD de staging salvo petición de Toni. Si un servicio despliega esa rama contra la BD de producción, ya estaría ejecutando código que necesita tablas inexistentes. **Primera acción: comprobar en los paneles de proveedor qué ocurrió tras las promociones del 12-oct (07:09Z y 07:41Z).** |
| **`production`** | **No** | migraciones sin aplicar; D10 prohíbe backend nuevo con esquema antiguo; B1 sin resolver; `ADMIN_USER_IDS` sin confirmar; revisiones pendientes |
| **`main`** | **No** | depende de `production`; semántica de `main` sin definir (R5) |

Conclusión: **PREPARADO** como borrador, con **bloqueos explícitos** y varios puntos `DESCONOCIDO` que solo se resuelven con consulta
autorizada a los proveedores (§9).

## 3. Efecto de cada rama (workflows y despliegue)

| Rama | Qué ejecuta Git/CI al avanzar | Despliegue en repo | Certeza |
|---|---|---|---|
| `development` | `ci.yml` (push): backend con Postgres 16 **efímero** (`prisma migrate deploy` contra el servicio del job), tests y build; frontend lint/typecheck/test/build. No toca servicios externos | no hay `vercel.json`, `render.yaml`, `railway.*`, `Procfile` en el repo | verificado |
| `staging` | igual `ci.yml`. Se avanza con `promote.yml` (manual, `workflow_dispatch`): fast-forward de `development`→`staging` si el estado combinado del SHA no es `failure/error`; hace `git push` con el token del workflow | **desconocido**: ninguna definición de despliegue en el repo; si Vercel/Railway/Render escuchan la rama, el despliegue ocurre fuera del repo | verificado (workflow) / desconocido (hosting) |
| `production` | `ci.yml` + promote (`staging`→`production`) | `docs/operations/DEPLOY.md` describe Railway/Render (backend) + Vercel (frontend) + Neon con migraciones **manuales** (`prisma migrate deploy` por CLI); `PRODUCTION_RUNTIME.md` declara «Vercel Serverless Functions» + «Supabase» para migraciones → **discrepancia B1** | verificado (docs) / desconocido (realidad) |
| `main` | `ci.yml` + promote (`production`→`main`); el paso final hace `npm ci` si existe `package-lock.json` | sin definición | verificado (workflow) |

`promote.yml` no aplica migraciones, no despliega por sí mismo y no contacta proveedores; **solo mueve la referencia**. Cualquier despliegue
es consecuencia de integraciones del hosting escuchando esa rama (**desconocido**).

## 4. Inventario de migraciones

Fuente: `backend/prisma/migrations/` en `0978402` (lectura de cada `migration.sql` completo) y `schema.prisma`. **La comparación literal
con `77f852aa` mediante `git diff` no se pudo ejecutar (consulta denegada por permisos)**: la lista de nuevas se obtiene por el prefijo
`20261012…` (los 20 anteriores son la línea base, coherente con el `verify-migrations` local y con D10 §3.1) y debe reconfirmarse contra
`77f852aa` y contra `_prisma_migrations` de producción antes de usarla.

Directorio: 26 migraciones + `migration_lock.toml`. Línea base: 20 (de `20251120020551_init` a `20260914130000_add_health_plans`, incl.
`20260905093156_add_oauth_accounts` y `20260914130000_add_health_plans`).

| # | Migración | SHA-256 de `migration.sql` | Cambio | Compatibilidad hacia atrás / bloqueo | Recuperación |
|---|---|---|---|---|---|
| 1 | `20261012030000_add_workout_generation_provenance` | `940e0cba…d9f9` | `workouts`: 3 columnas (`generationMode` NOT NULL DEFAULT `'unknown'`, `generationVersion`, `generationReason`) + CHECK de valores | código antiguo ignora las columnas. `ADD COLUMN … DEFAULT` es de metadatos (PG ≥ 11); el `CHECK` valida la tabla `workouts` con bloqueo breve (tamaño de tabla **no inspeccionado**) | código primero; borrar columnas solo con decisión aparte |
| 2 | `20261012030100_add_idempotency_records` | `3c4df009…4584` | tabla nueva `idempotency_records` (CHECK, único `(userId,operation,key)`, FK a `users` ON DELETE CASCADE) | tabla nueva, ignorada por código antiguo | no borrar sin backup (puede contener resultados) |
| 3 | `20261012030200_add_auth_sessions` | `d79b1dc1…0c45` | `users.disabledAt` nullable; tablas `auth_sessions`, `refresh_tokens` + índices + FKs | `ALTER TABLE users ADD COLUMN` nullable (metadatos). Tablas nuevas | tras volver al código antiguo, las sesiones nuevas dejan de valer (re-login), sin pérdida de datos |
| 4 | `20261012040000_add_coach_usage_operational_counters` | `63f6e084…4ebb25` | `coach_usage_windows`: 2 contadores DEFAULT 0 | metadatos | idem |
| 5 | `20261012050000_add_idempotency_quota_reservation` | `4becd718…039ece` | `idempotency_records`: 4 columnas + índice `reservedWindowId` | **requiere la migración 2**; metadatos + `CREATE INDEX` (tabla nueva, vacía) | idem. **Historial:** este fichero se editó tras aplicarse una vez en la BD de pruebas local y se reaplicó (checksum actual = `4becd718…`; ver doc 10 §11). Solo es seguro si **ningún otro entorno** aplicó la versión anterior; no volver a editarlo |
| 6 | `20261012090000_add_oauth_handoffs` | `cd8d9e79…a888` | tabla nueva `oauth_handoffs` (único `codeHash`, índice `expiresAt`, FK a `users` CASCADE) | tabla nueva, ignorada por código antiguo | `DROP TABLE` solo con backup y decisión aparte |

Observaciones:
- Todas son *expand-only* en su contenido SQL (leído). Eso **no** prueba reversibilidad de datos; los `Rollback` de los comentarios son
  referencia y no están validados contra datos reales.
- Orden obligatorio: 1→6 por nombre (Prisma las aplica por orden lexicográfico); 5 depende de 2; 3 y 6 dependen de `users`.
- Tiempo/lock: todas son pequeñas; el único punto con barrido de tabla es el `CHECK` de la migración 1 (volumen de `workouts` en
  producción: **desconocido**).
- Contrato de runner: `PRODUCTION_RUNTIME.md` dice `SUPABASE_DASHBOARD_OR_CLI`/`MANUAL_OR_CONSOLE`; el repo usa Prisma sobre Neon
  (`prisma migrate deploy`). **Bloqueo B1: no se reescribe el contrato; Toni debe decidir cuál es el runner y el destino reales.**
- `verify-migrations` local (BD de pruebas aislada) pasó con 26 migraciones, limpia = upgrade = `schema.prisma` (doc 17 §6). No es
  evidencia sobre producción.

## 5. Matriz de configuración (solo nombres; valores NO inspeccionados)

Nombres extraídos de `process.env.*` en `backend/src` y de `NEXT_PUBLIC_*` del frontend. «Prod/Staging» = estado de presencia/valor: **no
inspeccionado** en todos los casos (no se leyó ningún `.env*` ni panel).

| Variable | Servicio | Propósito / valor esperado (sin revelar) | Estado |
|---|---|---|---|
| `DATABASE_URL` | backend | destino de BD; **debe** ser la BD acordada para el entorno (ver B1/§7) | no inspeccionado |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | backend | ≥ 32 caracteres y distintos (B2 de D10); con `SECURITY_CONFIG_MODE=enforce` valores débiles impiden arrancar | no inspeccionado |
| `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | backend | vida de access/refresh; D10 propone mantener al inicio | no inspeccionado |
| **`ADMIN_USER_IDS`** | backend | UUID(s) de las cuentas administradoras. **Precondición del backend**: sin ella nadie es admin (fallo cerrado). Toni/operador debe confirmar el UUID en el gestor autorizado; no copiarlo aquí | **pendiente** |
| `ADMIN_EMAILS` | backend | **ya no concede nada** (ignorada; solo avisa en arranque). D10 §7 queda desfasado en este punto | obsoleta |
| `AUTH_ACCEPT_LEGACY_TOKENS` | backend | `true` al inicio (D10 §3) | no inspeccionado |
| `AUTH_REFRESH_SESSION_DAYS`, `AUTH_REFRESH_REUSE_GRACE_SECONDS` | backend | sesiones | no inspeccionado |
| `SECURITY_CONFIG_MODE` | backend | `warn` al inicio; `enforce` solo con secretos confirmados | no inspeccionado |
| `IDEMPOTENCY_KEY_ENFORCEMENT`, `IDEMPOTENCY_LEGACY_SUNSET_AT`, `IDEMPOTENCY_MAX_ATTEMPTS`, `IDEMPOTENCY_RETENTION_HOURS` | backend | `warn` al inicio; la fecha de retirada solo cuando se decida | no inspeccionado |
| `FRONTEND_URL` | backend | CORS y destino de las redirecciones OAuth (primer valor) | no inspeccionado |
| `GOOGLE_OAUTH_CLIENT_ID/SECRET/CALLBACK_URL`, `GITHUB_OAUTH_CLIENT_ID/SECRET/CALLBACK_URL` | backend | OAuth; las URLs de callback deben apuntar al API **del entorno** | no inspeccionado |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`, `NEXT_PUBLIC_ENABLE_GITHUB_AUTH` | frontend | URL del API; activación de botones sociales | no inspeccionado |
| `OAUTH_HANDOFF_TTL_SECONDS` | backend | opcional (60 s por defecto, acotado 10–300) | opcional |
| `GROQ_API_KEY`, `GROQ_MODEL`, `LLM_PROVIDER`, `LLM_COACH_*`, `LLM_WORKOUT_TIMEOUT_MS`, `OPENAI_API_KEY` | backend | IA; **en staging, sin clave ⇒ sin llamadas** | no inspeccionado |
| `SMTP_*`, `NOTIFICATION_DISPATCH_INTERVAL_MINUTES` | backend | correo/notificaciones; en staging, vacío evita envíos reales | no inspeccionado |
| `RETENTION_PURGE_BATCH_SIZE`, `RETENTION_PURGE_GRACE_SECONDS` | script de purga | **no hay scheduler configurado** | pendiente |
| `FORM_ANALYSIS_ENABLED`, `HEALTH_DATA_IMPORT_ENABLED`, `VOICE_COACH_ENABLED`, `WEARABLE_*_ENABLED` | backend | flags de funciones | no inspeccionado |
| `NODE_ENV`, `PORT` | backend | runtime | no inspeccionado |

Compatibilidad OAuth (doc 17 §4): backend y frontend deben salir **juntos**; frontend nuevo + backend antiguo y viceversa fallan de forma
segura (error), no con sesión inválida. El callback antiguo con tokens en la URL ya no instala nada. La política ya no auto-vincula por
email: usuarios que dependían de ello necesitarán su método original (pendiente de producto/soporte).

Caducidad/limpieza: `oauth_handoffs` caduca lógicamente (60 s por defecto) y **no se purga físicamente**: `purge-expired.ts` solo
cubre idempotencia y sesiones; `purgeExpiredOAuthHandoffs` existe pero **ningún job lo invoca**. Responsabilidad operativa pendiente.

## 6. Etapas propuestas (todas `PROPUESTO — NO EJECUTADO`)

Responsables por rol: **PROP** = propietario (Toni); **OPS** = operador con acceso a proveedores; **REL** = ingeniero de release;
**REV** = revisores (seguridad/profesional/Hermes/legal). Cada paso exige autorización explícita del PROP antes de ejecutarse.

### R0 — Preflight documental
| Paso | Responsable | Evidencia de entrada | Acción propuesta | Parada si |
|---|---|---|---|---|
| R0.1 | REL | este documento | confirmar SHAs remotos: `git ls-remote --heads origin` (solo lectura de red) | `production`/`main` ≠ `77f852aa` o `staging` ≠ `ed4bb64` |
| R0.2 | OPS | acceso a paneles | listar, **sin modificar**, proyectos/servicios que escuchan cada rama y sus últimos despliegues (Vercel/Railway/Render) y a qué BD apuntan sus variables (solo nombre/host, no credenciales) | no se puede establecer qué ocurrió el 12-oct 07:09Z/07:41Z |
| R0.3 | PROP | decisión B1 | fijar runner y destino de migraciones (Prisma/Neon vs Supabase) | B1 sin decidir |
| R0.4 | PROP/OPS | gestor de secretos | confirmar el UUID de la cuenta admin y que `ADMIN_USER_IDS` se fijará antes del backend | sin confirmar |

### R1 — Staging
Precondición dura: demostrar que staging tiene **BD y servicios propios y sintéticos** (o que no tiene despliegue). Si R0.2 muestra que
la rama despliega contra la BD de producción: **detener, tratarlo como incidente** (código que necesita tablas inexistentes) y decidir
si desactivar el auto-deploy de esa rama o aplicar R2 primero.
| Paso | Responsable | Acción propuesta | Resultado esperado | Parada si |
|---|---|---|---|---|
| R1.1 | OPS | verificar aislamiento de datos/OAuth/IA/correo de staging (nombres de variable y host de BD, sin valores) | BD distinta de producción; claves de IA/SMTP vacías o de prueba | cualquier recurso compartido con producción |
| R1.2 | REL | si la rama ya está desplegada: `GET <staging>/health/ready` (solo lectura) | 200 | 5xx |
| R1.3 | PROP | decidir si se avanza `staging` a `0978402`: `gh workflow run promote.yml -f target=staging` — **PROPUESTO — NO EJECUTADO** | ref movida a `0978402` | R1.1 no cumplida |

### R2 — Migración (solo tras R0 y autorización explícita)
| Paso | Responsable | Acción propuesta | Resultado esperado | Parada si |
|---|---|---|---|---|
| R2.1 | OPS | backup/branch point-in-time de la BD de producción según el proveedor (Neon: rama o export); anotar identificador | backup verificable | sin backup comprobado |
| R2.2 | OPS | solo lectura: `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name;` | las 20 migraciones de línea base con `finished_at` no nulo; ninguna de `20261012*` | faltan de la base, aplicadas de forma parcial o checksums distintos |
| R2.3 | REL | desde una copia fiel del SHA, sin `.env*`: `DATABASE_URL=<NO PEGAR SECRETOS> pnpm exec prisma migrate status` | «6 migrations pending» (solo esas) | deriva o migraciones desconocidas |
| R2.4 | PROP | autorización escrita de la ventana | — | no autorizado |
| R2.5 | OPS/REL | `DATABASE_URL=<NO PEGAR SECRETOS> pnpm exec prisma migrate deploy` | 6 aplicadas en orden | cualquier error ⇒ **no desplegar backend** (cada migración es una transacción) |
| R2.6 | OPS | verificar tablas/columnas (`information_schema`) y recuentos de `users`/`workouts` iguales a R2.2; `workouts` históricos con `generationMode='unknown'` | sin pérdida | diferencia de recuentos |

### R3 — Backend y frontend (orden compatible con OAuth)
| Paso | Responsable | Acción propuesta | Resultado esperado | Parada si |
|---|---|---|---|---|
| R3.1 | OPS | fijar variables del backend (§5): `ADMIN_USER_IDS`, secretos JWT, `AUTH_ACCEPT_LEGACY_TOKENS=true`, `IDEMPOTENCY_KEY_ENFORCEMENT=warn`, `SECURITY_CONFIG_MODE=warn`, `FRONTEND_URL`, OAuth callbacks del entorno | variables presentes (comprobar solo presencia) | falta `ADMIN_USER_IDS` o secretos |
| R3.2 | REL | desplegar backend del SHA verificado | `/health/ready` ok | 5xx por encima de la línea base ⇒ recuperación de código (§7) |
| R3.3 | REL/OPS | humo con la identidad QA dedicada (`QA_PERSISTENT_IDENTITY`; nunca la cuenta personal ni el administrador): login, refresh, logout, generar rutina, `/api/dashboard/*` 401/403/200 con el admin designado | verde | cualquier fallo |
| R3.4 | REL | desplegar frontend **del mismo SHA** | `/auth/login` carga; botones sociales según flags | errores de refresh/401 |
| R3.5 | REL/OPS | humo OAuth con cuentas de prueba (requiere proveedores configurados): flujo nuevo, rechazo de email ya usado | funciona / rechaza | — |
| R3.6 | OPS | observabilidad: tasa de refresh, 401 por ruta, uso de tokens legacy, crecimiento de `idempotency_records`/`oauth_handoffs` | paneles activos | sin observabilidad |

### R4 — Estabilización y producción
Entradas: revisiones **no sustituibles por IA** completadas o aceptadas explícitamente por PROP: seguridad (AI-06-AC10), profesional del
ejercicio (AI-03), Hermes (copy del aviso de fallback, B5), legal (L1–L8) según corresponda; E2E general sobre el árbol final;
programación de la purga (idempotencia, sesiones, handoffs). Ventana de observación (D10 §5: D+7/D+14/D+30). Promoción:
`gh workflow run promote.yml -f target=production` — **PROPUESTO — NO EJECUTADO**, solo cuando R1–R3 estén cerrados.

### R5 — `main`
`main` se mueve con el mismo workflow desde `production`. **Su semántica no está definida** (¿espejo de producción, fuente de release,
con automatizaciones propias?). Decisión del PROP antes de promover; el paso `npm ci` condicionado a `package-lock.json` es el único
efecto automático conocido. Comando: `gh workflow run promote.yml -f target=main` — **PROPUESTO — NO EJECUTADO**.

## 7. Recuperación (separada)

- **Código:** redesplegar el artefacto anterior (backend y frontend). El esquema aditivo no se rompe con código antiguo. Efecto:
  las sesiones emitidas por el backend nuevo dejan de valer en el antiguo (re-login), sin pérdida de datos. Interruptores sin redespliegue:
  `AUTH_ACCEPT_LEGACY_TOKENS=true`, `IDEMPOTENCY_KEY_ENFORCEMENT=warn`, `SECURITY_CONFIG_MODE=warn`. Mover la rama atrás no es recuperación
  de despliegue por sí solo (depende del hosting).
- **Esquema:** forward-only. No hay `DROP` automático. Retirar tablas/columnas exige backup de esas tablas, ventana, código que ya no
  las use y autorización aparte. Las sentencias de los comentarios son referencia no validada.
- **Datos:** no se borra ni se revierte nada como parte de una recuperación. Restauración de BD desde backup/branch solo por decisión del PROP
  y con pérdida de escrituras posteriores a evaluar. Los datos de handoffs/idempotencia/sesiones creados tras migrar son recuperables
  solo si el backup es posterior.

## 8. Decisiones pendientes de Toni y revisiones no sustituibles por IA

| # | Decisión / revisión | Estado |
|---|---|---|
| 1 | Qué es realmente `staging` (¿servicio y BD propios o solo rama?) y qué ocurrió con las promociones del 12-oct | **desconocido** |
| 2 | B1: runner y destino de migraciones; contrato Supabase/Vercel vs Prisma/Neon/Express | abierto |
| 3 | Confirmar el UUID admin y fijar `ADMIN_USER_IDS` antes del backend | pendiente |
| 4 | Confirmación de secretos JWT (≥ 32, distintos) por su propietario | pendiente |
| 5 | Hermes: copy del aviso de fallback (`workout-generator.tsx`); `restrictedDesc` aún menciona `ADMIN_EMAILS` | pendiente |
| 6 | Revisión de seguridad humana (AI-06-AC10) | pendiente |
| 7 | Revisión profesional AI-03 y reglas AI-04/05 | pendiente |
| 8 | Revisión legal L1–L8 | pendiente |
| 9 | E2E general (`session-and-fallback`) sobre el árbol final | no ejecutado |
| 10 | Programar purga de idempotencia, sesiones y handoffs; y definir `main` | pendiente |
| 11 | Efecto de usuarios que dependían del auto-vínculo OAuth; cuentas locales preregistradas con emails ajenos | pendiente |
| 12 | Volumen de `workouts` en producción (bloqueo del `CHECK`) | desconocido |

## 9. Fuentes y certeza

| Afirmación | Fuente (ruta) | Certeza |
|---|---|---|
| Estado Git y commits | `git status`, `git log --decorate` (refs locales) | verificado |
| CI `0978402` success; historial de *Promote* | `gh run list` (solo lectura): run `38237901438` y los del §1 | verificado |
| `promote.yml` solo mueve refs (fast-forward, estado ≠ failure/error) | `.github/workflows/promote.yml` | verificado |
| CI usa Postgres efímero | `.github/workflows/ci.yml` | verificado |
| Sin config de despliegue en el repo | ausencia de `vercel.json`, `render.yaml`, `railway.*`, `Procfile` | verificado |
| BD de producción única y prohibición de BD de staging | `.anclora/PRODUCTION_RUNTIME.md` §3 | verificado (documento); realidad desconocida |
| Migraciones, SQL y checksums | `backend/prisma/migrations/*/migration.sql` (`shasum -a 256`) | verificado |
| Lista «nuevas» respecto de `77f852aa` | prefijo de nombre + `verify-migrations` local + D10 | inferido (diff literal no ejecutado) |
| Despliegue real de cada rama, BD de staging, OAuth de staging | — | **DESCONOCIDO — requiere consulta autorizada** |
| Valores de variables y presencia de secretos | — | **DESCONOCIDO — no inspeccionado** |

## 10. NO EJECUTADO

Solo hubo inspección de lectura y redacción de este documento. **No** se ejecutó `git push`, `git fetch`, `git pull`, `git merge`,
`git switch/checkout`, `git reset`, `git clean`, `git commit` ni `git tag`; no se lanzó ningún workflow; no se aplicó ninguna migración ni
SQL; no se desplegó nada; no se conectó a ninguna base de datos, a staging ni a producción; no se leyó ni imprimió ningún `.env*` ni
secreto. Las consultas a GitHub (`gh run list`) fueron de solo lectura. Varias consultas `git` que referenciaban el SHA de producción
fueron **denegadas por permisos** y no se reintentaron por otra vía; los puntos afectados figuran como no verificados.
No se cambió ningún estado de tarea AI-xx ni gate. Ningún ZIP de release se generó ni promovió.
