# 40 — Diseño: endurecimiento de la CSP del frontend (B1-F2) (v1, 2026-10-13)

> **Propuesta de diseño. No se ha modificado código ni producción.** Responde a B1-F2 de `37-…`. Las decisiones y el alcance son de
> Toni. No acepta AI-06 ni gate. Estimaciones de esfuerzo orientativas, no medidas.

> **Estado (2026-10-13): P0 y P1 aprobados por Toni e implementados en local (sin desplegar).** `lib/security/csp.ts`,
> `lib/security/csp-report.ts`, `middleware.ts` y `app/api/csp-report/route.ts`. Verificación: 17 tests nuevos (12 de política y
> sanitizador con fase roja observada; 5 del *middleware* real), suite frontend 21/149, `tsc` limpio y `next build` aislado en
> verde con el *middleware* compilado (27,2 kB). **P2 sigue sin decidir.** Los datos de P1 saldrán de los logs de funciones de
> Vercel (línea `[csp-report]`) tras desplegar.

## 1. Estado actual (verificado en `middleware.ts` y en el repo)

| Aspecto | Hoy | Lectura |
|---|---|---|
| `script-src` (producción) | `'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com` | `unsafe-inline` anula la protección frente a scripts inyectados en línea; `jsdelivr`/`unpkg` sirven cualquier paquete de npm (gadgets de evasión) |
| Uso real de esos CDNs | **Ninguno** en el código (`grep` de `jsdelivr`, `unpkg`, `<script`, `next/script` sin resultados); la analítica `@vercel/analytics` se sirve desde el propio origen en producción | Los dos CDNs parecen **innecesarios** |
| `base-uri` | no definida (`default-src` no la cubre) | Permite inyectar `<base>` y reescribir URLs relativas |
| Tokens | `localStorage` (acceso y refresco) | Un XSS = robo de sesión: la CSP es la única barrera en el cliente |
| Renderizado | Todas las páginas se prerenderizan **estáticamente** (sin `dynamic`, `headers()` ni `cookies()` en `app/`) | Relevante para *nonces* (§3) |
| Superficie de inyección conocida | Un `dangerouslySetInnerHTML` (`components/ui/chart.tsx:83`) | Revisable |
| Stack | Next.js 14.2.16, App Router | Soporta *nonces* vía `middleware` |

## 2. Qué NO resuelve cada medida (para no engañarnos)

- Quitar solo `jsdelivr`/`unpkg`: **higiénico, no suficiente.** Con `'unsafe-inline'` un atacante con un punto de inyección sigue pudiendo ejecutar código en línea.
- La protección real frente a XSS requiere **eliminar `'unsafe-inline'` de `script-src`**, y en Next.js eso exige *nonces*.

## 3. Opciones

| Fase | Qué es | Protege | Riesgo de romper la app | Esfuerzo |
|---|---|---|---|---|
| **P0** | Quitar `jsdelivr` y `unpkg` (y `r2cdn` en desarrollo); añadir `base-uri 'self'` y `object-src 'none'`; mantener `unsafe-inline` | Reduce evasiones por CDN y la inyección de `<base>` | **Bajo** (nada los usa; `base-uri` rara vez rompe) | Pequeño |
| **P1** | Política estricta con *nonce* + `'strict-dynamic'` en modo **`Content-Security-Policy-Report-Only`** en paralelo a la actual; recoger violaciones en el E2E (`securitypolicyviolation`) | Nada aún: **mide** qué rompería | **Ninguno** (no bloquea) | Medio |
| **P2** | Pasar la política estricta a **enforce** y retirar `'unsafe-inline'` de `script-src` | **Sí**: bloquea scripts inyectados en línea | **Medio-alto** (§4) | Medio-alto |
| P3 | Sacar el *refresh token* de `localStorage` a cookie `httpOnly` con un dominio de API del mismo sitio (p. ej. `api-impulso.anclora.com`) | Mitiga el robo de sesión incluso con XSS | Alto (cambia el contrato de sesión) | Alto; decisión S1 |

