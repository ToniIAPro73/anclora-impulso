# 19 — Controles de promoción: divergencias, gate propuesto y cierre de AUD-024

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

> **Fecha:** 2026-11-10. **Estado:** diagnóstico y propuesta. **No se ha modificado ningún contrato, workflow, rama remota, variable de Vercel ni despliegue.**
> **Fase 0: ABIERTA.** Esta propuesta no cierra ningún control hasta que se implemente y se pruebe contra el workflow real.

---

## 1. Verificación de controles (solo lectura)

Cada control se clasifica como **EXISTENTE** (verificado en el sistema), **DOCUMENTADO sin implementar** o **INEXISTENTE**.

| # | Control | Dónde se exige | Estado real | Evidencia |
|---|---|---|---|---|
| C1 | Despacho sólo desde `development` | `promote.yml` (`GITHUB_REF_NAME`) | **EXISTENTE** | Lectura del workflow |
| C2 | SHA exacto revisado = `origin/development` | `promote.yml` | **EXISTENTE** | Lectura del workflow |
| C3 | Fast-forward: cada destino es ancestro del SHA | `promote.yml` (`merge-base --is-ancestor`) | **EXISTENTE** | Lectura del workflow |
| C4 | Sin force-push ni borrado en destinos | Protección de ramas en `staging`, `production`, `main` | **EXISTENTE** (sólo esto) | `gh api …/branches/<b>/protection`: `allow_force_pushes=false`, `allow_deletions=false` |
| C5 | Protección de `development` | Contrato y estándar | **INEXISTENTE** | `gh api …/branches/development/protection` → 404 "Branch not protected" |
| C6 | Revisión obligatoria antes de push a destinos | Estándar operativo ("protección de ramas") | **INEXISTENTE** | `required_pull_request_reviews=null`, `restrictions=false` |
| C7 | CI obligatorio y verde en el SHA | Owner (esta petición); contrato permite `pending` | **INEXISTENTE en el gate** | Ver §2, hallazgo H1 |
| C8 | Token `PROMOTE=FULL` validado por el workflow | Contrato (`PRODUCTION_RUNTIME`, cabecera) | **DOCUMENTADO sin implementar** | `promote.yml` no lo referencia |
| C9 | Aprobación verificable de un humano | Owner; `production-migrations` ya lo usa | **INEXISTENTE en `promote.yml`** | Environments: `Production` y `Preview` sin reglas |
| C10 | Concurrencia serializada | `promote.yml` (`concurrency`, `cancel-in-progress: false`) | **EXISTENTE** | Lectura del workflow |
| C11 | Verificación del historial completo que se promociona | Owner | **PARCIAL**: se verifica el ancestro, no el conjunto de commits | Lectura del workflow |
| C12 | Re-verificación de `development` antes de cada push a destino | Owner | **PARCIAL**: se verifica una vez, al inicio | Lectura del workflow |
| C13 | Evidencias persistentes | Owner | **INEXISTENTE**: sólo logs de run (retención limitada) | — |
| C14 | `DISPATCHED` no equivale a `PROMOTED` | D-2026-0052, estándar | **DOCUMENTADO sin implementar** | `promote.yml` no verifica las refs tras el push |
| C15 | Permisos mínimos del workflow | Buenas prácticas | **PARCIAL**: `contents: write`, `statuses: read`; `actions` permisos por defecto `read` | `gh api …/actions/permissions/workflow` |

---

## 2. Hallazgos principales

### H1 — El gate de promoción no evalúa el CI (grave)
`promote.yml` consulta `gh api repos/…/commits/<SHA>/status`, que es el **estado heredado** de commits. Para `0e0b897`, ese estado tiene **un único contexto: `Vercel`**. Los resultados de GitHub Actions son *check-runs* (`test-backend`, `test-frontend`) y **no entran en la decisión**.

**Consecuencia:** un CI en rojo no bloquea la promoción. El resultado `success` que muestra la API es vacío respecto al CI. Lo confirmé: los check-runs de CI existen y están en `success` en `0e0b897`, pero el gate sólo mira `Vercel`.

### H2 — El token `PROMOTE=FULL` no se valida, y las decisiones normativas se contradicen
- `PRODUCTION_RUNTIME.md` exige `PROMOTE=FULL` del propietario.
- **D-2026-0052** (aprobada) dice que `PROMOTE=FULL` o `promote ok` despacha el workflow.
- **D-2026-0044** (aprobada) dice, para L3 (promoción): **"`PROMOTE=FULL` por sí solo no autoriza promoción"**.
- `AGENT_OPERATING_STANDARD` dice que la promoción se autoriza con `promote ok` o `PROMOTE=FULL`.

