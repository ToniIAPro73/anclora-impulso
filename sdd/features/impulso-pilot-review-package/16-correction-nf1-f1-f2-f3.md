# 16 — Corrección local de NF-1, F-1, F-2 y F-3 (2026-10-12)

> Estado: **implementado en el árbol de trabajo de `development`, SIN commit, push, merge, despliegue ni promoción.** No acepta ninguna tarea
> AI-xx ni gate. AI-03, seguridad profesional, Hermes y legal siguen pendientes. F-4, C-D1…C-D5, NF-2 y el resto siguen abiertos.

## 0. Identidad
| Elemento | Valor |
|---|---|
| Base | `ed4bb640a72d5afc9c652829f2c3583b1cb4b1d5`, rama `development`, verificado al inicio (árbol con solo documentación de las preevaluaciones) |
| Árbol final | `sourceTreeSha256 53b1493900d6e30f256ab70bf4732110331e1ff7bdbaae496295af1f06f05bf7` (`scripts/support/code-identity.sh`; `dirty: true`, `diffSha256 fe5518e9…`) |
| Evidencia sobre el árbol final | integración completa, `verify-migrations`, unit, typecheck, build: todas con ese mismo `sourceTreeSha256` (ver §5) |
| Migraciones | **ninguna nueva**; las 25 existentes no se tocan |

## 1. NF-1 — guard de destino de pruebas (R6 reabierto y cubierto de nuevo)
**Mecanismo.** `assert_target` de `backend/scripts/test-db.sh` juzgaba la cadena completa con un `case` glob
(`postgresql://<user>:*@127.0.0.1:<port>/<db>[?*]`). El `*` absorbe cualquier cosa, así que una URL con autoridad remota y una cola
local-parecida (`…@remote.invalid:5432/other?decoy=@127.0.0.1:54329/<db>`) pasaba. `docker port` y el marcador validan el
contenedor, no la URL que recibe Prisma.

**Alcance real por flujo (demostrado, no extrapolado).**
| Comando | URL que recibe Prisma/Jest | Efecto del bypass antes de la corrección |
|---|---|---|
| `migrate` | la `DATABASE_URL` original del archivo | **Llegaba a `prisma migrate deploy` con el señuelo** (shim: `pnpm` invocado). Es el único vector con efecto directo |
| `verify-migrations` | URLs reconstruidas desde `TEST_DB_*` (solo bases desechables locales) | el guard fallaba (aceptaba), pero la URL usada era local: sin destino remoto |
| `test` | la `DATABASE_URL` original → jest | el guard shell aceptaba; el guard TS (`new URL`) rechazaba host remoto antes de conectar; **no** rechazaba parámetros como `?host=` ni `p@ss@127.0.0.1` |

**Corrección.** `backend/scripts/validate-db-url.py` (Python estándar, entorno por variables, sin argv): esquema `postgresql://`
exacto; autoridad = hasta el primer `/`, `?` o `#`; exactamente un `@`; usuario autorizado; contraseña no vacía y percent-encoded;
host exactamente `127.0.0.1` y puerto autorizado; ruta exactamente `/<db>`; consulta limitada a un único `schema=public`; sin
fragmento. Devuelve la URL **canónica** reconstruida de componentes y `test-db.sh` exporta esa y no la original; el motivo de
rechazo nunca contiene la URL. El guard TS (`tests/support/db-target.ts`) aplica la misma política (esquema, consulta, fragmento) y
compara también el usuario (`IMPULSO_TEST_DB_USER`). Nuevo subcomando `check-target` (guard sin operación).

**Rojo → verde (sin red).** `backend/scripts/test-guards.sh` con shims de `docker`/`pnpm` (el shim registra solo host/puerto/base,
nunca la contraseña): contra el guard original, **22 casos NF-1 fallaban** (11 en `migrate`, 11 en `verify-migrations`, p. ej.
señuelo en query/path, `host=`, `hostaddr=`, `port=`, nombre codificado, `schema` repetido/otro, fragmento, contraseña vacía,
`@` sin codificar); tras la corrección **68 casos, 0 fallos**, con controles positivos (URL canónica, sin consulta,
contraseña con caracteres reservados codificados) y comprobación de que el hijo recibe la URL canónica. Unit TS: 71/71.
`?host=` se rechaza como parámetro no autorizado; **no** se afirma que Prisma lo trate como conexión remota (no verificado).

**Límites.** El flujo `test` no se conduce con shims (lanza clon y jest reales); se cubre vía `check-target` más una comprobación
estructural de orden. Ver §6 (ejecuciones accidentales). No se afirma aislamiento universal: el guard cubre este runner.

