# 15-B1-IA — Pre-evaluación IA de seguridad AI-06 (sesiones, aislamiento, logs, cliente)

Estado: **pre-evaluación IA, solo lectura estática**. No es la revisión independiente que exige AI-06-AC10, no es certificación ni auditoría humana, no acepta ninguna tarea AI-xx, G1–G4 ni el lanzamiento. **AI-06-AC10 permanece PENDIENTE** hasta la revisión requerida por su contrato.

## 1. Encargo, tipo de revisión, agente, relación con la implementación

| Campo | Entrada |
|---|---|
| Encargo | Asignación B1 (`14-assignments/14B1-security-ai06-ac10.md`, `13-review-requests/13b-…` §B1), pre-evaluación IA |
| Tipo | Revisión estática de código en HEAD + lectura de documentación; sin ejecución de código, tests, app, BD ni red |
| Agente / modelo | Agente "B1-IA"; el runtime declara Sonnet 5.5 (`claude-sonnet-5-5`) |
| Relación con la implementación | Contexto nuevo; no participó en la implementación (hecha por un agente IA con Toni, modelo desconocido para mí) |
| Competencia | Revisión de código de autenticación/sesiones con criterio de seguridad de aplicaciones; **no** credencial profesional que declarar |

## 2. Revisión objetivo y fuentes examinadas

- Commit `ed4bb640a72d5afc9c652829f2c3583b1cb4b1d5` (HEAD, rama `development`), tree `71151408f79cac9dcf4f35350790f23a2fb4ed16`; árbol limpio (`git status --short` vacío).
- Comprobado: `middleware/admin.ts`, `progress.service.ts`, `sessions.service.ts`, `progress.routes.ts`, `health-plans.routes.ts`, `app.ts` y `middleware.ts` **no cambian** entre base `77f852aa` y HEAD: los hallazgos F-1…F-3 son **defectos preexistentes en la base**, no regresiones del paquete; siguen en el alcance de AC07/AC10.

Documentación leída: `COMMON-BRIEF.md`; `14-assignments/14B1-…`; `13-review-requests/13b-…`; `06-packet-security.md` (tablas obsoletas, usadas rutas actuales); `10-consolidated-matrix-r1-r8c.md` (§B, T-1…T-5, R4, R8, R8-A/B/C); `01a-route-level-inventory.md`; `impulso-pilot-session-security/{INDEX, spec-v1, security-review-dossier-v1}.md`.