**Conclusión:** Governance no tiene una regla única. Lo más sólido, sin contradecirse, es lo que pides tú: una **aprobación verificable** en GitHub, y el texto del operador como señal adicional. Eso necesita una decisión de Governance para cerrar la contradicción (§5).

### H3 — Un CI pendiente no bloquea
`promote.yml` sólo bloquea `failure` y `error` (línea 125-131). `pending` pasa. El contrato lo declara explícitamente: *"permits pending checks"*. Es una decisión documentada, no un fallo técnico, pero **no cumple tu requisito**.

### H4 — La promoción es a nivel de rama
Promover un SHA lleva a `staging`, `production` y `main` **todo el historial** de `development` hasta ese SHA. Hoy no hay ningún control que verifique qué commits son.

### H5 — El estándar afirma una protección que no existe
`AGENT_OPERATING_STANDARD` dice que se conservan "protección de ramas, ausencia de force push y ausencia de despliegue directo". La protección de ramas se reduce a force-push y borrado. No hay revisiones ni restricciones de escritura.

### H6 — El estándar prohíbe al agente consultar CI
`AGENT_OPERATING_STANDARD`: "no se consultan checks de CI/Preview y no se hace polling". Por eso el gate **debe** estar **dentro del workflow**, y el agente no debe ser el que lo compruebe. Un gate en el agente sería un control que se puede saltar.

### H7 — Los entornos no tienen aprobaciones
`production-migrations` tiene revisores obligatorios y `branch_policy`. `Production` y `Preview` no tienen ninguna regla. Existe un mecanismo probado en el mismo repositorio que sirve para C9.

### H8 — Las evidencias no persisten
Los logs de un run se pierden con el tiempo. No hay artefacto ni registro en el repositorio.

---

## 3. Gate propuesto (mínima corrección)

**Principio:** el gate vive **dentro** de `promote.yml`, no en el agente. La aprobación humana es un **environment con revisor obligatorio**, que GitHub aplica y registra.

### 3.1 Estructura de jobs

```yaml
# PROPUESTA. No aplicada. No validada en GitHub.
# AVISO: evaluate.mjs (adaptador que obtiene los datos de la API) NO EXISTE todavía.
# Sólo proposals/promotion-gate/gate.mjs está escrito y probado (18/18, a nivel lógico).
on:
  workflow_dispatch:
    inputs:
      target: { type: choice, options: [full], required: true }
      source_sha: { type: string, required: true }
      expected_commits: { description: "Lista de SHA revisados, separados por espacio", type: string, required: true }
      authorization_text: { description: "Instrucción del operador; debe contener PROMOTE=FULL", type: string, required: true }

permissions:
  contents: read            # sólo lectura en el job de gate
  statuses: read
  checks: read

concurrency:
  group: promote-development
  cancel-in-progress: false

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - name: Evaluate gate (decision logic, see proposals/promotion-gate/gate.mjs)
        run: node proposals/promotion-gate/evaluate.mjs   # computes checks, ancestry, range; writes evidence JSON
      - uses: actions/upload-artifact@v4
        with: { name: promotion-evidence, path: evidence.json, retention-days: 400 }

  promote:
    needs: gate
    runs-on: ubuntu-latest
    environment: promotion     # required reviewer = owner. GitHub enforces and records the approval.
    permissions:
      contents: write
    steps:
      - name: Re-check development immediately before each push
        run: |
          # for each target in staging production main:
          #   assert origin/development == source_sha
          #   assert target is ancestor of source_sha
          #   git push origin source_sha:refs/heads/<target>     # non-force: a concurrent change is rejected
      - name: Verify refs after push (DISPATCHED is not PROMOTED)
        run: |
          # assert origin/staging, origin/production, origin/main == source_sha
```

### 3.2 Decisiones que implementa el módulo (`proposals/promotion-gate/gate.mjs`)

| Requisito del owner | Cómo lo cumple la propuesta | Estado |
|---|---|---|
| SHA exacto y autorizado | `sourceSha` = `origin/development`, formato de 40 hex | Probado (18 casos) |
| CI obligatorio completado con éxito | `test-backend` y `test-frontend`: última ejecución `completed` + `success` | Probado |
| Bloqueo en pendiente, ausente, cancelado o fallido | Cualquier conclusión distinta de `success`, o ausencia | Probado |
| Estado heredado sin falso verde | Lista vacía de estados = bloqueo | Probado |
| Autorización verificable | Environment `promotion` con revisor obligatorio. El texto `PROMOTE=FULL` es necesario pero **no suficiente** | Probado a nivel lógico; el environment **no creado** |
| Historial completo verificado | Conjunto de commits de `target..source` = `expected_commits` | Probado |
| Fast-forward | Destinos ancestros del SHA | Probado |
| Protección frente a concurrencia | `concurrency` serializado; push no-force rechaza cambios concurrentes | Configuración existente + push no-force; **no probado en GitHub** |
| Registro persistente de evidencias | Artefacto `promotion-evidence`, retención configurable | **No probado** |
| Comprobaciones previas a cada push | Re-verificación por destino | Diseñado; **no probado** |

