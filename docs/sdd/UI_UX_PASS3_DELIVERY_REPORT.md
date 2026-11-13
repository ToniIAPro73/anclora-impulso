# Anclora Impulso — Informe de Entrega UI/UX Pass 3

**Fecha:** 2026-11-13
**Repositorio:** `anclora-impulso` · **Rama:** `development`
**Estado:** `UI_UX_PASS3_PUBLISHED_DEVELOPMENT` · `UI_UX_PASS3_CI_PASS` · `UI_UX_P2_BACKLOG_OPEN` · `NO_PROMOTE`

Los commits A, B y C están publicados en `origin/development` (`f028a22`). La CI del primer push falló en un test de la
propia entrega; tras el commit C pasa completa, incluido el build (ver §3 y §4).

Documentos de detalle: [auditoría consolidada](UI_UX_PREMIUM_AUDIT_AND_REFINEMENT.md) ·
[aceptación visual](UI_UX_FINAL_VISUAL_ACCEPTANCE.md) · [índice de evidencias](evidence/ui-ux-pass2/INDEX.md)

---

## 1. SHA base

| Referencia | SHA |
|---|---|
| `HEAD` local | `fbc2f4d8d95e54c473c638195f53fd0bce8830c8` |
| `origin/development` (tras `git fetch`) | `fbc2f4d8d95e54c473c638195f53fd0bce8830c8` |

La rama local no va por delante ni por detrás del remoto. No hay cambios ajenos en el árbol de trabajo: todos los
archivos modificados pertenecen al Grupo A o al Grupo B.

---

## 2. Inventario

### Grupo A — documentación de cierre N1 (3 archivos)

- `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`
- `docs/sdd/nutrition/M28_N1_PRODUCTION_ACCEPTANCE_FINAL.md`
- `docs/sdd/nutrition/M28_PRODUCTION_EXECUTION_AND_N1_ACCEPTANCE.md`

### Grupo B — refinamiento UI/UX

**Código (12 archivos)**

- `lib/ui-contracts.ts`
- `lib/explanation-signals.ts` (nuevo)
- `components/ui/dialog.tsx`
- `components/cookie-consent.tsx`
- `components/onboarding-dialog.tsx`
- `components/profile-dialog.tsx`
- `components/dashboard-user-menu.tsx`
- `components/dashboard-content.tsx`
- `components/progress-tracker.tsx`
- `app/admin/content/page.tsx`
- `app/nutrition/page.tsx`
- `app/workouts/[id]/page.tsx`

**Tests (7 archivos)**

- `__tests__/tsconfig.json`
- `__tests__/components/admin-content.test.tsx` (nuevo)
- `__tests__/components/dialog-focus-return.test.tsx` (nuevo)
- `__tests__/components/onboarding-dialog-feedback.test.tsx` (nuevo)
- `__tests__/components/profile-dialog-feedback.test.tsx` (nuevo)
- `__tests__/components/cookie-consent-focus.test.tsx` (nuevo)
- `__tests__/lib/explanation-signals.test.ts` (nuevo)

**Documentación (3 archivos)**

- `docs/sdd/UI_UX_PREMIUM_AUDIT_AND_REFINEMENT.md`
- `docs/sdd/UI_UX_FINAL_VISUAL_ACCEPTANCE.md`
- `docs/sdd/UI_UX_PASS3_DELIVERY_REPORT.md`

**Evidencias (`docs/sdd/evidence/ui-ux-pass2/`, 77 archivos, unos 16 MB)**

- `INDEX.md`, `capture-metadata.txt`
- `before/` — 11 capturas
- `after/` — 57 capturas
- `fixtures/` — `server.mjs` y seis JSON

### Grupo C — excluidos

Ver §7.

---

## 3. Commits

Autorización del propietario recibida (`commit y push ok`). Staging por rutas explícitas, sin `git add .`.

| # | SHA | Mensaje | Estado |
|---|---|---|---|
| A | `16debdc` | `docs(nutrition): record N1 production acceptance` | Publicado |
| B | `7985071` | `fix(ui): refine premium UX, modal behavior, responsive layout and accessibility` | Publicado |
| C | `f028a22` | `test(ui): make user-menu focus test deterministic` | Publicado |

Dos pushes normales a `origin/development`: `fbc2f4d..7985071` y `7985071..f028a22`, cada uno con su autorización. Sin force push; ninguna otra rama tocada.

---

## 4. CI

| Run | SHA | `test-backend` | `test-frontend` | Resultado |
|---|---|---|---|---|
| [43396141323](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43396141323) | `7985071` | PASS | **FAIL** — paso `Run frontend tests`, 188/189 | FAIL |
| [43396824480](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43396824480) | `f028a22` | PASS | PASS — lint, typecheck, tests y `Build frontend` | **PASS** |

**Causa del primer fallo.** Un único test, `DashboardUserMenu focus management › returns focus to the user menu button after the profile
dialog closes`, agotó sus 30 s. Es un test de esta entrega, no una regresión del producto: encadenaba el menú
desplegable de Radix y dos `requestAnimationFrame` bajo jsdom, y en el runner el flujo no llegaba a completarse. En
local pasaba, y ya había mostrado sensibilidad a la carga al ejecutarse con la suite en paralelo.

