# 42 — Resultado del gate Hermes, segunda ronda (cadenas 8, 9 y 10), 2026-10-13

> Respuesta de Hermes **conservada literalmente** (§2); el §1 y el §3 son del agente. No acepta AI-02/04/05 ni ningún gate.
> Primera ronda: `36-hermes-copy-gate-result-v1.md`. Paquete: `34-hermes-copy-gate-package-v1.md`.

## 1. Identificación y reservas

| Campo | Valor |
|---|---|
| Revisor declarado | «Hermes Copy Curator» (declarado por Toni como el Copy Curator del gate) |
| Fecha / commit | 2026-10-13 · `61f6c15` (`development`; el código de `components/` y `lib/` coincide con `0123477`/`2e2d251`) |
| Forma | Veredicto por cadena + tabla resumen; declara no haber modificado ficheros |
| **Reserva A — la cadena 8 no se revisó** | La cadena 8 del encargo es el aviso del **modo IA** («Generado con IA…»). Hermes llamó «Cadena 8» a la tercera *pregunta* (fallo por validación) y no emitió veredicto sobre el texto del aviso `ai` |
| **Reserva B — dato erróneo** | Afirma que para distinguir validación de indisponibilidad «hace falta un campo `generation.fallbackReason` en el backend; hoy no existe». **Sí existe**: `generation.reason` (`workouts.service.ts:404-507`) con valores `ai_unavailable` (sin clave), `ai_output_rejected` (validación), `ai_timeout` y `ai_error`; ya viaja al cliente (`lib/api/index.ts:1200`) aunque el componente no lo usa |
| **Reserva C — número fijo** | Propone «10 generaciones por hora» **escrito en el texto**. El tope es configurable (`WORKOUT_GENERATE_WINDOW_LIMIT`, `_WINDOW_MINUTES`): el texto quedaría falso al cambiar la configuración |

## 2. Respuesta de Hermes (literal)

```
Hermes Copy Curator
Fecha: 13-10-2026 (CEST)
Commit revisado: 61f6c15 (development)

Cadena 9 — Aviso de fallback (generatedWorkout.generation?.mode === "fallback", líneas 491-492)
Veredicto: Cambios propuestos
Texto actual (ES): "Plantilla estándar: la generación con IA no estaba disponible en este momento, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo más tarde."
Texto actual (EN): "Standard template: AI generation was not available at this moment, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it later."
Texto propuesto (ES): "Plantilla estándar: la generación con IA no pudo completarse, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo cuando quieras."
Texto propuesto (EN): "Standard template: AI generation could not complete, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate anytime."
Justificación: La frase "no estaba disponible en este momento" implica indisponibilidad del servicio (API caída, cuota agotada, mantenimiento), pero el fallback también se activa cuando la IA devuelve un resultado que no pasa validación (estructura inválida, ejercicios imposibles, etc.). Cambiar a "no pudo completarse" cubre ambos casos sin prometer IA ni diagnosticar la causa. Se elimina "más tarde" por "cuando quieras" para no sugerir que volver a intentar garantiza modo IA.

Cadena 10 — Límite de generación (error 429, líneas 143-145)
Veredicto: Cambios propuestos
Texto actual (ES): Has alcanzado el límite de este periodo. Se restablece a las ${resetAt}.
Texto actual (EN): You have reached the limit for this period. It resets at ${resetAt}.
Texto propuesto (ES): Has alcanzado el límite de 10 generaciones por hora. Se restablece a las ${resetAt}.
Texto propuesto (EN): You have reached the limit of 10 generations per hour. It resets at ${resetAt}.
Justificación: El mensaje actual dice "este periodo" sin especificar cuál. El usuario no sabe si es por hora, día o sesión. Incluir "10 generaciones por hora" (el hecho conocido) da transparencia y reduce tickets de soporte. El reset time ya se muestra, así que la acción es clara: esperar o volver luego.

Cadena 8 — Qué debe decir el aviso si la IA falló por validación (misma ubicación que Cadena 9)
Veredicto: Cambios propuestos (ya cubiertos en Cadena 9)
Justificación: El fallback único no distingue entre "servicio IA no respondió" y "respuesta IA inválida". El texto propuesto ("no pudo completarse") es honesto en ambos casos: no atribuye culpa al usuario, no promete que reintentar dé modo IA, y presenta la plantilla como plan estándar válido (no degradado). Si en el futuro se quiere diferenciar, hace falta un campo generation.fallbackReason en el backend; hoy no existe.

Tabla resumen
9 (fallback): Cambios propuestos — "la generación con IA no pudo completarse… cuando quieras" / "AI generation could not complete… anytime"
10 (rate-limit): Cambios propuestos — "límite de 10 generaciones por hora" / "limit of 10 generations per hour"
8 (validación vs disponibilidad): Cambios propuestos — (mismo que Cadena 9) — requiere backend change para diferenciar
Nota: No he modificado ningún fichero. Los textos propuestos están listos para aplicar via patch si el criterio es aprobado.
```

