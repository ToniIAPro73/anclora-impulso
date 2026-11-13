# Anclora Impulso — Aceptación Visual Final UI/UX (cierre de evidencias, pasada 3)

**Fecha:** 2026-11-13
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso` (`development`, cambios locales sin commit)
**Estado final:** `UI_UX_FINAL_REVIEW_PASS` — con las salvedades de §8 (comprobaciones `NOT_RUN`) y §9 (observaciones P2 abiertas)
**Revisión externa:** `UI_UX_PASS3_APPROVED_FOR_DEVELOPMENT`
**Índice de evidencias:** [INDEX.md](evidence/ui-ux-pass2/INDEX.md)

Este documento sustituye a la versión de la segunda pasada. Aquella declaraba `PASS` sobre evidencia que la revisión
externa del paquete `Anclora_Impulso_UI_UX_Pass2.zip` invalidó. Esta pasada rehace la evidencia y corrige únicamente
los defectos reales que aparecieron al comprobarla.

Leyenda: **PASS** verificado · **FAIL** defecto abierto · **BLOCKED** no ejecutable por una restricción ·
**NOT_RUN** no ejecutado.

---

## 1. Respuesta a las deficiencias de la revisión externa

| # | Deficiencia | Resultado | Estado |
|---|---|---|---|
| 1 | `after/nutrition-desktop-dark.png` solo mostraba «Cargando...» | **Captura prematura.** No hay defecto de hidratación, autenticación ni API (ver §2). Recapturada con la página cargada | PASS |
| 2 | Parejas BEFORE/AFTER no comparables | Todas regeneradas con el mismo viewport, DPR, tema, identidad, datos y backend (ver §3) | PASS |
| 3 | Admin Content sin evidencia visual | Capturado con fixtures locales, sin elevar permisos. Aparecieron 5 defectos reales, corregidos (ver §4) | PASS |
| 4 | Interacciones declaradas sin probar | Probadas en navegador; 5 defectos reales corregidos (ver §5) | PASS con `NOT_RUN` en §8 |
| 5 | Zoom 150 % / 200 % no aplicado realmente | Reflow validado con viewport equivalente; 1 defecto bloqueante corregido (ver §6) | PASS |

---

## 2. Nutrición: diagnóstico de «Cargando...»

| Hipótesis | Comprobación | Conclusión |
|---|---|---|
| Captura prematura | Muestreo del DOM a 1,3 s / 2,5 s / 3,7 s / 4,9 s / 6,2 s tras navegar: a 1,3 s solo está el loader del guard de sesión; desde 2,5 s la página está completa y estable | **Causa** |
| Problema de hidratación | 0 errores de página; consola sin errores ni avisos de hidratación | Descartado |
| Problema de autenticación | `GET /api/auth/me` 200, `GET /api/profile` 200 | Descartado |
| Petición API pendiente | `GET /api/nutrition/meal-plans`, `/summary?period=day`, `/logs?period=day`: las tres 200 | Descartado |
| Error real de frontend | Ningún error en consola ni peticiones 4xx/5xx de la aplicación | Descartado |

El loader es el guard de autenticación a pantalla completa, visible mientras resuelve `/auth/me`; en `next dev` la
primera compilación de la ruta alarga esa ventana. La captura anterior se disparó dentro de ella. Como el loader no era
un defecto, **no se ha tocado el código por este motivo ni se ha añadido test**: se ha corregido el método de captura
(espera de `networkidle`, fuentes, ausencia de loader y de spinners; ver INDEX §1).

Único ruido observado: `POST /api/csp-report` con `disposition: "report"` sobre scripts de `next dev`. Es CSP en modo
informe, propio del servidor de desarrollo, idéntico en `HEAD`; no afecta a la página.

**Defecto real encontrado al ver Nutrición cargada:** la señal «Riesgo de estancamiento» mostraba el literal `low`. El
valor llega en crudo desde la API dentro de `explanation.signals` y se pintaba tal cual en Nutrición, Panel, Progreso y
detalle de entrenamiento. Corregido en frontend (`lib/explanation-signals.ts`), con test de regresión.

---

## 3. Matriz BEFORE / AFTER

BEFORE es el código de `HEAD` (`fbc2f4d`) y AFTER el árbol de trabajo, ambos en local contra el mismo backend y la
misma identidad QA. No se ha modificado ningún registro para obtener una captura.

| Escenario | Viewport · tema | BEFORE | AFTER | Estado |
|---|---|---|---|---|
| Login + cookies | 1440×900 · oscuro | Modal con velo; `Iniciar Sesión` no clicable | Banner compacto; submit clicable | PASS |
| Login + cookies | 390×844 · oscuro | Mismo bloqueo | Banner inferior; submit clicable | PASS |
| Onboarding | 1440×900 · oscuro | Modal sobredimensionado, check verde al 0 % | `max-w-4xl`, icono de usuario al 0 % | PASS |
| Onboarding | 390×844 · oscuro | Pie solapado sobre opciones | Cuerpo con scroll, pie separado | PASS |
| Dashboard | 1440×900 · oscuro y claro | Tarjetas forzadas a oscuro en tema claro; señal `low` | Tarjetas en tema claro; `Bajo` | PASS |
| Progreso | 1440×900 · oscuro y claro | `Mejor PR: 0 kg`, riesgo `Bajo` sin datos | `--`, `Sin datos` | PASS |
| Nutrición | 1440×900 · oscuro y claro | Cargada; `low` | Cargada; `Bajo` | PASS |

---

## 4. Admin Content

**Método.** API de fixtures local sin base de datos e identidad `admin@fixture.local` simulada solo en el navegador.
La cuenta QA no ha recibido permisos y no se ha usado ninguna identidad administrativa real. Esto valida el
**renderizado y el comportamiento de la interfaz**; no valida datos reales ni la autorización del servidor.

| Comprobación | Resultado | Estado |
|---|---|---|
| Títulos | Dos líneas con `line-clamp-2`; un título sin espacios ya no se recorta | PASS (tras corrección) |
| Etiquetas y badges | Estados editoriales y de entrega localizados; 0 literales crudos en la página | PASS (tras corrección) |
| Filtros | Estado, incidencia y orden filtran y ordenan como se espera; ahora tienen nombre accesible | PASS (tras corrección) |
| Búsqueda | `plancha` → 1 resultado | PASS |
| Botones | Selección → barra masiva; acción masiva deshabilita los botones mientras envía; `Despachar ahora` muestra el error | PASS |
| Editor | Abrir con teclado, foco atrapado, `Escape`, `Cancelar`, `Guardar` con estado de carga, foco de vuelta a `Editar` | PASS (tras corrección) |
| Overflow escritorio | `scrollWidth = 1440`, 0 elementos fuera | PASS |
| Overflow móvil | `scrollWidth = 390`, 0 elementos fuera | PASS (tras corrección) |

**Defectos reales encontrados y corregidos**

1. **Literales crudos.** Los badges mostraban `ready` / `review` / `needs_work`, los filtros y botones masivos `ready`
   y `review`, y las entregas `sent` / `failed` / `pending`. La pasada anterior lo daba por resuelto, pero su test usaba
   un fixture con una forma distinta a la de la API real (y un mock con el nombre de método equivocado), así que no
   ejercitaba esos nodos.
2. **Cola recortada en móvil.** A 390 px las tarjetas desbordaban y quedaban recortadas: checkbox, puntuación y
   `Editar` eran inalcanzables.
3. **Editor roto en móvil.** Campos solapados entre sí y contenido recortado por la derecha en ambos editores.
4. **Foco perdido.** Al cerrar el editor el foco caía en `<body>`.
5. **Controles sin nombre accesible.** Los tres selectores y los checkboxes de fila.

---

## 5. Interacciones verificadas

Probadas en navegador real. «QA» = identidad QA en local, solo lectura. «Fixtures» = API de fixtures local.

| Interacción | Origen | Resultado | Estado |
|---|---|---|---|
| Login por clic con el banner visible | QA | Navega a `/dashboard` | PASS |
| Login con credenciales erróneas | Identidad inexistente | Aviso `Email o contraseña incorrectos`; el formulario sigue operable | PASS |
| Login con campos vacíos | Anónimo | Bloqueado por validación nativa | PASS |
| Banner de cookies: rechazar opcionales | QA | Persiste la elección y desaparece | PASS |
| Preferencias de cookies: abrir, tabular, `Escape`, guardar | QA | Foco dentro, `Tab` atrapado, cierre y foco de vuelta al botón flotante | PASS (tras corrección) |
| Onboarding: abrir, `Escape`, `X`, `Más tarde`, reabrir desde `Completar onboarding` | QA + Fixtures | Cierra y devuelve el foco al disparador cuando existe | PASS (tras corrección) |
| Onboarding: pasos, `Atrás`, conservación de valores | Fixtures | Avanza y retrocede sin perder datos | PASS |
| Onboarding: guardar | Fixtures | `Guardando...` deshabilitado y cierre | PASS |
| Onboarding: fallo al guardar | Fixtures | Aviso visible, modal abierto, reintento correcto | PASS (tras corrección) |
| Perfil: abrir desde el menú, `Escape`, `Cancelar` | Fixtures | Cierra; el foco vuelve al botón del menú | PASS (tras corrección) |
| Perfil: guardar y fallo al guardar | Fixtures | Estado de carga; aviso visible en el fallo | PASS (tras corrección) |
| Nutrición: `Registrar Comida` abrir, `Escape`, `X` | QA | Abre y cierra; foco de vuelta al botón | PASS |
| Navegación lateral (7 rutas) | QA | Todas cargan sin errores de página ni de consola | PASS |
| Móvil: menú lateral, navegación, diálogo de comida, pie del onboarding | QA | Operables; sin scroll horizontal | PASS |
| Teclado a 150 % y 200 % | QA | Cada parada de `Tab` visible y con indicador de foco | PASS |

**Defectos reales encontrados y corregidos**

1. **Fallo de guardado silencioso en Onboarding y en Perfil.** `handleSave` tenía `try/finally` sin `catch`: si la API
   fallaba, el botón se reactivaba sin decir nada. Ahora se muestra un aviso con `role="alert"` y se conservan los
   datos.
2. **Foco perdido al cerrar modales sin disparador.** Radix solo devuelve el foco a un `DialogTrigger`; los diálogos
   abiertos por estado lo dejaban en `<body>`. Corregido en el primitivo `components/ui/dialog.tsx` y, para Perfil
   (que se abre desde un ítem de menú que se desmonta), en `dashboard-user-menu.tsx`.
3. **Preferencias de cookies sin gestión de foco.** Declaraba `aria-modal="true"` pero no movía ni atrapaba el foco.
   Además, con una elección ya guardada, `Escape` y `Volver` volvían a mostrar el banner de consentimiento, y al
   volver al banner pendiente el foco caía en `<body>`. Ahora el foco regresa al control que abrió las preferencias.
4. **Campos de Onboarding sin nombre accesible** (tres selectores y siete campos de texto).

---

## 6. Zoom y responsive

Mecanismo reproducible: viewport CSS equivalente sobre una ventana de 1440×900 (150 % → 960×600 @1.5x; 200 % →
720×450 @2x). Detalle y comandos en INDEX §1.

| Vista | 150 % | 200 % |
|---|---|---|
| Login + cookies | PASS — `scrollW=960`, submit clicable | PASS — `scrollW=720`, submit clicable |
| Onboarding | PASS — pie alcanzable | PASS (tras corrección) — el modal completo hace scroll |
| Dashboard, Progreso, Nutrición | PASS — sin scroll horizontal, 0 elementos fuera | PASS — sin scroll horizontal, 0 elementos fuera |
| Admin Content y su editor | PASS | PASS — todos los controles alcanzables |
| Perfil, `Registrar Comida`, preferencias de cookies | NOT_RUN | PASS — todos los controles alcanzables |
| Foco de teclado | PASS — visible y con indicador | PASS — visible y con indicador |

**Defecto real encontrado y corregido.** A 200 % el onboarding dejaba `Más tarde` y `Continuar` fuera del modal: la
cabecera consumía toda la altura, el cuerpo con scroll quedaba en 0 px y el pie caía bajo un contenedor con
`overflow: hidden`. Las opciones del paso tampoco eran visibles. Ahora, por debajo de 640 px de alto, el modal entero
hace scroll. Verificado además en 640×360, 960×600, 390×844, 1440×900 y 1440×500.

Otros viewports: tablet 768×1024 y móvil 390×844 sin scroll horizontal en Dashboard, Progreso y Nutrición.

---

## 7. Tests ejecutados

| Comando | Resultado |
|---|---|
| `npm run typecheck` (aplicación y tests incluidos en `__tests__/tsconfig.json`, que ahora incluye los tests nuevos) | PASS |
| `npm run lint` | PASS — sin avisos ni errores |
| `npm run test:ci` | PASS — 33/33 suites, 189/189 tests |
| Tests focales (Admin, modales, Perfil, Onboarding, cookies, señales) | PASS — 7 suites, 29 tests |
| Revalidación visual tras los últimos cambios (diferencia de píxeles contra la evidencia guardada) | 0 % en login, dashboard, nutrición, onboarding móvil, onboarding a 200 % y Admin; 0,09 % en onboarding de escritorio |
| Tests unitarios de backend | NOT_RUN — sin cambios en `backend/`; el PASS de 27 suites / 240 tests es el declarado en la pasada anterior y no se ha vuelto a comprobar |
| Suites de integración de backend | NOT_RUN — requieren PostgreSQL aislado y Docker está parado; sin cambios en `backend/` |

Tests de regresión añadidos o ampliados en esta pasada:

- `__tests__/lib/explanation-signals.test.ts` — señales sin literales crudos.
- `__tests__/components/admin-content.test.tsx` — fixture con la forma real de la API; estados localizados, nombres
  accesibles, cuerpo del editor con scroll, títulos que rompen línea.
- `__tests__/components/dialog-focus-return.test.tsx` — foco de vuelta al cerrar con `Escape` y con `X`.
- `__tests__/components/onboarding-dialog-feedback.test.tsx` — aviso de error, nombres accesibles, scroll en
  viewports bajos.
- `__tests__/components/profile-dialog-feedback.test.tsx` — aviso de error al fallar el guardado.
- `__tests__/components/dashboard-user-menu-focus.test.tsx` — foco de vuelta al botón del menú al cerrar Perfil.
- `__tests__/components/cookie-consent-focus.test.tsx` — foco dentro, `Tab` atrapado, semántica de `Escape` y de `Volver`.

---

## 8. Bloqueos y comprobaciones no ejecutadas

| Elemento | Estado | Motivo |
|---|---|---|
| Admin Content con identidad administrativa real y datos reales | NOT_RUN | Se optó por fixtures locales; no se dispone de una identidad admin autorizada para QA. La autorización del servidor no se ha comprobado |
| Guardado real contra la API (onboarding, perfil, registro de comida, generar plan) | NOT_RUN | El entorno local escribe en la base de datos de producción; se ejercitó la misma interfaz contra fixtures |
| Estado de carga del botón de login | NOT_RUN | La respuesta local llega antes de poder observarlo |
| `Generar plan` (Nutrición) y generación de entrenamiento | NOT_RUN | El botón está deshabilitado con el perfil QA incompleto; generar escribiría en producción |
| `/workouts/[id]` con la señal localizada | NOT_RUN | La cuenta QA no tiene entrenamientos; cubierto por el test del helper compartido |
| Rutas `/auth/signup`, `/auth/forgot-password`, `/landing`, `/legal`, `/privacy`, `/terms`, `/nutrition/meal-plans/[id]`, `/workouts/[id]/start` | NOT_RUN | Fuera del alcance de este cierre |
| Interfaz en inglés | NOT_RUN | Solo se ha comprobado en español |
| Navegadores distintos de Chromium y dispositivos táctiles reales | NOT_RUN | Las pruebas móviles son por viewport |
| Capturas BEFORE contra `https://impulso.anclora.com` | BLOCKED | Requieren iniciar sesión con contraseña en producción; se sustituyeron por `HEAD` en local, que además hace válida la comparación |

