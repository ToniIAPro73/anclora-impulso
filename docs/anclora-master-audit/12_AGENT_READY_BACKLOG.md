# 12 — Backlog listo para agentes de IA

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> Reglas comunes para **todas** las tareas (se aplican además de la plantilla de `13`):
> - Trabajar solo en la rama `development`, sin ramas nuevas, sin commits ni push hasta que Toni valide.
> - Crear spec en `sdd/features/<nombre>/` antes de código (`AGENTS.md`).
> - Tests primero; código y comentarios en inglés (`AGENTS.md`, principio 5). Los documentos de producto pueden seguir en español.
> - Ningún agente lee ni imprime ficheros `.env*`.
> - No ejecutar tests de integración contra la base de datos de producción ni migrar desde local.
> - Copy público: pasar por el gate Hermes antes de cerrar.

---

## Índice

| Tarea | Título | Fase | Prioridad | Tipo | Origen | Tamaño |
|---|---|---|---|---|---|---|
| TASK-001 | Cerrar discrepancia documental de migración P1 | 0 | Media | Documentación | AUD-006 | S |
| TASK-002 | Refresh token en cookie httpOnly | 0 | Crítica | Seguridad | AUD-001 | M |
| TASK-003 | Marco legal de menores, salud y consentimiento | 0 | Bloqueante | Legal / producto | AUD-003, AUD-012 | M |
| TASK-004 | Retirar dependencias sin uso y fijar versiones | 1 | Alta | Supply chain | AUD-007 | S |
| TASK-005 | Regenerar cliente Prisma y gate de tipos backend | 1 | Alta | Calidad | AUD-005 | S |
| TASK-006 | Secretos JWT obligatorios en cualquier arranque | 0 | Crítica | Seguridad | AUD-002 | S |
| TASK-007 | Retirar o proteger la carpeta pública `/dashboard` | 1 | Media | Seguridad | AUD-011 | S |
| TASK-008 | La cohorte exige edad conocida | 1 | Alta | Elegibilidad | AUD-004 | S |
| TASK-009 | Proveniencia de textos 40+ y por sexo | 1 | Alta | Contenido | AUD-012, OPP-005 | M |
| TASK-010 | Revisión profesional de límites de planes IA | 1 | Alta | Seguridad clínica | AUD-013 | M |
| TASK-011 | Corregir documentación desfasada | 1 | Media | Documentación | AUD-008/009/010/020 | S |
| TASK-012 | Guardas para impedir integración local contra producción | 0 | Crítica | Operación | AUD-014, AUD-023 | S |
| TASK-013 | E2E de Ruta Vital y visual QA en entorno controlado | 1 | Media | Testing | AUD-018, AUD-019 | M |
| TASK-014 | Partir `nutrition.service.ts` con tests de caracterización | 7 | Baja | Mantenibilidad | AUD-015 | L |
| TASK-015 | Partir componentes grandes de dashboard y progreso | 7 | Baja | Mantenibilidad | AUD-016 | M |
| TASK-016 | Reducir usos de `any` | 7 | Baja | Calidad | AUD-017 | M |
| TASK-017 | Campos de catálogo: cohorte, variante y bandas | 2 | Alta | Datos | OPP-006 | M |
| TASK-018 | `sexAtBirth` y `genderIdentity` opcionales | 2 | Media | Datos | AUD-012 | M |
| TASK-019 | Seed de 10 modalidades en borrador | 2 | Media | Datos | OPP-006 | S |
| TASK-020 | Elegibilidad por bandas no solapadas y tests | 2 | Alta | Dominio | AUD-004 | S |
| TASK-021 | Contenido de 24 semanas para Ruta Vital (P07, P08) | 3 | Alta | Contenido | AUD-021 | L |
| TASK-022 | Pantalla de selección de modalidad | 3 | Media | Producto | OPP-004 | M |
| TASK-023 | Cambio de modalidad con historial | 3 | Media | Producto | OPP-004 | M |
| TASK-024 | Módulos opcionales de salud ósea y ciclo (experimento) | 3 | Experimento | Contenido | AUD-012, OPP-005 | M |
| TASK-025 | Onboarding no clínico con consentimiento | 4 | Media | Producto | OPP-003 | M |
| TASK-026 | Motor de reglas explicable | 4 | Media | Dominio | OPP-002, OPP-007 | M |
| TASK-027 | Investigación de competidores 40+ y 50+ | 5 | Experimento | Investigación | OPP-013 | S |
| TASK-028 | Indicadores de confianza en progreso con pocos datos | 5 | Media | UX | AUD-019 (UX-06) | S |
| TASK-029 | Explicación con IA opcional (experimento) | 6 | Experimento | IA | OPP-008 | M |
| TASK-030 | Eventos del embudo de planes | 5 | Media | Observabilidad | AUD-006 (medición) | M |
| TASK-031 | *(Reservada)* Retirada de `refreshToken` en respuesta JSON | 0/1 | Reservada | Seguridad | Contrato auth cookie | S |
| TASK-032 | Contrato `meal-plan-import-v1`, catálogo único y validadores (N0) | N0 | P0 | Dominio / Contrato | Spec Nutrición v2.0 | M |
| TASK-033 | Spike de persistencia y decisión condicional M28 (N1) | N1 | P1 condicional | Datos | Spec Nutrición v2.0 | S |
| TASK-034 | Pipeline `preview`/`commit` JSON, unidades e idempotencia (N1) | N1 | P0 | Backend | Spec Nutrición v2.0 | L |
| TASK-035 | Importación de texto libre / ODT / DOCX (N3) | N3 | P3 | Integración | Spec Nutrición v2.0 | M |
| TASK-036 | UI «Nuevo plan» + preview (N1) y tabs Preparación/Compra (N2) | N1/N2 | P0 → P1 | Frontend | Spec Nutrición v2.0 | M |
| TASK-037 | Adaptación skill `planificador-nutricion-mealprep-50` a JSON v2 (N0) | N0 | P0 | Skill / Contrato | Spec Nutrición v2.0 | S |
| TASK-038 | Asistente 5 decisiones e IA opcional bajo flag (N2) | N2 | P2 | Producto / IA | Spec Nutrición v2.0 | M |
| TASK-039 | Conector seguro Claude → borrador revisable (N3) | N3 | P3 / exp. | Integración | Spec Nutrición v2.0 | M |

