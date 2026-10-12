# 31 — Diseño de las sondas Stage D (v1, 2026-10-12)

> Diseño y herramienta **sin ejecutar contra producción**. No acepta ninguna tarea AI-xx ni gate. Procedimiento marco:
> `30-staging-plan-stage-d-v1.md` §11 y decisión `IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12`.
> Script: `scripts/stage-d/stage-d-probes.mjs`.

## 1. Qué hace y qué no hace el script

| Aspecto | Comportamiento |
|---|---|
| Por defecto | **Dry-run**: imprime el plan y el presupuesto; no abre ninguna conexión |
| Para ejecutar | Exige a la vez `--execute`, `STAGE_D_WINDOW_ID`, `STAGE_D_CONFIRM=I-AUTHORIZE-<ventana>`, credenciales QA y host en lista blanca |
| Identidad | Solo cuentas con prefijo `qa.`; rechaza cualquier otra. La contraseña viene solo del entorno y nunca se imprime ni se guarda |
| Presupuesto | Tope duro de **40** peticiones (plan ≈ 24). El limitador global de producción es 100 / 15 min por IP |
| Parada | Aborta ante cualquier 5xx no esperado o error de red; el 5xx del D1 sí está declarado como esperable |
| Evidencia | Directorio nuevo en `artifacts/stage-d/<UTC>-<id>/` con `results.json`, `transcript.json` (sin cuerpos completos, sin tokens) y `MANIFEST.sha256` |
| Limpieza | Borra solo las rutinas que crea; **nunca** el usuario QA |

## 2. Sondas

| ID | Qué hace | Señal de paso | Coste real |
|---|---|---|---|
| D0 | Calentar servicio (hasta ~96 s) y un único login | 200 y token | 0 |
| D1 atomicidad | Crea una rutina QA con 1 ejercicio válido; `PUT` con un `exerciseId` UUID inexistente (FK) ; relee | El `PUT` falla (≥ 400) y los ejercicios de la rutina antes y después son idénticos | 0 |
| D2a admisión del coach | Ráfaga de **4** mensajes simultáneos con claves distintas | 2xx ≤ tope de concurrencia (por defecto 2), el resto `429` y total consistente | **Hasta 2 llamadas reales al proveedor de IA** |
| D3 idempotencia | Misma `Idempotency-Key` ×**5** en paralelo, luego una secuencial, luego otra con cuerpo distinto | Exactamente 1 ejecución (201); la secuencial devuelve 200 con `Idempotent-Replayed: true`; la de cuerpo distinto 422; el nº de rutinas sube exactamente +1 | **1 generación real** (proveedor de IA o fallback) |

**No incluido y por qué:**
- **D2b — agotamiento de cuota.** Exigiría tantas llamadas como el límite de ventana (por defecto 20/h) con coste real. Ya está cubierto en local; en producción se declara **no ejecutado**.
- **D4** (pooler): por construcción, según tu declaración. **D5/D6**: no aplican (una instancia).
- **D7** (motor y estado): SQL de solo lectura por Toni, ver §4.

## 3. Cómo se ejecuta (lo hace Toni)

1. **Elegir y anunciar la ventana** (p. ej. 15 minutos con poco tráfico) y un identificador, p. ej. `win-20261013a`.
2. **Una sola vez**, en tu terminal, sin guardar la contraseña en ningún fichero ni pegarla en el chat:
   ```bash
   cd anclora-impulso
   export STAGE_D_WINDOW_ID=win-20261013a
   export STAGE_D_CONFIRM=I-AUTHORIZE-win-20261013a
   export STAGE_D_QA_EMAIL=qa.impulso@anclora.local
   read -s STAGE_D_QA_PASSWORD && export STAGE_D_QA_PASSWORD
   node scripts/stage-d/stage-d-probes.mjs            # primero el dry-run
   node scripts/stage-d/stage-d-probes.mjs --execute
   ```
3. Pegarme aquí la **salida de consola** (líneas PASS/FAIL y la ruta de evidencia). No contiene credenciales.
4. Ejecutar las consultas D7 (§4) y pasármelas.

## 4. D7 — consultas de solo lectura (Neon, rama `main`)

```sql
select version();
select count(*) filter (where finished_at is not null and rolled_back_at is null) as applied,
       count(*) filter (where finished_at is null and rolled_back_at is null) as failed
from public._prisma_migrations;
```
Esperado: versión mayor registrada (documentada como 17, sin verificar); `failed = 0`; `applied` = 26 (20 baseline + 6 nuevas).

## 5. Límites de la verificación del script (honestidad)

- **Validado solo contra un servidor simulado local** que imita códigos de estado y cabeceras esperables (4/4 PASS). Eso prueba la
  lógica del script y sus guardas, **no** el comportamiento del backend real. Las formas de respuesta reales se leyeron del código,
  no de una ejecución.
- Posibles falsos negativos al primer intento: formas de respuesta no previstas (p. ej. el listado de ejercicios), cuenta QA sin el
  plan que requiera el coach, o proveedor de IA no configurado en producción (el coach devolvería error y liberaría la reserva).
  Un FAIL por esas causas **no** indica fallo de integridad: se anota y se ajusta la sonda.
- La concurrencia de una ráfaga de 4–5 desde un solo cliente mide admisión en una instancia, no concurrencia distribuida.
- Si el limitador de peticiones o el de autenticación (5 fallos/15 min) se disparan, el script se detiene: no reintentar.

## 6. Riesgos y controles

| Riesgo | Control |
|---|---|
| Coste de proveedor de IA | N mínimo; máximo ≈ 3 llamadas (2 + 1) |
| Bloqueo de la cuenta QA por intentos fallidos | Un único intento de login y parada inmediata |
| Efecto en usuarios reales | Ventana corta, ráfagas pequeñas, sin tocar configuración; se crean y borran solo rutinas QA |
| Servicio dormido (Free) | Calentamiento previo; el tiempo de arranque queda registrado |
| Credenciales en el historial del shell | `read -s` y variables de entorno; no usar `export X=valor` con la contraseña |

## 7. Qué no demuestra

No acepta AI-08, no sustituye la revisión independiente (B2) ni la A-08-01 §6, y no prueba carga real ni concurrencia entre
instancias. Es evidencia operativa limitada de que, en la topología real con pooler, los tres mecanismos se comportan como en local.