No queda ningún **FAIL** abierto.

---

## 9. Observaciones P2 abiertas (no bloqueantes, sin corregir)

1. Con las cookies sin decidir, el onboarding se abre encima del banner y este queda atenuado e inerte hasta cerrar
   el modal.
2. La señal «Riesgo de estancamiento» de la recomendación muestra `Bajo` aunque no haya datos: la API no informa de
   si hay datos suficientes. Requiere cambio de backend.
3. Admin: «En revisión» y «Necesita revisión» son etiquetas muy parecidas, y la tarjeta superior dice «Necesitan
   trabajo» para el mismo estado. Categoría, grupo muscular, equipamiento y nombres de evento siguen en inglés técnico.
4. Admin: el editor ocupa 1280×868 en escritorio con mucha superficie vacía; el bloque «Notificaciones operativas»
   queda apretado en la columna derecha; en móvil el título de cada tarjeta dispone de poco ancho.
5. `ProfileDialog` y la etiqueta `Cerrar` del primitivo de diálogo están solo en español.
6. Los botones `Cancelar` / `Guardar` de Perfil miden 32 px de alto en móvil y los del pie del onboarding 36 px, por
   debajo de los 44 px recomendados para táctil.
7. Las opciones de objetivo del onboarding no exponen su estado seleccionado (`aria-pressed`).

