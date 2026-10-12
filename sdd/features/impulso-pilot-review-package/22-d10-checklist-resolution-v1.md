# 22 — Resolución del checklist D10 (revisión documental, v1, 2026-10-12)

> **RELEASE NO AUTORIZADO.** «Resuelta» significa *contestada con evidencia suficiente*; **no** aprueba ningún gate ni autoriza migrar,
> desplegar o promover. Revisión de lectura local: sin consultas remotas, sin `.env*`, sin valores, sin UUID.
> Etiquetas: **[LOCAL]** observado en el repo ahora · **[OPERADOR]** reportado, no verificado por mí · **[INFERIDO]** · **[DESCONOCIDO]**.

## 1. Estado Git observado (solo lectura)

`development` en `0978402`; sin cambios en archivos rastreados; sin commitear: informes 18–21 e `INDEX.md` (documentales). Sin `fetch`: las
refs remotas locales pueden estar desfasadas. [LOCAL]

## 2. Matriz de las nueve preguntas (literales del documento 21 §10)

| ID | Pregunta original | Evidencia disponible y procedencia | Resultado sustentado | Estado | Quién resuelve lo pendiente | Gate bloqueado |
|---|---|---|---|---|---|---|
| Q1 | «¿Autorizas, con fecha y ventana, la lectura de `_prisma_migrations` del destino (solo checksum, nombre y `finished_at`)?» | Solo hay lectura previa de la migración 5 [OPERADOR]; el SQL local y su checksum existen [LOCAL]. Ninguna evidencia sobre las migraciones 1–4 y 6 | La evidencia actual **no cubre** las otras cinco; la autorización es una decisión, no un dato | **PENDIENTE DE TONI** (decisión) → luego **CONSULTA AUTORIZADA** | Toni autoriza; operador ejecuta lectura | B4 (historial/checksums), migración |
| Q2 | «¿Qué mecanismo usarás para impedir que `main` despliegue el backend antes de migrar (pausar Auto-Deploy, filtro, otra rama)?» | Render: `rootDir=backend`, `main`, `autoDeploy=yes` [OPERADOR]. El repo **no** tiene `render.yaml` ni `vercel.json` [LOCAL]: el auto-deploy es ajuste de panel, no código; `promote.yml` solo mueve refs [LOCAL] | Existen al menos tres opciones, **ninguna demostrada** como disponible en el plan de Render; no se puede elegir por inferencia | **PENDIENTE DE TONI** | Toni (decide) + operador (confirma capacidades en el panel) | B7, promoción a `main` |
| Q3 | «¿Qué plataforma y runner son los oficiales para migrar (B1) y quién tiene acceso?» | Repo y CI: Prisma `migrate deploy` (`backend/package.json: prisma:deploy`; `.github/workflows/ci.yml` solo contra Postgres efímero) [LOCAL]. `DEPLOY.md`: Render/Railway + Neon, migración manual por CLI [LOCAL]. `PRODUCTION_RUNTIME.md`: «Vercel Serverless» + «Supabase … MANUAL_OR_CONSOLE» [LOCAL]. `AOS_ADOPTION.md` registra la discrepancia como abierta [LOCAL]. Operador: Express/Render/Neon [OPERADOR] | La implementación observada es Prisma+Neon+Express+Render; **el contrato oficial no está corregido** y no hay runner aprobado ni quién lo ejecuta | **PENDIENTE DE TONI** | Toni (contrato y titular del acceso) | B1, migración |
| Q4 | «¿Quién y dónde fijará `ADMIN_USER_IDS` con el UUID designado (sin pasarlo por chat)?» | Variable ausente en Render [OPERADOR]. El código la lee de `process.env.ADMIN_USER_IDS`, separa por comas y **descarta en silencio** cualquier entrada que no sea UUID hexadecimal canónico [LOCAL: `backend/src/config/env.ts:68`]; sin ninguna válida nadie es admin (fallo cerrado) [LOCAL] | Estado: ausente ⇒ bloqueo. Precisión nueva: **un UUID mal escrito no da error, simplemente deja a todos sin admin**; verificar tras fijarla (admin 200 vs 403) | **PENDIENTE DE TONI** (elige cuenta y responsable) | Toni (designa); operador (fija en el gestor) | B5, backend |
| Q5 | «¿Qué modos de `SECURITY_CONFIG_MODE`, `AUTH_ACCEPT_LEGACY_TOKENS` e `IDEMPOTENCY_KEY_ENFORCEMENT` quieres al arrancar?» | Reportadas **ausentes** [OPERADOR]. Defaults del código: `SECURITY_CONFIG_MODE='warn'`, `AUTH_ACCEPT_LEGACY_TOKENS=true` salvo `'false'`, `IDEMPOTENCY_KEY_ENFORCEMENT='warn'` [LOCAL: `env.ts:48,49,106`] | **Con las variables ausentes, el backend arranca exactamente en la configuración inicial que propone D10 v1 §3** (`warn` / `true` / `warn`). No hace falta fijarlas para el primer arranque; endurecer es decisión posterior (D10 v1 §5). `JWT_EXPIRES_IN` por defecto `7d` genera aviso `ACCESS_TOKEN_LIFETIME_LONG` (warning) | **RESUELTA CON EVIDENCIA LOCAL** (para el arranque inicial); la confirmación de que Toni lo acepta sigue siendo suya | Toni (aceptar) | B6 (se cierra al aceptar) |
| Q6 | «¿Dónde está y cómo se verifica el backup previo?» | El repo no contiene herramienta ni procedimiento de backup de BD (solo un backup local de Git en `scripts/README.md`, no relacionado) [LOCAL]. Nada del proveedor | No hay evidencia de backup ni de su verificación; depende de capacidades de Neon (rama punto-en-el-tiempo/export) **no verificadas** | **PENDIENTE DE CONSULTA AUTORIZADA** (panel de Neon: metadatos de retención/branching) y **PENDIENTE DE TONI** | operador/Toni | B3, migración |
| Q7 | «¿Aceptas el efecto de retirar la auto-vinculación OAuth sobre usuarios existentes y qué comunicación/soporte habrá?» | Política documentada y probada en local (doc 17 §3); efecto de transición descrito [LOCAL]. Número de usuarios con `oauth_accounts` o con cuenta local + OAuth: **desconocido** | El efecto está caracterizado: quien entraba por OAuth con email de una cuenta local ya no podrá; cuentas preregistradas ajenas siguen existiendo. Su aceptación y la comunicación son decisión de producto | **PENDIENTE DE TONI** | Toni | despliegue de OAuth; no bloquea la migración |
| Q8 | «¿Qué revisiones (seguridad, profesional, Hermes, legal) esperas cerradas antes de producción y cuáles aceptas como riesgo?» | `14-review-assignment-register.md` e informes 15–17: encargos originales *LISTO PARA ASIGNACIÓN*; solo análisis IA recibidos; sin firma ni acta [LOCAL]. Ningún documento firmado | Todas **siguen pendientes**; la decisión de cuáles se aceptan como riesgo es de Toni | **PENDIENTE DE TONI** | Toni; revisores cuando se designen | AI-06-AC10, AI-03, Hermes, legal; lanzamiento |
| Q9 | «¿Habrá una API/BD de staging real antes de volver a promover `staging`?» | `PRODUCTION_RUNTIME.md` §3 prohíbe BD de staging salvo petición de Toni [LOCAL]; los previews usan la API de producción y la BD compartida [OPERADOR]; informe 19: `staging` crea previews de Vercel [observado en el control plane, informe 19] | **Hoy no existe** API/BD de staging separadas (según el operador). Crearla requiere petición expresa de Toni (contrato actual) | **RESUELTA CON DATO DEL OPERADOR** para el estado actual; la decisión de crearla es **PENDIENTE DE TONI** | Toni | promoción a `staging` mientras previews compartan API |

