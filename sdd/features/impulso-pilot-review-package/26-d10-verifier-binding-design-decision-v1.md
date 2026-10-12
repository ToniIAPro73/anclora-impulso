# 26 — Diseño del vínculo SHA ↔ aprobación y corrección de H1–H4 del verificador (propuesta, v1, 2026-10-12)

> **PROPUESTA DE DISEÑO. RELEASE NO AUTORIZADO.** No cambia código, contratos ni workflow; no se ejecutó ni configuró nada remoto.
> Continúa el addendum de `25-d10-automated-migration-verifier-report-v1.md` (hallazgos H1–H9). Las decisiones marcadas **[DECIDE TONI]**
> no se dan por tomadas. Ningún gate ni tarea AI-xx cambia de estado.

## 1. Hechos contrastados con documentación oficial (consulta 2026-10-12)

Fuentes: `docs.github.com/en/webhooks/webhook-events-and-payloads#deployment_protection_rule` y
`docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/creating-custom-deployment-protection-rules`.
Las páginas se leyeron mediante un extractor automático; los literales deben reconfirmarse con una entrega real antes de codificar.

| Hecho | Lo que dice la documentación | Efecto en el diseño actual |
|---|---|---|
| `event` | «Event that triggered the protection rule» (el evento que originó el workflow, p. ej. `workflow_dispatch`), **no** el nombre del propio webhook | **H1 CONFIRMADO en lo esencial:** `payload.event !== "deployment_protection_rule"` rechazaría toda entrega legítima |
| SHA | campo de nivel superior `sha`: «Commit SHA that triggered the workflow»; `ref` de nivel superior; `deployment` puede ser `null`; **no** se documenta `deployment.sha` ni `workflow_run` | el código lee `deployment.sha`/`workflow_run.head_sha`: campos no documentados → `invalid or missing commit sha` |
| Respuesta | `POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule` con `state: approved|rejected` (y comentarios de estado opcionales, hasta 10, 1024 caracteres) | compatible con el diseño (uso de `deployment_callback_url`) |
| Permisos de la App | Actions: read; Deployments: read & write; token de instalación con `deployments: write` y el repo objetivo | no incluye lectura de contenido: repo público ⇒ no hace falta |
| Madurez | **«public preview … subject to change»** | riesgo de depender de una función en vista previa para una puerta de producción |
| Temporización, planes, coexistencia con revisores, máximo de reglas | **no documentados** en esa página | no asumir; comprobar en sandbox |

Consecuencia sobre **H2**: `sha` es «el commit que disparó el workflow», es decir, el commit del *ref* elegido al despachar, **no** el
input `sha` del formulario. El verificador nunca recibe `inputs.*`. Queda confirmado que hoy lo evaluado y lo migrado pueden diferir.

## 2. H2 — opciones para vincular lo evaluado con lo migrado

| Opción | Descripción | Evaluación |
|---|---|---|
| **A. SHA único = `github.sha` (recomendada)** | Se elimina el input `sha`. El job migra `github.sha`. Toni despacha eligiendo el *ref* (rama o tag) cuyo commit es el candidato. El verificador evalúa el `sha` del payload, que es exactamente lo que ejecuta el job | elimina la divergencia por construcción; el candidato queda fijado por Git, no por un campo de texto |
| **B. Manifiesto en el commit (complemento de A)** | `release-manifest.json` versionado en el propio commit con `expected_last_migration` y la lista esperada de migraciones; el verificador lo lee en ese SHA (repo público) | sustituye `expected_last_migration` y evita canales laterales; el contenido queda atado al commit y revisado en PR |
| C. Mantener `inputs.sha` y que el workflow «publique» el valor (comentario/estado) | el verificador lo leería de un canal escrito por el propio workflow | **descartada:** el canal lo controla el mismo YAML que queremos verificar |
| D. Verificador consulta `GET /actions/runs/{id}` | la API del run no expone los inputs del dispatch | **inviable** (no se documenta ese campo) |

**Backup (`backup_reference`)**: con A+B el verificador no depende del input; **selecciona él mismo** el snapshot `ready` más reciente de la
rama de producción y exige frescura (umbral **sin valor por defecto**). El input pasa a ser informativo o desaparece.

**Restricción heredada:** el guard actual «solo desde la rama por defecto» deja de ser el control; lo sustituyen (i) `github.sha` debe ser
ancestro (o igual) de la rama por defecto y (ii) el hash del workflow en ese commit (H3, §4).