---

## Fase 0 — Riesgos críticos y bloqueantes

### TASK-001 · Cerrar discrepancia documental de migración de Health Plans
- **Fase:** 0 · **Prioridad:** Media (resuelta la verificación en Neon) · **Tipo:** documentación · **Origen:** AUD-006
- **Estado actual:** el gate P1 (`docs/roadmap/impulso-post-ux-health/P1-FINAL-GATE-REPORT.md`) registra la migración `20260914130000_add_health_plans` como aplicada en "configured development database", mientras que el contrato (`.anclora/PRODUCTION_RUNTIME.md`) declara que solo existe la base de producción en Neon.
- **Evidencia verificada (2026-11-09, CLI de Vercel, `vercel env run -e production`, solo lectura):** existen 58 tablas en `public`, incluidas las 10 `health_plan_*`, y el ledger `_prisma_migrations` marca `20260914130000_add_health_plans` como terminada y sin rollback.
- **Problema:** la redacción del gate P1 contradice el contrato de runtime (`LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED`) y falta reflejar en `.anclora/PRODUCTION_RUNTIME.md` §12 la confirmación del ledger para `20260914130000_add_health_plans`.
- **Resultado esperado:** nota aclaratoria en `P1-FINAL-GATE-REPORT.md` y registro de verificación en `.anclora/PRODUCTION_RUNTIME.md` §12, sin tocar datos ni exponer credenciales.
- **Pasos:**
  1. Aclarar en `docs/roadmap/impulso-post-ux-health/P1-FINAL-GATE-REPORT.md` que la base configurada corresponde al modelo `PRODUCTION_BACKED` en Neon y que `20260914130000_add_health_plans` figura terminada en `_prisma_migrations`.
  2. Registrar en `.anclora/PRODUCTION_RUNTIME.md` §12 la verificación de solo lectura del ledger de Neon realizada el 2026-11-09.
- **Decisiones pendientes:** ninguna.
- **Restricciones:** ningún agente aplica migraciones ni lee `.env*`.
- **Criterios:** gate P1 y contrato alineados; ningún cambio de esquema ni de datos.
- **Pruebas:** no aplica (ajuste documental).
- **Riesgos:** ninguno.
- **KPI:** 0 contradicciones sobre el estado de `20260914130000_add_health_plans` entre gate y contrato.
- **Definición de terminado:** Toni valida la actualización documental.
- **Estimación:** S · complejidad baja · riesgo nulo.

### TASK-002 · Refresh token en cookie httpOnly
- **Fase:** 0 · **Prioridad:** Crítica · **Tipo:** seguridad · **Origen:** AUD-001
- **Estado actual:** `auth.controller.ts:88` devuelve `refreshToken` en JSON; `lib/api/auth.ts:33,81`, `lib/contexts/auth-context.tsx:135,181,191` lo guardan y leen de `localStorage`.
- **Problema:** un XSS puede robar un refresh de 30 días.
- **Resultado esperado:** refresh en cookie `httpOnly; Secure; SameSite=Lax; Path=/api/auth`; el frontend no lo guarda ni lo lee.
- **Justificación:** el patrón ya existe en `oauth.controller.ts:27-29`.
- **Archivos potencialmente afectados:** `backend/src/controllers/auth.controller.ts`, `backend/src/services/session.service.ts`, `backend/src/routes/auth.routes.ts`, `lib/api/auth.ts`, `lib/api/client.ts`, `lib/contexts/auth-context.tsx`, tests en `backend/tests/integration/auth.test.ts` y `__tests__/lib/auth-context-session.test.tsx`.
- **Dependencias:** ninguna.
- **Pasos:**
  1. Spec en `sdd/features/refresh-cookie/`.
  2. Test de login que espera `Set-Cookie` y no `refreshToken` en el cuerpo.
  3. Cambiar backend con retrocompatibilidad de 1 ventana de transición (leer cookie o cuerpo).
  4. Cambiar frontend para eliminar lectura y escritura de `localStorage`.
  5. Logout borra la cookie y revoca la sesión.