Resumen: 1 resuelta con evidencia local (Q5), 1 resuelta con dato del operador (Q9, estado actual), 7 pendientes de Toni y/o de consulta
autorizada (Q1–Q4, Q6–Q8). Ninguna queda `NO APLICA`.

## 3. Verificaciones técnicas documentales

| Comprobación | Resultado | Procedencia |
|---|---|---|
| Migraciones y orden | 6 nuevas `20261012030000`, `…030100`, `…030200`, `…040000`, `…050000`, `…090000` tras 20 de línea base; 26 en total + `migration_lock.toml` | [LOCAL] `ls backend/prisma/migrations` |
| Checksum migración 5 | `4becd718c9cd71fb9222ff3ea485729030abd71c20da8ea428647f1d57039ece` **coincide** con el SQL local (recomputado) | [LOCAL] |
| Historial migración 5 | editada tras una aplicación en la BD local aislada; sin versión inicial conservada; no volver a editar (doc 10 §11, `MIGRATION-5.md`) | [LOCAL] |
| Qué se sabe del ledger remoto | solo la migración 5 (ausente, con sus objetos) según consulta previa; **las otras cinco no** | [OPERADOR] |
| Comandos de migración en el repo | `prisma:deploy` = `prisma migrate deploy`; CI usa `pnpm exec prisma migrate deploy`; `prisma migrate status` es comando estándar del CLI. Ninguno ejecutado | [LOCAL] |
| Runner remoto aprobado | **no demostrado** por el repo | [LOCAL] / [DESCONOCIDO] |
| Conexión directa vs pooler | **no determinado**: nada en el repo fija `directUrl` en `schema.prisma` (datasource solo `url = env("DATABASE_URL")`) | [LOCAL] |
| Pausa de auto-deploy | **no demostrable** desde el repo (ajuste de panel) | [LOCAL] |
| Mecanismo de backup | **ninguno en el repo** | [LOCAL] |
| `main` | sigue **bloqueada** (ver §4) | — |