## 3. Decisión estructural previa — ¿construir el servicio automatizado? [DECIDE TONI]

| Opción | Qué es | Superficie nueva | Cuándo |
|---|---|---|---|
| **P1 (recomendada para la primera migración)** | Revisores requeridos del entorno + un **script local del operador** que reutiliza las funciones puras ya probadas (`ledger-evaluator`, `backup-evaluator`, `decision-engine`) y lee el ledger con una credencial de solo lectura **desde su máquina**; la salida se adjunta a la autorización | ninguna (sin servicio, sin clave de App, sin token Neon en un tercero) | ahora |
| P2 | Servicio con GitHub App (regla de protección personalizada), con A+B+H1–H4 implementados | servicio siempre activo con clave privada de App (`deployments: write`), credencial de lectura a la BD y API key de Neon en un proveedor tercero; función en *public preview* | después de P1 y de validar en sandbox |

Razón: P1 aprovecha todo el trabajo hecho (las reglas) sin añadir credenciales de producción persistentes ni depender de una función en
vista previa. P2 puede añadirse como **segunda barrera** sin sustituir a los revisores (H7).

## 4. Correcciones de código/pruebas necesarias (pendientes, NO ejecutadas)

| Hallazgo | Cambio propuesto | Prueba nueva |
|---|---|---|
| **H1** | `validateWebhookContext`: no exigir `event === "deployment_protection_rule"`; exigir `action === "requested"` (confirmar), `event === "workflow_dispatch"`, `environment`, `repository.full_name` y leer `sha` del **nivel superior**; `deployment` opcional | fixtures basados en una entrega real redactada; rechazo de `event` distinto, de `sha` ausente y de `repository` ajeno |
| **H2** | adoptar A+B en workflow y verificador (cambia el workflow y `expected_last_migration`) | prueba de que el job migra exactamente `github.sha` y de que el verificador evalúa ese mismo valor |
| **H3** | el verificador compara el SHA-256 de `.github/workflows/production-migrations.yml` en `sha` con un valor fijado **fuera del repo** (configuración del verificador) y rechaza si difiere; cualquier cambio legítimo del workflow exige actualizar ese valor por una acción deliberada | YAML modificado ⇒ REJECTED |
| **H4** | `evaluatePrismaLedger`: **fallar** con ledger vacío; exigir que el ledger contenga, como prefijo, todas las migraciones del candidato anteriores a la primera pendiente conocida (línea base de 20), con checksums iguales | ledger vacío ⇒ inválido; línea base incompleta ⇒ inválido |
| **H5** | si se adopta P2: almacén de replay compartido y atómico (insertar-si-no-existe) o declarar el riesgo aceptado | prueba de doble entrega concurrente |
| **H8** | `maxAllowedAgeMs` obligatorio (sin default) | llamada sin umbral ⇒ error |
| **H7** | mantener revisores requeridos en `production-migrations`; corregir el texto de `AOS_ADOPTION.md` («sustituye la revisión rutinaria humana») **si Toni lo decide** — edición de contrato, requiere su instrucción | — |

## 5. Orden propuesto y gates

1. [DECIDE TONI] elegir P1 o P2 (§3) y confirmar H7 (revisores se mantienen).
2. Contrastar H1 con una entrega real (solo si P2) o descartar el servicio.
3. Aplicar A+B al workflow y al script local; añadir H3 (hash del workflow) y H4 al evaluador; fijar H8.
4. Ejecutar las pruebas locales; solo entonces sandbox (entorno de pruebas sin BD productiva).
5. Mantener bloqueados: Q1 real, backup, migración 5, `ADMIN_USER_IDS`, auto-deploy de `main`, revisiones, G1–G4.

**RELEASE NO AUTORIZADO.** Sin commit ni push; sin conexión remota a BD, Neon, Render o Vercel; solo lectura de dos páginas públicas de documentación.

---
## Actualización (2026-10-12): Toni elige P1
Decisión registrada en `.anclora/AOS_ADOPTION.md` (`IMPULSO-MIGRATION-VERIFICATION-P1-2026-10-12`). Implementación local y procedimiento en
`27-d10-p1-operator-preflight-procedure-v1.md`. H2, H4 y H8 implementados y probados en local; H1, H3, H5 y H6 diferidos a P2; H7 resuelto
(revisores requeridos se mantienen). Sin ejecución remota. **RELEASE NO AUTORIZADO.**
