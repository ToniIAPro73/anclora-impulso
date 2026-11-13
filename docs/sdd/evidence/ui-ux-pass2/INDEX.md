# Índice de Evidencias Visuales — UI/UX Pass 2 (cierre de evidencias, pasada 3)

**Fecha de captura:** 2026-11-13
**Directorio estable:** `docs/sdd/evidence/ui-ux-pass2/`
**Herramienta:** `agent-browser 0.37.1` (Chromium headless), una sesión aislada por escenario.
**Metadatos por captura:** [`capture-metadata.txt`](capture-metadata.txt) (ruta, viewport CSS, DPR, tema, `scrollWidth`, loader, modal, banner).

Este índice **sustituye** al de la pasada anterior. Todas las capturas de `before/` y `after/` se han regenerado; las
anteriores quedaron invalidadas por la revisión externa (Nutrición mostraba solo el loader, parejas no equivalentes,
zoom no aplicado, Admin sin evidencia visual).

Leyenda de estado: **PASS** verificado · **FAIL** defecto abierto · **BLOCKED** no ejecutable por una restricción ·
**NOT_RUN** no ejecutado.

---

## 1. Cómo se han obtenido (reproducible)

| Elemento | Valor |
|---|---|
| BEFORE | Código de `HEAD` (`fbc2f4d`) exportado con `git archive` a un directorio temporal, servido con `next dev -p 3010` |
| AFTER | Árbol de trabajo actual (`development`, sin commit), servido con `next dev -p 3000` |
| API (BEFORE y AFTER) | El mismo backend local (`backend`, puerto 3001, sin cambios respecto a `HEAD`) |
| Datos | La misma identidad QA (`qa.impulso@anclora.local`) y los mismos datos en ambos lados; solo lectura |
| Admin / guardados | API de fixtures local (`fixtures/server.mjs`, puerto 3101) + copia del árbol de trabajo en `next dev -p 3020` |
| Escenario de datos | Perfil 0 %, sin sesiones, sin registros nutricionales, un plan semanal existente |

Las parejas BEFORE/AFTER comparten **viewport, DPR, tema, identidad, datos y backend**; lo único que cambia es el
código de frontend. El BEFORE ya no procede de `https://impulso.anclora.com`: comparar producción contra local mezclaba
entorno y datos.

**Espera de carga.** Cada captura espera `networkidle`, fuentes cargadas, ausencia de `Cargando...` y ausencia de
`.animate-spin` / `.animate-pulse` antes de disparar. Sin esa espera el guard de autenticación deja en pantalla el
loader a pantalla completa (causa de la captura inválida de Nutrición).

**Zoom.** El zoom de navegador se reproduce con su equivalente exacto de layout sobre una ventana de 1440×900:

| Zoom | Viewport CSS | DPR | Comando |
|---|---|---|---|
| 100 % | 1440×900 | 1 | `agent-browser set viewport 1440 900 1` |
| 150 % | 960×600 | 1.5 | `agent-browser set viewport 960 600 1.5` |
| 200 % | 720×450 | 2 | `agent-browser set viewport 720 450 2` |

La pasada anterior registró `innerWidth=1440` en los tres niveles: el zoom no se había aplicado.

**Sin escrituras en producción.** El modelo local es `PRODUCTION_BACKED`, así que con la identidad QA solo se han
hecho lecturas (más el inicio de sesión). Todo guardado, error de guardado y acción masiva se ha ejercitado contra la
API de fixtures local, que no tiene base de datos.

---

## 2. Parejas BEFORE / AFTER

Mismo nombre de archivo en `before/` y `after/`.

