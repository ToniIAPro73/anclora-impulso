# 28 — Lista de verificación de evidencia por gate y revisión (v1, 2026-10-12)

> Documento de **solo lectura y orientación**. No acepta ninguna tarea AI-xx, no aprueba ningún gate (G1–G4), no sustituye a
> ninguna revisión humana y no autoriza promoción. Los veredictos de abajo son del redactor (agente IA) sobre la **evidencia
> existente en el repositorio**; la decisión es de Toni y de los revisores.
> Fuentes: `INDEX.md`, `01-ai-01-evaluation.md`, `10-…`, `12-…`, `14-review-assignment-register.md`, `15-ai-pre-assessments/`,
> `impulso-pilot-baseline/impulso-pilot-baseline-v1.md` y `.anclora/*` (actualizados en `bc29075`).

## 0. Alcance y límites de esta lista

- **«G1–G4» aquí = los gates del plan piloto**: AI-10 (G1), AI-20 (G2), AI-26 (G3), AI-30 (G4). No son los G1–G4 de
  `docs/roadmap/impulso-post-ux-health/00-ROADMAP-MASTER.md` (arquitectura, esquema, invariantes, auth), que son otra cosa.
- **El plan original no está en el repositorio.** De G1 y G2 se conocen las dependencias (baseline §4). De G3 y G4 solo consta
  quién decide (Toni + producto [+ técnico]) y que son «per plan». No puedo listar sus criterios de aceptación sin inventarlos.
- Esta lista **no** re-ejecuta tests ni revisa código nuevo. Reutiliza lo ya documentado más lo verificado hoy en producción.
- Detalle importante: varios documentos del paquete dicen «D10 no ejecutado» y «sin commit». Eso es **histórico**: ver §1.

## 1. Qué cambió hoy y qué cuenta como evidencia

| Hecho (2026-10-12) | Evidencia | Qué prueba | Qué NO prueba |
|---|---|---|---|
| Migraciones `20261012*` (6) aplicadas en Neon producción | Run #1 de `production-migrations.yml` en `c0333f3`; ledger re-leído por Toni (6 filas terminadas, 0 revertidas) | El esquema de producción está al día con el código; la ruta de migración gobernada funciona (P1) | Que el comportamiento de la aplicación sea correcto ni que las revisiones estén hechas |
| Backend desplegado en Render en `c0333f3` | Deploy Live, `/health/simple` 200, `/api/auth/me` sin token 401 | El servicio arranca y conecta a la BD | Rendimiento, carga, múltiples instancias, observabilidad |
| Comprobación funcional por Toni | QA OK, admin 200, usuario normal 403 | F-1 (admin por `ADMIN_USER_IDS`) funciona en producción para 3 casos | Flujos OAuth, refresco de sesión, idempotencia en producción; sesiones existentes con el frontend viejo |
| Backup Neon `br-shy-cloud-agi9o4kv` | Rama creada antes de migrar, conservada | Existe un punto de restauración | Que sea restaurable (no probado) |
| Contratos `.anclora/` actualizados | Commit `bc29075` | Trazabilidad de la decisión | Nada sobre calidad del producto |

**Esto es evidencia operativa de despliegue (Stage D parcial).** No es evidencia de aceptación de ninguna tarea AI-xx.

### Actualización posterior (2026-10-12, Stage D en producción)
Ejecutado el Stage D con la identidad QA (`32-stage-d-production-results-v1.md`): D1 atomicidad, D3 idempotencia y D7 (motor
PostgreSQL 17.11; 26 migraciones aplicadas, 0 fallidas) con resultado favorable; D2 (coach) **no evaluable** por estar el coach
desactivado; D5/D6 no aplican (una instancia). Mejora la evidencia de AI-08 (Stage D parcial), pero **no la acepta**: siguen
faltando la revisión independiente (B2), AI-01 aceptada y D2. No cambia ningún gate.

### Actualización (2026-10-13): B1-F2 (CSP) — P0 y P1
Implementados en local, **sin desplegar**: política aplicada sin CDNs públicos y con `base-uri`/`object-src`; política estricta en
*Report-Only* con recogida de violaciones. **`unsafe-inline` permanece**: el hallazgo no se da por cerrado. Verificado: 17 tests
nuevos, suite frontend 21/149, `tsc` y `next build` aislado en verde. Pendiente: desplegar, leer las violaciones y decidir P2.