- **Decisiones pendientes:** duración de la ventana de transición; si se mantiene el cuerpo para clientes nativos (no existen hoy).
- **Restricciones:** no cambiar la rotación de refresh; no cambiar la expiración sin decisión de Toni.
- **Criterios:** sesión sobrevive a recarga; refresh rota; logout revoca; ningún token en `localStorage`.
- **Pruebas:** integración de auth (CI); unitarias de cliente; comprobación de cabeceras.
- **Comprobaciones de seguridad:** `HttpOnly`, `Secure` en producción, `SameSite`, `Path` restringido; sin token en logs.
- **Riesgos de regresión:** usuarios con sesión abierta deben reloguearse una vez.
- **KPI:** 0 claves de refresh en `localStorage`.
- **Definición de terminado:** tests verdes en CI; validación de Toni en `development`.
- **Estimación:** M · complejidad media · riesgo medio · cambia si OAuth depende del cuerpo.

### TASK-003 · Marco legal de menores, salud y consentimiento
- **Fase:** 0 · **Prioridad:** Bloqueante · **Tipo:** legal / producto · **Origen:** AUD-003, AUD-012
- **Estado actual:** sin cláusula de menores ni de datos de salud; registro sin edad; perfil acepta 14–100.
- **Resultado esperado:** textos legales revisados por asesoría; decisión sobre edad mínima; consentimiento específico para salud y sexo; bloqueo de planes para menores.
- **Archivos:** `components/legal-document.tsx`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `lib/translations/es.json`, `en.json`, `backend/src/utils/validators.ts`, `components/cookie-consent.tsx`.
- **Pasos técnicos:**
  1. Spec en `sdd/features/minors-health-consent/`.
  2. Revisión legal externa (fuera de la IA): texto oficial de la norma aplicable.
  3. Test: `age < edad mínima` no puede inscribirse en planes.
  4. Implementar consentimiento versionado.
- **Decisiones pendientes (Toni):** edad mínima de la plataforma; ¿permitir 14–17 con tutela?; proveedor legal.
- **Restricciones:** no citar normas de memoria; no publicar copy sin Hermes.
- **Criterios:** texto aprobado; consentimiento registrado con versión; bloqueo verificado.
- **Pruebas:** unitarias de bloqueo; integración de consentimiento.
- **Seguridad:** no guardar datos de menores sin base legal.
- **Riesgos:** retraso por revisión externa.
- **KPI:** 0 menores inscritos en planes con salud.
- **Definición de terminado:** aprobación escrita de asesoría y de Toni.
- **Estimación:** M (técnico) + revisión externa · complejidad media · riesgo alto · depende de decisión de Toni.

### TASK-006 · Secretos JWT obligatorios en cualquier arranque
- **Fase:** 0 · **Prioridad:** Crítica · **Tipo:** seguridad · **Origen:** AUD-002
- **Estado actual:** `backend/src/config/env.ts:39,41` con valores por defecto; bloqueo solo si `NODE_ENV=production` (`env.ts:138-143`).
- **Resultado esperado:** arranque falla si el secreto es el valor por defecto en cualquier entorno excepto `test`.
- **Pasos:** test unitario (falla hoy) → cambio de `env.ts` → verificación de que los tests de integración configuran secretos de prueba explícitos.
- **Restricciones:** no mostrar valores de secretos en logs ni en tests.
- **Criterios:** arranque sin secretos reales falla; con secretos, arranca.
- **Pruebas:** `backend/tests/unit/security-config.test.ts` ampliado.
- **Riesgos:** entornos de CI sin secretos explícitos fallarán (esperado).
- **KPI:** 0 arranques con valores por defecto.
- **Definición de terminado:** tests verdes; Toni confirma que Render tiene los secretos (sin ver valores).
- **Estimación:** S · complejidad baja · riesgo bajo · NO VERIFICADO el estado de Render.