| Archivo | Ruta | Viewport | Tema | BEFORE (`HEAD`) | AFTER | Estado |
|---|---|---|---|---|---|---|
| `login-desktop-cookie.png` | `/auth/login` | 1440×900 | Oscuro | Modal de cookies con velo: `Iniciar Sesión` no clicable (`submitClickable=false`) | Banner compacto en esquina; `submitClickable=true` | PASS |
| `login-mobile-cookie.png` | `/auth/login` | 390×844 | Oscuro | Mismo bloqueo | Banner inferior; submit clicable | PASS |
| `dashboard-desktop-onboarding.png` | `/dashboard` | 1440×900 | Oscuro | Modal sobredimensionado, check verde al 0 % | `max-w-4xl`, icono de usuario al 0 % | PASS |
| `dashboard-mobile-onboarding.png` | `/dashboard` | 390×844 | Oscuro | Pie solapado sobre las opciones | Cuerpo con scroll, pie separado | PASS |
| `zoom200-dashboard-onboarding.png` | `/dashboard` | 720×450 @2x | Oscuro | Referencia a 200 %: modal recortado, check verde al 0 % (no se midió si el pie era alcanzable) | El modal completo hace scroll; pie alcanzable (ver §3.2) | PASS (tras corrección) |
| `dashboard-desktop-dark.png` | `/dashboard` | 1440×900 | Oscuro | Señal `low` en crudo | `Bajo` | PASS |
| `progress-desktop-dark.png` | `/progress` | 1440×900 | Oscuro | `Mejor PR: 0 kg`, riesgo `Bajo` sin datos | `--`, `Sin datos` | PASS |
| `nutrition-desktop-dark.png` | `/nutrition` | 1440×900 | Oscuro | Cargada; `Riesgo de estancamiento: low` | Cargada; `Bajo` | PASS |
| `dashboard-desktop-light.png` | `/dashboard` | 1440×900 | Claro | Tres tarjetas forzadas a fondo oscuro | Tarjetas en tema claro | PASS |
| `progress-desktop-light.png` | `/progress` | 1440×900 | Claro | Métricas vacías engañosas | `--` / `Sin datos` | PASS |
| `nutrition-desktop-light.png` | `/nutrition` | 1440×900 | Claro | Cargada; `low` | Cargada; `Bajo` | PASS |

---

## 3. Capturas solo AFTER

### 3.1 Responsive y tema

| Archivo | Viewport | Observación | Estado |
|---|---|---|---|
| `dashboard-tablet-dark.png` | 768×1024 | Sin scroll horizontal | PASS |
| `dashboard-mobile-dark.png` | 390×844 | Tarjetas apiladas | PASS |
| `dashboard-mobile-sidebar-open.png` | 390×844 | Menú lateral abierto, 7 enlaces | PASS |
| `progress-mobile-dark.png` | 390×844 | Sin desbordamiento | PASS |
| `nutrition-mobile-dark.png` | 390×844 | Sin desbordamiento | PASS |
| `dashboard-desktop-onboarding-cookie-undecided.png` | 1440×900 | Onboarding abierto con cookies sin decidir: el banner queda atenuado e inerte hasta cerrar el modal | Observación P2 |

### 3.2 Zoom 150 % y 200 %

| Archivo | Zoom | Resultado medido | Estado |
|---|---|---|---|
| `zoom150-login-cookie.png` | 150 % | `scrollW=960`, submit clicable | PASS |
| `zoom150-dashboard-onboarding.png` | 150 % | Modal dentro del viewport, pie alcanzable | PASS |
| `zoom150-dashboard.png`, `zoom150-progress.png`, `zoom150-nutrition.png` | 150 % | `scrollW=960`, 0 elementos fuera por la derecha | PASS |
| `zoom150-admin-content.png` | 150 % | `scrollW=960` | PASS |
| `zoom200-login-cookie.png` | 200 % | `scrollW=720`, submit clicable | PASS |
| `zoom200-dashboard-onboarding.png`, `zoom200-dashboard-onboarding-footer.png` | 200 % | El modal completo hace scroll; pie visible y clicable al final | PASS (tras corrección) |
| `zoom200-dashboard.png`, `zoom200-progress.png`, `zoom200-nutrition.png` | 200 % | `scrollW=720`, 0 elementos fuera | PASS |
| `zoom200-admin-content.png`, `zoom200-admin-edit-dialog.png` | 200 % | Todos los controles alcanzables | PASS |
| `zoom200-profile-dialog.png`, `zoom200-nutrition-log-meal-dialog.png`, `zoom200-cookie-preferences.png` | 200 % | Todos los controles alcanzables | PASS |