### 3.3 Qué NO resuelve la propuesta, y debe decidirlo el propietario

- **La contradicción D-2026-0044 / D-2026-0052.** Governance debe decidir si `PROMOTE=FULL` autoriza o no. Mientras tanto, el environment con revisor es el control efectivo, sea cual sea la decisión.
- **Protección de `development`.** Si se quiere, requiere revisiones y estado requerido. Eso cambia el flujo de commit del agente y debe decidirse expresamente.
- **Restricción de escritura en destinos.** Limitar `staging`, `production` y `main` a la identidad de Actions requiere cambiar los ajustes de la rama; no lo hago.

---

## 4. Matriz de aceptación y pruebas del gate

| Caso | Prueba unitaria | Prueba en GitHub | Estado |
|---|---|---|---|
| Caso feliz con todos los controles | ✓ | Pendiente | Unitario OK |
| Ref distinta de `development` | ✓ | Pendiente | Unitario OK |
| SHA inválido | ✓ | Pendiente | Unitario OK |
| `development` movido tras la revisión | ✓ | Pendiente | Unitario OK |
| Sin aprobación de environment | ✓ | Pendiente | Unitario OK |
| Falta el token `PROMOTE=FULL` | ✓ | Pendiente | Unitario OK |
| `test-backend` ausente, pendiente, fallido, cancelado o saltado | ✓ | Pendiente | Unitario OK |
| Última ejecución fallida tapa una anterior correcta | ✓ | Pendiente | Unitario OK |
| Estado heredado pendiente o ausente | ✓ | Pendiente | Unitario OK |
| Commit fuera del conjunto revisado | ✓ | Pendiente | Unitario OK |
| Destino no ancestro | ✓ | Pendiente | Unitario OK |
| Environment realmente bloquea hasta aprobar | — | **Pendiente** | No probado |
| Push concurrente rechazado | — | **Pendiente** | No probado |
| Evidencia subida como artefacto | — | **Pendiente** | No probado |
| Verificación de refs tras el push | — | **Pendiente** | No probado |

**Prueba en GitHub:** requiere una rama de ensayo y un environment de prueba, cosas que hoy no existen. Se harán sólo con tu autorización.

---

## 5. Compatibilidad con `PROMOTE=FULL`

La propuesta exige `PROMOTE=FULL` en `authorization_text`, porque el contrato lo pide. No basta, porque es texto escrito por el operador: el control efectivo es el environment con revisor. Así se conserva la compatibilidad contractual y se evita que el texto sea la única prueba. La contradicción con D-2026-0044 queda para Governance (§3.3).

---

## 6. AUD-024: procedimiento de cierre

### 6.1 Contención inmediata (no requiere promoción)

| Paso | Acción | Responsable |
|---|---|---|
| 1 | En Vercel, `UTILIZAR_USER_TEXT` a `false` (o retirarla) en **Production** | **Toni** |
| 2 | **Rotar la contraseña** de la cuenta de `PASS_TEXT` | **Toni** |
| 3 | **Redeploy de producción sin caché** desde el dashboard, para que el build lea la bandera nueva | **Toni** |
| 4 | Verificar con booleanos: `https://impulso.anclora.com/auth/login` y `anclora-impulso.vercel.app` no contienen la contraseña | Agente (solo lectura) |

**Por qué funciona sin código:** el HTML de `/auth/login` es estático (`○` en el build). Con la bandera en `false`, el build no genera credenciales. Lo verifiqué en el árbol aislado de HEAD: con `false`, no hay centinelas en el HTML.

**Límite:** el paso 3 es una **reconstrucción de producción** sin cambio de código. Hay que confirmar que el redeploy usa las variables actuales. Lo verifico con el paso 4 después de ejecutarlo.

### 6.2 Previews

| Acción | Responsable |
|---|---|
| Comprobar cada preview contra **su propio** `PASS_TEXT` (booleanos, en proceso) | Agente |
| Reconstruir o eliminar los previews que lo expongan | **Toni** |

Muestra actual (12 previews más recientes): **0 con la contraseña de su entorno**. No cubre previews antiguos.