**Corrección (commit C).** El test se ha sustituido por
`__tests__/components/dashboard-user-menu-focus.test.tsx`, que prueba la misma garantía sin overlays de terceros ni
esperas: sustituye el menú y el diálogo por elementos simples y controla los fotogramas de animación. Pasa en 1,7 s y
**falla si se retira la devolución de foco** del componente (comprobado). El código de producto no cambia.

En el primer run el paso `build` no llegó a ejecutarse; en el segundo `Build frontend` y `Build backend` pasan.

---

## 5. QA

Ejecutado sobre el estado final del árbol de trabajo:

| Comprobación | Resultado |
|---|---|
| Typecheck de la aplicación | PASS |
| Typecheck de tests (`__tests__/tsconfig.json`, ampliado a los tests nuevos) | PASS |
| Lint | PASS — sin avisos |
| Suite de frontend completa (`npm run test:ci`), con el commit C | PASS en local — 33/33 suites, 189/189 tests |
| Tests focales: Admin Content, modales, Perfil, Onboarding, cookies, señales | PASS — 7 suites, 29 tests |
| Tests de backend | NOT_RUN — sin cambios en `backend/` |
| `next build` | NOT_RUN en local — PASS en CI (`Build frontend`, run 43396824480) |

**Coherencia con los 188 tests reportados.** Ahora son 189: se añadió un test al corregir el último defecto de esta
campaña (ver más abajo). Las suites pasan de 32 a 33 porque el test del menú de usuario vive ahora en su propio archivo.

**Revisión final de código.** Los siete consumidores de `DialogContent` fijan su propio ancho y ninguno sobrescribe
los manejadores de foco, de modo que los cambios del primitivo son compatibles con todos. Durante la revisión se
aplicaron tres ajustes puntuales:

1. `components/cookie-consent.tsx` — defecto reproducible: al volver de preferencias al banner pendiente el foco caía
   en `<body>`, y `Volver` reabría el banner aunque ya hubiera una elección guardada. Ahora `Volver` se comporta como
   `Escape` y el foco regresa al control de origen. Con test.
2. `components/onboarding-dialog.tsx` — el aviso de error de guardado se limpia al reabrir el modal.
3. `__tests__/tsconfig.json` — los cinco tests nuevos no entraban en el typecheck de tests; ahora sí.

**Validación visual mínima.** Comparación de píxeles contra la evidencia guardada, tras los últimos cambios:

| Vista | Diferencia | Comprobación adicional |
|---|---|---|
| Login + cookies (1440×900) | 0 % | `Iniciar Sesión` clicable con el banner visible; aceptar persiste tras recargar |
| Dashboard | 0 % | — |
| Nutrición | 0 % | Sin loader; 0 literales crudos |
| Onboarding móvil (390×844) | 0 % | — |
| Onboarding a 200 % (720×450 @2x) | 0 % | `Continuar` visible y clicable al final del scroll |
| Onboarding escritorio | 0,09 % | Diferencia de antialiasing; sin cambio de layout |
| Admin Content (fixtures) | 0 % | Escritorio y móvil sin desbordamiento |
| Perfil (fixtures) | — | Abre dentro del viewport; `Escape` devuelve el foco al botón del menú |

Las evidencias del índice siguen siendo válidas. No se hicieron escrituras sobre Neon: con la identidad QA solo hubo
lecturas y el inicio de sesión.

---

## 6. Evidencias

- 11 parejas BEFORE/AFTER comparables (mismo viewport, DPR, tema, identidad, datos y backend).
- Tema claro y oscuro; escritorio, tablet y móvil.
- Reflow a 150 % y 200 %.
- Admin Content con fixtures locales.
- Modales, errores de guardado y estados de carga.

**Tamaño.** 68 PNG, unos 16 MB en total; el mayor pesa 0,5 MB. El repositorio ya versiona 121 imágenes bajo `docs/`,
así que el volumen es coherente con la práctica existente. Todas las capturas están referenciadas en el índice.

**Seguridad de las fixtures**

| Condición | Resultado |
|---|---|
| Sin credenciales reales | Cumple |
| Sin tokens | Cumple — el token de sesión de prueba se genera al vuelo y no se guarda |
| Sin información personal | Cumple — identidad ficticia `admin@fixture.local`; la fecha de alta se sustituyó por un valor fijo |
| No elevan privilegios | Cumple — `isAdmin` solo existe en la respuesta simulada que recibe el navegador |
| No se importan desde código productivo | Cumple — 0 referencias desde `app/`, `components/`, `lib/`, `hooks/` |
| Fuera del bundle de producción | Cumple — viven en `docs/`, que Next no compila |
| No modifican la autorización real | Cumple — el backend no interviene; `requireAdmin` no cambia |

Las capturas muestran el nombre de la identidad QA sintética («QA Impulso»), no su correo.

