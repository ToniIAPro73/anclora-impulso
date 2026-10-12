# 15-00 — Resumen ejecutivo de las revisiones IA B1/B2 y preevaluaciones A/D

Fecha: 2026-10-12 · Coordinador: sesión Claude Code (Sonnet 5.5, `claude-sonnet-5-5`) · Solo análisis; no se modificó código, test, configuración, esquema ni dependencias; no hay commit, push, despliegue ni comunicación a terceros.

> Esto **no** es una auditoría humana, certificación, dictamen jurídico ni aval profesional. No se acepta ninguna tarea AI-xx ni gate G1–G4; Hermes (C) queda abierto; no se autoriza lanzamiento.

## 0. Versión revisada y modo de ejecución

| Elemento | Valor |
|---|---|
| Revisión objetivo (única, los cuatro agentes) | `ed4bb640a72d5afc9c652829f2c3583b1cb4b1d5`, rama `development`, árbol limpio, tree `71151408f79cac9dcf4f35350790f23a2fb4ed16` |
| ZIP histórico | `anclora-impulso-review-consolidated-20261012T064901Z.zip`, SHA-256 `ae3e5575…c294c75` verificado; usado como evidencia histórica |
| Estado de ramas (ls-remote de solo lectura) | `development` = `ed4bb64`; `staging` = `944eb67`; `main` y `production` = `77f852aa` |
| Modo real | 4 subagentes en contextos separados (uno por encargo) lanzados por el coordinador; cada uno escribió solo su archivo |
| Relación con la implementación | contextos nuevos, sin historial de implementación; la implementación la hizo un agente IA con Toni (modelo desconocido). No hay independencia humana |

### Correcciones a las premisas del prompt (comprobadas)
1. **`staging` no está en el mismo SHA que `development`.** `development` lleva dos commits más (`ca01b9c`, `ed4bb64`). La rama `staging` además no implica entorno staging.
2. **Difieren tres archivos del ZIP, no uno:** `components/workout-generator.tsx` (4 líneas de tipado), `backend/src/services/workouts.service.ts` (import estático del módulo LLM en lugar de `await import`) y `backend/tsconfig.json` (`module`/`moduleResolution` → `node16`). Los dos últimos están solo en `development`.
3. **Cobertura de esos cambios (aportada por B2-IA, contrastada por el coordinador en `identity.json`):** existe una ejecución de integración backend `20261012T073824Z-846d1e27` (23 suites / 141 tests, exit 0) con `sourceTreeSha256 a15ad0e3…7583` sobre un árbol sucio con base `944eb67` que ya incluía esos cambios. Esa ejecución **no figura** en el paquete, el ZIP ni los docs 10/11 (laguna de procedencia). B2-IA indica que recomputó el mismo hash en `HEAD`; el coordinador no lo repitió. **No** se reejecutaron tras `ca01b9c`: `verify-migrations` (hashes de migraciones idénticos), unit backend (67/67 solo en el mensaje de commit), E2E, build `tsc`.
4. `backend/.env.example` difiere de la base y no está en el ZIP; no se abrió deliberadamente. D-IA declara que un grep imprimió ~8 líneas de plantilla de ese archivo (sin secretos, sin uso).

## 1. Hallazgos nuevos sustentados (sin duplicados)

Criticidad ≠ confianza. «Verificado por coordinador» = el coordinador releyó la ruta de código; ninguno está reproducido contra base de datos o navegador.

