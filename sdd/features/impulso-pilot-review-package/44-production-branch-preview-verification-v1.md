# 44 — Verificación autenticada del preview de la rama `production` y variable de CORS (2026-10-13)

> Registro de evidencia y de un cambio de configuración de producción autorizado por Toni. No acepta gates ni AI-xx.

## 1. Estado de las ramas tras las promociones del 2026-10-13

| Rama | SHA | Entorno de Vercel |
|---|---|---|
| `development` | `5a5b05d` | Preview |
| `staging` | `5a5b05d` | Preview (`…7qgt0lzib-pmi140979-6354s-projects.vercel.app`) |
| `production` | `5a5b05d` | Preview (`…f1juhvp9h-pmi140979-6354s-projects.vercel.app`) |
| `main` | `77f852a` | **Production** (último despliegue 2026-10-03; sin tocar) |

Promociones por `promote.yml` (avance rápido): runs `38329419562` (staging) y `38337159701` (production), ambos `success`.

## 2. Cambio de configuración en Render (autorizado por Toni, 2026-10-13)

| Campo | Valor |
|---|---|
| Servicio | `Anclora-Impulso` (`srv-d6ps41v5r7bs73dvrudg`) |
| Variable creada | `FRONTEND_PREVIEW_HOST_SUFFIXES` = `-pmi140979-6354s-projects.vercel.app` (no es un secreto) |
| Efecto | Los previews de ese equipo de Vercel, con prefijo del proyecto, pueden llamar a la API con credenciales (B1-F1) |
| Aplicación | Render no redespliega al cambiar variables por API: despliegue manual de `5a5b05d` (backend idéntico al desplegado, `0606586`; diferencia solo en tests/documentos) → `live` |
| Riesgo residual | Los nombres de proyecto de Vercel comparten un espacio global: un nombre que acabe literalmente en ese sufijo no es demostrablemente ajeno (`utils/cors-origin.ts`). Preferible, a medio plazo, listar alias exactos en `FRONTEND_URL` |

**Verificación externa del CORS tras el despliegue:** orígenes exactos y los dos previews del equipo → `Access-Control-Allow-Origin`
devuelto; `anclora-impulso-evil.vercel.app`, `anclora-impulso-x-otherteam-projects.vercel.app` y `evil-pmi140979-6354s-projects.vercel.app`
→ rechazados.

## 3. Recorrido autenticado del preview de `production` (cuenta QA dedicada, `agent-browser`)

| Comprobación | Resultado |
|---|---|
| Inicio de sesión desde el preview | `POST /api/auth/login` 200 y preflight 204 |
| Copy nueva | Diálogo «**Configura tu perfil**» y sección «**Recordatorios**» visibles |
| Pantallas (dashboard, ejercicios, generar rutina, nutrición, progreso, planes de salud, logros, legal) | Todas cargan; **0 líneas de consola y 0 errores de página** |
| Peticiones (508) | API: 31 × 200 y 23 × 204; ninguna sin estado salvo las de `vercel.live` (barra del preview) |
| Informes de violación (política estricta, solo informe) | 118 `POST /api/csp-report` (≈ 13 por carga), como se esperaba |

**Límites:** un navegador y una cuenta; modal de onboarding sobre el dashboard; sin generar rutinas ni escribir datos; no se probó móvil
ni claro/oscuro; la cuenta QA es nueva (sin historial). El autocompletado del navegador de la herramienta precargó el correo personal de
Toni en el formulario de login; **no procede de la aplicación** (no aparece en el código fuente).

## 4. Inventario de la copy con «inteligente» (para la próxima ronda con Hermes)

| Clave / fichero | Texto | Estado |
|---|---|---|
| `home.subtitle` | (ya reformulado) | Aplicado, pendiente de Hermes |
| `dashboard.remindersTitle` | (ya reformulado) | Aplicado, pendiente de Hermes |
| `onboarding-dialog.tsx` título | (ya reformulado) | Aplicado, pendiente de Hermes |
| `home.adaptiveProgrammingDesc` | «Progresión **inteligente** que se adapta a tu rendimiento y ajusta **automáticamente** la dificultad» | **Sin tocar** (M4, parcial) |
| `dashboard.nutritionHub` | «**Nutrición Inteligente**» / «Smart Nutrition» | **Nuevo**, sin tocar |
| `components/progress-tracker.tsx:224` | «**Lectura inteligente** del progreso» / «Intelligent progress readout» | **Nuevo**, sin tocar |
| `lib/impulso-brand.ts` descripción global | «…con IA, progreso y seguimiento **inteligente**.» | **Sin tocar**; es el metadato que ven buscadores y redes |

**Actualización (cuarta ronda de Hermes, `42-…` §8):** las cuatro cadenas «inteligente» sin tocar de la tabla anterior
(`adaptiveProgrammingDesc`, `nutritionHub`, `progress-tracker`, descripción global) han sido reformuladas según la propuesta de Hermes.

## 5. Observaciones de configuración (solo nombres de variables de Render; ningún valor leído)

| Observación | Lectura |
|---|---|
| `JWT_EXPIRES_IN` y `JWT_REFRESH_EXPIRES_IN` existen | La duración real no se conoce (el valor no se leyó) |
| **No existen** `AUTH_ACCEPT_LEGACY_TOKENS`, `SECURITY_CONFIG_MODE`, `LLM_COACH_ENABLED`, `WORKOUT_GENERATE_*` | Rigen los valores por defecto: tokens antiguos aceptados, política de seguridad en `warn`, coach desactivado, tope de 10/hora |
| `SMTP_*` existen | Los recordatorios por correo son posibles; no verificado que funcionen |
| `ADMIN_EMAILS` existe | Obsoleta e ignorada por la autorización (F-1); conviene retirarla para no inducir a error |
| `PASS_TEXT`, `USER_TEXT`, `UTILIZAR_USER_TEXT` existen | Nombres sin uso aparente en el código del backend; **a revisar por Toni** (podrían ser residuos) |
| `GROQ_API_KEY`, `GROQ_MODEL_*` existen | Coherente con el generador de rutinas con IA |