## 3. Lectura del agente (no forma parte del dictamen)

| Cadena | Propuesta de Hermes | Lectura | Estado |
|---|---|---|---|
| 9 fallback | «no pudo completarse… cuando quieras» | **Correcta y aplicable.** Cubre `ai_output_rejected`, `ai_timeout`, `ai_error` y `ai_unavailable` sin diagnosticar; la premisa del dato `GROQ_API_KEY` ya no la contradice | Propuesta de aplicar |
| 10 tope | «límite de **10** generaciones por hora… Se restablece a las {hora}» | **Dos problemas:** (1) el número es configurable y no debe ir fijo en el texto; (2) **«se restablece» es inexacto**: la ventana es móvil y a la hora indicada se libera **una** generación (la más antigua), no el tope entero | Reformular |
| 8 aviso `ai` | Sin veredicto sobre el texto | **No revisada** | Reenviar |
| Pregunta «validación vs disponibilidad» | «hace falta un campo en el backend» | Falso: `generation.reason` ya existe; diferenciar es posible solo en cliente, aunque Hermes considera suficiente un texto único | Informativo |

**Opciones para la cadena 10** (decide Toni):

| Opción | Texto ES | Coste |
|---|---|---|
| A | «Has alcanzado el límite de generaciones de este periodo. Podrás generar otra a las {hora}.» | Solo cliente; sin número; exacto con la ventana móvil |
| B | «Has alcanzado el límite de {n} generaciones cada {m} minutos. Podrás generar otra a las {hora}.» con `{n}` y `{m}` enviados por el servidor | Cliente + una línea en el backend (`limit`, `windowSeconds` en el `429`) y redespliegue |

## 4. Decisión de Toni y aplicación (2026-10-13)

| Cadena | Decisión | Aplicado | Texto final |
|---|---|---|---|
| 9 fallback | Sí, tal como propone Hermes | **Sí** | ES «Plantilla estándar: la generación con IA no pudo completarse, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo cuando quieras.» · EN «Standard template: AI generation could not complete, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it anytime.» |
| 10 tope | Opción A (sin cifra) | **Sí** | ES «Has alcanzado el límite de generaciones de este periodo. Podrás generar otra a las {hora}.» · EN «You have reached the generation limit for this period. You can generate another at {hora}.» |
| 8 aviso `ai` | — | **No** | Pendiente de reenviar a Hermes (reserva A) |

**Nota de gate:** la redacción final de la cadena 10 **no es la que Hermes propuso** (la suya llevaba la cifra fija y «se restablece»),
sino una variante decidida por Toni con las razones de §1/§3. Por haber sido modificada tras la revisión, **debe volver a pasar por
Hermes** para quedar dentro del gate. La cadena 9 sí coincide literalmente con la propuesta de Hermes.

**Verificación:** E2E aislado `e2e/session-and-fallback.spec.ts` **13/13**, con aserciones nuevas (fase roja observada: fallaba
solo la del texto del aviso antes del cambio): el aviso contiene «no pudo completarse/could not complete» y no «no estaba
disponible», y el mensaje de tope contiene «Podrás generar otra/You can generate another» y no «restablece/resets». Los cuatro casos
de ventana y tema (móvil/escritorio, claro/oscuro) siguen cabiendo en pantalla. Jest frontend sin cambios.