| ID | Origen | Hallazgo | Crit. | Conf. | Verificación | Acción mínima propuesta (no implementada) |
|---|---|---|---|---|---|---|
| F-1 | B1 | **Escalada a administrador por mayúsculas del email.** El registro no normaliza el email (`validators.ts:5,11`; `auth.service.ts:25,38`; `UNIQUE` sensible a mayúsculas) y `isAdminEmail` compara en minúsculas (`middleware/admin.ts:9`). Registrar `Admin@dominio` otorga `isAdmin` si `admin@dominio` está en `ADMIN_EMAILS`: dashboard, escritura de catálogo, dispatch-now. B1-IA lo marca preexistente en la base `77f852aa` | ALTA | ALTA (lógica) | Coordinador por lectura; repro DB PENDIENTE | normalizar email (trim+lower) en registro/login y en unicidad; revisar usuarios existentes con variantes de mayúsculas |
| F-3 | B1 | `PUT /progress/measurements/:id` pasa el cuerpo sin validar a `prisma.update` (`progress.service.ts:46-49`): asignación masiva, p. ej. `userId` | MEDIA-BAJA | ALTA | Coordinador por lectura del servicio; no abrí el controlador | whitelist de campos / esquema de validación |
| F-2 | B1 | `POST /api/sessions` no verifica la propiedad de `workoutId` del cuerpo (filtra un entreno ajeno al feed propio); requiere conocer el UUID | MEDIA-BAJA | ALTA | solo B1 | comprobar `workout.userId` |
| F-4 | B1 | Callback OAuth instala tokens del fragmento/query sin vinculación de flujo (login CSRF / fijación de sesión); el fallback por query es innecesario | MEDIA | ALTA | solo B1; repro navegador PENDIENTE | `state`/nonce ligado a la sesión del navegador; retirar fallback query |
| F-5 | B1 | Caché de React Query sin clave por usuario ni limpieza al cambiar identidad sin recarga (forma concreta del riesgo conocido nº 6) | BAJA-MEDIA | MEDIA | solo B1 | limpiar caché en cambio de identidad |
| NF-1 | B2 | El patrón de `backend/scripts/test-db.sh:28-31` y la guarda TS aceptan una `DATABASE_URL` con host efectivo remoto (`…@evil:5432/x@127.0.0.1…`, `?host=`). Afecta `migrate`, no `verify-migrations` ni `test`. Simulado sin conexión | BAJA | ALTA lógica / Prisma PENDIENTE | solo B2 | parsear la URL y validar host/puerto efectivos |
| C-D1 | D | **El banner de cookies guarda la elección en `localStorage` (`anclora-cookie-consent-v1`) y nada la lee**; `<Analytics/>` (`app/layout.tsx:44`) y los eventos de producto se disparan sin condición, en contradicción con la política de privacidad | MEDIA-ALTA | ALTA (estático) | Coordinador: ningún otro consumidor de la clave en `app/components/lib/hooks` | condicionar analítica/eventos al consentimiento — la decisión de base jurídica es del profesional |
| C-D2 | D | `errorHandler` registra `redactSensitive(req.body)` + IP + UA en cada error, 30 días; la redacción es por clave, email/`limitations`/mensajes del coach quedan en claro | MEDIA-ALTA | ALTA | solo D (solapa con F-13 de B1) | decidir qué se registra; no registrar cuerpo |
| C-D3 | D | `coach_messages` y `product_events` sin retención y fuera del inventario L2; el purge cubre solo idempotencia y sesiones y nada lo programa; política dice «12 meses tras eliminación» sin flujo de borrado | MEDIA | ALTA | solo D | decisión de retención + flujo de borrado |
| C-D4 | D | `socialProfileVisibility` por defecto `public`; los entrenos publican en feed legible por cualquier autenticado con `fullName`; sin UI social; `updatePrivacy` no retroactivo (solapa con F-8 de B1) | MEDIA | ALTA | solo D | decisión de producto/legal: default privado o desactivar feed |
| C-13 / C-D5 | A, D | El guardarraíl médico del coach no se activa con «me duele», «lesión», «médico», «mareo», «dolores»; falso positivo con «medición»; respuesta solo en inglés para usuarios ES (probe local de A y D) | MEDIA (seguridad) | ALTA | probes de dos agentes | decisión del profesional sobre cobertura; localizar |
| NF-2 | B2 | **Candidato:** dos `PUT /workouts/:id` concurrentes con `order` disjuntos podrían dejar la unión de ejercicios (READ COMMITTED) | BAJA-MEDIA | MEDIA | receta PENDIENTE | verificar con PostgreSQL local antes de actuar |

Candidatos de triage de A-IA (mecanismo por lectura, sin prueba en producción; ver informe A para IDs C-01…C-14): el prompt no declara los techos que el validador impone (C-01), calentamiento prometido pero no expresable (C-02), usuario nuevo con adherencia 0 recibe `reduce` (C-03), limitaciones solo como texto libre y el fallback/validador las ignoran (C-04), tres poblaciones de edad distintas (C-05), la UI muestra dificultad/duración solicitadas no efectivas (C-07), señales de Ruta Vital no leídas por el generador (C-10), POST/PUT manuales sin techos (C-11), progresión fuera de envolvente (C-06/14, latente).

Otros puntos de B1 de baja criticidad (F-6…F-13): CSP de producción con `unsafe-inline` y jsdelivr/unpkg; CORS `*.vercel.app` con credenciales; `req.user.id` siempre indefinido en `errorHandler`/`httpLogger`; `/health` público expone detalle y `error.message`; `/health-plans/definitions` es público contra el inventario 01a; flag legacy por defecto `true`; puntos de log no auditados.

## 2. Riesgos ya conocidos y decisiones pendientes (no son defectos)