### TASK-012 · Guardas para impedir integración local contra producción
- **Fase:** 0 · **Prioridad:** Crítica · **Tipo:** operación · **Origen:** AUD-014, AUD-023
- **Paso adicional (AUD-023):** Toni revisa en el dashboard de Vercel si el proyecto `anclora-impulso` necesita la integración Neon; si no, la desvincula. Nada de esto requiere cambios de código ni expone valores.
- **Estado actual:** `default-integration-guard.ts` existe; su eficacia no se ha verificado; el contrato permite local = producción.
- **Resultado esperado:** los tests de integración se niegan a ejecutarse si `DATABASE_URL` apunta a un host de producción, salvo variable explícita de Toni.
- **Pasos:** revisar `backend/tests/support/integration-guard.ts` y `db-target.ts`; añadir test del guard; documentar en `PRODUCTION_RUNTIME.md`.
- **Decisiones pendientes:** qué hosts son "producción" para el guard.
- **Restricciones:** no leer `.env*`; el guard debe comparar el host sin imprimirlo completo.
- **Criterios:** guard bloquea host de producción en prueba unitaria.
- **Pruebas:** unitarias del guard.
- **Riesgos:** falsos positivos bloqueen trabajo legítimo (se resuelve con la variable explícita).
- **KPI:** 0 ejecuciones de integración contra producción.
- **Definición de terminado:** test del guard en verde; Toni valida.
- **Estimación:** S · complejidad baja · riesgo medio.

---

## Fase 1 — Estabilidad, seguridad y calidad

### TASK-004 · Retirar dependencias sin uso y fijar versiones
- **Fase:** 1 · **Prioridad:** Alta · **Tipo:** supply chain · **Origen:** AUD-007
- **Estado actual:** `package.json` raíz con `@supabase/*`, `openai`, `anthropic`, `psycopg2-binary`; 14 `latest`.
- **Resultado esperado:** solo dependencias usadas; versiones exactas; lockfile coherente.
- **Archivos:** `package.json`, `pnpm-lock.yaml` (actualización del lock solo por eliminación).
- **Pasos:** `grep` de importaciones antes de eliminar; eliminar; fijar `latest`; verificar build de tipos.
- **Restricciones:** no instalar nuevas dependencias; no tocar `node_modules` sin pedirlo.
- **Criterios:** lista de dependencias usadas coincide con el código.
- **Pruebas:** typecheck y Jest de frontend.
- **Riesgos:** un import dinámico no detectado por `grep`.
- **KPI:** 0 sin uso; 0 `latest`.
- **Definición de terminado:** Toni valida.
- **Estimación:** S · complejidad baja · riesgo bajo.

### TASK-005 · Regenerar cliente Prisma y gate de tipos backend
- **Fase:** 1 · **Prioridad:** Alta · **Tipo:** calidad · **Origen:** AUD-005
- **Estado actual:** `tsc --noEmit` backend con 4 errores (`oauth-handoff.service.ts` 30, 70, 76, 105).
- **Resultado esperado:** `tsc` limpio en CI tras `prisma generate`.
- **Pasos:** verificar que el CI ejecuta `prisma generate` antes de `tsc`; si no, añadirlo; documentar el comando local.
- **Restricciones:** no ejecutar `prisma migrate` ni `db push`.
- **Criterios:** `tsc --noEmit` backend sin errores tras `prisma generate` en entorno de CI.
- **Pruebas:** typecheck en CI.
- **Riesgos:** el cliente local desactualizado puede ocultar errores reales.
- **KPI:** 0 errores de tipos.
- **Definición de terminado:** CI verde; Toni valida.
- **Estimación:** S · complejidad baja · riesgo bajo.

### TASK-007 · Retirar o proteger la carpeta pública `/dashboard`
- **Fase:** 1 · **Prioridad:** Media · **Tipo:** seguridad · **Origen:** AUD-011
- **Estado actual:** `backend/src/app.ts:77` sirve `public/`; los datos están protegidos por `requireAdmin`.
- **Resultado esperado:** el HTML no se sirve en producción, o se sirve tras autenticación admin.
- **Pasos:** test que espera 401/403 o 404 en `/dashboard/dashboard.html`; cambio en `app.ts`.
- **Criterios:** la URL no es pública.
- **Pruebas:** integración de cabeceras (CI).
- **Riesgos:** se rompe el panel de administración de Toni si lo usa.
- **KPI:** 0 respuestas 200 públicas.
- **Estimación:** S · riesgo bajo.

### TASK-008 · La cohorte exige edad conocida
- **Fase:** 1 · **Prioridad:** Alta (quick win) · **Tipo:** elegibilidad · **Origen:** AUD-004
- **Estado actual:** `backend/src/services/health-plans.domain.ts:49` devuelve `true` si `age == null`.
- **Resultado esperado:** sin edad, no hay elegibilidad; el servicio pide edad.
- **Archivos:** `health-plans.domain.ts`, `health-plans.service.ts:129`, `backend/src/services/health-plans.domain.test.ts`.
- **Pasos:** test rojo con `null` → cambio → verde.
- **Criterios:** `isInCohort(null, 50, 60) === false`.
- **Pruebas:** unitarias de límites.
- **Riesgos:** usuarios existentes sin edad no podrán inscribirse hasta completar el perfil (esperado).
- **KPI:** 0 inscripciones sin edad.
- **Estimación:** S · riesgo bajo.