### 6.3 Integración del código (Paquete A)

| Paso | Acción | Responsable | Requiere |
|---|---|---|---|
| 1 | Revisión del diff de A (2 ficheros) | **Toni** | — |
| 2 | Commit de A **solo**, en `development`, con mensaje y atribución (ver `18`) | Agente | Aprobación explícita |
| 3 | Push a `origin/development` | Agente | Aprobación explícita |
| 4 | CI del SHA: `test-backend` y `test-frontend` en `success` (comprobación manual, el gate aún no existe) | Agente (solo lectura) | — |
| 5 | Preview del SHA: booleanos | Agente ejecuta, **Toni revisa** | — |
| 6 | Promoción: con el gate actual **sin** protección de CI, o con el gate propuesto cuando exista | **Toni** | Token `PROMOTE=FULL` y, con el gate nuevo, aprobación del environment |
| 7 | Verificación de refs y de booleanos en producción | Agente (solo lectura) | — |

**Recomendación:** no esperar a que exista el gate para cerrar AUD-024. La contención (§6.1) cierra la exposición. El código de A llega a producción por el camino normal, y el gate mejora ese camino, pero no es condición de la contención.

### 6.4 Confirmación del cierre sin revelar secretos

- Booleanos en producción: `passwordPresent=false`, `emailPresent=false`.
- Booleanos en previews accesibles, cada uno contra su entorno.
- Ningún valor, ningún encabezado, ningún cuerpo en los informes.

---

## 7. Paquete D: procedimiento posterior

| Paso | Acción | Responsable | Requiere |
|---|---|---|---|
| D0 | Preflight: sha256 del parche D (`5dc5025043397a66…`), 5 ficheros | Agente (solo lectura) | — |
| D1 | Revisión del diff | **Toni** | — |
| D2 | Commit de D, separado de A | Agente | Aprobación |
| D3 | Push | Agente | Aprobación |
| D4 | CI en `success` | Agente (solo lectura) | — |
| D5 | Sin promoción propia. Viaja en la siguiente promoción de `development` | — | — |

**Independencia de D respecto a A:** verificada en aislamiento (8/8 pruebas en HEAD + D). Puede ir antes o después de A. Si va antes, **viaja con A** en la siguiente promoción, así que su revisión debe estar cerrada antes de promocionar.

**Impacto en producción:** `redact.ts` afecta sólo a la capa de logs del backend, que Render sirve desde `development`. No cambia datos ni interfaz.

**Rollback de D:** `git revert` de su commit en `development`.

---

## 8. Riesgos residuales

| Riesgo | Severidad | Tratamiento |
|---|---|---|
| AUD-024 expuesta hasta el paso 6.1.3 | **Crítica** | Contención inmediata, manual |
| El gate actual no evalúa CI (H1) | **Alta** | Confirmar con el propietario antes de cada promoción. Corregir con el gate propuesto |
| Promoción a nivel de rama (H4) | Alta | Commits de B y C **no** deben estar en `development` antes de promocionar A |
| Contradicción D-2026-0044 / D-2026-0052 | Media | Decisión de Governance |
| `development` sin protección | Media | Decisión del propietario |
| Gate no probado en GitHub | Alta | Prueba en rama de ensayo, con autorización |
| Evidencias efímeras | Media | Artefacto del gate propuesto |
| Un redeploy sin caché puede no aplicar la nueva variable | Media | Verificación booleana posterior |

---

## 9. Decisiones que requieren al propietario

1. **Contención de AUD-024:** desactivar la bandera en Vercel, rotar la contraseña y reconstruir producción (§6.1).
2. **Aprobar o rechazar el gate propuesto** y autorizar el environment `promotion` con revisor obligatorio (Toni).
3. **Resolver la contradicción** D-2026-0044 / D-2026-0052 sobre si `PROMOTE=FULL` autoriza por sí solo (Governance).
4. **Decidir la protección de `development`** (revisiones, estados requeridos).
5. **Decidir la restricción de escritura** en `staging`, `production` y `main`.
6. **Autorizar una rama de ensayo** para probar el gate en GitHub antes de usarlo en producción.
7. **Confirmar** si el procedimiento de A puede usar el gate actual con comprobación manual del CI, o si espera al gate nuevo.

---

## 10. Estado de la Fase 0

**Fase 0: ABIERTA.** Los controles de promoción están diagnosticados, con una propuesta probada a nivel lógico y **no implementada**. AUD-024 sigue expuesta hasta que se ejecute la contención del §6.1. No se declara seguro ningún procedimiento de promoción por estar documentado: cada control tiene una implementación verificada o queda marcado como pendiente en §1 y §4.
