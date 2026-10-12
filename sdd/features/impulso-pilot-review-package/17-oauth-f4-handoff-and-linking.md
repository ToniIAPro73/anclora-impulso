# 17 — Incremento OAuth: F-4 (handoff) y vinculación por email (2026-10-12)

> Estado: **implementado y probado en local, SIN commit, push, despliegue ni promoción.** Proveedores simulados: esto demuestra el
> flujo local, **no** la configuración de producción ni la interoperabilidad real con Google/GitHub. No acepta tareas ni gates.
> El 401 intermitente de logout, C-D2/logs y demás riesgos siguen separados y sin causa atribuida a este incremento.

## 0. Identidad
Base de partida `ed4bb640…` con NF-1/F-1/F-2/F-3/F-1-A/B sin commit (`sourceTreeSha256 b17f852a…7e6b`, delta F1AB).
Árbol final de este incremento: `sourceTreeSha256 74c80c0811c09004270910e4f44f72807256bab920de06c81266778b71df4e0c`.
Las ejecuciones de backend, `verify-migrations` y E2E se hicieron sobre `81a44270…a18`; la **única** diferencia con el árbol final es
una línea del runner `scripts/frontend-jest-isolated.sh` (se añadió `data/` a su lista de copia; recomputado quitando ese cambio).
La ejecución de Jest frontend completa corresponde al árbol final.

## 1. Triage
| Hallazgo | Estado | Evidencia |
|---|---|---|
| **F-4** login CSRF / fijación de sesión en `/auth/callback` | **DEMOSTRADO y corregido en el alcance local** | rojo en navegador `artifacts/qa/runs/20261012T091555Z-a33de0d0`: la víctima instala la identidad del atacante vía fragmento y vía query y B es sustituido (3 fallos; el 4.º, limpieza de URL, ya pasaba) |
| Google sin `email_verified` | **DEMOSTRADO** (código) y corregido | unit rojo contra los módulos originales: 9 de 10 fallan (`backend/artifacts/local-runs/20261012T092116Z-19755891`) |
| GitHub usa `user.email` público, sin lista verificada | **DEMOSTRADO** y corregido | idem |
| Auto-vinculación por email a cuenta local existente | **DEMOSTRADO** (el test de F-1-A/B «un candidato» pasaba con el código anterior: `…085512Z-fb448249`) y corregido por política | ver §3 |
| Carrera de registros OAuth nuevos con el mismo email | **No reproducible como defecto**: el código nuevo la resuelve (un ganador, el otro rechazado; mismo flujo concurrente → una cuenta y un vínculo) | `…091941Z-0a642453` |
| Interoperabilidad real Google/GitHub, comportamiento de producción | **NO evaluado** | — |

## 2. Flujo antes / después
**Antes.** `/api/auth/google` (el navegador navega al backend) → cookie de transacción (state + PKCE del proveedor) → proveedor →
callback del backend → `redirect FRONTEND/auth/callback#accessToken=…&refreshToken=…` (sesión **ya emitida**). La página instalaba lo que
hubiera en fragmento o query: el state/PKCE protegían la pierna con el proveedor, **no** la entrega final al navegador.

**Después.**
1. El frontend crea un `verifier` aleatorio por intento (guardado en `sessionStorage` de la pestaña, nunca en la URL) y envía solo su
   challenge S256: `GET /api/auth/<proveedor>?challenge=…` (formato cerrado; sin challenge válido se rechaza antes del proveedor).
2. El backend guarda el challenge dentro de la cookie de transacción existente (state/PKCE del proveedor sin cambios).
3. Tras validar state + PKCE y resolver la cuenta, crea un **handoff** (`oauth_handoffs`): código aleatorio de 256 bits guardado solo como
   SHA-256, ligado a challenge, proveedor y usuario, caducidad corta (`OAUTH_HANDOFF_TTL_SECONDS`, 60 s por defecto, acotado a 10–300) y
   redirige a `FRONTEND/auth/callback#code=…&provider=…`. **No hay sesión ni token** en ese punto.
