# 20 — Consolidación de Fase 0: inventario y plan de integración

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

**Fecha de corte:** 2026-11-10  
**Repositorio / rama:** `anclora-impulso` / `development`  
**HEAD:** `af5f38d` — AUD-024; alineado con `origin/development` al inspeccionar  
**Modo:** análisis y creación de este informe. No se ejecutaron tests, CI, consultas de GitHub, despliegues ni operaciones de base de datos.

## 1. Resultado ejecutivo

Antes de crear este informe, el árbol presentaba **62 rutas pendientes**: 21 modificadas o eliminadas y 41 nuevas. Este informe es la única ruta añadida por el encargo y queda fuera de ese inventario de partida. Los cambios funcionales se distribuyen sin solapamiento entre los paquetes B (16 rutas), C (11) y D (5); el paquete A ya forma parte de `HEAD` y, según el contexto de esta tarea, su CI y Preview están validados. Las otras 30 rutas son documentos, snapshots de paquetes y una propuesta de Governance.

La integración de B, C y D no está autorizada por este informe. El principal bloqueo técnico es verificar en Render, sin revelar valores, los secretos JWT y parámetros exigidos antes de desplegar C y B. B requiere desplegar primero el backend y habilitar después el proxy para el frontend, seguido por su matriz en Preview. C contiene además una edición de `.anclora/PRODUCTION_RUNTIME.md` que requiere resolver su atribución/alcance antes de incluirla. D es independiente y no introduce migraciones.

**Fase 0 sigue abierta.** No se debe declarar aceptación global hasta cerrar los criterios de §7. Los informes 16–19 son útiles como evidencia, pero algunas secciones describen estados anteriores; se priorizan el estado actual del operador, la sección 14.6 del informe 17 y el estado del árbol de trabajo.

## 2. Alcance, fuentes y límites

```text
TASK=IMPULSO_PHASE0_CONSOLIDATION
MODE=WRITE (solo un documento nuevo)
READ_SCOPE=[anclora-impulso, anclora-governance]
WRITE_SCOPE=anclora-impulso/docs/anclora-master-audit/20_PHASE0_CONSOLIDATION_CODEX.md
EXPECTED_OUTPUT=inventario completo y plan revisable de integración de Fase 0
RUNTIME_SOURCE=anclora-impulso/.anclora/PRODUCTION_RUNTIME.md
DATABASE_SOURCE=anclora-impulso/.anclora/PRODUCTION_RUNTIME.md §§3–4, 9
QA_SOURCE=anclora-impulso/.anclora/PRODUCTION_RUNTIME.md §10
GIT_SOURCE=anclora-governance/standards/AGENT_OPERATING_STANDARD.md §10;
             anclora-impulso/AGENTS.md; .anclora/AOS_ADOPTION.md
MIGRATION_SOURCE=anclora-impulso/.anclora/PRODUCTION_RUNTIME.md §4
PROMPT_CONTRACT_CONFLICTS=[los informes 18–19 citan reglas de promoción
  que chocan con decisiones posteriores D-2026-0050/D-2026-0052 y D-2026-0044;
  requiere aclaración de Governance para cambios al gate, no para este informe]
```

Fuentes consultadas: contratos locales `.anclora/AGENT_PROJECT_CONTEXT.md`, `.anclora/PRODUCTION_RUNTIME.md`, `.anclora/AOS_ADOPTION.md`; `AGENTS.md`; documentos de auditoría 16–19 y README; listas/parches de A–D; specs de `refresh-cookie` y `phase0-runtime-cohort-guards`; estándares de Governance AOS Lean, Agent Execution y Operating; decisiones D-2026-0044, D-2026-0047, D-2026-0050 y D-2026-0052.

No se actualizaron ni reinterpretaron contratos normativos. La inspección de cambios usa los 62 paths actuales y los informes existentes; no se repitieron comprobaciones de CI/GitHub. El documento 18 contiene evidencia histórica de CI/Preview anterior al commit A. La aceptación reciente de A se toma del operador y no se vuelve a comprobar.