### DECISIÓN DEL PROPIETARIO (2026-10-13): matriz H4 aprobada y G1–G4 aceptados
Toni aceptó la matriz H4 (`43-…` §7) y los gates G1–G4 por decisión expresa. **Los veredictos técnicos de este documento no
cambian** y se conservan como evidencia de lo que había en el momento de la decisión. Detalle y límites: `.anclora/AOS_ADOPTION.md`
(`IMPULSO-OWNER-ACCEPTANCE-H4-G1G4-2026-10-13`). **No autoriza `main` ni acepta las tareas AI-xx por separado.**

### Actualización (2026-10-13): gate Hermes, cuarta ronda
Aprobadas A1–A3 y aplicadas B1–B4 y C1–C2 (`42-…` §8); incluye una corrección funcional del cliente (clave de idempotencia agotada).
Verificado en local: Jest 150, E2E 13/13. **Sin desplegar a producción.** AI-02 sigue sin aceptarse.

### Actualización (2026-10-13): gate Hermes, tercera ronda — cadenas 8 y 10 aprobadas
Hermes aprobó «tal cual» la cadena 8 (aviso del modo IA) y la 10 (tope de generaciones, variante de Toni): `42-…` §6. El gate de copy
queda **cumplido para el generador de rutinas y el aviso de tope**. **AI-02 sigue sin aceptarse**: falta la matriz promesa → función →
prueba (H4), y hay copy sin revisar fuera de ese ámbito («Onboarding inteligente», `429` sin hora en inglés).

### Actualización (2026-10-13): gate Hermes, segunda ronda
Aplicadas las cadenas 9 (fallback) y 10 (tope de generaciones) con E2E 13/13 (`42-…`). La 10 es una variante de Toni, no la propuesta
literal de Hermes: **debe reenviarse**. Sigue pendiente la cadena 8 (aviso del modo IA), que Hermes no llegó a revisar. AI-02 sigue sin
aceptarse (falta la matriz promesa → función → prueba).

### Actualización (2026-10-13): B1-F1/B1-F7 desplegados y dictámenes B1/B2 adoptados por delegación
- **Producción (Render `0606586`, desplegado y verificado):** B1-F1 (CORS sin comodines por prefijo) y B1-F7 (`userId` en logs). Los
  orígenes exactos siguen aceptados; los previews por hash dejan de poder llamar a la API hasta configurar su sufijo.
- **Dictámenes B1 y B2:** adoptados por Toni por delegación expresa (`37-…`, `38-…`). **No independientes**; no aceptan AI-06 AC10 ni
  AI-08 ni mueven ningún gate.

### Decisión (2026-10-13): P2 de la CSP aplazado
Toni aplaza P2 (renderizado dinámico + *nonces*) hasta que haya usuarios. B1-F2 queda **parcialmente mitigado** (P0 + medición P1).
Riesgo residual aceptado temporalmente: un XSS podría robar los tokens de `localStorage`. Antes de abrir tráfico real conviene
retomarlo (`41-…`) y decidir la mitigación de fondo (cookie `httpOnly`, S1/P3).

### Actualización (2026-10-13): B1-F1 (CORS)
Corregido en código y verificado en local (9 + 4 tests): sin comodines de Vercel salvo sufijo de equipo configurado. **Sin
desplegar.** Cambio operativo: los previews por hash no podrán llamar al backend de producción hasta configurar
`FRONTEND_PREVIEW_HOST_SUFFIXES` o listar sus alias en `FRONTEND_URL`.

### Actualización (2026-10-13): cliente ante el 429 y B1-F7
- **Cliente:** el generador ya trata el `429` con `windowResetsAt` y existe un E2E (`e2e/session-and-fallback.spec.ts`, caso
  «quota exhaustion») con la misma forma de respuesta que emite el backend. Queda anotado que **esa cadena no pasó por Hermes** y que
  los `429` sin `windowResetsAt` muestran texto del servidor en inglés (`34-…` §6ter).
- **B1-F7:** corregido en código (atribución de `userId` en logs de error y de petición lenta), con test; **sin desplegar**.