### 3.3 Admin Content (fixtures locales)

Identidad `admin@fixture.local` simulada solo en el navegador; ninguna cuenta real ni la cuenta QA ha recibido
permisos. Datos en `fixtures/*.json` (6 ejercicios y 4 recetas, con títulos largos y uno sin espacios para forzar
desbordamiento).

| Archivo | Viewport | Qué muestra | Estado |
|---|---|---|---|
| `admin-content-desktop-dark.png` | 1440×900 | Resumen, pestañas y filtros | PASS |
| `admin-content-desktop-dark-list.png` | 1440×900 | Cola: títulos a dos líneas, badges localizados | PASS |
| `admin-content-desktop-dark-bottom.png` | 1440×900 | Eventos y entregas con estado localizado | PASS |
| `admin-content-desktop-dark-recipes.png` | 1440×900 | Pestaña Recetas | PASS |
| `admin-content-desktop-dark-bulk-selected.png` | 1440×900 | Barra de acciones masivas | PASS |
| `admin-content-desktop-dark-dispatch-error.png` | 1440×900 | Aviso `No se pudo despachar` | PASS |
| `admin-content-desktop-dark-edit-dialog.png` | 1440×900 | Editor de ejercicio | PASS |
| `admin-content-desktop-dark-edit-saving.png` | 1440×900 | `Guardar` deshabilitado mientras guarda | PASS |
| `admin-content-desktop-dark-recipe-edit-dialog.png` | 1440×900 | Editor de receta | PASS |
| `admin-content-desktop-light.png` | 1440×900 | Tema claro | PASS |
| `admin-content-mobile-dark.png`, `admin-content-mobile-dark-list.png` | 390×844 | Cola sin recorte, controles operables | PASS (tras corrección) |
| `admin-content-mobile-dark-edit-dialog.png`, `admin-content-mobile-dark-recipe-edit-dialog.png` | 390×844 | Editores sin solapes, pie visible | PASS (tras corrección) |

### 3.4 Modales, errores y estados

| Archivo | Qué muestra | Origen | Estado |
|---|---|---|---|
| `cookie-preferences-desktop-dark.png` | Preferencias con foco dentro del diálogo | QA local | PASS (tras corrección) |
| `nutrition-log-meal-dialog-desktop-dark.png`, `nutrition-log-meal-dialog-mobile-dark.png` | Diálogo `Registrar Comida` | QA local | PASS |
| `login-desktop-error.png` | `Email o contraseña incorrectos` | Identidad inexistente | PASS |
| `onboarding-desktop-step3-fixture.png` | Paso 3 de onboarding | Fixtures | PASS |
| `onboarding-desktop-saving-fixture.png` | `Guardando...` deshabilitado | Fixtures | PASS |
| `onboarding-desktop-save-error-fixture.png` | Aviso de error al fallar el guardado | Fixtures | PASS (tras corrección) |
| `profile-dialog-desktop-dark-fixture.png`, `profile-dialog-mobile-dark-fixture.png` | Diálogo de perfil | Fixtures | PASS |
| `profile-dialog-desktop-save-error-fixture.png` | Aviso de error al fallar el guardado | Fixtures | PASS (tras corrección) |

---

## 4. Fixtures

`fixtures/server.mjs` es una API HTTP mínima (Node, sin dependencias, sin base de datos) que sirve los JSON de esta
carpeta, mantiene el perfil en memoria y registra las escrituras recibidas. Arranque:

```bash
node docs/sdd/evidence/ui-ux-pass2/fixtures/server.mjs
```

```bash
NEXT_PUBLIC_API_URL=http://localhost:3101/api NEXT_PUBLIC_API_PROXY=false ./node_modules/.bin/next dev -p 3020
```

Para simular un fallo de guardado de perfil basta crear un archivo vacío `FAIL_PROFILE` junto a `server.mjs`.
`me.json` y `profile.json` contienen una identidad ficticia (`admin@fixture.local`), sin datos personales.