Observación adicional (no resuelta): `schema.prisma` no declara `directUrl`; si el destino usa pooler de Neon, `prisma migrate deploy`
suele requerir conexión directa. **No se asume**; es un punto de B1/B2 para el operador.

## 4. Bloqueos que impiden migrar o promover a `main`

| # | Bloqueo | Para migrar | Para `main` |
|---|---|---|---|
| B1 | plataforma/runner oficial sin decidir | sí | sí |
| B2 | destino de BD sin confirmar por huella/etiqueta | sí | — |
| B3 | backup no demostrado | sí | sí (antes de cualquier cambio de backend) |
| B4 | ledger completo no leído | sí | sí |
| B5 | `ADMIN_USER_IDS` ausente | — | sí |
| B7 | auto-deploy de `main` activo y sin mecanismo decidido | — | sí |
| B8 | revisiones pendientes | — | sí (producción) |
| B9 | E2E general sobre árbol final y purgas | — | recomendado |

## 5. Consulta única agrupada para Toni (no sensible)

Responde con letra, sin pegar valores, URLs ni UUID:

1. **Mecanismo de auto-deploy (Q2):** (a) pausar Auto-Deploy en Render durante la ventana y desplegar a mano tras migrar · (b) mantenerlo
   activo pero con filtro/«after CI» si tu plan lo permite · (c) trasladar el backend a otra rama de despliegue. *Efecto:* (a) es la
   opción con menos incógnitas pero exige acción manual; (b)/(c) dependen de capacidades no verificadas.
2. **Plataforma oficial (Q3):** (a) Render + Neon + Prisma (corregir `PRODUCTION_RUNTIME.md`) · (b) otra. *Efecto:* desbloquea B1.
3. **Titular de la lectura de `_prisma_migrations` y de la migración (Q1/Q3):** ¿quién la ejecutará y desde qué entorno?
4. **Backup (Q6):** ¿usarás rama/restauración punto-en-el-tiempo de Neon o un export? ¿quién lo verifica?
5. **Arranque (Q5):** ¿aceptas `warn`/`true`/`warn` (defaults, sin tocar variables) para el primer despliegue?
6. **Revisiones (Q8):** ¿cuáles esperas cerradas antes de `main` y cuáles aceptas como riesgo conocido?
7. **OAuth (Q7):** ¿aceptas el efecto sobre usuarios existentes y quién da soporte?
8. **Staging (Q9):** ¿quieres que se cree API/BD de staging (petición expresa según el contrato) o se evita promover `staging`?

El UUID administrativo (Q4) se designa por un canal seguro del operador, no por chat.

## 6. Discrepancias documentos ↔ evidencia local

| Tema | Documento | Evidencia local |
|---|---|---|
| Backend | `PRODUCTION_RUNTIME.md`: «Vercel Serverless Functions» | repo Express + Prisma; auditorías y operador: Render |
| Runner | `PRODUCTION_RUNTIME.md`: «Supabase … MANUAL_OR_CONSOLE» | repo y `DEPLOY.md`: `prisma migrate deploy` sobre Neon |
| Admin | D10 v1 §7 cita `ADMIN_EMAILS` | ignorada por el código actual; se usa `ADMIN_USER_IDS` |
| Migraciones a aplicar | D10 v1 habla de «cuatro migraciones» | hay seis (la 5 y la 6 son posteriores) |
| `ADMIN_USER_IDS` | — | entradas inválidas se descartan en silencio (nuevo, Q4) |

## 7. Confirmación