La octava observación de la lista original era documental (`UI_UX_PREMIUM_AUDIT_AND_REFINEMENT.md` desactualizado) y
quedó **cerrada** al reconciliar ese informe. Siguen abiertas las siete anteriores; su clasificación está en
[UI_UX_PASS3_DELIVERY_REPORT.md](UI_UX_PASS3_DELIVERY_REPORT.md).

---

## 10. Archivos modificados en esta pasada

**Código**

- `lib/explanation-signals.ts` (nuevo)
- `app/nutrition/page.tsx`, `app/workouts/[id]/page.tsx`
- `components/dashboard-content.tsx`, `components/progress-tracker.tsx`
- `app/admin/content/page.tsx`
- `components/ui/dialog.tsx`
- `components/onboarding-dialog.tsx`, `components/profile-dialog.tsx`, `components/dashboard-user-menu.tsx`
- `components/cookie-consent.tsx`

**Tests**

- `__tests__/tsconfig.json`
- `__tests__/lib/explanation-signals.test.ts` (nuevo)
- `__tests__/components/admin-content.test.tsx`
- `__tests__/components/dialog-focus-return.test.tsx` (nuevo)
- `__tests__/components/onboarding-dialog-feedback.test.tsx` (nuevo)
- `__tests__/components/profile-dialog-feedback.test.tsx` (nuevo)
- `__tests__/components/dashboard-user-menu-focus.test.tsx` (nuevo)
- `__tests__/components/cookie-consent-focus.test.tsx` (nuevo)

