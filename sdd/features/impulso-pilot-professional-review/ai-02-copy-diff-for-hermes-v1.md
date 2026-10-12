# AI-02 — promise/fallback copy: diff for the Hermes copy gate

**Gate status: PENDING.** No Hermes Copy Curator is available in this environment; no approval is claimed. The
repository rule (`AGENTS.md`: a change affecting public copy needs Hermes before merge) remains in force.
Applied locally only; nothing committed or deployed.

## Principle
Before the outcome is known the interface must not promise AI generation. After the outcome it states the real mode,
and a fallback is explained as a valid standard plan, not as an error.

## Changes
| File | Key / location | Before | After |
|---|---|---|---|
| `components/workout-generator.tsx` | primary button (ES) | Generar Entrenamiento con IA | Generar entrenamiento |
| same | primary button (EN) | Generate AI Workout | Generate workout |
| same | result notice, mode `ai` (ES) | La IA usa tu perfil y las preferencias que acabas de revisar. Puedes regenerar o descartar antes de empezar. | Generado con IA a partir de tu perfil y las preferencias que acabas de revisar. Puedes regenerarlo o descartarlo antes de empezar. |
| same | result notice, mode `ai` (EN) | The AI uses your profile and the preferences you just reviewed. … | Generated with AI from your profile and the preferences you just reviewed. You can regenerate or discard it before starting. |
| same | result notice, mode `fallback` (ES) | Esta propuesta usa una plantilla estándar porque la generación con IA no estaba disponible o no superó las comprobaciones. Se adapta a tu perfil y preferencias; puedes regenerarla más tarde o descartarla antes de empezar. | Plantilla estándar: la generación con IA no estaba disponible en este momento, así que hemos preparado un plan estándar adaptado a tu perfil y preferencias. Es un plan válido: puedes empezar o regenerarlo más tarde. |
| same | result notice, mode `fallback` (EN) | This proposal uses a standard template because AI generation was unavailable or did not pass the checks. … | Standard template: AI generation was not available at this moment, so we prepared a standard plan adapted to your profile and preferences. It is a valid plan: you can start it or regenerate it later. |
| same | result notice, mode `manual`/`unknown` | (shown the AI text) | Propuesta basada en tu perfil y las preferencias que acabas de revisar… / Proposal based on your profile and the preferences you just reviewed… |
| same | new mode badge (`data-testid=generation-mode`) | — | "Generado con IA" / "Plantilla estándar" / "Propuesta personalizada" (EN: Generated with AI / Standard template / Personalized proposal) |
| `lib/translations/es.json` | `home.smartWorkoutsDesc` | Planes de entrenamiento impulsados por IA adaptados a tu nivel… | Planes de entrenamiento adaptados a tu nivel de fitness, objetivos y equipo disponible, con apoyo de IA cuando está disponible |
| `lib/translations/en.json` | `home.smartWorkoutsDesc` | AI-powered workout plans tailored to … | Workout plans tailored to your fitness level, goals, and available equipment, with AI assistance when available |
| es/en | `dashboard.stepTwoDesc` | Usa nuestra IA para crear un entrenamiento personalizado / Use our AI to create a personalized workout | Crea un entrenamiento personalizado a partir de tu perfil / Create a personalized workout from your profile |
| es/en | `nutrition.generateAiPlan` | Generar Plan IA / Generate AI Plan | Generar plan / Generate plan |
| es/en | `nutrition.generateMealPlanDescription` | La IA creará un plan semanal personalizado / AI will create a personalized weekly plan | Se creará un plan semanal personalizado / A personalized weekly plan will be created |
| es/en | `nutrition.emptyDescription` | …con IA o registra… / …an AI meal plan or… | …un plan de comidas o registra… / …a meal plan or… |

Colour/role: the fallback notice keeps the informational orange panel with `role="status"`; it is not rendered as an
error (the error panel is separate, `role="alert"`). E2E asserts both.

## Found and deliberately NOT changed (needs owner/legal/Hermes decision)
| Location | Text | Why not changed |
|---|---|---|
| `components/legal-document.tsx` (ES/EN) | "funciones … asistidas por IA" / "AI-assisted fitness, nutrition and progress features" | Legal text; requires legal review (AI-07) |
| `app/landing/page.tsx` title key `home.smartWorkouts` | "Generación Inteligente de Entrenamientos" | Brand wording; implies intelligence not AI generation — flag for Hermes |
| `app/nutrition/meal-plans/[id]/page.tsx` | recipe source label "IA" | Data-driven label of a recipe's `source`; accurate if the source is `ai` |
| Paywall / pricing copy | — | No paywall exists in the repo (AI-15…17 pending); AI-02 matrix must be completed when it does |

## Evidence
`e2e/session-and-fallback.spec.ts`: button label has no "IA"/"AI" before the result; after the result the badge has
`data-mode="fallback"`, the notice is `role=status`, no error panel is present, and the text does not contain
"error". Visual capture (mobile/desktop × light/dark) in `artifacts/qa/` (git-ignored). Existing component test
updated for the new button name.