4. La página limpia la URL, toma el intento de `sessionStorage` (un solo uso, máx. 10 min), exige que la identidad de la pestaña no haya
   cambiado, y canjea `POST /api/auth/oauth/exchange {code, verifier, provider}`.
5. El backend consume el código con **un único UPDATE condicional** (sin usar y no caducado): dos canjes simultáneos ⇒ una sola sesión;
   cualquier intento que alcance el consumo quema el código (un verifier erróneo no permite adivinar). Solo si verifier y proveedor
   coinciden y el usuario sigue habilitado se emite la sesión. Todos los fallos son el mismo 401.
6. El cliente instala la sesión solo si la generación de sesión de la pestaña no cambió durante el canje (login/logout posteriores ganan).

**Raíz de confianza de cada vínculo.**
| Vínculo | Raíz |
|---|---|
| navegador ↔ flujo | verifier en `sessionStorage` de la pestaña + challenge guardado en el servidor (no cookie cross-site ni nonce copiable de la URL) |
| flujo ↔ proveedor | state + PKCE del proveedor en cookie `httpOnly` `SameSite=Lax` (sin cambios; navegaciones de primer nivel) |
| proveedor ↔ cuenta existente | identidad `(provider, providerAccountId)` ya vinculada; **no** el email |
| proveedor ↔ cuenta nueva | email que el **propio proveedor** declara verificado en su respuesta autenticada |

## 3. Política de vinculación (cerrada)
- Google: `email` solo si `email_verified === true` en el userinfo autenticado; `sub` string no vacío. GitHub: email solo de `/user/emails`
  (verificado, primario preferido); el email público del perfil se ignora; fallo/forma inesperada ⇒ sin email; `id` numérico válido.
- Identidad ya vinculada ⇒ esa cuenta (rechazo si está deshabilitada); nunca se reasigna por email.
- Identidad nueva + email acreditado + **ninguna** cuenta local con ese email canónico ⇒ cuenta nueva (transacción usuario + vínculo).
- Identidad nueva + cuenta local existente (con contraseña, OAuth-only o admin) ⇒ **rechazo** (`link_requires_original_method`): no hay
  flujo seguro de vinculación/reautenticación en el producto, y la contraseña de una cuenta preregistrada puede ser del atacante.
- Conjunto canónico con varias cuentas ⇒ rechazo (F-1-A/B se conserva). Colisión `UNIQUE` de email en carrera ⇒ rechazo, nunca auto-vínculo;
  misma identidad concurrente ⇒ resuelve por el vínculo.

**Efecto de transición (pendiente, no aplicado):** usuarios que dependían del auto-vínculo (misma dirección con contraseña y luego
Google/GitHub) ya no podrán entrar con OAuth hasta que exista un flujo de vinculación con reautenticación. Las cuentas históricas **no** se
reasignan ni se les borran credenciales. Una cuenta local preregistrada por un tercero con el email de la víctima **sigue existiendo**: la
política impide que se fusione con la identidad OAuth de la víctima, pero no la elimina (decisión de producto/soporte).

## 4. Compatibilidad y orden de despliegue (propuesta, sin desplegar)
Backend y frontend deben salir **juntos**. Frontend nuevo + backend antiguo: el backend ignora `challenge` y entrega tokens en el fragmento,
que el frontend nuevo ya no lee ⇒ error seguro. Backend nuevo + frontend antiguo: el frontend antiguo no envía `challenge` ⇒ el backend lo
rechaza ⇒ error seguro. Los callbacks antiguos con tokens en la URL no instalan nada y no hay vía de reaplicación. Migración nueva
`20261012090000_add_oauth_handoffs` (expand-only; rollback `DROP TABLE "oauth_handoffs"`), aplicada solo a la BD aislada.