## 3. Inventario completo de las 62 rutas

Estado relativo a `HEAD`: **M** modificado, **D** eliminado, **N** nuevo/no rastreado. La asignación B/C/D sigue las listas `packages/*-files.txt`; los documentos auxiliares no pertenecen a esos paquetes funcionales.

### 3.1 Paquete B — TASK-002, refresh en cookie y proxy same-origin (16)

| Estado | Ruta |
|---|---|
| N | `backend/src/utils/refresh-cookie.ts` |
| N | `backend/tests/unit/refresh-cookie.test.ts` |
| M | `backend/src/controllers/auth.controller.ts` |
| M | `backend/src/controllers/oauth.controller.ts` |
| M | `next.config.mjs` |
| M | `lib/api/base-url.ts` |
| N | `__tests__/lib/api-base-url.test.ts` |
| M | `lib/api/auth.ts` |
| M | `lib/api/client.ts` |
| M | `lib/auth/oauth.ts` |
| M | `lib/contexts/auth-context.tsx` |
| M | `app/auth/callback/page.tsx` |
| M | `__tests__/lib/api-client-refresh.test.ts` |
| M | `__tests__/lib/api-client-session-race.test.ts` |
| M | `__tests__/components/oauth-callback.test.tsx` |
| N | `sdd/features/refresh-cookie/refresh-cookie-spec-v1.md` |

### 3.2 Paquete C — guardas de runtime, cohorte y acceso de integración (11)

| Estado | Ruta |
|---|---|
| M | `backend/src/config/env.ts` |
| D | `backend/src/services/health-plans.domain.test.ts` |
| M | `backend/src/services/health-plans.domain.ts` |
| M | `backend/src/utils/security-config.ts` |
| M | `backend/tests/support/db-target.ts` |
| M | `backend/tests/unit/integration-access.test.ts` |
| M | `backend/tests/unit/security-config.test.ts` |
| M | `docs/roadmap/impulso-post-ux-health/P1-FINAL-GATE-REPORT.md` |
| N | `backend/tests/unit/health-plans.domain.test.ts` |
| N | `sdd/features/phase0-runtime-cohort-guards/phase0-runtime-cohort-guards-spec-v1.md` |
| M | `.anclora/PRODUCTION_RUNTIME.md` |

El borrado del test bajo `src/services` y su alta bajo `tests/unit` es un traslado intencional del test para que lo recoja la configuración Jest del backend; no son dos tests funcionales distintos. El cambio del runtime manifest está dentro del patch C, pero es documental/normativo y debe revisarse por separado antes de integrar C.

### 3.3 Paquete D — redacción de salida y probes QA (5)

| Estado | Ruta |
|---|---|
| M | `backend/src/utils/redact.ts` |
| N | `backend/tests/unit/redact-credentials-synthetic.test.ts` |
| N | `scripts/qa/safe-output.mjs` |
| N | `scripts/qa/auth-probe.mjs` |
| N | `scripts/qa/browser-session-probe.mjs` |

### 3.4 Auditoría y documentación de consolidación (21)

Todas son nuevas/no rastreadas en esta rama al corte:

- `docs/anclora-master-audit/README.md`
- `docs/anclora-master-audit/00_EXECUTIVE_SUMMARY.md`
- `docs/anclora-master-audit/01_REPOSITORY_INVENTORY.md`
- `docs/anclora-master-audit/02_TECHNICAL_AUDIT.md`
- `docs/anclora-master-audit/03_PRODUCT_AUDIT.md`
- `docs/anclora-master-audit/04_COMPETITIVE_BENCHMARK.md`
- `docs/anclora-master-audit/05_DIFFERENTIATION_STRATEGY.md`
- `docs/anclora-master-audit/06_AGE_GENDER_PLANS.md`
- `docs/anclora-master-audit/07_PERSONALIZATION_SYSTEM.md`
- `docs/anclora-master-audit/08_TARGET_ARCHITECTURE.md`
- `docs/anclora-master-audit/09_FINDINGS_AND_OPPORTUNITIES.md`
- `docs/anclora-master-audit/10_PRIORITIZATION_MATRIX.md`
- `docs/anclora-master-audit/11_MASTER_ROADMAP.md`
- `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`
- `docs/anclora-master-audit/13_AGENT_IMPLEMENTATION_GUIDE.md`
- `docs/anclora-master-audit/14_QUICK_WINS.md`
- `docs/anclora-master-audit/15_VALIDATION_AND_KPIS.md`
- `docs/anclora-master-audit/16_PHASE0_ACCEPTANCE_REVIEW.md`
- `docs/anclora-master-audit/17_PHASE0_VALIDATION_REPORT.md`
- `docs/anclora-master-audit/18_INTEGRATION_PROCEDURE_A_D.md`
- `docs/anclora-master-audit/19_PROMOTION_CONTROLS_AND_AUD024_CLOSURE.md`