---

## 7. Archivos excluidos (Grupo C)

Ninguno de estos está en el repositorio ni entra en los commits:

| Elemento | Motivo |
|---|---|
| `.env*` | No se han leído, modificado ni preparado para staging |
| Respuestas de API de la cuenta QA capturadas para simular el dashboard (planes de comida, progreso, etc.) | Derivadas de datos reales de QA; se quedaron en el directorio temporal del agente |
| Copias del código (`HEAD` y árbol de trabajo) usadas para servir BEFORE y la instancia de fixtures | Temporales |
| Logs de servidores y de tests | Temporales; además `*.log` está ignorado por Git |
| Capturas de depuración y tres capturas descartadas por no aportar (dos de página completa de solo 900 px y una de un diálogo que no llegó a abrirse) | Redundantes |
| Capturas de Pass 1–2 guardadas fuera del repositorio | Invalidadas por la revisión externa |

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| El primitivo `components/ui/dialog.tsx` cambia para todos los modales (ancho por defecto y devolución de foco) | Los siete consumidores revisados; tests de regresión; verificado en navegador |
| `next build` no ejecutado en local | Cubierto: `Build frontend` pasa en CI sobre `f028a22` |
| Admin Content solo verificado con fixtures | La autorización del servidor no cambia en esta entrega; queda `NOT_RUN` con identidad y datos reales |
| Guardados reales contra la API no ejercitados | La interfaz se probó contra fixtures; el cliente de API no cambia |
| Interfaz en inglés no verificada | `NOT_RUN`; las etiquetas nuevas incluyen su versión en inglés salvo las de Perfil (observación P2) |
| Solo Chromium; móvil por viewport, no dispositivo real | `NOT_RUN` en otros navegadores |
| 16 MB de evidencias en el historial de Git | Coherente con el repositorio; se puede reducir en una iteración posterior |

---

## 9. Observaciones P2 pendientes

Siete observaciones de producto abiertas. La octava de la lista original era documental (informe de auditoría
desactualizado) y quedó **cerrada** en esta campaña. No bloquean la publicación en `development` y **no se ejecutan en
esta campaña**.

| # | Observación | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 6 | Botones por debajo de 44 px en táctil: `Cancelar`/`Guardar` de Perfil (32 px) y pie del onboarding (36 px) | Alto — usabilidad móvil en flujos de activación | Bajo | 1 |
| 3a | Admin: «En revisión» y «Necesita revisión» casi iguales; la tarjeta superior dice «Necesitan trabajo» para el mismo estado | Medio — riesgo de error editorial | Bajo | 2 |
| 2 | «Riesgo de estancamiento: Bajo» en la recomendación aunque no haya datos; la API no informa de si hay datos suficientes | Medio — mensaje engañoso | Medio — requiere cambio de backend | 3 |
| 5, 3b | Internacionalización: `ProfileDialog` y `Cerrar` solo en español; en Admin, categoría, grupo muscular, equipamiento y eventos en inglés técnico | Medio — usuarios en inglés | Medio | 4 |
| 4 | Admin: editor de 1280×868 con mucha superficie vacía, bloque de notificaciones apretado, título estrecho en móvil | Bajo — herramienta interna | Medio | 5 |
| 7 | Las opciones de objetivo del onboarding no exponen su estado seleccionado (`aria-pressed`) | Medio — lectores de pantalla | Bajo | 6 |
| 1 | Con cookies sin decidir, el onboarding se abre encima del banner y lo deja inerte hasta cerrar el modal | Bajo — se resuelve al cerrar el modal | Medio — decisión de producto sobre el orden | 7 |

**Siguiente iteración propuesta (paquete independiente «UI/UX P2»)**, en este orden: tamaños táctiles → claridad de
estados editoriales → recomendaciones con datos insuficientes → internacionalización → optimización de Admin Content.
Las observaciones 7 y 1 pueden acompañar a la primera por ser del mismo componente. La observación 2 necesita un
cambio de API y debería llevar su propia especificación.

---

## 10. Estado final

| Estado | Evidencia |
|---|---|
| `UI_UX_PASS3_PUBLISHED_DEVELOPMENT` | `origin/development` en `f028a22` |
| `UI_UX_PASS3_CI_PASS` | Run 43396824480 en PASS sobre `f028a22` |
| `UI_UX_P2_BACKLOG_OPEN` | Siete observaciones abiertas (§9) |
| `NO_PROMOTE` | No se ha solicitado ni ejecutado ninguna promoción |

No se han tocado `backend/`, migraciones, Neon, Render, Vercel, contratos `.anclora/` ni otros repositorios.

---

## 11. Recomendación de promoción

No promocionar todavía. Orden recomendado:

1. Revisar el Preview de `development`, en especial los modales (foco y cierre), el onboarding en un móvil real y la
   interfaz en inglés.
2. Solo entonces valorar `PROMOTE=FULL` con el SHA revisado (`f028a22` o posterior).

La entrega no contiene migraciones ni cambios de backend, así que una promoción futura afectaría únicamente al
frontend.