Código leído en HEAD (backend `backend/src/`): `services/session.service.ts`, `middleware/auth.ts`, `middleware/admin.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `utils/jwt.ts`, `utils/security-config.ts`, `utils/redact.ts`, `utils/pkce.ts`, `utils/validators.ts` (parcial), `middleware/{errorHandler,httpLogger,validate}.ts`, `config/{logger,env}.ts`, `server.ts`, `app.ts`, `controllers/{oauth,dashboard,health,sessions,progress}.controller.ts` (parcial), `services/oauth.service.ts`, `services/oauth/{google,github}.provider.ts`, `services/{sessions,progress,social,nutrition(parcial),workouts(parcial),health-plans(parcial),metrics,health}.service.ts`, todos los `routes/*.ts`, `prisma/schema.prisma` (`AuthSession`, `RefreshToken`, `User`), `public/dashboard.html` (parcial), `tests/integration/ai06-sessions.test.ts` (parcial: inventario y aislamiento), `tests/integration/dashboard-authorization.test.ts` (grep). Frontend: `lib/api/client.ts`, `lib/api/auth.ts`, `lib/contexts/auth-context.tsx`, `app/auth/callback/page.tsx`, `middleware.ts`, `components/dashboard-user-menu.tsx` (logout), `lib/providers/query-client.tsx`, `hooks/use-workouts.ts` (+ grep de `queryKey` en hooks). No abrí ningún `.env*`.

## 3. Método y límites

- Lectura dirigida a: creación/revocación de sesión, usuario eliminado/deshabilitado, expiración, vínculo sid↔usuario, rotación y reuso/grace, interleavings R8/A/B/C, OAuth, transporte, legado, `SECURITY_CONFIG_MODE`, autorización admin, aislamiento por recurso, cobertura del inventario de rutas, puntos de log.
- Inventario: contados 105 `router.<método>(…)` en `routes/*.ts` (docs.routes no está montado en `app.ts`): coincide con el total 105 de `01a`. Una clasificación difiere (F-11).
- **No se ejecutó ninguna prueba, probe ni suite.** Todo lo marcado «mecanismo por código» es inferencia estática; las reproducciones se dan como receta «PENDIENTE DE VERIFICACIÓN». No pude ver los informes de revisión independientes previos (no están en el repo).
- Los resultados de tests citados en el paquete (`ai06-sessions` 21, `dashboard-authorization` 14, E2E 14/14…) son evidencia histórica de árboles anteriores; no los atribuyo a HEAD. Los cambios de HEAD respecto al ZIP (`workout-generator.tsx`, `workouts.service.ts` import estático, `tsconfig` node16) no tocan sesión/auth, pero tampoco hay ejecución backend posterior a ellos.

## 4. Resultados

### 4.1 Matriz de criterios AI-06 (spec §4)

Clases: ES = EVIDENCIA SUFICIENTE EN EL ALCANCE · RC = REQUIERE CAMBIO · NE = NO EVALUABLE · VP = REQUIERE VALIDACIÓN PROFESIONAL.

| ID | Clase | Base (código HEAD) y reservas |
|---|---|---|
| AC01 config findings sin valores | **ES** | `security-config.ts:44-66` devuelve solo códigos; defaults, corta, idénticas. Reserva: solo detecta las 2 constantes `KNOWN_DEFAULT_SECRETS` y longitud ≥32; no mide entropía ni cubre valores de ejemplo de `.env.example` (no abierto, NE). |
| AC02 enforce falla / warn no | **RC (menor, decisión)** | Código: `applySecurityPolicy` lanza solo si hay hallazgo `severity:'error'` (`security-config.ts:82-84`). `LEGACY_TOKENS_ACCEPTED` y `ACCESS_TOKEN_LIFETIME_LONG` son *warning*: **enforce arranca** con legado activo y access 7 d (default `env.ts`). El texto literal de AC02 dice "falla ante cualquier hallazgo"; la spec §10 exige además `acceptable` en el entorno. Opciones: alinear el texto del AC o hacer que enforce bloquee `LEGACY_TOKENS_ACCEPTED`. Además `SECURITY_CONFIG_MODE` no se valida (F-12): un valor mal escrito degrada a `warn` sin error. |
| AC03 revocada ⇒ 401 access y refresh | **ES** | `isSessionActive` consulta BD por request (`session.service.ts:71-91`: revokedAt, expiresAt, user.disabledAt, `session.userId===payload.userId`); `rotateRefreshToken` rechaza sesión revocada/expirada (`:139-145`). |
| AC04 logout invalida servidor | **ES** | `auth.controller.ts:100-124`: revoca por refresh (aunque ya consumido: `revokeByRefreshToken` busca por hash) y por `sid` de access (ignora expiración). Idempotente. Reserva: logout no autenticado y siempre 200 (diseño). |
| AC05 rotación + reuso revoca familia | **ES con reservas** | Rotación CAS `updateMany usedAt:null` en transacción (`:152-167`); reuso fuera de grace revoca la sesión (`:171-186`). Reservas de grace en 4.4. |
| AC06 usuario eliminado/deshabilitado | **ES** | Eliminado: `onDelete: Cascade` y `findUnique` null ⇒ inactiva; deshabilitado: `disabledAt` en access, refresh, login y OAuth (`oauth.service.ts:60-64`). Observación operativa: no hay flujo de borrado, ni de deshabilitación, ni caller de producción de `revokeAllUserSessions` (solo tests): el procedimiento de incidente es SQL manual. |
| AC07 aislamiento A/B + inventario | **RC** | El test clasifica solo rutas con `:param` y prueba 11 rutas. Defectos fuera de esa clasificación: **F-2** (id de recurso en el body de `POST /api/sessions`), **F-3** (mass-assignment en `PUT /api/progress/measurements/:id`). Además la clase "catálogo compartido" de `GET /nutrition/recipes/:id` es inexacta (hay recetas `userId`; el código `assertRecipeAccess` sí filtra `isPublic OR userId`, OK). `follows/:userId`, `kudos`, `leaderboard` marcadas "exentas": ver F-8. |
| AC08 CSRF si cookies | **NE / no aplicable** | Transporte A (bearer en cabecera). Única cookie: transacción PKCE OAuth (`HttpOnly`, `SameSite=Lax`, `Path=/api/auth`). Nota para la decisión de cookies: ver F-7 (CORS con credenciales y comodín vercel.app). |
| AC09 rollback ensayado | **NE (parcial)** | Existen conmutadores (`AUTH_ACCEPT_LEGACY_TOKENS`, `SECURITY_CONFIG_MODE`) y migraciones expand-only, pero no hay evidencia de ensayo en entorno de despliegue. Nota: `AUTH_ACCEPT_LEGACY_TOKENS` es **true cuando falta** (`env.ts`: `!== 'false'`), opuesto al estado seguro. |
| AC10 revisión independiente registrada | **PENDIENTE** | Esta pre-evaluación IA **no** lo cumple ni lo sustituye. |
| N01 token expirado | **ES** | `verifyAccessToken` + `TokenExpiredError` (`middleware/auth.ts`). |
| N02 token malformado | **ES** | verify lanza ⇒ 401. |
| N03 firmado con secreto de refresh | **ES con reserva** | Secretos distintos, algoritmo fijado `HS256` (`jwt.ts`). Si `JWT_SECRET==JWT_REFRESH_SECRET` (posible en `warn`), un refresh JWT legado valdría como access legado: solo `enforce` lo impide. |
| N04 alg=none/confusión | **ES** | `algorithms:[HS256]` en todos los verify. |
| N05 clock-skew | **NE** | No hay `clockTolerance` explícito (por defecto 0) ni evidencia de test en lo que leí; la spec §10 no lista este caso entre los verificados. |

### 4.2 Hallazgos nuevos

Severidad = impacto si es explotable; confianza = certeza de que el mecanismo existe. «PENDIENTE DE VERIFICACIÓN» = no ejecutado por mí.

**F-1 — Escalada a administrador por variantes de mayúsculas (o preregistro) del email de admin.** Severidad **ALTA**, confianza **ALTA** (mecanismo por código; repro BD pendiente).
- Ruta/evidencia: `utils/validators.ts:5,11` (`z.string().email()`, sin `toLowerCase/trim`); `auth.service.ts:19-35,59-70` (`findUnique({email})` exacto); `schema.prisma` `User.email @unique` (colación sensible a mayúsculas; sin `citext`/índice `lower()` en migraciones); `middleware/admin.ts:4-9` compara `email.trim().toLowerCase()` del claim del token contra `ADMIN_EMAILS`. `validateBody` además descarta el resultado parseado (`validate.ts`: `schema.parse(req.body)` sin reasignar).
- Mecanismo: con registro abierto y sin verificación de email, quien registre `Admin@Example.com` cuando el admin real es `admin@example.com` obtiene una cuenta distinta cuyo claim `email` pasa `isAdminEmail`. También aplica a preregistrar el email del admin si todavía no existe. Impacto: `/api/dashboard/*` (logs con IP/UA/datos personales, `securityfindings`), escritura del catálogo de ejercicios/recetas, `POST /api/engagement/admin/dispatch-now`, `/api/events/summary`. Esto contradice la afirmación "operational endpoints admin-only" del paquete en la práctica.
- Reproducción (PENDIENTE): BD aislada; `ADMIN_EMAILS=admin@x.test`; `POST /api/auth/register {email:"Admin@X.test",…}`; con ese access, `GET /api/dashboard/summary` ⇒ esperado 403, observable por código: 200.
- Arreglo mínimo: normalizar email (trim + lowercase) en register/login/OAuth y comprobar duplicados existentes antes de migrar; y/o decidir admin por `userId`/email verificado, no por claim de email sin verificar. Test: variantes de mayúsculas ⇒ 403/409.

**F-2 — `POST /api/sessions` no comprueba que `workoutId` pertenezca al usuario.** Severidad **MEDIA-BAJA**, confianza **ALTA** (mecanismo), explotabilidad condicionada a conocer un UUID ajeno (no hallé ruta que exponga `workoutId` de otros).
- Evidencia: `services/sessions.service.ts` `createSession` (`workoutId: data.workoutId`, sin `findFirst({id,userId})`), `include: {workout:true}` devuelve el entrenamiento ajeno al actor y `recordWorkoutCompletedActivity` publica su `name` en el feed (potencialmente público) del actor. El test AC07 solo cubre ids de ruta.
- Reproducción (PENDIENTE): A `POST /api/sessions {workoutId:<id de B>,…}` ⇒ 201 con `workout` de B. Arreglo: validar propiedad (404) antes de crear; añadir caso al test AC07 (ids en body: `workoutId`, y revisar `recipeId`, `foodItemId` ya filtrados).

**F-3 — `PUT /api/progress/measurements/:id` pasa el body crudo a `prisma.update`.** Severidad **MEDIA-BAJA**, confianza **ALTA** (mecanismo), repro pendiente.
- Evidencia: `routes/progress.routes.ts:20` sin `validateBody`; `controllers/progress.controller.ts:65` → `progress.service.ts` `updateMeasurement(..., data)` → `prisma.bodyMeasurement.update({where:{id}, data})`. La propiedad se comprueba solo sobre el id de la URL; el body puede incluir `userId` (campo escalar sin restricción) y mover la medida propia a otro usuario o alterar `id/createdAt`.
- Impacto: escritura/contaminación de los datos de progreso de B (requiere `userId` de B, expuesto en feed/leaderboard, por defecto públicos). Arreglo: esquema + lista blanca de campos en el servicio. Patrón general: `validateBody` no reemplaza `req.body` por el valor parseado; conviene hacerlo en todas las rutas.

**F-4 — Login CSRF / fijación de sesión en `/auth/callback`.** Severidad **MEDIA**, confianza **ALTA** (mecanismo), repro de navegador pendiente.
- Evidencia: `app/auth/callback/page.tsx:12-30`: acepta `accessToken`/`refreshToken` del fragmento **o de la query** y los instala (`setToken` + `localStorage`) sin vínculo con un flujo iniciado en ese navegador. El servidor liga `state` a la cookie PKCE pero la página no verifica nada.
- Mecanismo: un atacante inicia sesión con su cuenta, construye `https://app/auth/callback#accessToken=…&refreshToken=…` y lo envía a la víctima; la víctima queda en la cuenta del atacante y puede introducir datos de salud que el atacante ve. No figura en los riesgos conocidos (que tratan solo la exposición de tokens). La propuesta de código de intercambio (spec §12) con vínculo a la cookie de transacción lo corregiría; la rama de query es además innecesaria.
- Mínimo interino: eliminar el fallback de query; exigir marcador de flujo iniciado (p. ej. nonce en `sessionStorage` puesto al lanzar OAuth) antes de instalar tokens.

**F-5 — Caché de React Query no ligada al usuario y no limpiada en cambios de identidad sin recarga.** Severidad **BAJA-MEDIA** (dispositivos compartidos), confianza **MEDIA** (falta repro en navegador).
- Evidencia: `lib/providers/query-client.tsx` (staleTime 5 min, gcTime 10 min, `refetchOnMount:false`, instancia global); `hooks/use-workouts.ts:37` y resto con `queryKey` sin `userId`; ninguna llamada a `queryClient.clear()`. El logout manual hace `window.location.replace` (`dashboard-user-menu.tsx:77-78`, limpia memoria), pero `discardRejectedSession` (`auth-context.tsx`) y un login sobre otra sesión (`router.replace("/dashboard")`) no recargan.
- Impacto: datos de A mostrados a B tras sesión rechazada/expirada (30 d) y nuevo login por navegación SPA. Es la concreción del riesgo conocido #6 (hooks no auditados). Receta: A con datos en caché → revocar sesión de A por BD → disparar 401 → login de B por UI sin recarga → observar `/workouts`. Arreglo mínimo: `queryClient.clear()` ante cualquier cambio de generación de sesión / o incluir `user.id` en las claves.

**F-6 — CSP de producción poco efectiva.** Severidad **BAJA** (amplía riesgo conocido #1), confianza **ALTA** (lectura).
- `middleware.ts`: `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com`. Además de `unsafe-inline` (ya conocido), esos CDN sirven código arbitrario de npm, por lo que un punto de inyección permite cargar script de atacante; `img-src https: http:` permite exfiltración por imagen. Consecuencia: con tokens en `localStorage`, la CSP no aporta contención real de XSS. Decisión de Toni, no cambio mínimo.

**F-7 — CORS: comodín de previews `*.vercel.app` con `credentials:true`.** Severidad **BAJA hoy** (bearer, sin cookies de sesión), confianza **MEDIA**.
- `app.ts` `isAllowedOrigin`: si algún `FRONTEND_URL` termina en `.vercel.app`, cualquier origen `<base>-xxx.vercel.app` (que un tercero puede registrar) pasa CORS con credenciales. Sin efecto con bearer; sería grave si se adopta transporte por cookie (AC08). Registrar como precondición de la decisión D4.

**F-8 — "Privado" social eludible por follow unilateral; por defecto público.** Severidad **BAJA**, confianza **MEDIA** (intención no documentada).
- `social.service.ts`: `followUser` no requiere consentimiento y `getFeed`/`assertFeedItemVisible` muestran items `private` a seguidores; el feed público expone `userId` y nombre del entrenamiento a cualquier usuario autenticado (default `public` salvo `private`). Los items previos a pasar a privado siguen públicos. Pertenece a AI-07/legal más que a sesiones; se anota porque AC07 lo declaró "exento".

**F-9 — Correlación de usuario rota en logs de error y de petición lenta.** Severidad **BAJA**, confianza **ALTA**.
- `errorHandler.ts:25` y `httpLogger.ts:~64` usan `req.user?.id`, pero `JwtPayload` tiene `userId`; siempre `undefined`. Pérdida de atribución en incidentes; arreglo de una línea.

**F-10 — `/health` público con detalle y `error.message` crudo, sin límite de tasa.** Severidad **BAJA**, confianza **ALTA**. `routes/health.routes.ts`, `controllers/health.controller.ts` (devuelve `error.message`), `health.service.ts` (entorno, versión, memoria, disco, BD). El limitador solo cubre `/api/`. Conecta con riesgo conocido #9/D-4.

**F-11 — Inventario `01a`: una clasificación errónea.** Severidad **INFO**. `GET /api/health-plans/definitions` consta como `auth` (#36) pero `health-plans.routes.ts:9` se declara **antes** de `router.use(authenticate)`: es pública (totales reales 19 públicas/70 auth/16 admin). Contenido de catálogo; sin impacto de seguridad directo, pero el inventario "forzado" no detectó la discrepancia (clasifica por parámetro, no por acceso).

**F-12 — Robustez de configuración.** Severidad **BAJA**, confianza **ALTA**. `AUTH_ACCEPT_LEGACY_TOKENS` abre cuando falta; `SECURITY_CONFIG_MODE` y los enteros (`AUTH_REFRESH_REUSE_GRACE_SECONDS`, `AUTH_REFRESH_SESSION_DAYS`) sin validación: NaN deja grace en 0 (revocación inmediata) o fecha inválida. `env.ts` solo aborta en producción ante los dos defaults exactos.

**F-13 — Puntos de log no auditados antes (ampliación de R4).** Severidad **BAJA**, confianza **ALTA**.
- `services/llm/groq.provider.ts:48` registra 500 caracteres del contenido LLM; `errorHandler` registra el body completo (con redacción por clave, no por contenido: mensajes del coach, notas) en **todo** error manejado, incluidos 4xx esperados; `dashboard/health/health.service` registran `error.message` sin `redactText`; `httpLogger` construye el JSON de producción por interpolación de `:user-agent` (inyección/rotura de JSON en el log). Retención: 30 d (errores), 14 d (combinado). Relacionado con AI-07.

### 4.3 Revisión de interleavings R8 / R8-A / R8-B / R8-C (lectura de `client.ts`, `auth.ts`, `auth-context.tsx`)

Conclusión: no encontré ruta por la que **una operación cambie de usuario al renovar credenciales**.

| Escenario | Mecanismo observado | Resultado |
|---|---|---|
| Misma pestaña: refresh en vuelo + login/logout | `sessionGeneration` capturada al inicio; `stillSameSession()` tras `await fetch` y tras `response.json()`; reintento solo si `generation === this.sessionGeneration` (`client.ts:111-186`) | Resultado de refresh de A descartado; no escribe ni reintenta bajo B |
| Otra pestaña inicia sesión como B | Antes del refresh se compara `identityOf(accessToken almacenado)` con la identidad en memoria; si difiere no usa el refresh almacenado. Tras la respuesta, adopta solo si la identidad (`sid`) coincide | Peticiones de la pestaña A siguen como A (token en memoria) hasta caducar; nunca se envía el refresh de B. Tras 401 ⇒ falla, no cambia de usuario |
| Rotación de la misma sesión por otra pestaña | adopción con `identityOf` igual | Correcto; sin deriva |
| Logout con refresh en vuelo | `setToken(null)` incrementa generación; logout en servidor usa el refresh almacenado (aunque consumido, `revokeByRefreshToken` resuelve la sesión) y el `sid` | Sesión revocada; token sucesor del refresh tardío inservible |
| `json()` tardío | segunda comprobación de generación/refresh almacenado | Inerte |
| Replay tras identidad nueva | `request()` no reintenta si la generación cambió | Falla tal cual (401) |
| Carga de perfil / migración legado | `isStale()` tras cada await y antes de cada efecto; deriva de identidad cuenta como obsoleto | Sin publicación ni PUT bajo otra identidad |
| `discardRejectedSession` | Solo limpia si el refresh almacenado sigue siendo el esperado | No borra la sesión de otra pestaña |

Reservas (no son defectos de cambio de usuario): `identityOf` decodifica `sid` sin verificar (uso de correlación; la autorización es del servidor; un script con acceso a `localStorage` ya lo controla todo). Tokens legados sin `sid` correlacionan por valor: tras upgrade la identidad cambia y se tratan como "otra" (cierre de sesión local, no cruce). Sesión A abandonada tras login B en la misma pestaña sigue viva en servidor hasta expirar (riesgo conocido #4; el refresh queda sobrescrito, inalcanzable salvo copia). Falta sincronización visual entre pestañas (conocido #3). El riesgo cruzado real en cliente es F-5 (caché), no el transporte de credenciales.

### 4.4 Rotación, grace y alternativas

Hechos de código: grace por `usedAt` del primer uso (`authRefreshReuseGraceSeconds`=10); dentro de la ventana cada reuso **crea un token sucesor adicional** sin límite (la familia se bifurca) y no se registra el evento (`session.service.ts:171-190`); el reuso fuera de ventana revoca la sesión entera. Expiración absoluta 30 d, no se extiende al rotar.

| Cuestión | Valoración |
|---|---|
| Ataque real con token consumido dentro de 10 s | Requiere haber capturado el token justo antes/tras su consumo. Un atacante con XSS ya lee el token vigente en cualquier momento, así que el grace añade poco frente a ese vector; el caso residual es captura en tránsito/log/historial (fragmento OAuth). Dentro de 10 s se obtiene sucesor válido **sin detección** y la cadena queda bifurcada hasta fin de sesión (30 d) sin alarma. **Riesgo aceptado-pendiente**, coherente con la documentación; no es defecto. |
| Falso positivo de revocación | Si la respuesta de un refresh se pierde (red móvil) y el cliente reintenta con el token ya consumido pasados >10 s (siguiente 401), la **sesión legítima se revoca** y se fuerza login. Es disponibilidad, no confidencialidad; documentado para clientes que ignoran el token nuevo, pero no como pérdida de respuesta. **Decisión de Toni.** |
| Alternativas (no implementadas) | (a) Dentro de grace, aceptar solo si el sucesor del token **no se ha usado aún**; si ya se usó, tratar como reuso y revocar. (b) Limitar a un único sucesor extra por token consumido. (c) Registrar contador/alerta `refresh_reuse_in_grace`. Cualquiera reduce la bifurcación silenciosa sin forzar grace 0 (que cerraría sesión a pestañas legítimas simultáneas). |
| Legado | `upgradeLegacyRefreshToken` **no consume** el JWT legado: puede canjearse repetidamente por sesiones nuevas hasta su `exp` (30 d), el logout no lo invalida y los contadores `legacyUse` son por instancia. Amplía el riesgo conocido #3: la ventana real tras migrar el usuario sigue abierta hasta apagar el flag. |

### 4.5 Riesgos conocidos que requieren decisión (no re-etiquetados como nuevos)

1. Bearer en `localStorage` + CSP débil (conocido #1; ver F-6): decidir si basta para el piloto o si la cookie (dominio same-site) precede al lanzamiento; con cookie, F-7 y AC08 pasan a ser bloqueantes.
2. Grace 10 s y falso positivo por pérdida de respuesta (4.4): aceptar, o adoptar alternativa (a).
3. Retirada de legado (`AUTH_ACCEPT_LEGACY_TOKENS=false`): precondiciones mínimas — contador de uso agregado (no por instancia) a 0 sostenido, ventana ≥30 d o relogin forzado, y en `enforce` decidir si el legado debe bloquear arranque (AC02). Mientras tanto la revocación individual de legados no existe.
4. OAuth con tokens en fragmento: tratar junto a F-4; la propuesta de código de intercambio resuelve exposición y fijación a la vez.
5. Precondiciones de lanzamiento de `SECURITY_CONFIG_MODE`: usar `enforce` **y** comprobar `/api/dashboard/summary` → `security.acceptable=true` (enforce no bloquea warnings); verificar secretos reales (B2/D7, no verificables aquí); `JWT_EXPIRES_IN=15m` (el default sigue 7 d).
6. Admin: email sin MFA ni verificación (F-1 lo vuelve explotable sin MFA). Decidir verificación de email/admin por id y MFA.
7. Sin bloqueo por cuenta; limitador por IP e in-memory, solo fallos (`skipSuccessfulRequests`), con `trust proxy 1`: la topología de proxies del despliegue no consta (NE); un salto de proxy de más agrupa a todos los usuarios bajo una IP.
8. Procedimiento de incidente: no hay endpoint/herramienta para revocar todas las sesiones ni deshabilitar usuario; solo SQL.
9. Enumeración de usuarios (409 en registro; login sin comparación ficticia): menor; sin decisión previa registrada.

### 4.6 No evaluables

AC08 (no aplica bajo transporte A), AC09 (sin ensayo en despliegue), N05 (sin evidencia), valor real de secretos y de `ADMIN_EMAILS` en destino, topología de proxy/WAF, comportamiento en navegador de F-4/F-5 (recetas dadas), `.env.example` (no abierto), cualquier afirmación sobre staging/producción, completitud de ids en body en servicios no leídos (nutrición/workouts/health-plans solo parcial), causas de los incidentes históricos `…255cfca9` y `premium-form-voice` (sin atribuir).

## 5. Conclusión acotada y decisiones reservadas

- El modelo de sesión en servidor (creación, vínculo sid↔usuario, revocación, expiración, usuario eliminado/deshabilitado, rotación con reuso fuera de grace) es coherente en el código de HEAD, y los interleavings R8/A/B/C no permiten, según la lectura estática, cambiar de usuario renovando credenciales. Esto no es una verificación ejecutada sobre HEAD.
- **Antes de dar AC07/AC10 por cumplidos hay cambios mínimos que valorar**: F-1 (alta), F-2, F-3 (aislamiento), F-4 (OAuth), F-5 (caché cliente); F-9 y F-12 son correcciones triviales. Ninguno está implementado ni reproducido en esta revisión.
- La afirmación "A no lee/modifica B" no puede sostenerse en términos absolutos con la evidencia revisada: la prueba cubre ids de ruta; F-2/F-3 muestran ids y campos en body fuera de su alcance.
- Reservado a Toni/profesionales: aceptación de localStorage para el piloto, grace y su alternativa, vida de tokens, política de legado y fecha, MFA/verificación de admin, aceptación o corrección de F-6/F-7/F-8, semántica de "privado" social, topología de proxy, retención/redacción de logs (con AI-07), y la **revisión independiente humana de AC10**, que sigue pendiente.

---
## Addendum 2026-10-12 — F-1, F-2, F-3 corrected locally (report text unchanged)
See `../16-correction-nf1-f1-f2-f3.md`. This addendum does not change the criteria classification issued by B1-IA; a new review of the
corrected tree would be a separate engagement. AC10 remains pending its contract's required review.
