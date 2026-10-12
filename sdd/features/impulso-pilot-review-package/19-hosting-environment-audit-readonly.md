# 19 — Auditoría de solo lectura del hosting de Anclora Impulso (2026-10-12)

> Auditoría **exclusivamente de lectura**. No es una aprobación de release; no cambia ninguna tarea AI-xx ni gate G1–G4.
> Fuente única de control plane consultada: **Vercel (metadatos de proyectos y despliegues, API de solo lectura)**. No hay evidencia de
> ningún otro proveedor (backend, base de datos) accesible desde esta sesión.
> Etiquetas: **OBSERVADO** (visto ahora en el control plane) · **REPORTADO PREVIAMENTE** (del contexto, no vuelto a ver) · **INFERENCIA**.

## A. Resultado ejecutivo

**Estado: `INDETERMINADO`** (con un hallazgo firme de riesgo de ejecución, ver abajo).

- **OBSERVADO:** la rama `staging` **sí activa despliegues**. El proyecto Vercel `anclora-impulso` está conectado por Git a
  `ToniIAPro73/anclora-impulso` y desplegó `staging` en `944eb67` y en `ed4bb64` el 12-oct (estado READY) — además de `development`,
  `production` y `main`. «Staging» es un **entorno de despliegue real (preview de Vercel)**, no solo una rama.
- **OBSERVADO:** el despliegue de **producción de Vercel corresponde a `main`** (target `production`, último: `77f852aa`, 2026-10-03). Las
  ramas `staging` y `production` se despliegan como *preview*, no como producción. Es decir, **el último paso de promoción
  (`production → main`) es el que actualiza el sitio de producción**.
- **No determinable con este acceso:** a qué base de datos y a qué API/backend apuntan esos despliegues (variables de entorno no
  abiertas por seguridad; el backend Express no aparece como proyecto Vercel inequívoco). Por tanto no se puede confirmar
  `AISLAMIENTO CONFIRMADO` ni `RIESGO DE CRUCE`.
- **Despliegues que ejecutan código nuevo:** sí hay despliegues READY de `944eb67`/`ed4bb64` (staging y development) y de `0978402`
  (development). Son **frontend Next.js**; **si** sus variables apuntan a un API/BD de producción, ese frontend nuevo hablaría con un
  backend cuyo esquema no se pudo verificar (ver D). No hay evidencia de que un backend con las migraciones nuevas se haya
  desplegado.

## B. Matriz de servicios y entornos

| Proveedor/proyecto | Servicio | Entorno | Rama | SHA desplegado | Último despliegue (UTC) | Estado | DB/proyecto visible | ADMIN_USER_IDS | Evidencia |
|---|---|---|---|---|---|---|---|---|---|
| Vercel / `anclora-impulso` (framework nextjs) | frontend Next.js (tipo LAMBDAS: funciones de las rutas Next) | **Production** (target `production`) | `main` | `77f852aa3a1c…` | 2026-10-03 13:49:36 | READY, candidato a rollback | DESCONOCIDO | no verificable | OBSERVADO: `dpl_3HXgVHYRdRUdhuxu7LczntJ3xXon` |
| idem | frontend | Preview | `production` | `77f852aa…` | 2026-10-03 13:49:14 | READY | DESCONOCIDO | no verificable | OBSERVADO: `dpl_7riJGZiKtTmEqPqMrK7YZppD78CW` |
| idem | frontend | Preview (alias `anclora-impulso-git-staging-…`) | `staging` | `ed4bb640a72d…` | 2026-10-12 07:42:01 (build 07:42:06, ready 07:43:02) | READY | DESCONOCIDO | no verificable | OBSERVADO: `dpl_3zEU3dhSWeC2opAw7LBHqcXGqSMV` |
| idem | frontend | Preview | `staging` | `944eb67d3577…` | 2026-10-12 07:09:21 | READY | DESCONOCIDO | no verificable | OBSERVADO: `dpl_3zPaNtwWeMBRUd69pKTQPALtNaUC` |
| idem | frontend | Preview | `development` | `097840203807…` (`0978402`) | 2026-10-12 10:41:27 | READY | DESCONOCIDO | no verificable | OBSERVADO: `dpl_3fQ2XFhwnyYnNfUovRvyacFcq1hJ` |
| idem | frontend | Preview | `development` | `ed4bb640…` / `944eb67…` / `ebfc7079…` | 07:39:13 / 07:06:40 / 06:55:27 | READY | DESCONOCIDO | no verificable | OBSERVADO |
| ¿Backend Express (API)? | **DESCONOCIDO** | — | — | — | — | — | DESCONOCIDO | no verificable | `DEPLOY.md` (Railway/Render) y `PRODUCTION_RUNTIME.md` (Vercel Serverless) discrepan; en Vercel existen proyectos de nombre genérico (`api`, `web`, `frontend`) que **no se pueden atribuir** a Impulso sin abrirlos: se detiene aquí |
| Neon / BD de producción | — | — | — | — | — | — | no consultado (sin acceso y sin conexión permitida) | — | `PRODUCTION_RUNTIME.md` (REPORTADO PREVIAMENTE) |