## 2. F-1 — privilegios de administrador
**Mecanismos (reproducidos en PostgreSQL aislado, ruta `requireAdmin` real `/api/dashboard/summary`).**
1. *Variante de mayúsculas*: el email no se normalizaba (`UNIQUE` sensible a mayúsculas) y `isAdminEmail` comparaba en minúsculas ⇒
   registrar `Admin-x@…` junto a `admin-x@…` concedía admin. **Rojo** (run `20261012T082831Z-124546f1`).
2. *Dirección permitida sin cuenta*: cualquiera podía registrar esa dirección y obtener admin. **Rojo** (mismo run).
Control: campos `isAdmin/role/roles` inyectados en el registro no elevaban (ya verde).

**Corrección y raíz de confianza.** El privilegio ya **no deriva del email**. `ADMIN_USER_IDS` (lista de UUID designada por el
operador fuera del registro público) es la única fuente: `isAdminUserId(userId)` en `middleware/admin.ts`, usado por
`requireAdmin` (sobre `userId` firmado + sesión de servidor), por `isAdmin` de login/registro/me y por OAuth. `ADMIN_EMAILS` queda
**ignorada** (se conserva parseada solo para avisar en arranque). Sin `ADMIN_USER_IDS` nadie es admin (fallo cerrado). No se asigna
ningún rol a cuentas existentes por su email: no hay backfill ni migración.
Normalización: `normalizeEmail` (trim + minúsculas) en registro, login y OAuth; la unicidad se comprueba sin distinguir
mayúsculas; las cuentas heredadas con mayúsculas siguen entrando (exacto, luego insensible). Si varias cuentas coinciden por
mayúsculas no se selecciona ninguna: login 401, `logger.warn('auth.email_canonical_conflict', {accounts})` sin direcciones, **sin**
fusionar, borrar ni reasignar. `validateBody` sigue descartando el resultado de `schema.parse` (no se cambió globalmente): la
normalización vive en los servicios.

**Verde** (`review-nf-f1-admin-privileges` + `dashboard-authorization`, run `20261012T083113Z-2da7c821`, 25/25): variante sin
privilegios; preregistro sin privilegios; roles inyectados sin efecto; admin designado por id accede y deja de acceder al
retirar la designación; cuenta previa con email en `ADMIN_EMAILS` no se convierte; coincidencia solo por id; registro canónico y
login con cualquier caja; cuenta heredada mixta entra y su forma en minúsculas se rechaza como duplicado sin convertirla; duplicados
canónicos → conflicto sin cambios; OAuth con mocks (sin proveedor).

**Precondiciones de despliegue (PROPUESTA, no aplicada).**
1. Identificar el id real de cada administrador: `SELECT id, email, "createdAt" FROM users WHERE lower(email) IN (<admins>)`.
   Si hay más de una fila por dirección, **no** designar a ciegas: revisar cuál es la cuenta legítima (fecha, actividad).
2. Detectar conflictos: `SELECT lower(email), count(*) FROM users GROUP BY 1 HAVING count(*) > 1` (solo lectura; resolución manual).
3. Definir `ADMIN_USER_IDS=<uuid>[,<uuid>]` en el entorno del backend **antes** de desplegar; si falta, el panel admin queda sin
   acceso (bloqueo seguro). `ADMIN_EMAILS` deja de tener efecto.
4. `backend/.env.example` no se actualizó (no se leen `.env*`): añadir `ADMIN_USER_IDS` allí es tarea del operador.
5. Revisión externa que este mandato no puede hacer: si en algún entorno desplegado existió una cuenta con variante de mayúsculas
   de un email administrativo y accedió al panel (logs de la plataforma).
6. Copy: `lib/translations/es.json` (`restrictedDesc`) aún dice «Configura tu email en `ADMIN_EMAILS`»; es copy público (puerta
   Hermes) y **no se modificó**.

## 3. F-2 — `workoutId` en `POST /api/sessions`
**Reproducción** (run `20261012T083230Z-0d373e04`, rojo): A con el `workoutId` de B ⇒ **201**, sesión persistida para A, XP/racha y
elemento de feed con el nombre del entreno de B, y `workout` de B devuelto.
**Corrección** (`sessions.service.createSession`): comprobación de propiedad y creación en **una transacción**; ajeno e inexistente
→ el mismo 404 «Entrenamiento no encontrado» (sin oráculo de existencia); si el entreno desaparece entre comprobación e INSERT, la
violación de FK sobre `workoutId` se mapea al mismo 404 (carrera real con bloqueo, no simulada). Los efectos posteriores
(racha, XP, progreso de fuerza, feed) **conservan su forma preexistente: se ejecutan tras el commit y no son atómicos con la
sesión** (límite no tratado: reescribir gamificación queda fuera).
**Verde** (run `20261012T083412Z-ec43cf60`): propio 201; ajeno 404 sin escritura/efectos/datos; misma respuesta que inexistente;
llamada directa al servicio también rechazada; carrera con borrado → 404 sin sesión.

