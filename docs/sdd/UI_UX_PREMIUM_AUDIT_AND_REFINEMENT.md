# Anclora Impulso — Auditoría y Refinamiento Premium UI/UX (Pass 1–3)

**Fecha:** 2026-11-13
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso`
**Rama:** `development` · **SHA base:** `fbc2f4d8d95e54c473c638195f53fd0bce8830c8` (= `origin/development`)
**Estado:** `UI_UX_PASS3_APPROVED_FOR_DEVELOPMENT` (revisión externa) · cambios locales sin commit ni push

Documentos relacionados:

- Aceptación visual y detalle de comprobaciones: [UI_UX_FINAL_VISUAL_ACCEPTANCE.md](UI_UX_FINAL_VISUAL_ACCEPTANCE.md)
- Índice de evidencias y método de captura: [evidence/ui-ux-pass2/INDEX.md](evidence/ui-ux-pass2/INDEX.md)
- Informe de entrega y backlog P2: [UI_UX_PASS3_DELIVERY_REPORT.md](UI_UX_PASS3_DELIVERY_REPORT.md)

Este documento es el resumen consolidado de las tres pasadas. Sustituye a la versión de la segunda pasada, cuyo
inventario y varias afirmaciones quedaron superados (ver §8).

---

## 1. Alcance y separación de entregas

| Entrega | Contenido | Estado |
|---|---|---|
| **A — Cierre documental N1** | `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`, `docs/sdd/nutrition/M28_N1_PRODUCTION_ACCEPTANCE_FINAL.md`, `docs/sdd/nutrition/M28_PRODUCTION_EXECUTION_AND_N1_ACCEPTANCE.md` | N1 Commit y M28 ya aceptadas en producción; solo documentación, pendiente de commit |
| **B — Refinamiento UI/UX** | Código de frontend, tests de regresión, informes y evidencias | Aprobada para `development`, pendiente de commit |

La Entrega B no incluye cambios de backend, API, migraciones, infraestructura ni contratos AOS. No rediseña la marca.

---

## 2. Historia de las tres pasadas

| Pasada | Qué hizo | Resultado |
|---|---|---|
| **Pass 1** | Auditoría de las 22 rutas y de los primitivos compartidos; correcciones P0 y P1 | Correcciones aplicadas |
| **Pass 2** | Evidencia visual y declaración de `PASS` | **Invalidada por la revisión externa**: Nutrición mostraba solo el loader, las parejas BEFORE/AFTER no eran comparables, el zoom no se había aplicado y Admin no tenía evidencia visual |
| **Pass 3** | Evidencia rehecha con método reproducible; interacciones probadas en navegador; corrección de los defectos reales que aparecieron | `UI_UX_PASS3_APPROVED_FOR_DEVELOPMENT` |

---

## 3. Rutas

22 rutas `app/**/page.tsx`. La auditoría de código (Pass 1) las cubrió todas; la verificación en navegador (Pass 3)
cubrió las marcadas.

| Área | Rutas | Verificadas en navegador (Pass 3) |
|---|---|---|
| Entrada y auth (8) | `/`, `/landing`, `/auth/login`, `/auth/signup`, `/auth/signup-success`, `/auth/forgot-password`, `/auth/callback`, `/auth/error` | `/auth/login` |
| Usuario (10) | `/dashboard`, `/nutrition`, `/nutrition/meal-plans/[id]`, `/exercises`, `/workouts/generate`, `/workouts/[id]`, `/workouts/[id]/start`, `/progress`, `/achievements`, `/health-plans` | `/dashboard`, `/nutrition`, `/progress` en detalle; `/exercises`, `/workouts/generate`, `/achievements`, `/health-plans` solo carga y navegación |
| Admin y legal (4) | `/admin/content`, `/legal`, `/privacy`, `/terms` | `/admin/content` (con fixtures) |

Las rutas no marcadas constan como `NOT_RUN` en el documento de aceptación (§8).

---

## 4. Hallazgos y resoluciones

### 4.1 Pass 1–2

| Sev. | Componente | Problema | Resolución |
|---|---|---|---|
| P0 | `components/cookie-consent.tsx` | El aviso de cookies bloqueaba `Iniciar Sesión` | Tarjeta flotante no bloqueante con tres acciones equilibradas |
| P0 | `components/onboarding-dialog.tsx` | Pie solapado sobre las opciones en móvil; modal sobredimensionado; check verde con perfil al 0 % | `max-w-4xl`, cuerpo con scroll y pie separado, icono de usuario hasta el 100 % |
| P1 | `lib/ui-contracts.ts`, `components/ui/dialog.tsx` | Una regla anulaba `maxWidthClass`; botón de cierre pequeño y sin foco visible | Anulación eliminada, ancho por defecto `max-w-lg`, cierre de 32 px con `aria-label` y anillo de foco |
| P1 | `components/progress-tracker.tsx`, `components/dashboard-content.tsx` | Métricas engañosas sin datos (`0 kg`, riesgo `Bajo`); tres tarjetas forzadas a oscuro en tema claro | `--`, `Sin marca de peso`, `Sin datos`; tarjetas con tema claro |
| P1 | `components/profile-dialog.tsx` | Botón `Cerrar` duplicado, tildes ausentes, botones diminutos | Cierre único, tildes corregidas, botones `h-9` |
| P1 | `app/admin/content/page.tsx` | Literal `needs_work` en un selector y un botón; títulos truncados a una línea | Etiqueta localizada y `line-clamp-2` (**incompleto**, ver 4.2) |

### 4.2 Pass 3 — defectos reales encontrados al verificar

| Sev. | Componente | Problema | Resolución |
|---|---|---|---|
| P0 | `components/onboarding-dialog.tsx` | A 200 % de zoom `Más tarde` y `Continuar` quedaban fuera del modal | Por debajo de 640 px de alto el modal entero hace scroll |
| P1 | `app/admin/content/page.tsx` | Seguían en crudo `ready`, `review`, `needs_work` (badges, filtros, acciones masivas) y `sent`, `failed`, `pending` | Etiquetas localizadas en todos los puntos |
| P1 | `app/admin/content/page.tsx` | En móvil la cola se recortaba (checkbox y `Editar` inalcanzables) y los editores tenían campos solapados | Columnas que pueden encoger; cuerpo del editor con scroll |
| P1 | `components/onboarding-dialog.tsx`, `components/profile-dialog.tsx` | Un fallo al guardar no mostraba nada | Aviso con `role="alert"`, modal abierto, datos conservados, reintento |
| P1 | `components/ui/dialog.tsx`, `components/dashboard-user-menu.tsx` | Al cerrar un modal sin `DialogTrigger` el foco caía en `<body>` | El primitivo recuerda el elemento que lo abrió; Perfil devuelve el foco al botón del menú |
| P1 | `components/cookie-consent.tsx` | Preferencias con `aria-modal` pero sin mover ni atrapar el foco; con elección guardada, `Escape` y `Volver` reabrían el banner | Foco dentro, `Tab` atrapado, cierre completo si ya hay elección, foco devuelto al control de origen |
| P1 | `lib/explanation-signals.ts` (nuevo) y cuatro vistas | La señal «Riesgo de estancamiento» mostraba `low` | Helper compartido que localiza `low` / `medium` / `high` |
| P2 | `components/onboarding-dialog.tsx`, `app/admin/content/page.tsx` | Campos, selectores y checkboxes sin nombre accesible | `aria-label` en todos |

La captura de Nutrición con «Cargando...» **no era un defecto**: fue una captura prematura durante el guard de sesión.
Diagnóstico completo en el documento de aceptación (§2).

---

## 5. Sistema de diseño

No se han modificado tokens (`app/globals.css`), paleta, tipografía ni gradientes de marca. Los cambios son de
comportamiento (foco, avisos de error, scroll), de texto (localización de estados) y de contención de layout.

Cambios en primitivos compartidos que afectan a todos los modales:

- `components/ui/dialog.tsx`: ancho por defecto `max-w-lg` y devolución del foco al elemento que abrió el diálogo.
  Los siete consumidores actuales fijan su propio ancho y ninguno sobrescribe `onOpenAutoFocus` / `onCloseAutoFocus`.
- `lib/ui-contracts.ts`: `buildResponsiveModalClass` ya no anula el ancho máximo recibido.

---

## 6. Evidencia

Toda la evidencia vigente es la de Pass 3 y está en `docs/sdd/evidence/ui-ux-pass2/`:

- 11 parejas BEFORE/AFTER con el mismo viewport, DPR, tema, identidad, datos y backend. BEFORE es el código de `HEAD`
  servido en local; AFTER es el árbol de trabajo.
- Tema claro y oscuro; escritorio 1440×900, tablet 768×1024, móvil 390×844.
- Reflow a 150 % (960×600 @1.5x) y 200 % (720×450 @2x).
- Admin Content con una API de fixtures local e identidad simulada.
- Modales, errores de guardado y estados de carga.

El método, los comandos y los metadatos de cada captura están en el índice. Las capturas de Pass 1–2 (incluidas las que
se guardaron fuera del repositorio) ya no son válidas y no se referencian.

---

## 7. Verificación

Ejecutada sobre el estado final del árbol de trabajo:

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` (aplicación y tests incluidos en `__tests__/tsconfig.json`) | PASS |
| `npm run lint` | PASS |
| `npm run test:ci` | PASS — 32/32 suites, 189/189 tests |
| Revalidación visual tras los últimos cambios (diferencia de píxeles contra la evidencia guardada) | 0 % en login, dashboard, nutrición, onboarding móvil, onboarding a 200 % y Admin; 0,09 % en onboarding de escritorio |
| Tests de backend | NOT_RUN — sin cambios en `backend/` |

