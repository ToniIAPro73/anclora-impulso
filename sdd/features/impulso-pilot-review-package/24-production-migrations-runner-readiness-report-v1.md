# 24 — Informe de readiness del runner de migraciones de producción (D10)

> **ESTADO GLOBAL: NOT READY FOR WORKFLOW DISPATCH**
> **RELEASE Y MIGRACIÓN NO AUTORIZADOS.**
> Fecha: 2026-10-12
> Autoridad: Instrucción de Toni (Nivel 1), `ANCLORA_WORKSPACE_AGENT_POLICY.md` (Nivel 2), contratos canónicos `.anclora/` (Nivel 3).
> Árbol Git de evaluación: `development` @ `097840203807d0ae9ac4209cada26a6bd3f5adb6`.

---

## 1. Distinción Fundamental: Readiness del Runner vs Autorización de Migración

> [!IMPORTANT]
> **`READY FOR WORKFLOW DISPATCH`** (cuando se alcance) significará **únicamente** que el workflow está técnicamente disponible en GitHub Actions y dotado de las defensas y protecciones mínimas necesarias para recibir una invocación manual segura.
> 
> **NO autoriza a ejecutarlo ni a migrar la base de datos de producción.**
> 
> La ejecución real de una migración permanecerá estrictamente bloqueada hasta que:
> 1. Exista una autorización operativa explícita e independiente de Toni para esa migración concreta con fecha y ventana.
> 2. Se hayan completado y documentado sus precondiciones operativas externas (revisión manual del ledger `_prisma_migrations`, backup/snapshot verificado en Neon y comprobación de compatibilidad directa).
> 
> Las atestaciones en los inputs del workflow (`ledger_reviewed`, `backup_confirmed`) son declaraciones de responsabilidad humana del operador; **no constituyen una verificación automática** de dichos hechos por parte del sistema.

---

## 2. Resumen de Controles de Readiness del Runner

| # | Control | Estado | Evidencia y Localización | Naturaleza / Procedencia | Riesgo Residual y Acción Requerida |
|---|---|---|---|---|---|
| **C01** | Diseño e identidad del workflow (manual, serializado, sin deploy) | **PASS** | `.github/workflows/production-migrations.yml:17-48`: únicamente `workflow_dispatch`, `concurrency: group: production-migrations`, `cancel-in-progress: false`, `permissions: contents: read`. | Verificado en esta revisión [LOCAL] | Ninguno en el diseño del YAML. |
| **C02** | Validación de sintaxis y esquema de GitHub Actions | **PARCIAL** | Validado localmente como YAML sintáctico válido vía AST (`js-yaml@4.3.2` / Node.js). `actionlint` **NO está instalado** en el sistema (`which actionlint` vacío); no se descargaron binarios no autorizados. | Verificado en esta revisión [LOCAL] | **Límite**: `js-yaml` valida sintaxis YAML, no el esquema semántico de GitHub Actions (expresiones, context keys, runner types).<br>**Acción para Toni**: Ejecutar `actionlint .github/workflows/production-migrations.yml` cuando esté disponible. |
| **C03** | Validación estricta del SHA de entrada | **PASS** | `production-migrations.yml:66`: regex `^[0-9a-f]{40}$`. Verificado con tests que rechazan mayúsculas, ramas, tags y SHAs abreviados. | Verificado en esta revisión [LOCAL] | Ninguno en la validación de entrada. |
| **C04** | Verificación de ancestro y migraciones no atrasadas | **PASS** | `production-migrations.yml:86-100`: comprobación de ancestría con `git merge-base --is-ancestor`, consistencia de migración más reciente (`expected_last_migration`) y comparación de árbol con `comm -13`. | Verificado en esta revisión (test mock sintético) [LOCAL] | Requiere en ejecución remota que `origin/$DEFAULT_BRANCH` esté presente en el fetch del runner. |
| **C05** | Atestaciones manuales obligatorias en inputs | **PASS** | `production-migrations.yml:68-71`: `ledger_reviewed` y `backup_confirmed` obligatorios (`true`); `backup_reference` alfanumérico seguro (rechaza esquemas URL y credenciales). | Verificado en esta revisión [LOCAL] | Son atestaciones del operador; el workflow no valida ni puede validar por sí solo la existencia del backup en Neon. |
| **C06** | Enmascaramiento de credenciales y rechazo de pooler | **PASS** | `production-migrations.yml:128-142`: guardias de longitud (≥3 caracteres), rechazo de `\n`/`\r`, `::add-mask::` para host, user, pass y dbName; rechazo estricto de URLs que contengan `-pooler`. | Verificado en esta revisión [LOCAL] | Requiere que el operador configure la URL directa de Neon (sin `-pooler`). |
| **C07** | Fijación de dependencias y acciones de terceros | **PARCIAL** | Referencias en workflow: `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`. Están fijadas por **etiqueta mayor mutable (`@v4`)**, siguiendo el estándar actual del repo (`ci.yml`, `promote.yml`). **NO están fijadas a un SHA de commit inmutable**. | Verificado en esta revisión [LOCAL] | **Riesgo residual**: Un compromiso upstream de las etiquetas `@v4` podría mutar el código ejecutado en el runner. La política canónica del repositorio actualmente tolera `@v4`, pero no es un pin criptográficamente inmutable. |
| **C08** | Suite de pruebas de aislamiento y seguridad del runner | **PASS** | `scripts/support/test-production-migrations-workflow.sh`: 13 pruebas seguras y aisladas (sintaxis, validación de inputs, rechazo de pooler, newline injection, mock de árbol git). | Verificado en esta revisión [LOCAL] | Cubre la lógica programada local del workflow, no la infraestructura remota ni el comportamiento del engine de GitHub Actions. |
| **C09** | Existencia del GitHub Environment `production-migrations` | **FAIL** / **AUSENTE** | Consulta de metadatos remota: `gh api repos/ToniIAPro73/anclora-impulso/environments` (solo devuelve `Preview`, `Production`, `rare-happiness / production`). | Metadato remoto [GITHUB-READONLY] | **BLOQUEO CRÍTICO**: Si un job apunta a un environment inexistente, GitHub lo crea automáticamente SIN protecciones. Toni debe crearlo previamente. |
| **C10** | Aprobación del GitHub Environment y Regla de Autoaprobación | **PENDIENTE** / **NO VERIFICABLE** | Al no existir el environment, no es posible inspeccionar sus protection rules ni reviewers configurados. | Metadato remoto [GITHUB-READONLY] | **BLOQUEO CRÍTICO / RIESGO DE AUTOAPROBACIÓN**: Si Toni inicia el workflow y además figura como único revisor, la política de GitHub ("Prevent self-review") podría bloquear el job indefinidamente, o permitir que se ejecute sin revisión independiente.<br>**Acción requerida de Toni**: Configurar el Environment con una política de aprobación explícita y viable (revisor independiente o política admitida). |
| **C11** | Secreto `PRODUCTION_MIGRATION_DATABASE_URL` | **FAIL** / **AUSENTE** | Consulta de metadatos: `gh secret list --env production-migrations` (404 Not Found); `gh secret list` (repo) reporta `no secrets found`. | Metadato remoto [GITHUB-READONLY] | **BLOQUEO**: El secreto debe configurarse exclusivamente dentro del Environment `production-migrations` una vez creado este. |
| **C12** | Disponibilidad del workflow en la rama remota por defecto | **FAIL** / **AUSENTE** | Consulta remota: `gh workflow list` (solo `CI`, `Validate agent branch`, `Promote / Environment`). El archivo es untracked local. | Verificado en esta revisión [LOCAL] + [GITHUB-READONLY] | **BLOQUEO GIT**: `workflow_dispatch` solo se puede disparar si el archivo YAML existe en la rama por defecto remota (`origin/development`). Commit y push se mantienen bloqueados. |