## 4. F-3 — medidas corporales
**Reproducción** (rojo): `PUT /progress/measurements/:id` sin validación aceptaba `userId`, `id` y `user: {connect}` (200).
Hallazgo adyacente de la misma clase, **demostrado**: `createMeasurement` hacía `{ userId, ...data }` con el cuerpo crudo, de modo
que `data.userId` **ganaba** (POST con `userId` de B creaba la medida de B).
**Corrección:** `updateMeasurementSchema` (`.strict()`, campos editables `date, weight, bodyFat, chest, waist, hips, arms, thighs`,
al menos uno, mismos rangos que la creación, `null` permitido para vaciar) usado por la ruta **y** por el servicio (`safeParse`,
400 sin mutación parcial); la creación usa `createMeasurementSchema.safeParse` y fija `userId` al autenticado al final. Decisión
documentada: PUT **rechaza** claves desconocidas/no editables con 400; POST **ignora** claves extra (no rompe clientes). El modelo
no tiene `createdAt` (la fecha editable es `date`). El cliente web ya solo envía los campos permitidos (sin cambios de frontend).
**Verde** (mismo run): campos válidos actualizan; `userId`, `id`, relación anidada y claves desconocidas → 400 sin cambios; valores
y tipos inválidos y cuerpo vacío → 400; A no actualiza la medida de B (404); contrato también en llamadas directas; creación con
`userId` ajeno crea para el autenticado.

## 5. Cobertura sobre el árbol final (`53b14939…`)
| Ejecución | Resultado | Carpeta |
|---|---|---|
| Guards offline (`test-guards.sh`) | 68 pasan / 0 fallan | consola; salida guardada en el delta |
| Backend unit (env-free) | 9 suites / 71 tests, exit 0 | `backend/artifacts/local-runs/20261012T083518Z-68e70878` |
| Typecheck `tsc --noEmit` (`module/moduleResolution node16`) | exit 0 | `…/local-runs/20261012T083533Z-a6b4f0ea` |
| Build `tsc --outDir ./dist-check` (en el clon) | exit 0 | `…/local-runs/20261012T083546Z-dd3c857e` |
| `verify-migrations` | pass: 25/25 en limpia y upgrade, sin diferencias ni deriva | `backend/artifacts/verify-migrations/20261012T083601Z-b3011878` |
| Integración completa, ejecución 1 | **FALLÓ 1 test**: 26 suites (25 ok) / 167 tests (166 ok) | `backend/artifacts/test-runs/20261012T083613Z-70b009b3` |
| Integración completa, ejecución 2 | 26 suites / 167 tests, exit 0 | `backend/artifacts/test-runs/20261012T083817Z-cac2b318` |

**Fallo no explicado (registrado).** En la ejecución 1, `ai06-sessions › logout revokes server-side… (línea 144)` recibió 401 donde
espera 200 en `POST /api/auth/logout` sin cabecera de autorización. Esa ruta no devuelve 401 en el código (el controlador responde
200 siempre) y el log HTTP no registra un 401 para esa llamada; el test pasa aislado (run `…083742Z-6aa63897`, 21/21) y en la
segunda ejecución completa. Ninguno de los cambios de este incremento está en la ruta. **Causa desconocida**; un reintento verde no
la demuestra. Se trata como intermitente no explicado, igual que los incidentes históricos.
No se ejecutó frontend Jest ni E2E: no cambia ningún contrato que el cliente consuma (formas de respuesta de
registro/login/me idénticas; el email devuelto está en minúsculas) y ningún flujo de UI.

## 6. Ejecuciones accidentales durante la fase roja (registradas, no citables como evidencia)
Al ejecutar por primera vez los casos NF-1 contra el guard **sin corregir**, los casos del comando `test` atravesaron el guard y
lanzaron el clon y jest reales (el arnés no puede interponer shims ahí). Se interrumpió. Resultado: 2 ejecuciones se detuvieron en
el guard TS («host is not loopback») antes de cualquier conexión; 1 (`…@127.0.0.1` con userinfo ambiguo) intentó autenticarse
contra el contenedor local aislado y falló en 23 suites (141 tests fallidos, ninguno pasó); 1 quedó vacía. Ningún caso intentó
conexión remota (hosts `.invalid`). Además se generaron 11 registros `verify-migrations` con `pnpm` simulado (no son evidencia).
Todo se movió, sin borrar, a `backend/artifacts/nf1-red-phase-accidental-20261012/` con README. El arnés se corrigió para no
conducir `test` en shims.

