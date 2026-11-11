# 18 — Procedimiento operativo de integración: Paquete A (AUD-024) y Paquete D (redacción)

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

> **Fecha:** 2026-11-10. **Estado:** procedimiento preparado. **No se ha ejecutado ningún commit, push, despliegue ni promoción.**
> **Fase 0: ABIERTA.** Este procedimiento cubre sólo A y D. B, C y las validaciones pendientes siguen abiertos.
> **Referencias:** `17_PHASE0_VALIDATION_REPORT.md` (secciones 11–13), `packages/A-AUD-024.patch`, `packages/D-CREDENTIAL-REDACTION.patch`.

---

## 1. Línea base verificada (solo lectura)

| Elemento | Valor | Verificación |
|---|---|---|
| Rama local | `development` | `git branch --show-current` |
| `HEAD` local | `0e0b897dfca6397f9ca5a5d1e5d30382794f8428` | `git rev-parse HEAD` |
| `origin/development` | `0e0b897dfca6397f9ca5a5d1e5d30382794f8428` (igual) | `git ls-remote origin refs/heads/development` |
| Estado combinado de GitHub en `0e0b897` | `success` | `gh api repos/ToniIAPro73/anclora-impulso/commits/0e0b897/status` |
| Check-runs en `0e0b897` | 5 | `gh api …/check-runs` |
| Últimas ejecuciones de CI en `development` | `CI: success`, `Promote: success` (`0e0b897`) | `gh run list --branch development` |
| Despliegues asociados a `0e0b897` | 2 | `gh api repos/…/deployments?sha=…` |
| Parche A | `sha256 b8df17f7348dbc3c…`, 2 ficheros, 83 líneas | `shasum -a 256` |
| Parche D | `sha256 5dc5025043397a66…`, 5 ficheros, 230 líneas | `shasum -a 256` |
| Aislamiento A | HEAD + A: test AUD-024 PASS; control HEAD FAIL; frontend 152/152 | iso-A (17 §13.2) |
| Aislamiento D | HEAD + D: 8/8 PASS; self-test del guard OK | iso-D (17 §13.2) |

**Lo que no sabemos aún:** el CI de un commit futuro. Los parches A y D **no** tienen commit todavía, así que no hay SHA ni CI que revisar.

---

## 2. Hallazgo de gobierno: el workflow de promoción no comprueba el token `PROMOTE=FULL`

`.github/workflows/promote.yml` valida, en este orden:

1. Se despacha desde `development`.
2. `source_sha` no está vacío y existe.
3. `source_sha` **es exactamente** `origin/development` (si `development` se ha movido, bloquea).
4. El estado combinado del SHA **no** es `failure` ni `error`. Un estado `pending` **sí** se acepta.
5. Cada destino (`staging`, `production`, `main`) es ancestro de `source_sha` (avance rápido).
6. Empuja el SHA a `staging`, `production` y `main`, en ese orden.

**No valida:** el token `PROMOTE=FULL`, la aprobación de Toni, ni la revisión en Preview. El contrato (`PRODUCTION_RUNTIME.md`, cabecera) sí los exige.

**Consecuencia:** cualquiera con permiso para despachar el workflow puede promover. La barrera real es el control de acceso del repositorio, no el token. Un cambio en el workflow para exigirlo requiere **aprobación de Governance**; no lo modifico.

**Consecuencia operativa 2:** `CI pending` no bloquea. **Hay que comprobar el CI a mano antes de despachar.**

---

## 3. Restricción crítica: la promoción es a nivel de rama

Promover `source_sha` lleva a `staging`, `production` y `main` **todo el historial** que haya en `development` hasta ese SHA.

**Regla:** antes de la promoción, los únicos commits nuevos en `development` deben ser los que se han revisado en Preview. Los paquetes B y C **no** se commitean hasta que se decida su orden, porque si entraran en el SHA revisado llegarían a producción sin revisión.

---

## 4. Procedimiento del Paquete A — AUD-024