### Actualización (2026-10-13): B2-F1 verificado en producción
Desplegada la corrección (Render en `41a427a`, código equivalente a `4eb8e1b`), la sonda D8 (`32-…` §7) obtuvo **10 aceptadas y
la undécima `429 quota_exhausted`** con instante de reinicio exacto. B2-F1 pasa de «abierto en producción» a **verificado en
producción** (un caso, una ráfaga secuencial). Sigue sin aceptarse AI-08. Pendiente: mensaje del cliente ante el `429`.

### Actualización posterior (2026-10-13, B2-F1)
Hallazgo B2-F1 (generación de rutinas sin cuota por usuario; ver `38-…`): **corregido en código** en `development` (`4eb8e1b`):
tope por usuario y ventana, exacto bajo concurrencia, 9 tests nuevos, control negativo, CI en verde. **Producción sin cambiar**
(`c0333f3`): hasta el despliegue manual y una sonda con la cuenta QA, el hallazgo sigue abierto allí. Mejora la evidencia de
Accept 2 de AI-08 para la generación de rutinas, **sin aceptar AI-08**. Quedan las 3 suites de logs que fallan por hora del día
(hipótesis sin demostrar, ver conversación) y la comprobación del mensaje de cliente ante el nuevo 429.

## 2. Gate G1 (AI-10) — dependencias AI-02, 04, 05, 06, 07, 08, 09

| Dependencia | Estado documentado | Evidencia que existe | Qué falta | Quién | Veredicto |
|---|---|---|---|---|---|
| AI-02 copy/promesas | PENDIENTE | Copy cambiada en local/`development`; aserciones E2E (R-L) | Revisión Hermes (C), matriz promesa–función–prueba (no hay paywall) | Hermes; Toni confirma ruta | **Sin cerrar** |
| AI-04 validador de rutinas | PENDIENTE | Validador implementado; tests integración/E2E locales | Límites revisados por AI-03; Stage D | Profesional (A) | **Parcial** |
| AI-05 fallback determinista | PENDIENTE | Fallback + modo persistido (R-L) | Plantillas revisadas por AI-03; aviso de modo en UI | Profesional (A) + dev | **Parcial** |
| AI-06 auth/sesiones | PENDIENTE; AC10 BLOQUEADA | Sesiones, revocación, política; F-1/F-4 corregidos; preevaluación IA B1; producción verificada hoy (3 casos) | Revisión de seguridad humana (B1); decisión de transporte de token (AC10) | Seguridad (B1) + Toni | **Parcial, AC10 bloqueada** |
| AI-07 privacidad/legal | PENDIENTE (hallazgos) | Preevaluación IA D; hallazgos F-L5-5 (cambiar a privado no retira lo publicado) etc. | Revisión legal humana (D); política de retención/backup; export/erase no existen | Legal (D) + dev | **Sin cerrar** |
| AI-08 integridad/idempotencia | No aceptada | 23 suites / 141 tests en PG16 aislado; preevaluación IA B2 (NF-1 corregido); migraciones aplicadas hoy | Staging/entorno equivalente (Stage D), revisión independiente humana (B2), AI-01 aceptada, decisión A-08-01 | Revisor B2 + Toni | **Parcial: sin evidencia multiinstancia/pooler** |
| AI-09 CI/restore | PENDIENTE | Config CI existe; lockfile npm vs pnpm detectado | Resultado de CI limpio; ensayo de restore/rollback; escaneo | Técnico + QA | **Sin evidencia** (restore del backup de hoy no probado) |

**Veredicto G1: NO cumplido.** Ninguna de las 7 dependencias está aceptada. Bloqueos duros: revisiones humanas A, B1, B2, C, D
sin designar (todas «LISTO PARA ASIGNACIÓN», nada enviado) y AI-01 sin aceptar.

## 3. Gates G2, G3, G4

| Gate | Dependencias conocidas | Estado | Veredicto |
|---|---|---|---|
| G2 (AI-20) | AI-11, 12, 13, 14, 17, 18, 19 | Todas pendientes/parcial; AI-14 sin UI y depende de G1; AI-17/19 sin empezar; AI-15/16 (pagos) inexistentes | **NO cumplido; no evaluable antes de G1** |
| G3 (AI-26) | «per plan» (no en repo); decide Toni + producto | AI-21…AI-25 pendientes (humano/comercial) | **NO cumplido; criterios no disponibles en el repo** |
| G4 (AI-30) | «per plan» (no en repo); Toni + producto + técnico | AI-27…AI-29 pendientes | **NO cumplido; criterios no disponibles en el repo** |

