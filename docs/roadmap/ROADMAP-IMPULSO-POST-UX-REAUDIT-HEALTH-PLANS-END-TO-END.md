# ROADMAP — Anclora Impulso Post UX Re-audit + Health Plans

Este documento es el índice ejecutivo. La ejecución detallada está en [`impulso-post-ux-health/00-ROADMAP-MASTER.md`](impulso-post-ux-health/00-ROADMAP-MASTER.md) y los ocho documentos P0–P7.

## Contract

| Campo | Valor |
|---|---|
| Base | `development` |
| Baseline | `c37f068f20de71c9e58079a0b4846de615e1edf2` |
| Primera fase funcional | P1 — Ruta Vital 50–60 |
| Modo de esta entrega | authoring only; `IMPLEMENTATION_STARTED = NO` |
| Product code | no modificar en esta misión |
| Data policy | synthetic fixtures; no auto-enrollment; no destructive writes |
| Release | final gate → CI → development → staging → production → main |

## Phase order

| Phase | Outcome | Main drivers |
|---|---|---|
| P0 | authority baseline, content/safety/test contracts | audit traceability; health boundaries |
| P1 | Ruta Vital 50–60 persistent weekly experience | new capability; UX-07 systemic opportunity |
| P2 | focused workout workspace | UX-01, UX-02, UX-03 |
| P3 | coherent public/auth entry | UX-08, UX-09, UX-10, UX-11 |
| P4 | controllable and explainable AI | UX-05 |
| P5 | useful progress/nutrition/gamification loop | UX-06, UX-07 |
| P6 | exercise discovery/content quality | UX-04 |
| P7 | premium, PWA and release hardening | residual quality and release risk |

## Phase file index

- [00 Roadmap master](impulso-post-ux-health/00-ROADMAP-MASTER.md)
- [P0 Baseline](impulso-post-ux-health/P0-BASELINE.md)
- [P1 Ruta Vital 50–60](impulso-post-ux-health/P1-RUTA-VITAL-50-60.md)
- [P2 Workout experience](impulso-post-ux-health/P2-WORKOUT-EXPERIENCE.md)
- [P3 Public and auth](impulso-post-ux-health/P3-PUBLIC-AUTH.md)
- [P4 AI trust](impulso-post-ux-health/P4-AI-TRUST.md)
- [P5 Fitness loop](impulso-post-ux-health/P5-FITNESS-LOOP.md)
- [P6 Exercise discovery](impulso-post-ux-health/P6-EXERCISE-DISCOVERY.md)
- [P7 Release hardening](impulso-post-ux-health/P7-RELEASE-HARDENING.md)

## Health-plan acceptance

P1 solo pasa si una persona sintética puede descubrir, unirse, completar onboarding no clínico, atravesar safety, ver fase/semana/objetivo/NBA/minimum version, entrar en Workout/Nutrition/Progress, volver y conservar el estado. `age` alone never enrolls or determines capacity.

## Promotion

No force push. No skip branches. Each phase has an explicit final gate and a separate promotion decision. A failed safety/provenance/privacy/no-diagnosis gate blocks release even when UI tests are green.
