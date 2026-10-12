# 36 — Resultado del gate Hermes (copy), recibido 2026-10-12

> Respuesta de Hermes **conservada literalmente** (§2), tal como la pegó Toni. El agente que redacta este documento añade solo
> el §1 (identificación y reservas) y el §3 (lectura). **No acepta AI-02, AI-04, AI-05 ni ningún gate.**
> Encargo: `14-assignments/14C-hermes-copy.md` · paquete: `34-hermes-copy-gate-package-v1.md`.

## 1. Identificación y reservas

| Campo | Valor |
|---|---|
| Revisor declarado | «Hermes Copy Curator» (declarado por Toni como el Copy Curator del gate, 2026-10-12) |
| Fecha / commit | 2026-10-12 · `c0333f3` (rama `development`), según la propia respuesta |
| Forma | Estructurada: veredicto por cadena + respuestas H1–H6 + resumen |
| Modificó ficheros | No (lo declara; el árbol de trabajo estaba limpio) |
| **Reserva A — premisa** | Varias justificaciones (cadenas 1, 8, 9, 11 y H1) parten de que «el coach está desactivado» implica que la IA del generador está desactivada o que el *fallback* es «por defecto». **No está respaldado** (`34-…` §6bis): el generador usa IA solo si existe `GROQ_API_KEY`, independiente de `LLM_COACH_ENABLED`; **no consta** si producción la tiene |
| **Reserva B — alcance de H4** | Dice que «el gate se cierra en ese aspecto». La matriz promesa → función → prueba de AI-02 sigue sin existir y el criterio del plan exige «matriz aprobada»; el curador de copy no puede darla por cerrada |
| **Reserva C — referencia** | Cita la clave `workouts.workoutGenerated`; en el código el texto está **escrito en línea** en `components/workout-generator.tsx:455` (la clave existe en los JSON pero el componente no la usa) |
| Cadenas revisadas | 11 del paquete + una más (la nº 12, que el propio Hermes identificó) |

## 2. Respuesta de Hermes (literal)

```
Hermes Copy Curator — 2026-10-12 — commit c0333f3 (rama development)

1. home.smartWorkouts — «Generación Inteligente de Entrenamientos» / «Smart Workout Generation»
Veredicto: Cambios propuestos
ES propuesto: Generación de Entrenamientos
EN propuesto: Workout Generation
Justificación: H2. El adjetivo «Inteligente»/«Smart» sugiere IA cuando el coach está desactivado en producción (§6). Criterio 4: los textos que mencionan IA deben describir solo lo que el producto hace hoy. Quitar el adjetivo elimina la promesa implícita.

2. home.smartWorkoutsDesc — «Planes de entrenamiento adaptados a tu nivel de fitness, objetivos y equipo disponible, con apoyo de IA cuando está disponible» / «Workout plans tailored to your fitness level, goals, and available equipment, with AI assistance when available»
Veredicto: Aprobada
Justificación: Lenguaje condicional («cuando está disponible» / «when available») — no promete IA antes de conocer el resultado (C1). Equivalencia ES/EN correcta (C3). Honesto sobre el estado actual (C4).

3. dashboard.stepTwoDesc — «Crea un entrenamiento personalizado a partir de tu perfil» / «Create a personalized workout from your profile»
Veredicto: Aprobada
Justificación: Sin mención a IA. «Personalizado»/«personalized» describe el resultado, no el método. Cumple C1, C3, C4.

4. nutrition.generateAiPlan — «Generar plan» / «Generate plan»
Veredicto: Aprobada
Justificación: H3. Cambio desde «Plan IA» a «Generar plan» es correcto: neutro, sin promesa de IA. Cumple C1 y C4.

5. nutrition.generateMealPlanDescription — «Se creará un plan semanal personalizado» / «A personalized weekly plan will be created»
Veredicto: Aprobada
Justificación: Futuro neutro, sin atribución a IA. Equivalencia correcta. Cumple C1, C3, C4.

6. nutrition.emptyDescription — «Genera un plan de comidas o registra tus comidas manualmente» / «Generate a meal plan or log your meals manually»
Veredicto: Aprobada
Justificación: Ofrece ambas vías sin jerarquizar. Neutro y honesto. Cumple C1, C3, C4.

7. workout-generator.tsx botón principal — «Generar entrenamiento» / «Generate workout»
Veredicto: Aprobada
Justificación: Acción neutra, sin promesa de IA. Cumple C1, C4.

8. Aviso modo ai — «Generado con IA a partir de tu perfil y las preferencias que acabas de revisar. Puedes regenerarlo o descartarlo antes de empezar.» / «Generated with AI from your profile and the preferences you just reviewed. You can regenerate or discard it before starting.»
Veredicto: No evaluable
Justificación: §6: el coach de IA está desactivado en producción (LLM_COACH_ENABLED ≠ true); esta cadena no llega a usuarios hoy. C4 no puede verificarse en vivo.

9. Aviso modo fallback — «Plantilla estándar: la generación con IA no estaba disponible en este momento, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo más tarde.» / «Standard template: AI generation was not available at this moment, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it later.»
Veredicto: Cambios propuestos
ES propuesto: Plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo más tarde.
EN propuesto: Standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it later.
Justificación: H1. C2 se cumple (fallback presentado como plan válido, no error). Pero §6 indica que el generador puede caer siempre a plantilla; «la generación con IA no estaba disponible en este momento» implica indisponibilidad temporal, no arquitectura actual. C4: el texto debe describir lo que el producto hace hoy. Eliminar la referencia a IA no disponible evita expectativa falsa.

10. Aviso modo manual/unknown — «Propuesta basada en tu perfil y las preferencias que acabas de revisar…» / «Proposal based on your profile and the preferences you just reviewed…»
Veredicto: Aprobada
Justificación: Neutro, describe el origen (perfil + preferencias) sin atribuir método. Cumple C1, C3, C4.

11. Insignia (tres estados) — «Generado con IA · Plantilla estándar · Propuesta personalizada» / «Generated with AI · Standard template · Personalized proposal»
Veredicto: Aprobada
Justificación: H1. Cada etiqueta describe correctamente su modo. «Plantilla estándar» es la que verá el usuario habitual (fallback por defecto). No…no promete superioridad clínica. Equivalencia ES/EN correcta. Cumple C2, C3, C4.

12. workouts.workoutGenerated — «¡Entrenamiento Generado!» / «Workout Generated!»
Veredicto: Cambios propuestos
ES propuesto: Entrenamiento listo
EN propuesto: Workout ready
Justificación: H6. El toast de éxito aparece también en modo fallback (línea 455-456 del componente). «¡Entrenamiento Generado!» celebra la generación como éxito sin distinguir modo; en fallback puede leerse como «la IA lo hizo». C2: el fallback debe presentarse como plan estándar válido, no como logro de IA. Texto neutro evita la confusión.

Respuestas a H1–H6
H1 — Aviso fallback: eliminar «la generación con IA no estaba disponible…» → propuesto arriba. Insignias: aprobadas tal cual.
H2 — Quitar «Inteligente»/«Smart» → propuesto arriba.
H3 — Cambio correcto; aprobado.
H4 — No existe paywall; la copy revisada no promete IA antes de resultado (C1). Gate se cierra en ese aspecto.
H5 — Fuera de alcance — no evaluadas.
H6 — No aceptable tal cual. Propuesta neutra arriba.

Fin del dictamen. No modificaré ficheros. Aplica los cambios propuestos solo por orden expresa.
```