Identificadores: equipo Vercel `pmi140979-6354s-projects`, proyecto `prj_Wz4XhLOySqymCrbyl9DRMrc1Yo4J`. Un único proyecto Vercel con nombre
Impulso (búsqueda por nombre y listado de 43 proyectos del equipo).

## C. Promociones previas (secuencia observada)

| Fecha (UTC) | Evento de ref (GitHub, REPORTADO por `gh`) | Build/despliegue Vercel (OBSERVADO) |
|---|---|---|
| 2026-10-12 06:55 | push de `ebfc707` a `development` | despliegue `development` READY 06:55:27 |
| 2026-10-12 07:06–07:09 | `944eb67` a `development`; *Promote* → `staging` 07:09:06 | `development` 07:06:40; **`staging` 07:09:21 READY** |
| 2026-10-12 07:39–07:42 | `ed4bb64` a `development`; *Promote* → `staging` 07:41:48 | `development` 07:39:13; **`staging` 07:42:01 READY** |
| 2026-10-12 10:41 | `0978402` a `development` (este incremento) | `development` 10:41:27 READY |
| 2026-10-03 13:33–13:49 | *Promote* x3 de `77f852a` (staging → production → main) | `development` 13:33; `staging` 13:48:21; `production` 13:49:14; **`main` 13:49:36 target production READY** |
| 2026-09-25 | `c75cdbc`, `444d472` a `main` | despliegues `main` target production READY (11:25 y 06:11) |

Cada promoción de rama produjo build **y** despliegue READY pocos segundos después del cambio de referencia (rama→build→despliegue).
**No hay evidencia en este control plane de tráfico real de usuarios** sobre los despliegues de preview: solo se observan builds/deployments.

## D. Migraciones y compatibilidad

| Entorno | ¿Evidencia de migraciones aplicadas? | Migración/checksum visible | Compatibilidad |
|---|---|---|---|
| Vercel Production (`main`@`77f852aa`) | Vercel no ejecuta migraciones de Prisma; no hay metadato de BD | ninguno | **NO VERIFICABLE** (el código de producción es el de la línea base, anterior a las 6 migraciones) |
| Vercel Preview `staging` (`944eb67`, `ed4bb64`) | ninguna | ninguno | **NO CONFIRMADO**: es frontend; no depende por sí mismo del esquema, pero **si** el frontend apunta a un backend con código nuevo y sin migraciones, fallaría (D10 §2: backend nuevo + esquema antiguo rompe) |
| Backend Express | no localizado | — | **NO VERIFICABLE SIN CONSULTA AUTORIZADA** |

- **Migración 5 (`20261012050000_add_idempotency_quota_reservation`, checksum local `4becd718…039ece`):** editada tras aplicarse una vez en la
  BD local de pruebas. **NO VERIFICABLE SIN CONSULTA AUTORIZADA** si algún otro entorno aplicó la versión anterior: Vercel no lo registra y la
  BD no se consultó. Ausencia de evidencia ≠ no aplicada.