| Paso | Acción | Responsable | Requiere autorización explícita | Evidencia |
|---|---|---|---|---|
| A0 | Preflight: rama, `HEAD`, `origin/development`, parche sha256 y 2 ficheros | Agente (solo lectura) | No | Salida de §1 |
| A1 | Revisión del diff de 2 ficheros | **Toni** | — | Aprobación escrita |
| A2 | `git add app/auth/login/page.tsx __tests__/components/login-page-no-env-credentials.test.tsx` (sólo índice; reversible con `git reset`) | Agente | Sí, tras A1 | `git diff --cached --name-only` = 2 ficheros |
| A3 | Commit con el mensaje de §6 | Agente | **Sí: commit aprobado por Toni** (`COMMIT_PUSH_REQUIRES_EXPLICIT_USER_VALIDATION=true`) | SHA del commit |
| A4 | `git push origin development` | Agente | **Sí: push aprobado por Toni** | `git ls-remote` = SHA nuevo |
| A5 | CI del SHA: `gh run watch` hasta conclusión. Debe ser `success` | Agente (solo lectura) | No | ID y URL del run |
| A6 | Preview del SHA: obtener URL con `gh api …/deployments?sha=<SHA>` y comprobar el HTML con booleanos | Agente ejecuta; **Toni revisa** | No, salvo que Toni pida otro procedimiento | Booleanos + URL |
| A7 | Variables en Vercel: `UTILIZAR_USER_TEXT` a `false` o retirarla, y retirar `USER_TEXT`/`PASS_TEXT` tras el despliegue | **Toni** | Siempre | Captura del dashboard (sin valores) |
| A8 | **Rotar la contraseña** de la cuenta de `PASS_TEXT` | **Toni** | Siempre | Confirmación |
| A9 | Previews antiguos con la bandera activa: reconstruir o eliminar | **Toni** (eliminar); agente verifica | Sí | Lista de URLs verificadas |
| A10 | Promoción: `gh workflow run promote.yml -f target=full -f source_sha=<SHA revisado>` | **Toni** | **Sí: token `PROMOTE=FULL` escrito por Toni, con el SHA exacto** | Run ID |
| A11 | Verificación en producción tras el despliegue: booleanos en `impulso.anclora.com` y `anclora-impulso.vercel.app` | Agente (solo lectura) | No | Booleanos |

**Lo que ejecuto yo con los permisos actuales:** A0, A2 (sólo tras aprobación), A5, A6, A11, y las comprobaciones de solo lectura del CI. Lo que cambia estado (commit, push, variables, rotación, eliminación de previews, promoción) requiere a Toni.

### Rollback del Paquete A

- **No hay rollback a la versión anterior a A.** Revertir A reintroduce la exposición. Tampoco sirve el rollback instantáneo de Vercel a un despliegue anterior: esos despliegues también exponen la contraseña.
- **Rollback real = fix-forward:** un commit correctivo con el mismo procedimiento.
- **Contención inmediata:** la bandera desactivada y la contraseña rotada (A7, A8) son la protección efectiva, con independencia del código.

---

## 5. Procedimiento del Paquete D — redacción y scripts QA

| Paso | Acción | Responsable | Requiere autorización | Evidencia |
|---|---|---|---|---|
| D0 | Preflight: parche sha256 y 5 ficheros | Agente (solo lectura) | No | §1 |
| D1 | Revisión del diff: `backend/src/utils/redact.ts`, test sintético, `scripts/qa/*.mjs` | **Toni** | — | Aprobación |
| D2 | `git add` de los 5 ficheros | Agente | Tras D1 | `--cached` |
| D3 | Commit de D, **separado** de A | Agente | **Sí** | SHA |
| D4 | Push | Agente | **Sí** | `ls-remote` |
| D5 | CI: `success`. Incluye `test:ci` del backend, que ejecuta `redact-credentials-synthetic.test.ts` | Agente (solo lectura) | No | Run ID |
| D6 | Sin promoción propia: D es tooling. Viaja en la próxima promoción de `development` | — | — | — |

**Impacto en producción:** `redact.ts` se usa en la capa de logs del backend. El backend sirve desde la rama `development` de Render, así que D cambia lo que se registra. Sólo **reduce** la información registrada.

### Rollback de D

`git revert <SHA de D>` en `development`, con el mismo procedimiento. No hay efecto en datos ni en la interfaz.

---

## 6. Mensaje de commit (para A y D)

Formato según la instrucción de atribución del entorno:

```
fix(auth): stop exposing login credentials from environment variables (AUD-024)

The login page is a Server Component that read USER_TEXT, PASS_TEXT and
UTILIZAR_USER_TEXT and rendered them into the HTML when the flag was set.
The page now renders no environment-derived credentials. Covered by a test
with sentinel values and a source guard.

Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>
```

Para D, el asunto será `chore(qa): redact credentials in tool output and add safe QA probes`, con el mismo pie de atribución.

---

## 7. Matriz de responsabilidades