## 5. Persistencia y retención
Caducidad **lógica** a `expiresAt` (toda comprobación la aplica). Limpieza **física** con `purgeExpiredOAuthHandoffs`, que ningún
scheduler invoca todavía (junto con el resto de purgas, pendiente de D10/scheduler). No se promete borrado: hasta entonces las filas
caducadas permanecen (solo hash del código, challenge, proveedor y usuario). El código no se registra en logs.

## 6. Evidencia (árbol `81a44270…` salvo indicación)
| Verificación | Resultado | Carpeta |
|---|---|---|
| Navegador, ataque F-4 (rojo, código anterior) | 3 fallos / 1 pasa | `artifacts/qa/runs/20261012T091555Z-a33de0d0` |
| Providers, rojo contra módulos originales | 9 fallos / 1 pasa | `backend/artifacts/local-runs/20261012T092116Z-19755891` |
| Backend dirigido (handoff, controlador, política, F-1/F-1-A/B) | 38/38 | `backend/artifacts/test-runs/20261012T091941Z-0a642453` |
| **E2E navegador aislado, 11/11** (ataques + flujo legítimo, silent refresh y logout revocan, identidad cambiada, foráneo, B intacto) | verde | `artifacts/qa/runs/20261012T093450Z-c6179ef1` |
| Integración backend completa | 28 suites / 194 tests, exit 0 | `backend/artifacts/test-runs/20261012T093638Z-df220b2e` |
| `verify-migrations` (26 migraciones, limpia = upgrade = schema) | pass | `backend/artifacts/verify-migrations/20261012T093626Z-7e68fafd` |
| Typecheck backend / build backend / unit backend (81) | exit 0 | `backend/artifacts/local-runs/20261012T0935…` |
| Typecheck frontend (`tsc --noEmit`) | exit 0 | consola |
| Jest frontend completo, copia sin `.env*` | 19 suites / 132 tests, exit 0 (árbol final) | `artifacts/qa/frontend-jest/20261012T093749Z-125551c6` |

**Intentos fallidos y defectos propios (registrados):**
- Un primer Jest frontend falló por mi arnés (`data/` no copiado) y dos por el mock de `window.location`; corregidos.
- E2E `…092350Z-9edddc5c` y una ejecución de depuración (`…092749Z-11be1296`): `page.route` **no interceptó la redirección** y el navegador
  de prueba llegó a `accounts.google.com` real con `client_id=synthetic-google` (página «invalid_client» y recursos estáticos de Google; sin
  cuentas, tokens ni secretos reales implicados). Es un contacto accidental con un proveedor real que el mandato excluía; se corrigió
  sirviendo la redirección desde la propia respuesta del API (sin que el navegador salga del stack local) y añadiendo un guard que falla
  la prueba ante cualquier petición a hosts de proveedor. No demuestro la ausencia total de tráfico externo en las ejecuciones previas
  a la corrección más allá de lo anterior.
- E2E `…092841Z-920fe306`, `…093050Z-ddf931ed`, `…093221Z-b02bca8b`: fallos de diseño de mis pruebas (captura del fragmento, apertura de una
  segunda pestaña con una ruta retenida); sustituidos por una simulación determinista del cambio de identidad.
- No se repitió E2E general previo (`session-and-fallback`) ni `next build` (sin dependencia en lo cambiado salvo el callback y el botón; no
  ejecuté `next build` porque cargaría el entorno operativo).

## 7. Tooling tocado (necesario para ejecutar lo anterior)
`scripts/e2e-isolated.sh`: el guard de destino de BD usaba el mismo glob que NF-1 y ahora usa `validate-db-url.py`; `E2E_FAKE_OAUTH=1`
(proveedores simulados vía `e2e/support/fake-oauth-providers.cjs`, solo en local). `scripts/support/clone-backend.sh`: regenera el cliente
Prisma **dentro del clon** (sin `.env*`, sin red) para que los modelos nuevos existan. `scripts/frontend-jest-isolated.sh` nuevo.
`test-db.sh unit`: el patrón posicional ya no queda absorbido por `--testPathIgnorePatterns`.