| Tema | Fuente | Decisión reservada |
|---|---|---|
| `localStorage`/CSP aceptables para el piloto | B1 | Toni + revisor de seguridad |
| Ventana de gracia de refresh (10 s): replay dentro de ella no se detecta; respuesta perdida + reintento >10 s revoca sesión legítima | B1 | Toni; alternativa: aceptar solo si el sucesor no se usó |
| Tokens legacy: refresh JWT no consumidos, generan sesiones hasta `exp`; logout no los invalida | B1 | criterio de retirada |
| `SECURITY_CONFIG_MODE=enforce` solo bloquea severidad error; legacy y vida 7 d son warning (AC02 literal no cumplido) | B1 | decisión de lanzamiento |
| Admin sin MFA/verificación; sin herramienta de revocación de sesiones (solo SQL); topología de proxy para el rate limiter | B1 | Toni |
| Aprobar/enmendar addendum A-08-01; topes experimentales 3/5/2 sin techo global; programación de purge/reconcile (D10) | B2 | Toni + revisor independiente |
| Migración 5 editada tras un apply local: aceptable solo si ningún otro entorno aplicó la versión anterior; no editar de nuevo | B2 | Toni |
| ¿Reejecutar `verify-migrations`, unit y E2E sobre `HEAD`? | B2 + §0 | Toni |
| Causas desconocidas de `…255cfca9`, `premium-form-voice` e inc03 intermitente | histórico | no atribuidas |
| Envolvente numérica de ejercicio: ninguna cifra revisada (R1–R17 de A) | A | profesional del ejercicio |
| Datos a Groq (EE. UU.): ¿`limitations` = datos de salud (art. 9 RGPD)? ¿consentimiento explícito? DPA/ZDR no verificable | D | profesional legal |
| AI Act (Reglamento 2026/1744 «omnibus»): aplicabilidad art. 50 según rol; producto sanitario (MDCG 2019-11) según finalidad declarada | D | profesional legal |

## 3. Qué avanzó con análisis IA y qué exige revisión humana

| Ámbito | Resultado IA | Sigue requiriendo |
|---|---|---|
| AI-06 (B1) | ES: AC01, AC03–AC06, N01–N04. RC: AC02, AC07 (F-2/F-3). NE: AC08 (n/a bearer), AC09, N05. **AC10 pendiente**, sin firma. R8/A/B/C: sin ruta por lectura en que renovar credenciales cambie de usuario | revisión humana de seguridad exigida por el contrato de AC10; verificación F-1/F-4 en entorno |
| AI-08 (B2) | C1–C9 ES en el alcance (PG16 local, un proceso); C10 guardas RC (NF-1); C11 staging NE; C12 revisión humana independiente RVP | revisor independiente humano, Stage D, decisión de A-08-01 |
| AI-03 (A) | R1–R17 y 14 candidatos; **todos los valores numéricos RVP**; NE la aptitud de cada cifra, tasa real de rechazo LLM, catálogo de producción | profesional del ejercicio |
| L1–L8 (D) | correspondencias código↔textos descritas; preguntas para el letrado | profesional legal; NE: Neon/región, logs de plataforma, contrato Groq, comportamiento real del banner |

## 4. Recomendación del siguiente incremento

**Sí existe base para un incremento de código pequeño y acotado**, porque hay defectos sustentados por lectura: **F-1 (prioritario), F-3, F-2** y, tras decisión legal, C-D1. Propuesta: una corrección mínima de F-1/F-2/F-3 con test unitario/integración que lo demuestre, **antes** de cualquier promoción. Condiciones: autorización expresa de Toni; F-1 debe reproducirse primero en PostgreSQL local (reproducción: registrar `Admin@x` con `admin@x` en `ADMIN_EMAILS` y llamar a una ruta `requireAdmin`).

**Comprobación externa urgente para Toni (sin código):** `main`/`production` están en `77f852aa` y B1-IA indica que F-1 es preexistente en esa base. Si ese código está desplegado, revisar `ADMIN_EMAILS` y usuarios existentes con variantes de mayúsculas del email de administración. El coordinador no verificó el despliegue real.

Resto: sin otra ronda de código; decisiones y revisiones profesionales según §2 y §3.

## 5. Informes

| Encargo | Informe |
|---|---|
| B1-IA | `15-B1-IA-security-ai06.md` |
| B2-IA | `15-B2-IA-integrity-ai08.md` |
| A-IA | `15-A-IA-exercise-ai03.md` |
| D-IA | `15-D-IA-legal-l1-l8.md` |

Límites del coordinador: los informes completos no se releyeron línea a línea; las cifras de los subagentes se citan como declaradas por ellos salvo donde se indica verificación. Ninguna prueba de base de datos ni navegador se ejecutó.

---
## Addendum 2026-10-12 — status of NF-1, F-1, F-2, F-3 (text above unchanged)
Implemented locally and uncommitted; mechanism, red/green evidence, limits and deployment preconditions in
`../16-correction-nf1-f1-f2-f3.md`. F-1 now has an additional precondition: the administrator is designated by `ADMIN_USER_IDS`
(`ADMIN_EMAILS` is ignored). An adjacent demonstrated instance of F-3 (measurement creation with `userId` in the body) was fixed too.
Open and untouched: F-4, C-D1…C-D5, NF-2 and the A-IA candidates. Section 0 point 3 (historical run) was verified: see doc 16 §7.
