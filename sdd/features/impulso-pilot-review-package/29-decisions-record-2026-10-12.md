# 29 — Registro de decisiones de Toni (2026-10-12)

> Registro fiel de las decisiones comunicadas por Toni el 2026-10-12, con sus consecuencias y límites. **No acepta ninguna tarea
> AI-xx ni ningún gate (G1–G4)**, no envía nada a nadie y no sustituye ninguna revisión. Estado de gates: `28-…`.

## 1. Decisiones

| # | Tema | Decisión de Toni | Efecto registrado | Lo que NO produce |
|---|---|---|---|---|
| 1 | AI-01 | Acepta `B-D6` (sin persona asignada a las tareas, como estado válido). El «técnico» es Toni. | Cumple el criterio «responsables» de AI-01 sin inventar nombres. Técnico nombrado. | **AI-01 no pasa a ACEPTADA**: falta la revisión del técnico (N7) y la declaración expresa de aceptación de AI-01. N1–N4 siguen explícitos. |
| 2 | A-08-01 | Aprobado tal cual | Aprobado por el propietario en `02-…` §7. Stage L acepta la evidencia local para Accept 1–3; Stage D obligatorio antes de lanzar; revisión independiente separada. | **AI-08 no queda aceptada**: requiere revisión independiente, AI-01 aceptada y Stage D. |
| 3 | Staging | Sí, debe existir | Decisión registrada. Aún **no se ha creado ni configurado** nada. | Ningún entorno staging existe por esta decisión. |
| 4 | Revisores | A y D: diferidos. B1 y B2: Toni. | B1 y B2 pasan a «DESIGNADO, PENDIENTE DE ACEPTAR EL ENCARGO». A y D siguen sin designar. | No hay dictamen. Ver §3 sobre independencia. |
| 5 | Hermes (C) | El propio agente Hermes sobre el repositorio local | C pasa a «DESIGNADO, PENDIENTE DE ACEPTAR EL ENCARGO» (ruta designada). | Hermes no se ha ejecutado; no hay aprobación de copy. |

## 2. Consecuencias sobre tareas y gates

| Elemento | Antes | Ahora | Pendiente |
|---|---|---|---|
| AI-01 | PENDIENTE | PENDIENTE (B-D6 aceptado; técnico = Toni) | Revisión del técnico (N7) + aceptación expresa |
| AI-02 | PENDIENTE | PENDIENTE | Resultado de Hermes (C) |
| AI-03 | BLOQUEADA | BLOQUEADA | Revisor profesional (A, diferido) |
| AI-06 | PENDIENTE; AC10 BLOQUEADA | igual | Dictamen B1 y decisión de transporte de token |
| AI-07 | PENDIENTE | PENDIENTE | Revisor legal (D, diferido) |
| AI-08 | No aceptada | No aceptada (Stage L habilitado) | Revisión independiente, AI-01, Stage D en staging |
| G1–G4 | No cumplidos | No cumplidos | Ver `28-…` |

## 3. Independencia (advertencia explícita)

- **B1 y B2 designados a Toni no son independientes.** Toni dirigió la implementación (con un agente IA) y es el propietario del
  producto. El plan exige, para tareas P0, una «revisión competente, independiente»; A-08-01 §2 lo recoge como requisito
  separado. La designación queda **registrada tal como Toni la hizo**, pero **no sustituye** a esa revisión independiente.
- **Lo que sí aporta:** una revisión del propietario con competencia declarada es un control adicional válido y documentable;
  conviene escribirla como dos dictámenes separados (B1 y B2), con su alcance, fecha y versión revisada.
- **Técnico = Toni:** el rol «Toni + técnico» de AI-01 queda ocupado por una sola persona; la co-revisión es nominal hasta que
  haya una segunda persona.
- **Hermes (C)** no participó en la implementación, por lo que no tiene ese conflicto. Su resultado debe volver como documento.

## 4. Siguientes pasos derivados (ninguno ejecutado)

1. Toni redacta o dicta los dictámenes B1 y B2 sobre la versión indicada en el registro (ZIP `ae3e5575…`, o HEAD).
2. Toni ejecuta Hermes sobre la copy (`07-packet-hermes-copy.md`, `ai-02-copy-diff-for-hermes`) y devuelve el resultado.
3. Preparar staging (ver documento de plan cuando se redacte): entorno desplegado no productivo con BD aislada.
4. Revisión del técnico (N7) y, si procede, aceptación expresa de AI-01.
5. A y D siguen diferidos: sin ellos, AI-03/04/05 y AI-07 siguen bloqueadas.