## 8. Riesgos residuales y fuera de alcance
- Sin prueba con Google/GitHub reales; la política de scopes (`user:email`, `openid email profile`) no se revisó contra la configuración real.
- Un atacante con **XSS** en el origen del frontend puede leer verifier, código y tokens (localStorage sigue siendo el almacén, decisión previa).
- `Referer`/telemetría: el código viaja solo en fragmento y se limpia al cargar; no se auditó telemetría de terceros del cliente.
- Cuentas OAuth históricas pudieron crearse/vincularse con emails no verificados bajo el código anterior; no se revisan ni se corrigen aquí.
- Cookie de transacción sin firma (httpOnly, host-only): su integridad depende de que ningún tercero pueda escribir cookies en el host del API.
- No hay rate limit específico del canje (aplica el limitador global).
- Copy: no se añadió ni cambió texto; la página de error existente se reutiliza (**sin diff pendiente de la puerta Hermes**).
- Sin cambios: C-D1…C-D5, NF-2, 401 intermitente, transición `ADMIN_USER_IDS`.

---
## 9. Addendum de cierre (revisión del delta OAuth: O-1, O-2, O-3 y `next build`) — texto anterior sin cambios
Estado: corregido y probado en local, **sin commit**. No acepta tareas ni gates. Árbol final `sourceTreeSha256 c4d25a0ccad0aa1165572263bb9e836861ffca93844ef6f8aa2d4251fb0419b4`; las
ejecuciones de backend, Jest y build corresponden a `7db9cb41…` (anterior a un último ajuste del helper de E2E
`e2e/support/network-policy.ts`, que solo captura errores de peticiones canceladas); las ejecuciones E2E finales, a `c4d25a0ccad0aa1165572263bb9e836861ffca93844ef6f8aa2d4251fb0419b4`.

| ID | Defecto | Rojo | Corrección | Verde |
|---|---|---|---|---|
| **O-1** | `errorHandler` registraba `redactSensitive(req.body)`; `verifier` no estaba en el patrón | 2 tests fallaban (`…095406Z-b48ff43b`): redacción estructural y ficheros de log tras rechazos/replay | el cuerpo de `/api/auth/oauth/*` **no se registra** (`[omitted]`) y el patrón cubre `verifier`, `codeVerifier`, `handoff*`; regex sobre texto libre sigue siendo best-effort, no garantía | señuelos con valores reales de code/verifier y señuelos de campos extra: 0 apariciones en los ficheros de log, y la comprobación no es vacía (los rechazos sí se registraron) |
| **O-2** | claim y emisión de sesión en operaciones separadas | fallo inyectado tras el claim y la fila de sesión: el código quedaba consumido (rojo) | `redeemOAuthHandoff` usa **una transacción** (`claim` + lectura + `issueSession(user, now, tx)` + armado de la respuesta); `issueSession` acepta un cliente transaccional y sus llamadores anteriores no cambian | rollback: 0 sesiones y 0 refresh tokens, código aún canjeable y canje posterior exitoso; concurrencia ⇒ 1 sesión; caducado/replay/deshabilitado rechazados sin sesión |
| **O-3** | la guarda solo detectaba | el control con **centinela local** halló un fallo real: un salto de redirección «origen permitido → centinela» sí llegaba (1 petición recibida) y, aún peor, un segundo salto tras una 3xx entregada tampoco se enrutaba | política preventiva por contexto (`e2e/support/network-policy.ts`): solo `BASE_URL`/`API_URL`; todo lo demás se aborta; los permitidos se ejecutan con redirecciones desactivadas y una 3xx de navegación se convierte en una página que hace `location.replace` (cada salto vuelve a enrutarse); 3xx de fetch/XHR ⇒ bloqueado; `serviceWorkers: 'block'`; envoltorio de `APIRequestContext` | centinela local con contador: **0 peticiones recibidas** en fetch, navegación, sub-recurso, salto de redirección, cadena de dos saltos y página nueva; 15/15 E2E dos veces seguidas |