## 4. Revisiones externas (A, B1, B2, C, D)

| ID | Alcance | Preevaluación IA disponible | Revisor humano | Estado en registro | Para cerrar |
|---|---|---|---|---|---|
| A | AI-03 (+AI-04/05) | `15-A-IA`: envelope sin respaldo profesional (descanso 0 s, 1 ejercicio, 5×15 «advanced»); inconsistencias «segura» vs. comportamiento | No designado | LISTO PARA ASIGNACIÓN | Toni nombra profesional cualificado; dictamen firmado |
| B1 | AI-06 AC10 | `15-B1-IA`: no encontró ruta de cambio de usuario al renovar credenciales | No designado | LISTO PARA ASIGNACIÓN | Toni nombra revisor de seguridad |
| B2 | AI-08 | `15-B2-IA`: evidencia suficiente en alcance local; NF-1 (corregido), NF-2 no confirmado; staging/pooler/multi-instancia **no evaluables** | No designado | LISTO PARA ASIGNACIÓN | Revisor independiente; Toni decide A-08-01 |
| C | Copy (AI-02, strings AI-04/05) | — | Hermes no disponible en este entorno | LISTO PARA ASIGNACIÓN | Toni confirma ruta/persona del gate Hermes |
| D | L1–L8 | `15-D-IA`: marco RGPD art. 9, DPA/transferencia (Groq, DPF), MDR «aplicabilidad pendiente» | No designado | LISTO PARA ASIGNACIÓN | Toni nombra revisor legal |

Regla vigente (registro §State rules): una preevaluación IA **no** sustituye una firma humana ni un requisito que exija otro
tipo de revisor. Hallazgo factual del registro: **la copy ya está en `development` y `staging`; el gate Hermes está abierto y debe
cerrarse antes de `production`/`main`.**

## 5. Estado del resto de la cadena de release

| Elemento | Estado | Nota |
|---|---|---|
| Migraciones en producción | **Hecho y verificado** | §1 |
| Backend en producción (`c0333f3`) | **Hecho; verificación funcional limitada (3 casos)** | Render sigue la rama `development` por decisión de Toni |
| Frontend en producción (Vercel, `main`) | **Sin tocar; compatibilidad con backend nuevo no verificada más allá de los 3 casos** | Es el riesgo principal de una promoción a `main` |
| Promoción a `staging` / `main` | **No autorizada** | Mover `main` despliega el frontend de producción |
| Smoke de producción con identidad QA dedicada | Pendiente | Listado como pendiente en `10-…` |
| Scheduler/monitorización, límites de cuota, autorización comercial | Pendiente / decisión de producto | `10-…` §C |

## 6. Qué puede hacer cada parte para avanzar (en orden de menor a mayor esfuerzo)

1. **Toni (decisiones, sin trabajo técnico):** nombrar revisores A, B1, B2, D y la ruta Hermes (C); confirmar `B-D6` y nombrar
   al «técnico» (AI-01); decidir A-08-01 y si habrá staging.
2. **Toni (comprobaciones propias):** checks de logs externos del documento 03; smoke de producción con la cuenta QA
   dedicada (login, refresco de sesión, OAuth, generación de rutina, sesión con idempotencia).
3. **Ingeniería (yo, si Toni lo pide):** ensayar la restauración del backup `backup-pre-migration-20261012` en una rama
   aparte (cierra parte de AI-09); corregir lockfile npm/pnpm en CI; actualizar los documentos 10–12 que dicen «D10 no ejecutado».
4. **Revisores externos:** emitir dictamen sobre el alcance de cada encargo.
5. **Solo después de 1–4:** redactar el paquete de promoción a `staging`, y decidir `main` con la compatibilidad
   frontend–backend verificada en staging.

## 7. Límites de esta lista

- Los veredictos son consultivos del redactor; ninguna fila sustituye a la decisión de Toni ni a un dictamen humano.
- No se ha verificado nada nuevo en producción para elaborar esta lista (se reutiliza lo verificado hoy).
- Los criterios de G3 y G4 no están disponibles en el repositorio y no se han supuesto.
- Los documentos 10, 11 y 12 conservan afirmaciones históricas («D10 no ejecutado», «sin commit») que hoy son obsoletas; no se
  han editado aquí.