| Acción | Agente (permisos actuales) | Toni |
|---|---|---|
| Leer estado de git, CI, despliegues, previews | Sí | — |
| Ejecutar tests, typecheck, lint, build locales | Sí | — |
| Comprobar HTML de previews y producción (booleanos) | Sí | Revisa |
| Staging en índice (`git add`) | Sí, **tras aprobación** | Aprueba |
| Commit | Técnicamente sí; **no sin aprobación** | **Aprueba** |
| Push a `origin/development` | Técnicamente sí; **no sin aprobación** | **Aprueba** |
| Variables de Vercel (`UTILIZAR_USER_TEXT`, `USER_TEXT`, `PASS_TEXT`) | **No** | **Sí** |
| Rotar contraseña de la cuenta de `PASS_TEXT` | **No** | **Sí** |
| Eliminar previews | **No** | **Sí** |
| Despachar `promote.yml` | **No** | **Sí, con token `PROMOTE=FULL`** |
| Cambiar `promote.yml` o contratos | **No** (requiere Governance) | Decide |
| Despliegue manual en Render | **No** | **Sí** |

---

## 7 bis. Evidencias a capturar en cada paso

| Campo | Ejemplo |
|---|---|
| SHA integrado | `<sha>` |
| Run de CI | ID y URL |
| URL de Preview | `https://…vercel.app` |
| Booleanos del HTML | `passwordPresent=false` |
| Run de promoción | ID y URL |
| Booleanos en producción | `passwordPresent=false` |
| Fecha y hora | ISO-8601 |

Ninguna evidencia contiene valores de credenciales, cabeceras, cookies ni tokens. Los probes sólo imprimen códigos y booleanos.

---

## 8. Pendientes que no bloquean A ni D, pero mantienen abierta la Fase 0

| Ítem | Estado | Responsable |
|---|---|---|
| Matriz de TASK-002 en Preview y producción (17 §13.4) | Pendiente | Agente + Toni |
| Secretos JWT, `NODE_ENV`, `FRONTEND_URL` y sufijos de preview en Render | **BLOCKED** | Toni |
| Paquete B: backend primero, después frontend con proxy | Pendiente de decisión | Toni |
| Paquete C: condicionado a Render y a Governance | Pendiente | Toni |
| Refresh en JSON (AUD-001) | Ver TASK-031 | Toni decide |
| Segundo incidente de exposición | **NO VERIFICADO**: sin evidencia concreta | Toni debe indicar la salida |

### Sobre el segundo incidente

Se trata como **NO VERIFICADO**. No se presume una segunda exposición. Búsqueda realizada sin hallazgos: JWT en logs, documentos y scripts. Si Toni tiene una salida concreta, se verificará y, si procede, se revocará la sesión implicada.

---

## 9. TASK-031 — Retirada del refresh token en JSON (AUD-001)

Tarea independiente, no incluida en ningún paquete actual.

| Fase | Acción | Criterio de salida |
|---|---|---|
| 1 | Inventario de consumidores: `e2e/oauth-handoff-attacks.spec.ts`, `e2e/oauth-handoff-flow.spec.ts`, `e2e/session-and-fallback.spec.ts`, `backend/tests/integration/{auth,final-state,ai06-sessions,review-*}.test.ts`, `__tests__/lib/*` de refresh | Lista cerrada |
| 2 | Telemetría: contador de peticiones que usan `req.body.refreshToken` (la ventana de transición) | Medido durante un periodo acordado con Toni |
| 3 | Migrar los consumidores para que usen sólo la cookie | Tests actualizados y verdes |
| 4 | Retirar `refreshToken` del JSON de login, registro, refresh y OAuth; retirar el fallback del cuerpo | Commit aparte, tras Preview y producción de B |
| 5 | Rollback: `git revert` de ese commit | Documentado |

**Dependencia:** B debe estar en producción y su matriz completa. TASK-031 no puede empezar antes.

---

## 10. Estado de la Fase 0

**Fase 0: ABIERTA.** Se cierra sólo cuando se cumplan **todas** estas condiciones:

1. AUD-024 cerrada en producción, con rotación confirmada y variables retiradas.
2. Paquete B integrado: backend primero, frontend después, matriz completa en Preview y producción.
3. Paquete C aprobado tras verificar Render y cumplir Governance.
4. Refresh en JSON: retirada completada (TASK-031) o decisión explícita de mantenerla.
5. Segundo incidente: verificado o cerrado como no ocurrido, con evidencia.