## E. Incertidumbres y bloqueos

| # | Pregunta abierta | Evidencia que falta | Consulta mínima |
|---|---|---|---|
| 1 | ¿Dónde corre el backend Express y quién lo despliega? | proyecto/servicio del API | **Metadatos de hosting:** abrir el panel del proveedor del backend (Railway/Render/otro proyecto Vercel) y anotar nombre, rama y SHA; no variables |
| 2 | ¿A qué API apuntan los previews de `staging`/`development`? | nombre (no valor) de `NEXT_PUBLIC_API_URL` por scope Preview/Production | **Metadatos con riesgo de exponer valores:** solo comprobar *presencia* del nombre por scope; no abrir valores (consulta autorizada por Toni) |
| 3 | ¿A qué proyecto/instancia de BD apunta cada servicio? | etiqueta de proyecto Neon asociada al backend | **Autorización adicional:** metadatos del backend; no la cadena de conexión |
| 4 | ¿Se aplicaron migraciones y con qué checksum (migración 5)? | filas de `_prisma_migrations` | **Requiere acceso a BD autorizado**: `SELECT migration_name, checksum, finished_at FROM _prisma_migrations ORDER BY 1;` — **PROPUESTO, NO EJECUTADO** |
| 5 | ¿`ADMIN_USER_IDS` presente en el backend de producción? | lista de nombres de variable del servicio backend | metadatos del backend (presencia solamente) |
| 6 | ¿Hubo tráfico real a los previews de staging? | analítica/logs de Vercel | metadatos de Vercel (solo agregados) |
| 7 | Contrato de producción discrepante (B1) | decisión del propietario | decisión de Toni |

No se pidieron credenciales. Si hace falta comprobar datos, solo se deja el procedimiento propuesto.

## F. Recomendación de release

- **No considerar `staging` aislado.** Es un despliegue real (preview Vercel) cuyo destino de API/BD no está demostrado.
- Mientras no se resuelvan los puntos 1–3, **bloquear cualquier promoción adicional**: en particular **`main` desplegaría producción de
  Vercel** con el frontend nuevo (flujo OAuth con canje de código, cabecera `Idempotency-Key`, refresco silencioso) frente a un backend
  cuyo estado de esquema/código es desconocido. Con backend antiguo, el login OAuth fallaría de forma segura (no existe
  `/auth/oauth/exchange`), pero eso es una regresión de producto visible.
- No recomendar migrar ni desplegar backend hasta resolver B1, confirmar `ADMIN_USER_IDS` y el checksum de la migración 5 (D, E.4–E.5).
- Revisar, antes de nada, si los despliegues de `staging` del 12-oct deben considerarse un incidente (frontend nuevo sobre servicios
  compartidos) o inocuos; depende de E.2.

## Cierre

- **Acciones ejecutadas: ninguna (auditoría de solo lectura).**
- **Cambios realizados: ninguno** en hosting, repositorio remoto, ramas, variables ni bases de datos. Único cambio en disco: este informe
  (y una línea en `INDEX.md`).
- **Consultado (solo lectura, ~11:35–11:40 UTC, 2026-10-12):** lista de equipos de Vercel; lista de proyectos del equipo (incluida búsqueda
  por nombre `impulso`); listado de despliegues del proyecto `anclora-impulso` (15 más recientes: id, rama, SHA, estado, target, fecha);
  detalle de un despliegue (`dpl_3zEU3dhSWeC2opAw7LBHqcXGqSMV`: tipo, alias, estado, tiempos). Previamente en la sesión: `gh run list`
  del workflow *Promote*.
- **Deliberadamente no inspeccionado:** variables de entorno (de ningún proyecto), configuración de proyecto que pudiera mostrar valores
  (`get_project` no se llamó), URLs de conexión, secretos, proyectos genéricos `api`/`web`/`frontend`, bases de datos, tráfico y logs
  de usuarios. No se hicieron peticiones a los dominios desplegados.