**Política de quemado (deliberada, conservada):** verifier erróneo, proveedor erróneo o usuario deshabilitado **queman** el código; el
resultado se devuelve desde la transacción (se confirma el claim) y solo después se lanza el 401. Probado por separado de O-2.
**Límite documentado:** si el COMMIT se confirma y la respuesta se pierde antes de llegar al navegador, la sesión existe pero el navegador
no la recibió; el código ya está consumido y el login debe reiniciarse. No se ofrece replay de tokens.
**Corrección de una afirmación anterior (§8):** el canje **sí** cuenta en el limitador de autenticación de `/api/auth` (5 peticiones
fallidas por ventana e IP), porque ese limitador se monta por prefijo; los tests tuvieron que respetarlo.

**Límites de la barrera O-3.** Cubre solicitudes del navegador de los contextos creados con el fixture (y `APIRequestContext` mediante el
envoltorio); no cubre WebSockets del propio stack local (destino local), ni un contexto creado a mano sin la política (hay que usar
`installNetworkPolicy`), ni el tráfico del proceso API (que usa `fetch` simulado). Los specs previos no migrados al fixture (p. ej.
`session-and-fallback`) siguen sin esta política. El contacto accidental con `accounts.google.com` de §6 permanece registrado.

**`next build` aislado.** Exit 0 desde una copia fiel sin `.env*`, `NEXT_PUBLIC_API_URL` sintética y entorno vacío
(`artifacts/qa/frontend-build/20261012T100209Z-6612b718`, fidelidad y manifiesto en la carpeta). Dependencia externa identificada:
`next/font/google` descarga CSS/fuentes de `fonts.googleapis.com` en build; se aísla con `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`
(registra las URL consultadas en `font-requests-served-from-mock.txt`). **Divulgación:** las dos primeras ejecuciones del script
(`…095551Z-89086a8a` sin mock, y `…095634Z-7595957d` con un mock defectuoso) terminaron en 0 sin demostrar que no usaron red; la primera
probablemente descargó las fuentes públicas de Google (sin credenciales ni datos). Solo las siguientes prueban el aislamiento.

| Verificación final | Resultado |
|---|---|
| Integración backend completa (issueSession modificado) | 29 suites / 201 tests, exit 0 (`backend/artifacts/test-runs/20261012T100105Z-92db6cf6`) |
| Typecheck / build / unit backend (81) | exit 0 |
| Jest frontend (copia sin `.env*`) | 19 / 132, exit 0 |
| `tsc` frontend, `next build` aislado | exit 0 |
| E2E OAuth + política de red | 15/15 (dos ejecuciones: `…100333Z-a2958369`, `…100416Z-9dc72927`) |
| Intentos fallidos registrados | `…095744Z` (el centinela detectó la fuga por redirección → causa de la política de salto), `…095858Z` (cadena de dos saltos: idem), `…100234Z` (carrera del helper: `route.fulfill` tras navegación; corregido capturando la cancelación — cuenta como defecto de arnés, causa conocida) |
No se repitieron `verify-migrations` (sin cambios de esquema), cuotas ni el E2E general previo. Sigue pendiente lo de §8.

---
## 10. Addendum — aislamiento de red de `next build` (texto anterior sin cambios)
**Estado: PASS**, en local, sin commit. No acepta tareas ni gates. Sustituye como evidencia de aislamiento a la del §9: la ejecución
`…100209Z-6612b718` probaba solo que el build **compilaba** con el CSS mockeado; no demostraba ausencia de tráfico (ni había barrera).

**Compila ≠ aislado.** «Compila» = `next build` termina con exit 0. «Aislado» = además, un mecanismo preventivo del sistema operativo
impide que el proceso y sus hijos abran conexiones, probado de forma independiente del mock.