(Nota de formato: la tabla de H1–H6 se aplanó a lista para el fichero; el contenido es el mismo.)

## 3. Lectura del agente (no forma parte del dictamen)

| Cadena / H | Veredicto de Hermes | ¿Depende de la premisa errónea? | Estado propuesto |
|---|---|---|---|
| 2, 3, 4, 5, 6, 7, 10 | Aprobadas | No | **Aprobadas** (sin dependencia) |
| 11 insignia | Aprobada | Solo en la frase «verá el usuario habitual»; el veredicto no | **Aprobada**; ignorar esa frase |
| 1 título | Cambios propuestos | Parcial: el criterio 4 sostiene la propuesta con independencia | **Decisión de Toni** |
| 12 «¡Entrenamiento Generado!» | Cambios propuestos | No (se basa en lo que muestra el componente en modo fallback) | **Decisión de Toni** |
| 8 aviso modo `ai` | No evaluable | **Sí.** Si hay `GROQ_API_KEY` es alcanzable y evaluable; su texto es coherente con el criterio 2 | **Pendiente** de saber si existe la clave |
| 9 aviso fallback | Cambios propuestos | **Sí.** Con clave: «no estaba disponible en este momento» es verdad (fallo temporal/validación); sin clave: sería engañoso | **Pendiente** de saber si existe la clave |
| H4 | «Gate se cierra» | Fuera de alcance del curador | **No válido** (Reserva B) |

Pendiente único para resolver 8 y 9: ¿existe `GROQ_API_KEY` en Render → Environment (solo el nombre)? Hasta entonces, no aplicar
los cambios de las cadenas 8 y 9.

## 4. Decisiones de Toni y aplicación (2026-10-12, mensaje posterior)

| Cadena | Orden de Toni | Aplicado | Dónde |
|---|---|---|---|
| 12 «¡Entrenamiento Generado!» / «Workout Generated!» | Aplicar la propuesta | **Sí**, sin commit en el momento de escribir | `components/workout-generator.tsx:455` (texto en línea) y claves `workouts.workoutGenerated` en `lib/translations/{es,en}.json` → «Entrenamiento listo» / «Workout ready» |
| 1 `home.smartWorkouts` | Quitar «Inteligente» y «Smart» (ES y EN) | **Sí**, sin commit en el momento de escribir | `lib/translations/{es,en}.json` → «Generación de Entrenamientos» / «Workout Generation» |
| 8, 9 | Sin orden de cambio | **No** | Ver §5 |

Verificación mínima suficiente (solo cadenas, sin lógica): JSON válidos y `__tests__/components/modal-scroll-close-and-localization.test.tsx`
8/8; ninguna prueba ni E2E referencia los textos antiguos (búsqueda en `__tests__` y `e2e`). No se ejecutó el E2E ni la suite completa.

## 5. Dato nuevo: `GROQ_API_KEY` existe en Render (declarado por Toni, 2026-10-12)

Resuelve la Reserva A: con la clave presente el generador **puede** usar IA, de modo que el aviso del modo `ai` (cadena 8) es
alcanzable y su texto es coherente con los criterios 2 y 4, y «la generación con IA no estaba disponible en este momento» (cadena 9)
es una descripción verdadera de un fallo temporal o de una validación no superada.

| Cadena | Veredicto de Hermes | Efecto del dato | Estado |
|---|---|---|---|
| 8 aviso `ai` | No evaluable (premisa errónea) | Evaluable; sin cambio de texto propuesto | **Pendiente de que Hermes la reevalúe** con el dato |
| 9 aviso *fallback* | Cambiar (premisa errónea) | La premisa «arquitectura actual sin IA» no se sostiene | **No aplicada**; pendiente de reevaluación |

Limitación: que la clave **exista** no prueba que sea válida ni que el proveedor responda; no se sabe con qué frecuencia la
generación cae a plantilla en producción (el Stage D no registró `generationMode`).