### TASK-009 · Proveniencia de textos 40+ y por sexo
- **Fase:** 1 · **Prioridad:** Alta · **Tipo:** contenido · **Origen:** AUD-012, OPP-005
- **Estado actual:** `forty-plus-guidance.ts:7-30` con afirmaciones clínicas sin fuente.
- **Resultado esperado:** cada afirmación con fuente, nivel de evidencia y fecha; las no citadas se eliminan o se marcan como genéricas.
- **Archivos:** `backend/src/services/forty-plus-guidance.ts`, `backend/src/services/nutrition.service.ts` (guía nutricional por sexo, línea ~1022), tests asociados.
- **Pasos:** inventario de afirmaciones; asignación de fuentes; Hermes gate si hay copy público; tests que verifiquen que cada texto de variante tiene referencia.
- **Decisiones pendientes:** revisor profesional.
- **Restricciones:** no inventar fuentes; no citar de memoria.
- **Criterios:** 100 % de afirmaciones con referencia.
- **Pruebas:** unitaria que falla si una variante no tiene referencia.
- **Riesgos:** textos actuales más pobres en el corto plazo.
- **KPI:** 100 % de contenido con fuente.
- **Definición de terminado:** revisión de Toni y Hermes.
- **Estimación:** M · riesgo medio.

### TASK-010 · Revisión profesional de límites de planes IA
- **Fase:** 1 · **Prioridad:** Alta · **Tipo:** seguridad clínica · **Origen:** AUD-013
- **Estado actual:** `plan-limits.ts` con `PENDING_PROFESSIONAL_REVIEW`.
- **Resultado esperado:** valores revisados por profesional; `reviewStatus` cambia a `REVIEWED` con fecha y revisor.
- **Restricciones:** **no ampliar límites** sin revisión; documentar cualquier cambio.
- **Pruebas:** tests de `plan-validator` con los nuevos límites.
- **Riesgos:** planes más conservadores que los actuales.
- **KPI:** `reviewStatus = REVIEWED`.
- **Estimación:** M · riesgo medio · depende de revisor externo.

### TASK-011 · Corregir documentación desfasada
- **Fase:** 1 · **Prioridad:** Media · **Tipo:** documentación · **Origen:** AUD-008, AUD-009, AUD-010, AUD-020
- **Estado actual:** CLAUDE.md, business doc y SPEC con cifras y hosting incorrectos.
- **Resultado esperado:** cifras reproducibles; hosting coherente con `PRODUCTION_RUNTIME.md`; el business doc marca como objetivo lo no verificado.
- **Archivos:** `CLAUDE.md` (raíz del repo), `docs/business/EXECUTIVE-SUMMARY.md`, `docs/specs/SPEC-...` (no editar la SPEC: es inmutable por el propio proceso; crear spec nueva si cambia). Mover artefactos de la raíz a `docs/archive/`.
- **Restricciones:** no editar SPEC cerradas (regla del SDD); no tocar `AGENTS.md` sin instrucción.
- **Criterios:** cada cifra enlaza al comando que la produce.
- **KPI:** 0 afirmaciones falsas detectadas en revisión.
- **Estimación:** S · riesgo bajo.

### TASK-013 · E2E de Ruta Vital y visual QA en entorno controlado
- **Fase:** 1 · **Prioridad:** Media · **Tipo:** testing · **Origen:** AUD-018, AUD-019
- **Estado actual:** sin E2E de planes; UX sin verificación en navegador.
- **Resultado esperado:** Playwright cubre descubrir → unirse → onboarding → semana → volver; visual QA con `agent-browser` (`anclora-visual-qa`).
- **Restricciones:** usuario QA dedicado (`qa.impulso@anclora.local`, `PRODUCTION_RUNTIME.md` §10); nunca la cuenta de Toni; no borrar la cuenta QA.
- **Pasos:** spec → tests → implementación → ejecución en CI con base de test.
- **Criterios:** flujo completo en verde; sin errores de accesibilidad graves en la página.
- **Pruebas:** E2E + visual.
- **Riesgos:** flakiness; datos de QA acumulados.
- **KPI:** flujo completo en verde en CI.
- **Estimación:** M · riesgo medio.

---

## Fase 2 — Arquitectura modular de planes

### TASK-017 · Campos de catálogo: cohorte, variante y bandas
- **Fase:** 2 · **Prioridad:** Alta · **Tipo:** datos · **Origen:** OPP-006
- **Resultado esperado:** `HealthPlanDefinition` con `cohortKey`, `variantKey`, `ageMin`, `ageMax` (nullable); migración aditiva.
- **Dependencias:** TASK-001 (estado de migraciones), TASK-020.
- **Pasos:** spec → migración `backend/prisma/migrations/<timestamp>_add_plan_catalog_fields/` → backfill de Ruta Vital (50, 60) sin tocar datos.
- **Restricciones:** no aplicar migración desde local; la aplica el runner protegido tras aprobación.
- **Criterios:** migración en Postgres de test; Ruta Vital sigue elegible en los mismos casos.
- **Pruebas:** migración en CI; integración del catálogo.
- **Riesgos:** Ruta Vital existente con `maxAge 60`.
- **KPI:** 0 errores de migración.
- **Estimación:** M · riesgo medio.