No se realizaron consultas remotas, operaciones de base de datos, migraciones, pruebas, builds, cambios de hosting, despliegues ni
promociones. No se leyó ningún `.env*`. Ninguna tarea AI-xx, revisión profesional ni gate G1–G4 fue marcada como aceptada.
**RELEASE NO AUTORIZADO.**

---
# Addendum v1.1 (2026-10-12) — decisiones recomendadas de Toni aplicadas al registro (texto anterior sin cambios)

> **RELEASE NO AUTORIZADO.** Una decisión registrada **no** es una acción ejecutada ni un gate aprobado. Este addendum es de lectura local y
> redacción: no se leyó ningún `.env*`, no se hizo `fetch`, no se tocó ningún proveedor.
> Git observado (solo lectura): `development` @ `0978402`; archivos rastreados sin cambios; sin commitear solo documentación (informes 18–22
> e `INDEX.md`).

## A. Qué se pudo y qué no se pudo consultar

| Consulta | Resultado | Motivo |
|---|---|---|
| **Q1 — ledger remoto** (solo `migration_name`, `checksum`, `finished_at` de `_prisma_migrations`) | **NO EJECUTADA** | La autorización existe, pero esta sesión **no dispone de ninguna herramienta que pueda imponer ese alcance**: no hay conector de base de datos; hacerlo exigiría un cliente SQL o Prisma con una cadena de conexión que no poseo y que solo podría obtenerse leyendo `.env*` (prohibido). Según el propio texto de la autorización, si el alcance no puede garantizarse **no se usa** y Q1 queda para ejecución manual supervisada. No se intentó ninguna otra vía |
| Q2/Q3/Q6/Q9 — metadatos de hosting | **NO CONSULTADOS** | Render: sin conexión desde esta sesión. Vercel: la única herramienta de variables devuelve valores junto con nombres (se descartó, conforme a la regla del prompt) |

## B. Registro de decisiones, separado por naturaleza

**DECIDIDO (planificación; no ejecutado):** Q1 autorizar una lectura acotada; Q2 `main` sigue bloqueada; Q3 separar en dos asuntos y registrar el
conflicto de autoridad; Q4 Toni fija personalmente el UUID; Q5 defaults como compatibilidad transitoria; Q6 backup bloqueado hasta
autorización y evidencia; Q7 no aceptar el impacto OAuth por defecto; Q8 revisiones y G1–G4 siguen bloqueantes; Q9 no crear staging ahora.

**VERIFICADO [LOCAL] (observado en archivos ahora):**
- defaults del código: `SECURITY_CONFIG_MODE='warn'`, `AUTH_ACCEPT_LEGACY_TOKENS=true` (salvo `'false'`), `IDEMPOTENCY_KEY_ENFORCEMENT='warn'`
  (`backend/src/config/env.ts`);
- `ADMIN_USER_IDS` descarta en silencio entradas que no sean UUID canónico (`env.ts`);
- checksum local de la migración 5 `4becd718c9cd71fb9222ff3ea485729030abd71c20da8ea428647f1d57039ece`; seis migraciones nuevas por orden;
- el repo no contiene `render.yaml` ni `vercel.json` ni herramienta de backup de BD; `schema.prisma` no declara `directUrl`;
- `.anclora/PRODUCTION_RUNTIME.md`: `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED`, `LOCAL_DATABASE_SCOPE=production`, `MIGRATION_SYSTEM=Supabase
  PostgreSQL`, `MIGRATION_STRATEGY=SUPABASE_DASHBOARD_OR_CLI`, `MIGRATION_RUNNER=MANUAL_OR_CONSOLE`;
- `.anclora/AOS_ADOPTION.md`: la excepción `IMPULSO-TEST-DB-2026-10-12` cubre **solo** la BD aislada de pruebas de integración, no cambia
  `LOCAL_RUNTIME_MODEL`, ni el contrato de producción, ni el camino de migración; la discrepancia Supabase/Vercel vs Prisma/Neon/Express figura
  como `OPEN_DISCREPANCY` («el contrato no se reescribe aquí»).