## 4. Por qué P2 es arriesgado (y qué lo mitiga)

1. **Los *nonces* exigen renderizado dinámico.** Hoy las páginas son estáticas: su HTML se genera en *build* sin *nonce* y sus scripts de hidratación en línea quedarían **bloqueados**. Habría que forzar renderizado dinámico (`export const dynamic = 'force-dynamic'` en el layout raíz o leer `headers()`), con coste en caché y latencia.
2. **Next.js inserta scripts en línea propios** (datos de hidratación); con *nonce* los marca automáticamente solo si la cabecera de la petición lo lleva, y solo en renderizado dinámico.
3. **Terceros:** `@vercel/analytics` y las fuentes de `next/font` deben comprobarse bajo la política estricta.
4. **Mitigación:** P1 primero. Si el E2E y una pasada en producción no muestran violaciones, P2 es un cambio de una línea de política.

## 5. Plan propuesto

| Paso | Qué | Verificación |
|---|---|---|
| 1 | P0 con tests (la política se extrae a una función pura y se prueba como la de CORS) | Test unitario del encabezado; E2E existente sin regresión |
| 2 | P1: añadir la cabecera *Report-Only* y un recolector de `securitypolicyviolation` en Playwright | E2E aislado (14 pruebas) con cero violaciones o lista cerrada |
| 3 | Desplegar P0+P1 a un preview y a producción (solo frontend) | Revisión visual y consola |
| 4 | Decidir P2 con los datos de P1 | Según resultado |

**Riesgos de P0:** si algún recurso externo no detectado dependiera de `jsdelivr`/`unpkg`, aparecería como bloqueado en la consola. Probabilidad
baja por la búsqueda, pero **no verificada con un build real** (el E2E aislado lo cubriría).

## 6. Decisiones de Toni

| # | Decisión | Propuesta |
|---|---|---|
| 1 | Alcance ahora | **P0 y P1** (son aditivos y no rompen); P2 después, con datos |
| 2 | ¿Aceptas renderizado dinámico global si P2 lo exige? | Decidir con los datos de P1: afecta a caché y coste en Vercel |
| 3 | S1: ¿se explora P3 (cookie `httpOnly` + dominio de API del mismo sitio)? | Diseño aparte; es la mitigación de fondo |

## 7. Límites

- Esta propuesta no se ha probado con un *build* real ni en navegador.
- Una CSP estricta no sustituye revisar el único `dangerouslySetInnerHTML` ni el saneado de entradas.
- P0 por sí solo **no cierra** B1-F2: lo deja parcialmente mitigado y medible.

## 8. Verificación del preview por el agente (2026-10-13)

> Ejecutada con `agent-browser` (sesión propia) por orden de Toni, sobre el preview de `development` (`2e2d251`):
> `anclora-impulso-amvus4wk1-pmi140979-6354s-projects.vercel.app`. Acceso a la protección de despliegues con un token OIDC de
> corta duración de la CLI de Vercel de Toni (vía prevista, sin desactivar la protección ni usar secretos estáticos; el token no
> se imprimió ni se guardó). Identidad QA dedicada; sin tocar la cuenta personal de Toni. Solo lectura de pantallas.