### TASK-018 · `sexAtBirth` y `genderIdentity` opcionales
- **Fase:** 2 · **Prioridad:** Media · **Tipo:** datos · **Origen:** AUD-012
- **Resultado esperado:** dos campos nuevos en `User`, opcionales; `sex` se mantiene; validadores con `prefer_not_say`.
- **Dependencias:** TASK-003 (consentimiento).
- **Pasos:** spec → migración aditiva → validadores Zod → tests de retrocompatibilidad.
- **Criterios:** los perfiles antiguos siguen válidos.
- **Pruebas:** `profile.test.ts` ampliado; migración en CI.
- **Riesgos:** duplicidad de semántica con `sex`.
- **KPI:** 0 regresiones en perfil.
- **Estimación:** M · riesgo medio.

### TASK-019 · Seed de 10 modalidades en borrador
- **Fase:** 2 · **Prioridad:** Media · **Tipo:** datos · **Origen:** OPP-006
- **Resultado esperado:** 10 definiciones P01–P10 con `status='draft'`, sin publicar, con bandas de `06 §2`.
- **Dependencias:** TASK-017.
- **Pasos:** seed idempotente (`upsert`) en `backend/prisma/seed-health-plans.ts` (nuevo) — no modificar `seed.ts` de forma destructiva.
- **Criterios:** tras ejecutar dos veces, el número de filas es 10; ninguna publicada.
- **Pruebas:** test de idempotencia.
- **Riesgos:** publicar por error; mitigado por `draft`.
- **KPI:** 10 filas en borrador.
- **Estimación:** S · riesgo bajo.

### TASK-020 · Elegibilidad por bandas no solapadas y tests
- **Fase:** 2 · **Prioridad:** Alta (quick win) · **Tipo:** dominio · **Origen:** AUD-004
- **Resultado esperado:** función pura que devuelve la modalidad de una edad; tests de límites; test de que ningún par de bandas se solapa; test de que `health-plans.*` no es importado por `workouts/nutrition/gamification`.
- **Pruebas:** unitarias en `backend/src/services/health-plans.domain.test.ts`.
- **Criterios:** 17→no elegible (menor); 18→P01/P02; 29→P01/P02; 30→P03/P04; 39→P03/P04; 40→P05/P06; 49→P05/P06; 50→P07/P08; 59→P07/P08; 60→P09/P10; null→sin sugerencia.
- **Riesgos:** ninguno relevante.
- **KPI:** 100 % de límites cubiertos.
- **Estimación:** S · riesgo bajo.

### TASK-021 · Contenido de 24 semanas para Ruta Vital (P07, P08)
- **Fase:** 3 · **Prioridad:** Alta · **Tipo:** contenido · **Origen:** AUD-021
- **Estado actual:** semanas 1, 5, 13 y 25 sembradas (`health-plans.service.ts`); `getPhaseForWeek` mapea hasta semana 24+.
- **Resultado esperado:** semanas 1–24 con objetivo, versión completa y mínima, acciones y señales; contenido con proveniencia (`HealthPlanContentReference`).
- **Dependencias:** TASK-009.
- **Pasos:** spec de contenido → plantillas → revisión → seed idempotente.
- **Restricciones:** no publicar fases sin contenido; no inventar referencias.
- **Criterios:** cada semana tiene versión mínima y completa; cada acción cita fuente.
- **Pruebas:** test que falla si una semana no tiene `minimumVersion`.
- **Riesgos:** volumen de contenido; revisión lenta.
- **KPI:** 24/24 semanas con contenido revisado.
- **Estimación:** L · riesgo medio.

### TASK-022 · Pantalla de selección de modalidad
- **Fase:** 3 · **Prioridad:** Media · **Tipo:** producto · **Origen:** OPP-004
- **Resultado esperado:** la persona ve su sugerencia con motivo y puede elegir cualquier modalidad o ninguna.
- **Dependencias:** TASK-019, TASK-020.
- **Pasos:** spec → endpoint `GET /api/health-plans/suggestion` (Zod) → componente → tests.
- **Criterios:** sin edad, no hay sugerencia; con edad, sugerencia explicada; elección manual siempre disponible.
- **Pruebas:** unitarias; E2E (TASK-013).
- **Riesgos:** confusión con la sugerencia.
- **KPI:** % de usuarios que eligen la sugerencia frente a otra.
- **Estimación:** M · riesgo medio.

### TASK-023 · Cambio de modalidad con historial
- **Fase:** 3 · **Prioridad:** Media · **Tipo:** producto · **Origen:** OPP-004
- **Resultado esperado:** cambio de modalidad cierra la inscripción anterior (`leftAt`), crea la nueva con `previousPlanId`, conserva datos.
- **Dependencias:** TASK-022, TASK-017.
- **Pasos:** spec → migración aditiva de `previousPlanId` → servicio → endpoint → tests.
- **Criterios:** ningún dato de entrenamiento se pierde; una inscripción activa por usuario y modalidad.
- **Pruebas:** integración de transición; test de idempotencia.
- **Riesgos:** inscripciones duplicadas.
- **KPI:** 0 duplicados activos.
- **Estimación:** M · riesgo medio.