### 3.5 Snapshots de paquetes y propuesta de control de promoción (9)

Nuevos artefactos de revisión; no son código de producto aprobado:

- `docs/anclora-master-audit/packages/A-AUD-024.patch`
- `docs/anclora-master-audit/packages/B-TASK-002.patch`
- `docs/anclora-master-audit/packages/B-files.txt`
- `docs/anclora-master-audit/packages/C-FASE0-RESTO.patch`
- `docs/anclora-master-audit/packages/C-files.txt`
- `docs/anclora-master-audit/packages/D-CREDENTIAL-REDACTION.patch`
- `docs/anclora-master-audit/packages/D-files.txt`
- `docs/anclora-master-audit/proposals/promotion-gate/gate.mjs`
- `docs/anclora-master-audit/proposals/promotion-gate/gate.test.mjs`

Conteo: B 16 + C 11 + D 5 + documentación 21 + artefactos/propuesta 9 = **62**.

## 4. Duplicados, temporales, sensibles y asignación

- **Duplicados/derivados:** los cuatro `.patch` son copias de revisión de cambios fuente y se solapan deliberadamente con las rutas de paquetes. En particular, `A-AUD-024.patch` representa un cambio ya incluido en `HEAD`; no debe reaplicarse. B/C/D son snapshots de los cambios pendientes y pueden quedar obsoletos si cambia su fuente. Las listas de paths son índices auxiliares, no archivos de producto.
- **Movimiento, no duplicación:** `health-plans.domain.test.ts` se elimina de `src/services` y se recrea bajo `backend/tests/unit`; la intención documentada es volverlo descubrible por Jest.
- **Propuesta, no cambio normativo:** `proposals/promotion-gate/gate.mjs` y su test son una propuesta lógica. El informe 19 señala que el adaptador de API/workflow no existe y que no está implementada ni validada en GitHub. No integrar al workflow ni tratar como requisito vigente sin decisión y aprobación de Governance.
- **Temporales:** no aparecen nombres de temporales, volcados, logs, builds, cachés o artefactos de base de datos en los 62 paths. Los probes QA son herramientas intencionales, no temporales.
- **Superficie sensible:** B gestiona refresh tokens, cookies HttpOnly, OAuth y sesión; C endurece secretos JWT y el guard de acceso a BD; D procesa salida que puede contener credenciales y añade probes. Deben revisarse con salidas sintéticas/booleanas; no se deben copiar valores reales a logs, commits o evidencias. La búsqueda estática localizó patrones en código de redacción/tests, no se imprimieron valores y no se identificó un token literal en la salida revisada; esto no sustituye una revisión de secretos antes de publicar.
- **Sin asignar funcionalmente:** no hay rutas de código fuente fuera de B/C/D según las listas existentes. La auditoría (21), snapshots/listas (7) y propuesta de gate (2) quedan en categorías documentales/Governance, no deben mezclarse en commits de paquetes. Las listas cubren los 32 paths funcionales, y sus paquetes no se solapan.
- **Riesgo de mantenimiento documental:** los informes 16–19 repiten matrices/pendientes y contienen secciones históricas en tensión. No se repite el análisis: para estado de AUD-024 se usa §14 de 17 (en especial §14.6); para B/C/D y su separación, §12–13 de 17; para discrepancias de promoción, 18–19 junto a decisiones canónicas más recientes.

