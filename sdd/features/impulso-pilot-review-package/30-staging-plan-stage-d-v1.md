# 30 — Plan de staging y verificación Stage D (v1, 2026-10-12)

> **DECISIÓN DE TONI (2026-10-12): opción C.** El Stage D se ejecuta en producción con la identidad QA dedicada; **no se crea staging,
> ni proyecto Neon, ni servicio Render nuevos**. Las secciones 3–6 y 9 se conservan como análisis; el procedimiento vigente es el §11.

> **Plan, no ejecución.** No se ha creado ningún recurso, no se ha tocado ningún servicio, secreto ni rama. No acepta ninguna tarea
> AI-xx ni gate. Deriva de la decisión de Toni «Staging: sí» (`29-decisions-record-2026-10-12.md` §1, #3) y de A-08-01 §5 (Stage D).
> Etiquetas: **OBSERVADO** (visto en esta sesión o documento previo del repo) · **DESCONOCIDO** (hay que preguntar o leer en panel)
> · **PROPUESTA** (mi recomendación, a decidir por Toni).

## 1. Qué problema resuelve

A-08-01 acepta la evidencia local de AI-08 (Stage L) pero deja **obligatorio antes del lanzamiento** el Stage D: comprobar en una
topología real lo que PostgreSQL 16 local no puede demostrar (pooler, varias instancias, relojes, versión del motor). Hoy **no existe
un entorno donde hacerlo sin tocar producción**.

## 2. Estado real hoy

| Elemento | Estado | Etiqueta / fuente |
|---|---|---|
| Rama Git `staging` | Existe y dispara previews de Vercel | OBSERVADO (doc 19) |
| Backend de ese «staging» | **No existe uno propio.** El único servicio Render, `Anclora-Impulso`, es el backend de producción | OBSERVADO/INFERENCIA fuerte (doc 20 §5) |
| `NEXT_PUBLIC_API_URL` en scope Preview | No leído; muy probablemente igual que Production | DESCONOCIDO (doc 20) |
| Base de datos aislada para staging | **No existe.** Solo producción (`neon-impulso`/`main`) y la rama de backup | OBSERVADO |
| Contrato | `PRODUCTION_RUNTIME.md` §3: no crear BD de desarrollo/preview/staging «salvo que Toni lo pida explícitamente» | OBSERVADO |
| Producción hoy | Backend `c0333f3` en Render (rama `development`, Auto-Deploy Off) | OBSERVADO |

**Consecuencia:** los previews de `staging` no son un staging aislado, y una prueba Stage D sobre ellos podría escribir en la BD de
producción. Por eso este plan prohíbe usar los previews actuales para Stage D.

## 3. Opciones

| Opción | Qué es | Aislamiento | Cubre D1–D7 | Coste/esfuerzo | Valoración |
|---|---|---|---|---|---|
| **A. Proyecto Neon nuevo + servicio Render nuevo** | BD vacía, migraciones aplicadas desde cero, datos sintéticos; credenciales y secretos propios | Total | D1–D7 (D5 requiere ≥2 instancias) | Medio; posible coste de Render para 2 instancias | **PROPUESTA (recomendada)** |
| B. Rama de Neon hija de `main` + servicio Render nuevo | Copia con datos reales de usuarios | Parcial: **datos personales reales en staging** | D1–D7 | Bajo | No recomendada: arrastra datos personales y credenciales de producción a un entorno de pruebas (RGPD, AI-07) |
| C. Ejecutar Stage D en producción con identidad QA | Es lo que A-08-01 permite «bajo procedimiento autorizado» | Ninguno | Parcial | Mínimo | Fallback. D2/D3 con concurrencia sobre producción compite con tráfico real y consume cuota/proveedor reales |

## 4. Arquitectura propuesta (opción A)

```
Vercel Preview (rama staging) ──NEXT_PUBLIC_API_URL (solo scope Preview, rama staging)──▶ Render «anclora-impulso-staging»
                                                                                           │  JWT/OAuth/IA: secretos propios
                                                                                           ▼
                                                                          Neon «neon-impulso-staging» (proyecto aparte)
```

Requisitos de diseño:
1. **Misma versión mayor de PostgreSQL** que producción (D7). Producción: DESCONOCIDO en panel; `CLAUDE.md` dice 17 (no verificado).
2. **Mismo modo de conexión que producción** (pooler o directo) para que D4 mida lo que de verdad ocurre. Producción: DESCONOCIDO
   (hay que mirar el hostname de `DATABASE_URL` del servicio en Render; si contiene `-pooler`, es pooled).
3. **Mismo código**: despliegue manual del mismo commit que se va a lanzar.
4. **Secretos propios**: `JWT_SECRET`, `JWT_REFRESH_SECRET`, claves OAuth y de IA distintas de las de producción. Nada de reutilizar.
5. **OAuth**: clientes de Google/GitHub de staging con su callback, o desactivar OAuth en staging (D1–D3 no lo necesitan).
6. **IA**: clave de proveedor de staging con límite de gasto, o ejercer D2 con límite bajo para no consumir mucho.
7. **`FRONTEND_URL`/CORS** del backend de staging apuntando solo al preview de staging.
8. **`ADMIN_USER_IDS`** de staging: solo usuarios sintéticos.
9. **Auto-Deploy Off** en el servicio de staging, igual que producción.
10. **Datos 100 % sintéticos**; usuarios QA creados a propósito.

## 5. Pasos (quién hace qué)

| # | Paso | Quién | Riesgo |
|---|---|---|---|
| 0 | Registrar excepción de contrato `IMPULSO-STAGING-2026-10-12` en `AOS_ADOPTION.md` (alcance: un proyecto Neon, un servicio Render, datos sintéticos; NO cambia `LOCAL_RUNTIME_MODEL`) | Yo, con tu orden expresa | Bajo |
| 1 | Leer en el panel de Render de producción: hostname de `DATABASE_URL` (¿`-pooler`?), nº de instancias, plan, versión Node/región | **Toni** (solo nombres/nº, sin pegar valores) | Bajo |
| 2 | Leer en Neon: versión mayor de PostgreSQL y plan del proyecto de producción | **Toni** | Bajo |
| 3 | Crear proyecto Neon `neon-impulso-staging` (misma región y versión), con Auto-suspend por defecto | **Toni** | Bajo |
| 4 | Aplicar migraciones desde cero con `prisma migrate deploy` (comando local con la URL en variable de entorno efímera; no en fichero) | Yo guío, **Toni** ejecuta o autoriza | Bajo (BD vacía, no es producción) |
| 5 | Crear servicio Render `anclora-impulso-staging` (Root dir `backend`, rama `development` o el commit a lanzar, Auto-Deploy Off, secretos propios) | **Toni** | Medio |
| 6 | En Vercel, definir `NEXT_PUBLIC_API_URL` **solo** para Preview de la rama `staging` apuntando al servicio de staging | **Toni** | **Medio:** un error aquí reapunta previews a producción o viceversa |
| 7 | Crear usuarios QA sintéticos en staging | Yo guío / Toni | Bajo |
| 8 | Ejecutar sondas Stage D (D1–D7) y archivar la evidencia con manifiesto y hash | Yo preparo scripts; **Toni** ejecuta | Bajo |
| 9 | Documentar resultados en un documento nuevo del paquete (no sobrescribir) | Yo | Bajo |

## 6. Sondas de Stage D (cómo se mide cada control)

Las suites de integración actuales **no pueden** usarse contra staging: sus guards solo permiten PostgreSQL local aislado (a
propósito). Hacen falta sondas HTTP nuevas (no existen todavía; las escribiría yo, sin credenciales en repo).

| Control | Sonda | Señal de paso | Dependencia |
|---|---|---|---|
| D1 atomicidad | `PUT` de rutina QA con id de ejercicio inválido | rutina intacta | usuario QA |
| D2 cuota concurrente | N peticiones simultáneas al coach con límite bajo | aceptadas ≤ límite; resto `429 quota_exhausted` con `windowResetsAt` | clave IA de staging o proveedor simulado |
| D3 idempotencia | misma `Idempotency-Key` ×N en paralelo y en secuencia | una ejecución; resto 409/replay; contadores +1 | — |
| D4 pooler | D1–D3 por la ruta de conexión de producción | mismos resultados; sin errores de prepared statement/transacción | **mismo modo de conexión que producción (paso 1)** |
| D5 multi-instancia | D2/D3 con ≥2 instancias del backend | el tope se mantiene; toma de lock correcta | **plan de Render con ≥2 instancias (coste)**; solo aplica si producción escala |
| D6 reloj | comparación de relojes entre instancias | decisiones coherentes dentro del margen de lock | D5 |
| D7 versión/estado | versión del motor y filas de `_prisma_migrations` | versión registrada; sin deriva; D1–D3 pasan | paso 2 |

## 7. Qué NO demuestra Stage D en staging

- No demuestra comportamiento bajo tráfico real ni carga sostenida.
- No sustituye la revisión independiente (B2) ni acepta AI-08: A-08-01 §6 lo dice expresamente.
- Si staging usa otra región, otro plan de Neon o distinto modo de conexión que producción, D4–D7 pierden valor: por eso los pasos 1–2.
- No prueba que el frontend de producción (Vercel `main`) sea compatible con el backend nuevo; eso requiere un smoke con la cuenta QA
  sobre el despliegue real antes de promocionar `main`.

## 8. Riesgos y controles

| Riesgo | Control |
|---|---|
| Preview de staging reapuntado a producción por una variable mal definida | Paso 6 con verificación posterior: leer **solo el nombre/hostname** de la variable por scope y confirmar que no es el de producción |
| Reutilizar secretos de producción | Lista del §4.4 revisada por Toni antes del primer despliegue |
| Datos personales reales en staging | Opción A: BD vacía; rama B descartada |
| Coste inesperado (Render ≥2 instancias, Neon, proveedor IA) | Medir coste antes (**DESCONOCIDO**); desactivar o borrar tras Stage D si no se mantiene |
| Staging olvidado y desactualizado | Reglas: Auto-Deploy Off, despliegue manual del commit candidato, fecha de revisión |

## 9. Decisiones que necesito de Toni para pasar de plan a ejecución

1. **Opción A, B o C** (recomiendo A).
2. Presupuesto: ¿aceptas un servicio Render adicional y, solo durante D5, ≥2 instancias?
3. Respuestas a los pasos 1–2 (pooler sí/no, nº de instancias de producción, versión PostgreSQL, planes).
4. ¿Autorizas registrar la excepción de contrato del paso 0?
5. ¿Mantener staging de forma permanente o solo durante Stage D y luego borrarlo?

## 10. Límites de este documento

Sin acceso a los paneles de Render, Neon y Vercel desde esta sesión: los puntos marcados **DESCONOCIDO** no se han verificado y los
costes no se han calculado. No hay compromiso de plazo.

## 11. Procedimiento vigente: Stage D en producción con identidad QA (opción C)

**Decidido por Toni el 2026-10-12.** No se crea ningún recurso nuevo; por tanto **no existe excepción al contrato de BD de staging**
(la que se planteaba en el paso 0 del §5 queda sin objeto). El procedimiento se registra como decisión
`IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12` en `AOS_ADOPTION.md`.

### 11.1 Datos de entrada (declarados por Toni)
| Dato | Valor | Efecto |
|---|---|---|
| Modo de conexión de producción | **pooler** (declarado por Toni) | D4 se cumple por construcción: toda sonda pasa por el pooler |
| Instancias del backend | **1 (plan Free)** — OBSERVADO en captura de Render del 2026-10-12: servicio `Anclora-Impulso`, etiqueta *Free*, aviso «free instance will spin down with inactivity… 50 seconds or more» | D5 y D6 **no aplican a la topología actual** (no hay varias instancias). Consecuencia práctica: arranques en frío de ~50 s; calentar el servicio antes de medir |
| Staging | No se crea (C) | La pregunta «¿permanente o solo Stage D?» queda sin objeto |
| Coste adicional | Ninguno nuevo | Decisión de Toni: no a un segundo servicio |

### 11.2 Reglas de seguridad del procedimiento (obligatorias)
1. **Solo la identidad QA dedicada** (`qa.impulso@anclora.local`). Nunca la cuenta personal de Toni ni usuarios reales. No se borra el usuario QA después.
2. **Sin datos personales reales** en peticiones ni en respuestas archivadas.
3. **N pequeño**: ráfagas de 5 a 10 peticiones, no más; ninguna prueba de carga.
4. **Una sola ventana** acotada, anunciada, con la hora de inicio y fin registrada (UTC y CEST).
5. **Sin cambiar configuración de producción** (cuotas, límites, variables) para facilitar la prueba.
6. **Parada inmediata** si aparece cualquier error 5xx inesperado o efecto sobre usuarios reales; se registra y no se reintenta.
7. **Evidencia archivada** en un directorio nuevo por ejecución, con `MANIFEST.sha256`, siguiendo `scripts/support/evidence-lib.sh`.
8. **Los proveedores de IA cuestan dinero real**: D2 consume cuota/coste real; mantener N en el mínimo útil.

### 11.3 Alcance por control
| Control | ¿Se puede en producción con QA? | Observación |
|---|---|---|
| D1 atomicidad | Sí | rutina QA con id de ejercicio inválido |
| D2 cuota concurrente | Sí, con reservas | El limitador de peticiones (documentado: 5 de IA/hora por usuario en `CLAUDE.md`, **no verificado hoy**) puede enmascarar la cuota; registrar qué mecanismo respondió |
| D3 idempotencia | Sí | misma `Idempotency-Key` ×N, en paralelo y en secuencia |
| D4 pooler | **Sí, por construcción** | (declarado) producción usa pooler |
| D5 multi-instancia | **No aplica** (1 instancia, plan Free) | Se registra «no aplica a la topología actual». Si el plan cambia a varias instancias, D5 pasa a obligatorio |
| D6 reloj | **No aplica** (idem D5) | idem |
| D7 motor/estado | Sí, solo lectura | `select version();` y `_prisma_migrations` (ya verificado hoy: 26 migraciones, 6 nuevas OK) |

### 11.4 Cómo averiguar las instancias (acción de Toni, solo lectura)
En el panel de Render: servicio `Anclora-Impulso` → pestaña **Scaling** (o **Settings → Instance Type / Scaling**). Anota el plan
y, si aparece, el número de instancias. Si el plan es Free, el servicio es de **una sola instancia** (no escala); si no encuentras la
pestaña de escalado, eso suele indicar plan fijo de una instancia. Si lo ves ambiguo, haz una captura de esa pantalla (sin variables).
No pegues valores de variables.

### 11.5 Qué sigue sin demostrar la opción C
- No demuestra comportamiento bajo carga real ni concurrencia entre varias instancias si solo hay una.
- Ejecutar en producción tiene riesgo operativo propio: de ahí las reglas del §11.2.
- No sustituye la revisión independiente ni acepta AI-08.