### TASK-024 · Módulos opcionales de salud ósea y ciclo (experimento)
- **Fase:** 3 · **Prioridad:** Experimento · **Tipo:** contenido · **Origen:** AUD-012, OPP-005
- **Hipótesis:** el módulo aporta valor a P04, P06, P08, P10 sin aumentar el abandono.
- **Diseño del experimento:** 2 variantes con usuarios de prueba (no producción); métrica: uso y comprensión; criterio de parada: abandono mayor en un 10 %.
- **Restricciones:** opt-in; sin diagnóstico; contenido con fuentes (TASK-009).
- **KPI:** uso del módulo; quejas; abandono.
- **Estimación:** M · riesgo medio.

---

## Fase 4 — Onboarding y personalización

### TASK-025 · Onboarding no clínico con consentimiento
- **Fase:** 4 · **Prioridad:** Media · **Tipo:** producto · **Origen:** OPP-003
- **Resultado esperado:** 3 pasos (objetivo, días/tiempo, edad) + consentimiento para salud y sexo; saltable.
- **Dependencias:** TASK-003, TASK-018.
- **Pasos:** spec → componente → endpoint → tests.
- **Criterios:** primer entrenamiento no depende de los pasos sensibles; cada paso tiene motivo visible.
- **Pruebas:** unitarias; E2E.
- **KPI:** onboarding completado; abandono en paso 3.
- **Estimación:** M · riesgo medio.

### TASK-026 · Motor de reglas explicable
- **Fase:** 4 · **Prioridad:** Media · **Tipo:** dominio · **Origen:** OPP-002, OPP-007
- **Resultado esperado:** reglas R1–R6 (`07 §4.1`) como funciones puras con motivo y control de usuario.
- **Dependencias:** TASK-020, TASK-025.
- **Pasos:** spec → reglas con tests → integración con UI de explicación.
- **Criterios:** cada regla devuelve motivo; el usuario puede desactivar la adaptación.
- **Pruebas:** unitarias por regla; propiedad de no-regresión en `getAdaptation`.
- **KPI:** % de sugerencias cambiadas; comprensión en prueba.
- **Estimación:** M · riesgo medio.

---

## Fase 5 — Experiencia y diferenciación

### TASK-027 · Investigación de competidores 40+ y 50+
- **Fase:** 5 · **Prioridad:** Experimento · **Tipo:** investigación · **Origen:** OPP-013
- **Resultado esperado:** informe con fuentes y fechas sobre apps que segmentan por edad.
- **Restricciones:** consultas genéricas sin datos del producto ni de usuarios.
- **Criterios:** cada afirmación con URL y fecha; nivel de confianza indicado.
- **KPI:** 5 fuentes primarias.
- **Estimación:** S · riesgo bajo.

### TASK-028 · Indicadores de confianza en progreso con pocos datos
- **Fase:** 5 · **Prioridad:** Media (quick win) · **Tipo:** UX · **Origen:** AUD-019 (UX-06)
- **Resultado esperado:** cada KPI muestra periodo, suficiencia de datos y siguiente acción cuando hay pocos registros.
- **Archivos:** `components/progress-tracker.tsx`, `app/progress/page.tsx`.
- **Pruebas:** unitarias de texto; visual QA.
- **KPI:** comprensión en prueba de usabilidad.
- **Estimación:** S · riesgo bajo.

### TASK-030 · Eventos del embudo de planes
- **Fase:** 5 · **Prioridad:** Media · **Tipo:** observabilidad · **Origen:** medición de hipótesis
- **Resultado esperado:** eventos `plan_suggested`, `plan_joined`, `plan_changed`, `week_started`, `week_completed`, `plan_left` en `ProductEvent`, sin datos de salud en el payload.
- **Pruebas:** unitarias del redactor de eventos; integración.
- **Criterios:** payload sin campos de salud ni sexo.
- **KPI:** embudo medible.
- **Estimación:** M · riesgo bajo.

---

## Fase 6 — Automatización e IA

### TASK-029 · Explicación con IA opcional (experimento)
- **Fase:** 6 · **Prioridad:** Experimento · **Tipo:** IA · **Origen:** OPP-008
- **Resultado esperado:** texto explicativo generado por el proveedor existente, detrás de flag, con límite por usuario y registro; sin alterar la decisión de reglas.
- **Dependencias:** TASK-010, TASK-026.
- **Pruebas:** guardrails; cuota; coste.
- **Restricciones:** no diagnóstico; no usar sexo ni edad como causa de la decisión.
- **KPI:** coste por usuario; comprensión.
- **Estimación:** M · riesgo medio.

---

## Fase 7 — Escalabilidad y optimización