## 5. Dependencias técnicas y contractuales

| Elemento | Dependencia/condición | Efecto |
|---|---|---|
| A — AUD-024 | Ya en `HEAD`; el operador informa CI y Preview validados | Sin cambios pendientes atribuibles a A. Su cierre de despliegue/producción es distinto de la validación de desarrollo; §14.6 de 17 acepta el riesgo residual y no exige rotación, pero no sustituye el despliegue del código de A para cierre definitivo. |
| B — backend | El backend debe emitir/limpiar la cookie y conservar temporalmente el refresh JSON antes de que el frontend dependa del proxy/cookie | Desplegar backend primero; un frontend proxificado contra backend antiguo deja de restaurar sesión tras expirar access. Requiere inspección de configuración Render sin revelar valores y despliegue manual según contrato local (`autoDeploy=no`). |
| B — frontend | Requiere `NEXT_PUBLIC_API_PROXY` y `API_PROXY_TARGET` coherentes en cada entorno y destino allowed CORS; preservar rutas locales Next | Habilitar después de backend; validar la matriz de login, refresh, logout, OAuth, 401, expiración, pestañas y cookies en Preview. Varias pruebas E2E de OAuth y rate limit siguen sin evidencia actualizada en las fuentes consultadas. |
| B — AUD-001 | El refresh continúa en el JSON y el backend mantiene fallback de transición; los consumidores existentes siguen dependiendo de ello | No retirar el campo en este paquete. TASK-031 es posterior e independiente: inventario/telemetría, migración de consumidores y retirada sólo tras B en Preview/producción o decisión explícita de conservar compatibilidad. |
| C — TASK-006 | Exige JWT secretos con longitud mínima de 32, distintos y no-default fuera de `test` | Antes del despliegue de C, el propietario debe verificar en Render la configuración, sin revelar ni enviar secretos. Si falla, el servicio no arrancará. |
| C — TASK-012 | Sólo permite integración a PostgreSQL de prueba loopback y nombre `*_test`; Neon/hosts remotos se bloquean | Respeta `PRODUCTION_BACKED`; no crear BD alternativa ni ejecutar suites de integración contra Neon. CI ya define PostgreSQL `impulso_test` según informes 17. No hay migraciones en B/C/D. |
| C — TASK-008/020 | Spec mueve el test al root ejecutado por Jest y prueba límites de cohorte | No hay dependencia con B; se requiere comprobar selección del test y límites definidos por spec en la validación focal posterior, no durante esta auditoría. |
| C — runtime manifest | Cambio dentro de C añade una atribución de auditoría a un contrato normativo | Necesita confirmar texto y autoridad antes de incluirlo; no editar ni propagar contrato como parte automática del patch. Separar de cambios de código si no se aprueba. |
| D — redacción | No depende de B/C; test sintético, probes no deben imprimir token/cabeceras/cuerpos | Puede integrarse aislado. Cambia sanitización en backend y debe cubrirse con pruebas sintéticas. No requiere configuración ni migración. |
| Publicación/promoción | El contrato local exige validación del propietario antes de commit/push; Governance controla autorización y flujo de promoción | Un `PROMOTE=FULL` lleva un SHA publicado de development por la cadena oficial; el flujo es a nivel de rama. Integrar cambios nuevos antes de promover A puede hacer que el SHA ya incluya otros paquetes. Congelar el alcance/SHA y respetar el orden es obligatorio. |

## 6. Bloqueantes por responsable

### 6.1 Propios de Impulso