**REPORTADO [OPERADOR] (no verificado por mí):** Render `Anclora-Impulso` (`rootDir=backend`, `main`, `autoDeploy=yes`, Live `70fd1d4`);
Vercel producción = `main`; `NEXT_PUBLIC_API_URL` en todos los scopes hacia el backend de producción; variables Render: presentes
`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`; ausentes `ADMIN_USER_IDS`, `SECURITY_CONFIG_MODE`, `AUTH_ACCEPT_LEGACY_TOKENS`,
`IDEMPOTENCY_KEY_ENFORCEMENT`; la migración 5 y sus objetos no existen en la BD identificada (consulta previa, solo esa migración);
no existen API/BD de staging; acceso a Neon interrumpido y restablecido, con bases Docker locales temporales como fallback para
`anclora-shiftimport`, `anclora-impulso` y `anclora-talent`.

**PENDIENTE:** Q1 ejecución supervisada; Q2 procedimiento verificado de despliegue controlado del backend; Q3 formalización del contrato;
Q4 configuración y prueba funcional; Q6 backup ejecutado y verificable; Q7 estimación de impacto y proceso de recuperación; Q8 dictámenes
humanos firmados; Q9 (si se decide en el futuro) análisis de coste/contrato.

**NO AUTORIZADO en esta tarea:** conectar a Neon para averiguar el destino configurado; leer `.env*`; cambiar variables o Auto-Deploy; crear
backup, staging o recursos; migrar, desplegar, promover; contactar usuarios o inspeccionar cuentas reales.

## C. Notas específicas

- **Q1 — consulta propuesta para el operador (NO EJECUTADA):** una única sentencia de lectura sobre el destino ya identificado, p. ej.
  `SELECT migration_name, checksum, finished_at FROM public._prisma_migrations ORDER BY migration_name;`, ejecutada manualmente y supervisada,
  sin otras tablas ni consultas. Resultado esperado a guardar: UTC, identidad de la consulta y las tres columnas (sin host ni credenciales).
  Nota: `rolled_back_at` **no** está en el alcance autorizado; si Toni lo considera necesario para detectar migraciones revertidas, debe
  ampliar expresamente la autorización.
- **Q3-A (modelo local):** el contrato declara que el desarrollo local usa la BD de producción de Neon; la **configuración efectiva actual no
  fue verificada** en esta tarea (no se leyó `.env*` ni se conectó). Las bases Docker temporales de Toni son un fallback de disponibilidad
  reportado; **no** son un entorno aprobado ni sustituyen al contrato. No se recomienda ninguna alternativa de BD.
- **Q3-B (migración de producción):** **`ANCLORA_AUTHORITY_CONFLICT`** para la acción de migración. Contrato canónico: Supabase
  (`SUPABASE_DASHBOARD_OR_CLI`, `MANUAL_OR_CONSOLE`). Implementación/hosting observados o reportados: Express + Prisma + Neon + Render. No
  se demuestra que el camino Supabase sea aplicable al esquema y despliegue actuales. **Se detiene la acción afectada (migrar)** hasta que
  Toni actualice formalmente el contrato o confirme cómo se aplica en esta arquitectura. No se ejecuta Prisma, Supabase CLI ni ningún comando
  de migración.
- **Q4:** el agente no busca, propone ni lee UUID. Cierre solo con (1) confirmación de Toni de que la variable está fijada y (2) prueba
  funcional segura posterior (admin autorizado → acceso; usuario normal → 403). Una entrada no canónica se ignora sin error.
- **Q5:** propuesta de compatibilidad **transitoria** (`warn` / `true` / `warn`), sujeta a aceptación de Toni y a fechas de retirada
  aprobadas. Que el runtime de Render resuelva las variables ausentes igual que el código local **no está verificado**. Riesgo temporal
  declarado: con `AUTH_ACCEPT_LEGACY_TOKENS=true` la revocación **no es completa** (un JWT heredado no se puede revocar individualmente).
- **Q6:** opciones del proveedor sin verificar (rama punto-en-el-tiempo o exportación de Neon, a confirmar en su documentación/panel). No se
  crea ni restaura nada. Evidencia que lo cerraría: autorización de Toni, ejecución por el operador, identificador del backup, fecha/hora,
  retención y una prueba de restauración en destino aislado (también bajo autorización).
- **Q7:** no se acepta el riesgo. Evidencia local disponible: la política (doc 17 §3) y que no hay forma local de contar cuentas afectadas;
  medirlo exigiría leer datos reales (**NO AUTORIZADO**). Debe diseñarse un proceso de vinculación con reautenticación que no reactive el
  auto-vínculo vulnerable; hasta entonces es bloqueo de release del cambio OAuth.
- **Q8:** sin dictámenes humanos firmados. Ningún análisis IA sustituye a la revisión profesional AI-03, de seguridad AI-06-AC10, técnica
  independiente AI-08, Hermes/copy ni legal. Solo Toni puede autorizar una excepción documentada (alcance, motivo, riesgo residual,
  responsable); ninguna se infiere.