### TASK-014 · Partir `nutrition.service.ts` con tests de caracterización
- **Fase:** 7 · **Prioridad:** Baja · **Tipo:** mantenibilidad · **Origen:** AUD-015
- **Resultado esperado:** subdominios (plan, recetas, registro, intercambios, balance) en ficheros separados; comportamiento idéntico.
- **Pasos:** tests de caracterización sobre la API actual → partir por subdominio → repetir.
- **Restricciones:** un subdominio por entrega; no cambiar contratos de API.
- **Criterios:** suites de nutrición en verde sin cambios de expectativa.
- **Riesgos:** regresiones silenciosas.
- **KPI:** líneas por fichero < 500.
- **Estimación:** L · riesgo medio.

### TASK-015 · Partir componentes grandes
- **Fase:** 7 · **Prioridad:** Baja · **Tipo:** mantenibilidad · **Origen:** AUD-016
- **Resultado esperado:** `dashboard-content.tsx` en subcomponentes; sin cambios visuales.
- **Pruebas:** visual QA antes y después.
- **KPI:** líneas por fichero < 400.
- **Estimación:** M · riesgo bajo.

### TASK-016 · Reducir usos de `any`
- **Fase:** 7 · **Prioridad:** Baja · **Tipo:** calidad · **Origen:** AUD-017
- **Resultado esperado:** 34 → 0 en el código de producto, o justificación por línea.
- **Pruebas:** typecheck.
- **KPI:** número de `any`.
- **Estimación:** M · riesgo bajo.

---

## Pista transversal N — Planificación nutricional interoperable (`TASK-031` reservada; `TASK-032` a `TASK-039`)

### TASK-031 · *(Reservada)* Retirada de `refreshToken` en respuesta JSON
- **Estado:** **Reservada** (fuera de la ampliación nutricional v2.0).

### TASK-032 · Contrato `meal-plan-import-v1`, catálogo único y validadores
- **Entrega:** N0 · **Prioridad:** P0 · **Estado:** **Implementada (N0)** (`N0_QA_PASS`).
- **Resultado esperado:** DTO `meal-plan-import-v1` (Zod + JSON Schema sincronizados), catálogo único de protocolos en `shared/nutrition-protocols.json` / `protocol-catalog.ts` sin habilitar dietas sin soporte en el generador actual, validadores de estructura, unidades, duplicados, restricciones, cribado 4-4-9, procedencia e inyección de contenido no confiable, y fixtures reproducibles.

### TASK-033 · Spike de persistencia y decisión condicional M28
- **Entrega:** N1 · **Prioridad:** P1 condicional · **Estado:** Estudio definitivo completado (`docs/sdd/nutrition/M28_PERSISTENCE_STUDY.md` — recomienda Alternativa B aditiva mínima; `M28_NOT_EXECUTED`).
- **Dependencias:** `TASK-032`.

### TASK-034 · Pipeline `preview`/`commit` JSON, unidades e idempotencia
- **Entrega:** N1 · **Prioridad:** P0 · **Estado:** `preview` implementado localmente (`POST /api/nutrition/meal-plans/import/preview`, 0 escrituras BD); `commit` bloqueado por persistencia (`N1_PARTIAL_BLOCKED_BY_PERSISTENCE`) hasta ejecutar M28.
- **Dependencias:** `TASK-032`, `TASK-033`, tests de caracterización `TASK-014`.

### TASK-035 · Importación de texto libre / documentos ODT-DOCX
- **Entrega:** N3 · **Prioridad:** P3 · **Estado:** Pendiente.

### TASK-036 · UI «Nuevo plan» + preview (N1) y Preparación/Compra (N2)
- **Entrega:** N1/N2 · **Prioridad:** P0 → P1 · **Estado:** MVP N1 implementado localmente (`components/nutrition/meal-plan-import-panel.tsx` + selector en `app/nutrition/page.tsx`); N2 (Preparación/Compra persistida) pendiente de M28.

### TASK-037 · Adaptación de la skill `planificador-nutricion-mealprep-50` a JSON v2
- **Entrega:** N0 · **Prioridad:** P0 · **Estado:** Adaptación v2 preparada en repositorio (`docs/sdd/nutrition/planificador-nutricion-mealprep-v2/SKILL.md` + `skill-adapter.ts`); ejecución generativa no verificada en este entorno (`SKILL_GENERATION_NOT_VERIFIED`).
- **Dependencias:** `TASK-032`.

### TASK-038 · Asistente 5 decisiones y generación guiada
- **Entrega:** N2 · **Prioridad:** P2 · **Estado:** Pendiente.

### TASK-039 · Conector seguro Claude → borrador revisable
- **Entrega:** N3 · **Prioridad:** P3 / experimento · **Estado:** Pendiente.

---

## Resumen de tamaños

| Tamaño | Tareas |
|---|---|
| S | 001, 004, 005, 006, 007, 008, 011, 012, 019, 020, 027, 028, 031, 033, 037 |
| M | 002, 003, 009, 010, 013, 015, 016, 017, 018, 022, 023, 024, 025, 026, 029, 030, 032, 035, 036, 038, 039 |
| L | 014, 021, 034 |