1. **Render: verificación pendiente para B y C.** Confirmar desde el dashboard, sin revelar valores, `NODE_ENV=production`, ambos JWT secretos válidos/distintos, `FRONTEND_URL` y sufijos Preview. La fuente disponible lo marca bloqueado porque la CLI no revela valores. Esta comprobación es requisito de despliegue, no de lectura ni de integración documental.
2. **B necesita orden de rollout.** Despliegue manual del backend primero; después configuración del proxy/frontend; luego pruebas reales en Preview. Falta evidencia actualizada para la matriz completa y para OAuth con proveedores, cookies HTTPS y rate limit tras el proxy.
3. **Decisión de compatibilidad AUD-001/TASK-031.** B conserva refresh JSON por compatibilidad; decidir expresamente mantenerlo o autorizar el plan posterior de eliminación. No bloquea la integración inicial de B, sí la afirmación de cierre de la superficie AUD-001 si se exige eliminarlo.
4. **Aceptación de C y contrato local.** Revisar el diff de los guards, resultados focales/CI cuando corresponda y el cambio a `.anclora/PRODUCTION_RUNTIME.md`. Los informes etiquetan C como sujeto a validación del propietario.
5. **Criterio de cierre de Fase 0.** Confirmar que el segundo incidente citado en informes se cierra como no verificado (no hay evidencia concreta) o aportar el artefacto verificable; no tratar una sospecha como incidencia confirmada.

### 6.2 Dependientes de Governance/AOS

1. **Conflicto de autoridad sobre promoción:** D-2026-0044 indica que `PROMOTE=FULL` por sí solo no autoriza promoción; D-2026-0047/D-2026-0050 y D-2026-0052 junto con el estándar Lean describen el token como autorización afirmativa de dispatch. Resolver la precedencia y actualizar la fuente canónica antes de modificar workflow/contratos o afirmar que la propuesta 19 es un gate aprobado.
2. **Gate real frente a propuesta:** los informes 18–19 documentan que el workflow actual permitiría checks pendientes y que la propuesta requeriría un environment/revisor y una integración no escrita. Governance/owner deben decidir si se cambia el estándar y el workflow; los dos archivos de propuesta no habilitan cambios por sí mismos.
3. **Reglas de branch/protección y evidencias:** requisitos de CI obligatorio, aprobación verificable, historial completo y persistencia de evidencia requieren decisión normativa y operacional. No son cambios del paquete B/C/D.
4. **Reconciliación documental:** Governance debe ratificar la atribución/autoría añadida al runtime manifest dentro de C, si ese cambio se considera histórico/normativo.

Estos puntos de Governance no bloquean el análisis ni las pruebas locales aisladas de paquetes. Sí bloquean cambiar el gate de promoción o incorporar como autoridad una decisión contractual todavía contradictoria.

## 7. Orden recomendado de integración y validación

1. **Congelar el baseline A.** Registrar que `af5f38d` es el baseline A indicado por el propietario; conservar sus resultados CI/Preview ya aceptados sin repetirlos. No mezclar en su SHA cambios nuevos. Aún no declarar el cierre de producción si falta la operación de promoción/despliegue autorizada.
2. **Resolver antes de desplegar.** Propietario verifica los valores de configuración Render requeridos (solo booleanos/confirmaciones); decide alcance de AUD-001 y el incidente no verificado; resuelve la aprobación del cambio documental del paquete C. Sin valores de secretos en evidencia.
3. **Integrar D como lote independiente** tras revisión del propietario. Validación focal con datos sintéticos para redacción y probes; revisar que errores sólo produzcan estados/códigos/booleanos. Mantener separado de los paquetes de sesión y runtime. Si la decisión de secuenciación de release necesita promoción A aislada, no incorporar D a development antes de fijar/promover ese SHA.
4. **Integrar C en lote propio**, después de resolver el runtime-manifest diff y verificar configuración de Render. Validar guards y suites unitarias de backend, incluyendo el test trasladado a `tests/unit`; nunca ejecutar integración contra Neon. No hay migración. No desplegar el guard de secretos con configuración desconocida.
5. **Integrar B en lote(s) backend → frontend.** Backend cookie/OAuth primero; correr validación backend focal/CI según el flujo autorizado. Despliegue manual Render sólo tras aprobación del propietario; luego configurar proxy en Preview, publicar frontend en su carril autorizado y validar matriz completa. La eliminación de refresh JSON queda fuera de B.
6. **Prueba integrada de fase.** Una vez disponibles B/C/D en el SHA acordado: CI del SHA cuando toque por el flujo de publicación (no repetir checks previos sin cambios); confirmar tests unitarios relevantes, typecheck/build que aplique y suite de integración aislada en el runner/CI permitido. Browser QA en Preview con identidad QA dedicada `qa.impulso@anclora.local`, sin cuenta personal, sin imprimir tokens y sin tocar Neon con suites destructivas. Las pruebas destructivas sólo sobre el Postgres de test loopback/CI ya permitido.
7. **Aceptación del propietario y cierre.** Revisar resultados/evidencia, decidir compatibilidad AUD-001, confirmar criterio del segundo incidente y declarar explícitamente el estado final. Commit/push/promoción/despliegues siguen requiriendo las autorizaciones y gates de AOS vigentes; este plan no los autoriza.