**Documentación y evidencias**

- `docs/sdd/UI_UX_FINAL_VISUAL_ACCEPTANCE.md`, `docs/sdd/UI_UX_PREMIUM_AUDIT_AND_REFINEMENT.md`, `docs/sdd/UI_UX_PASS3_DELIVERY_REPORT.md`
- `docs/sdd/evidence/ui-ux-pass2/INDEX.md`
- `docs/sdd/evidence/ui-ux-pass2/before/**`, `after/**` (regeneradas)
- `docs/sdd/evidence/ui-ux-pass2/fixtures/**`, `capture-metadata.txt` (nuevos)

Sin cambios en `backend/`, migraciones, Neon, contratos `.anclora/` ni despliegues. Sin commit ni push.

---

## 11. Conservación del estilo

No se han tocado tokens, paleta, tipografía ni gradientes. Los cambios son de comportamiento (foco, avisos de error,
scroll), de texto (localización de estados) y de contención de layout en Admin y Onboarding.

---

## 12. Recomendación

**Estado:** `UI_UX_FINAL_REVIEW_PASS`. Nutrición carga completa y no queda ningún defecto bloqueante abierto.

**Recomendación:** apto para publicar en `development` cuando el propietario lo valide y lo autorice con
`commit y push ok`. Antes de autorizar conviene revisar en local dos cambios de comportamiento compartido, porque
afectan a todos los modales: la devolución de foco en `components/ui/dialog.tsx` y el scroll del onboarding en
viewports bajos. Las comprobaciones `NOT_RUN` de §8 y las observaciones de §9 quedan pendientes de decisión.