| Elemento | Resultado |
|---|---|
| Next / Node | 14.2.16 / v24.19.0 |
| Obtención del CSS (`fetch-css-from-google-fonts.js`, inspeccionado en la versión instalada) | con `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` consulta el módulo mock por URL exacta; sin entrada ⇒ error |
| Obtención de los archivos (`fetch-font-file.js`) | con la misma variable **nunca usa red**: una ruta absoluta se lee del disco. El CSS sintético referencia solo un fixture local de 82 bytes (sha256 `d53bbacf…e10b`); el asset `.woff2` emitido tiene exactamente ese hash |
| Barrera | macOS Seatbelt (`sandbox-exec -f perfil`): `deny network*`; sockets unix permitidos salvo el socket del resolvedor (`mDNSResponder`) y los servicios mach de DNS. Aplica al build y a todos sus hijos |
| Sonda previa (centinela LOCAL fuera de toda lista, con contador) | conexión bajo barrera: `EPERM`, **0** conexiones recibidas; control sin barrera: conectó, contador 1 (la sonda no es vacía) |
| Control negativo | el MISMO build sin el mock, bajo la barrera, **falla** (`getaddrinfo ENOTFOUND fonts.googleapis.com`; denegaciones del resolvedor en el log) |
| Build final | exit 0 bajo la barrera; 2 consultas CSS servidas sintéticamente (DM Sans, JetBrains Mono); 0 URLs `.woff2` remotas sin resolver |
| Denegaciones del build final (log unificado, familia node/next) | `node mach-lookup com.apple.SystemConfiguration.DNSConfiguration` ×3; ninguna denegación de socket IP ni del socket del resolvedor en esa ventana; el nombre consultado **no se puede atribuir** con este log |

**Qué se puede y qué no se afirma.** Se afirma: ninguna conexión IP ni consulta DNS pudo salir del proceso de build (todas las
operaciones de red IP y el resolvedor están denegados antes de transmitir), el build no las necesitó, y los archivos de fuente proceden
del fixture. No se afirma que el build no *intentara* resolución: las tres búsquedas de configuración DNS fueron denegadas. Seatbelt no da
totales de conexiones permitidas/bloqueadas; los intentos se conocen solo por el log del sistema.

**Evidencia y comandos.**
- Ejecución final: `artifacts/qa/frontend-build/20261012T102700Z-0f02e45f` (`identity.json`, `summary-build.log.txt`,
  `font-mock-requests.json`, `network-guard.json`, `negative-control-build.log.txt`, `MANIFEST.sha256` verificado), árbol
  `sourceTreeSha256 db1a509e10b86cbcad145c8faa5087eb37e989906706a25a0c1d63055b4eb6f7`, HEAD `ed4bb640…`, rama `development`, sucio.
- Reproducir: `bash scripts/frontend-build-isolated.sh` (falla si falta `sandbox-exec`, si la sonda alcanza el centinela, si el
  control negativo pasa, si el mock no se consulta, si no hay `.woff2` o difiere del fixture).
- Pruebas del runner (inyección de fallos): `bash scripts/test-frontend-build-runner.sh` → 2/2 (barrera ineficaz ⇒ fallo; CSS no servido ⇒ fallo).
- Intentos intermedios del desarrollo del runner (carpetas `…101912Z`–`…102521Z`): fueron iteraciones del propio script (predicado de log,
  ventana de denegaciones). No son la ejecución final.
- Cambios: `scripts/frontend-build-isolated.sh`, `scripts/support/net-probe.cjs`, `scripts/test-frontend-build-runner.sh` y este addendum.
  Sin cambios de producto, esquema ni migraciones. No se contactó ningún host externo (ni para probar el bloqueo).

**Límites residuales.** Solo macOS (Seatbelt, API en desuso pero operativa); builds fuera de este runner no están cubiertos; el perfil
permite sockets unix distintos del resolvedor; el runner no cubre `next dev`/`next start`.