---

## 3. Delimitación de Responsabilidades: Runner vs Plan de Release

Para preservar la pureza metodológica y evitar confusión entre la herramienta técnica y la operación de despliegue:

- **Ámbito del Runner de Migraciones (este informe)**:
  - Validar código y defensas del workflow.
  - Verificar existencia del Environment en GitHub con protección adecuada.
  - Verificar presencia del secreto en el entorno sin leer su valor.
  - Habilitación y disponibilidad del workflow en GitHub.
- **Ámbito del Plan de Release y Despliegue (Runbook D10 v2 / Doc 21)**:
  - Pausar Auto-Deploy en Render para desacoplar el despliegue del backend de la promoción de `main` (B7).
  - Revisión y lectura manual supervisada del ledger `_prisma_migrations` en Neon (Q1).
  - Creación y verificación de snapshot/backup en Neon (Q6).
  - Configuración de `ADMIN_USER_IDS` en Render (B5).
  - Cierre formal de revisiones profesionales y de seguridad (AI-03, AI-06, Hermes, Legal).

---

## 4. Veredicto de Readiness Verificable

- **Veredicto Global**: **`NOT READY FOR WORKFLOW DISPATCH`**
- **Estado Detallado**:
  - **Defensas Locales del Workflow**: Verificadas positivamente dentro del alcance de las pruebas locales, pero sujetas a validación formal de esquema con `actionlint` (C02: PARCIAL) y con fijación de acciones a versiones mayores mutables (C07: PARCIAL).
  - **Infraestructura Remota en GitHub**: **NO PREPARADA** (Environment ausente, política de autoaprobación no definida, secreto ausente, workflow no commiteado ni pusheado).
- **Invariante de Seguridad Preservado**:
  - `commit` y `push` permanecen estrictamente bloqueados en el repositorio local.
  - No se ha ejecutado `workflow_dispatch`, no se ha tocado base de datos de producción ni se ha modificado la configuración de proveedores externos.

---
## Addendum 2026-10-12 — referencia a la revisión del verificador
Ver el addendum de `25-d10-automated-migration-verifier-report-v1.md`: el estado «implementado local» del verificador se limita a las
reglas de decisión; el servicio y sus integraciones no existen, y hay hallazgos abiertos (H1–H9) sobre el payload del webhook, el vínculo
entre el SHA evaluado y el SHA migrado, el hash del workflow, el ledger vacío y la sustitución de la revisión humana.
Estado del runner sin cambios: no ejecutado, entorno y secretos sin verificar. **RELEASE NO AUTORIZADO.**