| Comprobación | Resultado |
|---|---|
| Cabecera `Content-Security-Policy` en producción de preview | **P0 presente:** `script-src 'self' 'unsafe-inline'` (sin `jsdelivr`/`unpkg`), `base-uri 'self'`, `object-src 'none'` |
| Cabecera `Content-Security-Policy-Report-Only` | **P1 presente:** nonce por petición + `strict-dynamic`, `report-uri /api/csp-report` |
| Recorrido: login, dashboard, ejercicios, generar rutina (solo vista), nutrición, progreso, planes de salud, logros, legal | Todas cargan; **0 mensajes de consola y 0 errores de página** |
| Aspecto visual (captura del dashboard) | Renderiza con estilos y fuentes correctos (modal de onboarding de la cuenta QA) |
| Peticiones | ≈ 550: sin ninguna bloqueada salvo `vercel.live/_next-live/feedback/feedback.js` (barra de **comentarios del propio preview de Vercel**; no es de la aplicación, no existe en producción y ya estaba fuera de la política anterior) |
| API (`anclora-impulso.onrender.com`) | 31 × `200` y 23 × `204` (preflights): **CORS correcto** con el origen del preview contra el backend actual |
| Informes de violación | **131** `POST /api/csp-report` → `204` en 9 cargas (≈ 14 por página): la tubería P1 funciona y confirma que la política estricta bloquearía los scripts en línea de hidratación de las páginas estáticas |

**Lectura:** P0 no rompe nada observable; P1 mide. **P2 queda confirmado como no trivial**: ≈ 14 violaciones por página en la
política estricta, todas esperables por ser páginas estáticas sin nonce.

**Aviso sobre B1-F1 (CORS):** el preview funciona hoy porque el backend desplegado aún tiene la regla antigua por prefijo. Tras
desplegar el endurecimiento, este origen (`…-pmi140979-6354s-projects.vercel.app`) se rechazará salvo que se configure
`FRONTEND_PREVIEW_HOST_SUFFIXES=-pmi140979-6354s-projects.vercel.app` o se liste el alias. El sufijo de equipo
`pmi140979-6354s-projects` queda **confirmado** por este despliegue.

**Límites:** un solo navegador y una sola cuenta; pantallas con el modal de onboarding encima; sin generar rutinas ni escribir
datos; los informes llegaron al endpoint pero **no se leyeron en los logs de Vercel**; no se probó móvil ni claro/oscuro.

## 9. Lectura de los informes en los logs de Vercel (2026-10-13)

> Fuente: `get_runtime_logs` del proyecto `anclora-impulso`, ventana de 3 h, filtro `csp-report`, entorno `preview`, rama
> `development`, despliegue `dpl_HZtnkJi8c3zdAWC1UG1SkPVeTkDS`. La herramienta devuelve como máximo **100 entradas**: es una muestra
> (la recorrida generó ≥ 131 POST). El tráfico es el de la verificación del agente (una cuenta QA, 9 cargas).

| Dato | Valor |
|---|---|
| Informes leídos | 100 (todos con `disposition: report`, ninguno `enforce`) |
| Directiva efectiva | 100 × `script-src-elem` |
| Recurso bloqueado por la política **estricta** | 93 × scripts propios de Next (`/_next/static/chunks/*`), 7 × `inline` |
| Recursos de **terceros** | **0** |
| Otras directivas (`style-src`, `connect-src`, `img-src`, `font-src`) | 0 informes |
| Por página | `/achievements` 17 · `/progress` 16 · `/nutrition` 16 · `/workouts/generate` 16 · `/health-plans` 15 · `/legal` 10 · `/exercises` 10 |
| Errores (`error/function`) | 0 |

**Lectura para P2:**
- La tubería funciona: los informes llegan al log con el formato saneado (sin query strings).
- Las violaciones son **todas propias**: las etiquetas `<script src>` de las páginas estáticas y sus scripts en línea no llevan
  *nonce*. No aparece ningún recurso externo que P2 fuera a romper.
- Por tanto, **la viabilidad técnica de P2 depende de una sola cosa**: que Next.js reciba el *nonce* en cada render, lo que exige
  renderizado dinámico del layout raíz (decisión 2 de §6; coste en caché y latencia sin medir).

**Límites:** muestra de 100 de ≥ 131; solo rutas autenticadas recorridas por una cuenta; no incluye navegadores distintos de
Chromium, ni extensiones, ni rutas no visitadas (p. ej. `/workouts/[id]`, `/auth/signup`).