- **Q9:** cerrada **solo como decisión actual de no crear staging**; no es evidencia de aislamiento. Los previews de Vercel apuntan, según el
  operador, a la API/BD de producción: **no ejecutar pruebas funcionales que puedan escribir datos desde previews**. Las bases Docker locales
  no constituyen staging compartido.

## D. Matriz final

| Q | Respuesta adoptada | Evidencia | Estado | Responsable | Bloquea release |
|---|---|---|---|---|---|
| Q1 | Autorizada lectura acotada de 3 columnas del ledger; **no ejecutada** (sin herramienta que garantice el alcance) | consulta propuesta §C; sin evidencia remota nueva | **PENDIENTE** (ejecución manual supervisada) | Toni (autoriza) / operador | sí (B4, migración) |
| Q2 | `main` bloqueada hasta procedimiento verificado de despliegue controlado del backend; sin pausar ni cambiar Auto-Deploy | `render.yaml` ausente [LOCAL]; Auto-Deploy `yes` [OPERADOR] | **PENDIENTE** (bloqueada) | Toni / operador | sí (B7, `main`) |
| Q3 | Dos asuntos: (A) modelo local production-backed con configuración efectiva no verificada; (B) `ANCLORA_AUTHORITY_CONFLICT` para migrar | `PRODUCTION_RUNTIME.md`, `AOS_ADOPTION.md` [LOCAL] | **PENDIENTE** (conflicto abierto; B1 no cerrado) | Toni (formaliza el contrato) | sí (B1, migración) |
| Q4 | Toni fija el UUID personalmente; sin búsqueda ni lectura de usuarios | `env.ts` [LOCAL]; ausente [OPERADOR] | **PENDIENTE** (sin confirmación ni prueba funcional) | Toni | sí (B5, backend) |
| Q5 | Defaults `warn`/`true`/`warn` como compatibilidad transitoria propuesta | `env.ts:48,49,106` [LOCAL] | **DECIDIDO (propuesto)**; runtime de Render no verificado | Toni (acepta y fija fechas) | no por sí sola; riesgo temporal declarado |
| Q6 | No crear backup aquí; investigar opciones | sin herramienta en el repo [LOCAL] | **PENDIENTE** (bloqueada) | Toni autoriza / operador ejecuta | sí (B3, migración) |
| Q7 | No aceptar el impacto por defecto; definir proceso de recuperación/vinculación seguro | doc 17 §3 [LOCAL]; impacto no medible sin datos reales | **PENDIENTE** (bloqueo) | Toni | sí (cambio OAuth) |
| Q8 | Revisiones y G1–G4 siguen bloqueantes; excepciones solo explícitas de Toni | `14-review-assignment-register.md` [LOCAL] | **PENDIENTE** | Toni + revisores | sí (producción) |
| Q9 | No crear staging ahora; no probar funcionalmente desde previews | operador confirma que no existe [OPERADOR] | **DECIDIDO (decisión actual)**; sin evidencia de aislamiento | Toni | `staging`/previews: riesgo abierto |

## E. Gates que siguen bloqueados
B1, B2, B3, B4, B5, B7, B8 y B9 (ver §4 del registro v1); además AI-06-AC10, AI-03, AI-08 (revisión técnica independiente), Hermes/copy,
legal L1–L8 y G1–G4. Ninguna tarea AI-xx ni gate cambió a aceptado.

**RELEASE NO AUTORIZADO.**

---
## Addendum v1.2 (2026-10-12) — Q3 decidida documentalmente
Ver `23-d10-architecture-and-runner-decision.md` y los contratos `.anclora/*` actualizados (`PRODUCTION_RUNTIME.md` v2.1 §12,
`AOS_ADOPTION.md` `IMPULSO-ARCH-RUNNER-2026-10-12`). Q3: **DECIDIDA DOCUMENTALMENTE** (arquitectura Vercel + Render/Express + Neon +
Prisma Migrate; runner manual protegido aprobado como diseño). `ANCLORA_AUTHORITY_CONFLICT` resuelto documentalmente. **B1 sigue abierto en lo
operativo**: entorno `production-migrations` inexistente según metadatos, secreto directo sin crear, Q1/backup/migración 5 pendientes.
Runner **no ejecutado**. Las demás preguntas conservan su estado. **RELEASE NO AUTORIZADO.**
