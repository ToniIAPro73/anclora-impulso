# 34 — Paquete para el gate Hermes (copy) (v1, 2026-10-12)

> Material para que **Toni ejecute Hermes sobre el repositorio local**. No es una aprobación ni la emite el agente.
> Ruta designada: `29-decisions-record-2026-10-12.md` §1 (#5). Encargo C: `14-assignments/14C-hermes-copy.md`.
> Regla: `AGENTS.md` — «cambio que afecta copy público → Hermes Copy Curator antes del merge».

## 0. Aviso sobre el gate

El encargo C exige el **Hermes Copy Curator**, y el registro dice que un agente de IA genérico **no** cumple el gate. Si el agente
Hermes que usarás sobre el repositorio local es ese curador, el gate se cumple; si es el orquestador general, **es decisión tuya**
si cuenta como Hermes Copy Curator, y debe quedar anotado así en el registro. El agente que redactó esto no puede decidirlo.

## 1. Hecho a registrar

La copy ya está en `origin/development` (y se desplegó el backend `c0333f3` el 2026-10-12) **sin haber pasado este gate**.
Debe cerrarse **antes de cualquier promoción a `main`** (que despliega el frontend de producción).

## 2. Alcance

Solo las cadenas cambiadas para AI-02 («promesas y oferta honesta») y la insignia/aviso de modo real de AI-04/AI-05.
**Fuera:** textos legales (encargo D), reglas de ejercicio (encargo A), precios y posicionamiento.

## 3. Cadenas actuales (extraídas del repositorio en `c0333f3`)

| Clave / lugar | ES | EN |
|---|---|---|
| `home.smartWorkouts` (título landing; **sin cambiar**) | Generación Inteligente de Entrenamientos | Smart Workout Generation |
| `home.smartWorkoutsDesc` | Planes de entrenamiento adaptados a tu nivel de fitness, objetivos y equipo disponible, con apoyo de IA cuando está disponible | Workout plans tailored to your fitness level, goals, and available equipment, with AI assistance when available |
| `dashboard.stepTwoDesc` | Crea un entrenamiento personalizado a partir de tu perfil | Create a personalized workout from your profile |
| `nutrition.generateAiPlan` | Generar plan | Generate plan |
| `nutrition.generateMealPlanDescription` | Se creará un plan semanal personalizado | A personalized weekly plan will be created |
| `nutrition.emptyDescription` | Genera un plan de comidas o registra tus comidas manualmente | Generate a meal plan or log your meals manually |
| `workout-generator.tsx` botón principal | Generar entrenamiento | Generate workout |
| aviso, modo `ai` | Generado con IA a partir de tu perfil y las preferencias que acabas de revisar. Puedes regenerarlo o descartarlo antes de empezar. | Generated with AI from your profile and the preferences you just reviewed. You can regenerate or discard it before starting. |
| aviso, modo `fallback` | Plantilla estándar: la generación con IA no estaba disponible en este momento, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo más tarde. | Standard template: AI generation was not available at this moment, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it later. |
| aviso, modo `manual`/`unknown` | Propuesta basada en tu perfil y las preferencias que acabas de revisar… | Proposal based on your profile and the preferences you just reviewed… |
| insignia | Generado con IA · Plantilla estándar · Propuesta personalizada | Generated with AI · Standard template · Personalized proposal |

Diff completo (antes → después): `sdd/features/impulso-pilot-professional-review/ai-02-copy-diff-for-hermes-v1.md`.
Fuentes de verdad: `lib/translations/es.json`, `lib/translations/en.json`, `components/workout-generator.tsx`.

## 4. Criterios de revisión

1. Ningún texto promete generación con IA antes de conocer el resultado.
2. Tras el resultado se declara el modo real; el *fallback* se presenta como plan estándar válido, no como error.
3. Equivalencia de sentido ES/EN; tono de marca; sin afirmaciones clínicas ni de superioridad.
4. Los textos que mencionan IA describen solo lo que el producto hace hoy.

## 5. Decisiones abiertas para Hermes

| # | Pregunta |
|---|---|
| H1 | Redacción del aviso de *fallback* (ES/EN) y de las tres insignias |
| H2 | Título de landing «Generación Inteligente de Entrenamientos»: ¿mantener, cambiar o quitar «Inteligente»? |
| H3 | Nutrición: «Generar plan» frente al anterior «Plan IA» |
| H4 | La matriz promesa → función → prueba de AI-02 no existe (no hay paywall) |
| H5 | Cadenas no cambiadas por ser texto legal (encargo D) |
| H6 | El generador sigue anunciando «¡Entrenamiento Generado!» como éxito en modo *fallback*: ¿aceptable? |

## 6. Hecho nuevo desde la preparación del encargo (afecta a H1/H6)

En producción, el **coach de IA está desactivado** (`LLM_COACH_ENABLED` distinto de `true`; Stage D, documento 32). Por tanto:
- Las cadenas del coach no llegan hoy a usuarios.
- Verifica si el **generador de rutinas** usa IA o plantilla en producción: **no consta** (el script de Stage D no registró
  `generationMode`). Si siempre cae a plantilla, el aviso de *fallback* es el que verá el usuario de forma habitual. Esto es relevante
  para H1 y H6.

## 7. Instrucción sugerida para Hermes (copiar y pegar)

```
Actúa como Hermes Copy Curator del repositorio local anclora-impulso (rama development, commit c0333f3).
Revisa SOLO las cadenas listadas en sdd/features/impulso-pilot-review-package/34-hermes-copy-gate-package-v1.md §3.
Compara con lib/translations/{es,en}.json y components/workout-generator.tsx.
Aplica los criterios de §4 y responde a H1–H6 de §5.
NO modifiques ningún fichero. Devuelve, por cada cadena: veredicto (aprobada / cambios propuestos / no evaluable),
texto propuesto si procede (ES y EN) y justificación breve. Indica quién eres, la fecha y el commit revisado.
No apruebes nada fuera del alcance (textos legales, precios, reglas de ejercicio).
```

## 8. Qué devolverme

Guarda la respuesta de Hermes como fichero nuevo, p. ej. `36-hermes-copy-gate-result.md`, y dímelo. Yo:
1. Actualizaré el registro (`14-…`, encargo C → «DICTAMEN RECIBIDO», con identidad y versión).
2. Si hay cambios propuestos, los **aplicaré solo por tu orden expresa**, con tests, y reviso el diff antes de commitear.
3. Actualizaré el documento 28 (gate Hermes: cerrado/abierto).

## 9. Límites

La respuesta de Hermes no acepta AI-02, AI-04 ni AI-05, ni ningún gate. No cubre textos legales ni pagos (inexistentes).