Tests de regresión de la Entrega B: `admin-content`, `dialog-focus-return`, `onboarding-dialog-feedback`,
`profile-dialog-feedback`, `cookie-consent-focus` (en `__tests__/components/`) y `explanation-signals` (en
`__tests__/lib/`). `__tests__/tsconfig.json` los incluye ahora en el typecheck de tests.

Limitaciones `NOT_RUN` y `BLOCKED`: ver documento de aceptación (§8). Las principales son Admin con identidad y datos
reales, los guardados reales contra la API (el entorno local escribe en producción), la interfaz en inglés y las rutas
no marcadas en §3.

---

## 8. Afirmaciones de versiones anteriores que quedan corregidas

| Afirmación anterior | Situación real |
|---|---|
| «`needs_work` localizado» en Admin | Solo en un selector y un botón; el resto se corrigió en Pass 3 |
| Reflow a 150 % y 200 % con `innerWidth=1440` | El zoom no se había aplicado; validado de verdad en Pass 3 |
| Capturas BEFORE de `https://impulso.anclora.com` | Sustituidas por `HEAD` en local para que la comparación sea válida |
| Evidencia en un directorio temporal del agente fuera del repositorio | Toda la evidencia vigente está en `docs/sdd/evidence/ui-ux-pass2/` |
| Admin Content «verificado por inspección de código» | Verificado en navegador con fixtures; no con identidad ni datos reales |
| Frontend `27/27` suites y `170/170` tests | `32/32` suites y `189/189` tests sobre el estado final |
| Backend unitario `27/27` suites y `240/240` tests | Declarado en Pass 2; no se ha vuelto a ejecutar porque `backend/` no cambia |

