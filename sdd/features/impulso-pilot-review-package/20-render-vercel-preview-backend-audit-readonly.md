# 20 — Relación Render ↔ previews de Vercel (investigación de solo lectura, 2026-10-12)

> Sin acceso a paneles de Render desde esta sesión y sin lectura de variables de Vercel (ver §1). **No es una aprobación de release**;
> no cambia ninguna tarea AI-xx ni gate. Etiquetas: **OBSERVADO** (visto ahora) · **REPORTADO PREVIAMENTE** (captura/contexto/documentos
> del repo, no vuelto a ver en el panel) · **INFERENCIA**.

## 1. Veredicto ejecutivo

**`INDETERMINADO`** para los previews de `staging`: no se pudo leer `NEXT_PUBLIC_API_URL` ni abrir el panel de Render.

- **Por qué no se leyó la variable (decisión deliberada):** la única herramienta disponible para variables de Vercel
  (`filter_project_envs`) devuelve **todas** las variables del proyecto y no permite filtrar por nombre; leerla habría volcado a esta sesión
  valores de otras variables (potencialmente `DATABASE_URL`, claves JWT/OAuth/IA). El prompt exige no mostrar valores y detenerse si no se
  puede comprobar de forma segura, así que no se llamó. La lectura de una sola variable es una comprobación manual de segundos para Toni (§7).
- **Render:** esta sesión no dispone de conexión al panel de Render. Todo lo de Render procede de la captura aportada (REPORTADO) y de
  documentos del repo.
- **Producción:** `INDETERMINADO` por la misma razón; hay evidencia indirecta fuerte de que el servicio Render es el **backend de
  producción** (§5).

## 2. Evidencia de Render

| Dato | Valor | Etiqueta / fuente | Consulta |
|---|---|---|---|
| Service ID / nombre | `srv-d6ps41v5r7bs73dvrudg` / `Anclora-Impulso` | REPORTADO PREVIAMENTE (captura `Screenshot 2026-10-12 at 13.41.59.png`) | no re-observado |
| Workspace / agrupación / entorno | `My Workspace` → `Anclora Group` → `Test` | REPORTADO (captura). **El nombre `Test` no demuestra aislamiento** | no re-observado |
| Repositorio y rama | `ToniIAPro73/anclora-impulso`, rama `main` | REPORTADO (captura) | no re-observado |
| Despliegue mostrado | commit `70fd1d4`, estado `Live` | REPORTADO (captura) | no re-observado |
| Dominio | `anclora-impulso.onrender.com` | REPORTADO (captura); coincide con los documentos del repo (§5) | no re-observado |
| Tipo de servicio, variables (nombres), recursos de datos vinculados, auto-deploy | — | **DESCONOCIDO** (sin acceso al panel) | — |

## 3. Historial de Render

**No consultado.** No se sabe si aparecen despliegues de `944eb67`, `ed4bb64`, `0978402` ni cuándo se desplegó `70fd1d4`. Dato
verificable localmente (OBSERVADO en el repositorio, solo lectura): `70fd1d4` es el commit
`70fd1d4 feat(impulso): complete P7 release hardening` (2026-09-14 22:55 +0200), alcanzable desde `development`, `staging`, `production` y
`main`; **ningún commit entre `70fd1d4` y `77f852aa` (16 commits) modifica `backend/`**.

## 4. Evidencia de Vercel

| Scope | Despliegue / rama / SHA | Fecha (UTC) / estado | Hostname de `NEXT_PUBLIC_API_URL` | Fuente y limitación |
|---|---|---|---|---|
| Preview | `staging` / `944eb67` | 2026-10-12 07:09:21 · READY | **NO LEÍDO** | OBSERVADO el despliegue (informe 19); variable no leída (§1) |
| Preview | `staging` / `ed4bb64` | 2026-10-12 07:42:01 · READY | **NO LEÍDO** | idem |
| Preview | `development` / `0978402` | 2026-10-12 10:41:27 · READY | **NO LEÍDO** | idem |
| Production | `main` / `77f852aa` | 2026-10-03 13:49:36 · READY | **NO LEÍDO** | idem |

Aunque se leyera, Vercel no conserva en este control plane la configuración efectiva de cada despliegue histórico: la lectura mostraría la
configuración **actual** por scope, no necesariamente la vigente cuando se construyó cada preview (las variables `NEXT_PUBLIC_*` se
incrustan en el build).

## 5. Relación Preview ↔ Render

- **Comparación de hostnames:** `INDETERMINADA` (no hay hostname de Vercel que comparar).
- **Evidencia indirecta (REPORTADO PREVIAMENTE, documentos del repo):** las auditorías UX del 2026-09-14
  (`docs/audits/anclora-impulso-ux-reaudit-2026-09-14.md`, `…final-blocker-closure-2026-09-14.md`, `build_impulso_ux_reaudit.py`) registran
  `https://anclora-impulso.onrender.com/api` como **backend del entorno PRODUCTION** (también para pruebas de login y CORS). El dominio
  coincide con el servicio de la captura. **INFERENCIA:** el servicio Render `Anclora-Impulso` es el backend de producción, con
  independencia de que su agrupación se llame `Test`.