### Criterios de aceptación de Fase 0

- A permanece integrado en `development` y conserva el resultado CI/Preview aceptado; el cierre de su riesgo de código desplegado se distingue de la contención pública. Se respeta la decisión del propietario de §14.6: la rotación no es condición requerida mientras sigan cumpliéndose sus condiciones.
- B cumple la spec en backend y frontend; backend disponible antes de activar proxy; login, refresh/cookie, logout, expiración, 401, concurrencia/pestañas y OAuth verificados en Preview conforme a la matriz acordada; configuración de cookies HTTPS y proxy/rate limit revisada.
- C cumple guardas JWT, acceso de integración y límites de cohorte; test de dominio entra en la suite Jest esperada; configuración de Render confirmada antes de despliegue; cambio al runtime manifest aprobado o excluido del lote; ninguna migración/DB alternativa.
- D pasa validación sintética de redacción y revisión de probes; ninguna salida contiene token, cabeceras o cuerpos completos.
- CI requerido para el SHA final en estado satisfactorio conforme al gate vigente; verificación aislada sin tests destructivos en Neon; QA usa identidad dedicada persistente.
- Cambios documentales y snapshots no se confunden con código aprobado; cada lote tiene diff y evidencia inequívocos; SHA de cualquier promoción contiene sólo lo revisado para ese release.
- Propietario acepta expresamente los pendientes residuales y el estado global: **Fase 0 COMPLETA** solo cuando se cumplen los criterios funcionales y operativos aprobados, no por el mero estado verde de pruebas aisladas.

## 8. Decisiones que requieren al propietario

1. Confirmar, en Render y sin revelar valores, configuración de JWT, `NODE_ENV`, `FRONTEND_URL` y sufijos de Preview antes de desplegar B/C.
2. Aprobar o excluir del paquete C la atribución que modifica `.anclora/PRODUCTION_RUNTIME.md`; no se presume autorización normativa por estar incluida en un patch.
3. Elegir si AUD-001 conserva refresh en JSON o si se abre TASK-031 tras B; sin retirada durante B.
4. Aceptar la matriz de Preview pendiente de B y su orden backend → frontend; autorizar por separado despliegue manual Render y variables de Preview que exija el contrato.
5. Elegir el momento de D para que el SHA que se promueva contenga únicamente paquetes revisados; aprobar su integración después de revisar el diff.
6. Cerrar como “no verificado” el segundo incidente mencionado en los informes, salvo que se aporte evidencia concreta.
7. Confirmar secuenciación de publicación de A frente a B/C/D: el workflow promueve el SHA de la rama y puede llevar todos los commits presentes. Congelar el SHA de A antes de añadir paquetes si se quiere conservar una promoción aislada.

Las cuestiones 1–6 son decisiones/validaciones de Impulso. La resolución del conflicto de `PROMOTE=FULL` y cualquier cambio al workflow/contrato son de Governance y no quedan aprobados por este informe.

## 9. Estado de cambios de este encargo

Este informe es el único archivo creado por esta tarea. No se alteraron ni eliminaron otros cambios del árbol; no se ejecutaron tests ni acciones sobre GitHub, Render, Vercel o Neon.