---

## 9. Observaciones P2 abiertas

Siete observaciones de producto siguen abiertas y no bloquean la publicación en `development`. La octava de la lista
original era documental (este informe estaba desactualizado) y queda cerrada con esta versión. El detalle, la
clasificación por impacto y esfuerzo y la propuesta de siguiente iteración están en el informe de entrega (§9).

---

## 10. Inventario de archivos

### Entrega A — documentación N1

- `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`
- `docs/sdd/nutrition/M28_N1_PRODUCTION_ACCEPTANCE_FINAL.md`
- `docs/sdd/nutrition/M28_PRODUCTION_EXECUTION_AND_N1_ACCEPTANCE.md`

### Entrega B — código

- `lib/ui-contracts.ts`, `lib/explanation-signals.ts` (nuevo)
- `components/ui/dialog.tsx`
- `components/cookie-consent.tsx`, `components/onboarding-dialog.tsx`, `components/profile-dialog.tsx`
- `components/dashboard-user-menu.tsx`, `components/dashboard-content.tsx`, `components/progress-tracker.tsx`
- `app/admin/content/page.tsx`, `app/nutrition/page.tsx`, `app/workouts/[id]/page.tsx`

### Entrega B — tests

- `__tests__/tsconfig.json`
- `__tests__/components/admin-content.test.tsx`
- `__tests__/components/dialog-focus-return.test.tsx`
- `__tests__/components/onboarding-dialog-feedback.test.tsx`
- `__tests__/components/profile-dialog-feedback.test.tsx`
- `__tests__/components/cookie-consent-focus.test.tsx`
- `__tests__/lib/explanation-signals.test.ts`

### Entrega B — documentación y evidencias

- `docs/sdd/UI_UX_PREMIUM_AUDIT_AND_REFINEMENT.md`
- `docs/sdd/UI_UX_FINAL_VISUAL_ACCEPTANCE.md`
- `docs/sdd/UI_UX_PASS3_DELIVERY_REPORT.md`
- `docs/sdd/evidence/ui-ux-pass2/INDEX.md`, `capture-metadata.txt`
- `docs/sdd/evidence/ui-ux-pass2/before/` (11 capturas), `after/` (57 capturas)
- `docs/sdd/evidence/ui-ux-pass2/fixtures/` (`server.mjs` y seis JSON)