## 7. Evidencia histórica `20261012T073824Z-846d1e27` (addendum a docs 10/11 y a B1/A; el texto histórico no se edita)
- Manifiesto `MANIFEST.sha256` verificado (`identity.json` y `jest.log` coinciden). Resultado 23 suites / 141 tests, exit 0, finalizada
  `2026-10-12T07:39:01Z`, `gitHead 944eb67…` con árbol sucio.
- Su `sourceTreeSha256` `a15ad0e3e3ed3058b2a7026743f2dc41ca8f133865b9d23a625c1ad18cbe7583` coincide con el hash calculado **desde
  los objetos de `ed4bb64`** (`git ls-tree`/`git show`, misma fórmula de `code-identity.sh`, recomputado para este addendum). Por tanto
  cubre el código de aplicación y tests de `ed4bb64`, **incluidos** `workouts.service.ts` (import estático) y `backend/tsconfig.json`.
- La identidad **no** cubre `backend/scripts/`, ni `docker-compose.test.yml`, ni documentación. No estaba listada en el paquete,
  el ZIP ni los docs 10/11 (laguna de procedencia que este addendum cierra).
- No sustituye las pruebas de este incremento (árbol distinto).

## 8. Riesgos y límites que permanecen
- OAuth sigue vinculando por email a cuentas locales existentes (preexistente, F-4 y relacionados no tocados).
- La restricción `UNIQUE(email)` de BD sigue siendo sensible a mayúsculas; la unicidad canónica se aplica en la aplicación
  (ventana de carrera teórica solo frente a filas heredadas con mayúsculas; sin efecto en privilegios ya que no dependen del email).
- `ADMIN_USER_IDS` se lee al arrancar; cambiar admins exige reiniciar. Sin MFA ni verificación de correo (decisión de producto).
- Prisma/`?host=`: no verificado; solo se rechaza.
- NF-2, F-4, C-D1…C-D5 y los candidatos de A siguen abiertos en su fase.

---
## 9. Addendum — F-1-A y F-1-B (revisión del delta, 2026-10-12; texto anterior sin cambios)
La revisión del delta señaló dos huecos en la política «con conflicto canónico no se selecciona ninguna cuenta»:
- **F-1-A (login):** `findUserByEmail` devolvía la fila exacta normalizada antes de comprobar si el conjunto canónico era único.
- **F-1-B (OAuth):** una vinculación nueva por email elegía la cuenta más antigua entre varios candidatos (podía ser la designada admin).

**Rojo** (run `20261012T085406Z-cd17c3f9`, BD aislada, filas sintéticas): fallaban exactamente esos dos casos; los controles
(variantes sin fila normalizada, cuenta heredada única, vínculo previo por proveedor, cuenta deshabilitada, candidato único, sin
candidato) ya pasaban. **Corrección:** `src/services/account-lookup.service.ts` (política única: lee el conjunto canónico
completo, `conflict` si hay más de uno; log solo con el recuento). Login usa `found`; OAuth, antes de crear `OAuthAccount` o
sesión, lanza error ante `conflict`. Los vínculos ya existentes por `(provider, providerAccountId)` no pasan por esa búsqueda
y no se tocan. Sin cambios de esquema, de raíz de confianza admin ni fusión/normalización masiva.
**Verde** (run `20261012T085512Z-fb448249`: 5 suites / 59 tests = nuevas regresiones + F-1 + dashboard + ai06-sessions + auth);
typecheck, build y unit (71) en verde. Un intento intermedio falló (`…085443Z-09d80137`) por un defecto del propio test
(limitador de auth de 5 fallos por ventana → 429); corregido el test, no el código.
**Árbol:** `sourceTreeSha256 b17f852ae60b724efc3b14fa881633ae4bb1213d787ac461158b12b649457e6b`. **No** se repitió la suite completa, `verify-migrations`, cuotas ni E2E (sin dependencia con
estos cambios); la integración completa de §5 corresponde al árbol `53b14939…`, anterior a este addendum.
**Sin cambios:** causa del 401 intermitente de logout (desconocida); candidato separado de OAuth por email sin verificar
(sin triage ni remedio aquí; sigue siendo precondición de lanzamiento por decidir); transición `ADMIN_USER_IDS`; copy; gates.