- **INFERENCIA (no confirmada):** si el scope Preview de Vercel usa el mismo `NEXT_PUBLIC_API_URL` que Production (lo habitual cuando se
  define una sola vez para «All Environments»), los previews de `staging` hablan con **ese backend de producción**. Es la hipótesis más
  probable y debe confirmarse con una lectura manual.
- **Backend y aislamiento de BD:** nada de esto prueba el aislamiento de la base de datos; ni siquiera se conoce la BD del servicio.

## 6. Riesgos y decisión de release

| Afirmación | Estado | Justificación |
|---|---|---|
| Los previews de staging llamaron o podían llamar al backend Render | **NO CONFIRMADO** (hipótesis probable, §5) | falta el valor/hostname de Preview |
| El servicio Render está en un entorno aislado | **NO CONFIRMADO / contradicha por indicios** | documentos del repo lo llaman PRODUCTION; `Test` es solo un nombre |
| Frontend y backend en versiones compatibles | **NO CONFIRMADO** | Render mostraba `70fd1d4` (backend anterior a todas las migraciones y cambios de sesión/OAuth); los previews son de `944eb67`+ . D10 §2: frontend nuevo + backend antiguo funciona salvo OAuth (`/auth/oauth/exchange` no existe: fallo seguro) |
| El backend tiene migraciones compatibles | **NO VERIFICABLE** | no se consultó BD ni checksum; la migración 5 sigue sin verificarse |

**Nuevo riesgo derivado (INFERENCIA, a confirmar en el panel):** el servicio Render sigue la rama **`main`**. Si tiene *Auto-Deploy* activado,
**mover `main` a `0978402` desplegaría automáticamente el backend nuevo en producción sin migraciones aplicadas**
(D10: «nunca desplegar el backend antes de las migraciones»), a la vez que Vercel actualiza el frontend de producción. Que Render siga en
`70fd1d4` aunque `main` estuvo en `77f852aa` (sin cambios de backend entre ambos) es compatible con auto-deploy filtrado o con no
redespliegue; **no distingue** entre ambas.

**Recomendación:** mantener **bloqueada** la promoción a `main` (y, por precaución, a `production`) mientras no se resuelvan: destino de
`NEXT_PUBLIC_API_URL` en Preview/Production, ajuste de Auto-Deploy del servicio Render, B1 de D10, `ADMIN_USER_IDS` en el servicio y el
checksum de la migración 5. No se autoriza ni se ejecuta ningún release.

## 7. Consultas pendientes

**Metadatos aún consultables en paneles (sin autorización adicional más allá de acceso de lectura):**
1. Render → servicio `srv-d6ps41v5r7bs73dvrudg` → *Settings*: **Branch**, **Auto-Deploy** (Yes/No/After CI checks), *Build Filters* (paths).
2. Render → *Events/Deploys*: lista de despliegues (SHA, rama, fecha, resultado); ¿aparecen `944eb67`, `ed4bb64`, `0978402`?
3. Render → *Environment*: **solo nombres** presentes de `DATABASE_URL`, `ADMIN_USER_IDS`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `AUTH_ACCEPT_LEGACY_TOKENS`, `IDEMPOTENCY_KEY_ENFORCEMENT`, `SECURITY_CONFIG_MODE`, `FRONTEND_URL`, OAuth. No abrir valores.
4. Vercel → proyecto `anclora-impulso` → *Settings → Environment Variables*: para `NEXT_PUBLIC_API_URL`, qué **scopes** la tienen
   (Production / Preview / Development) y si el hostname del scope Preview es el de Render; anotar solo `COINCIDE / NO COINCIDE`.
5. Render → recursos vinculados (nombre y entorno de la instancia de BD visible, sin abrir la URL).

**Requieren autorización aparte (acceso a la base de datos):** `SELECT migration_name, checksum, finished_at FROM _prisma_migrations …`
para confirmar qué migraciones y qué checksum de la migración 5 están aplicados — *PROPUESTO, NO EJECUTADO*. No se piden credenciales por chat.

## 8. Confirmación de alcance

- Acciones de despliegue/configuración: **ninguna**.
- Peticiones al frontend/backend: **ninguna**.
- Consultas a bases de datos/migraciones: **ninguna**.
- Cambios en ramas, variables, servicios o repositorio remoto: **ninguno** (solo este informe y una línea en `INDEX.md`; sin commit).
- **Consultado:** lecturas locales del repositorio (`grep` de `onrender`, `git log` de `70fd1d4`, rango `70fd1d4..77f852aa` sobre `backend/`),
  informes 18 y 19, y los metadatos de despliegues de Vercel ya obtenidos en la auditoría 19 (~11:35–11:40 UTC).
- **No inspeccionado deliberadamente:** valores de variables de Vercel o Render (incluida `NEXT_PUBLIC_API_URL`, por la razón del §1),
  proyectos genéricos `api`/`web`/`frontend`, bases de datos, logs de aplicación, el panel de Render (sin acceso).
