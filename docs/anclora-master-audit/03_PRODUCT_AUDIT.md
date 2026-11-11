# 03 — Auditoría funcional y de experiencia de usuario

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09. Fuente principal: código de `app/`, `components/`, `hooks/`, y la SPEC del programa Post-UX.

---

## 1. Propuesta de valor (según el repositorio)

| Elemento | Enunciado | Fuente | Estado |
|---|---|---|---|
| Promesa | Entrenamientos personalizados con IA y seguimiento inteligente | `README.md` | CONFIRMADO (documentado) |
| Diferencial declarado | Personalización con perfil, equipo y progreso | `README.md`, `services/workouts.service.ts` | CONFIRMADO en código (perfil y equipo influyen en la generación) |
| Diferencial real observado | Respaldo determinista cuando la IA no responde; validador de planes | `services/workouts/deterministic-fallback.ts`, `plan-validator.ts` | CONFIRMADO |
| Diferencial de la línea 50+ | Ruta Vital: opt-in, educación, progresión y hábitos (no diagnóstico) | `docs/specs/...` §1 | CONFIRMADO (documentado), contenido incompleto (AUD-021) |
| Promesa de negocio no respaldada | "GPT-4", "100 ejercicios validados por profesionales", precios freemium | `docs/business/EXECUTIVE-SUMMARY.md` | NO VERIFICADO / contradicho (AUD-009) |

**Conclusión:** la propuesta funcional real es **entrenamiento personalizado con IA + seguimiento + capa de hábitos para 50+**. La narrativa de negocio es más amplia y no coincide con el código.

---

## 2. Público objetivo (inferido)

| Segmento | Evidencia | Estado |
|---|---|---|
| Adultos que empiezan a entrenar con fuerza | Preguntas de nivel de experiencia y entorno (`onboarding-dialog.tsx`) | INFERIDO |
| 40+ | `forty-plus-guidance.ts` aplica reglas para edad ≥ 40 | CONFIRMADO |
| 50–60 | Ruta Vital (`isInCohort(age, 50, 60)`) | CONFIRMADO |
| Usuarios de 14–17 años | Perfil acepta `age` ≥ 14 (`validators.ts:18`) | CONFIRMADO; tratamiento legal NO VERIFICADO (AUD-003) |

---

## 3. Mapa de funcionalidades: implementado, parcial, ausente

| Área | Implementado | Parcial | Ausente / no verificable |
|---|---|---|---|
| Captación | Registro, login, OAuth, recuperación | — | Verificación de email en el flujo: NO VERIFICADO |
| Onboarding | Diálogo con perfil completo | Completitud calculada en cliente (`previewCompletion`) | Onboarding no clínico por segmentos |
| Entrenamiento | Generación, revisión, ejecución, progreso | Ejecución en modo "hoja de series" (UX-01) | Periodización explícita de ciclos |
| Biblioteca | Filtros, detalle, medios | Imágenes de fallback ocupan espacio (UX-04) | — |
| Progreso | Gráficos, récords, volumen | Lecturas con pocos datos parecen fallo (UX-06) | — |
| Nutrición | Planes, recetas, registro, objetivos | Vinculación a entrenamiento parcial (UX-07) | — |
| Motivación | XP, logros, retos, social (API) | UI social NO VERIFICADA | — |
| Coach IA | Conversación con guardrails | — | Memoria a largo plazo: NO VERIFICADO |
| Ruta Vital | Inscripción, safety, semana, acciones, progreso | Contenido de 4 semanas plantilla (AUD-021) | 20 semanas restantes de contenido |
| Monetización | Campo `subscriptionTier` | — | Pago y límites comerciales: NO VERIFICADO |

---

## 4. Flujos principales y fricción observada (desde código)

| Flujo | Pasos observados | Fricción identificada | Tipo |
|---|---|---|---|
| Primer entrenamiento | Login → onboarding (campos obligatorios de sexo, edad, objetivo, días, entorno) → generar | El formulario exige muchos campos antes del primer valor (`nutrition/page.tsx:325` lo recoge como requisito) | Producto, observado en código |
| Ejecutar sesión | Revisión → inicio → series | Vista larga de series (UX-01); menú oculto en móvil (UX-02) | Documentado, cerrado en P2 según gate |
| Unirse a Ruta Vital | Página de salud → onboarding no clínico → safety → semana | Concepto "Ruta Vital" sin explicación de público (hipótesis de comprensión) | Requiere pruebas con usuarios |
| Cambiar de modalidad | No existe | Sin flujo de cambio de plan | Ausente |
| Editar perfil | `profile-dialog.tsx` | Sexo solo binario con etiquetas "male/female" | Observado en código (AUD-012) |
| Cerrar sesión | `auth.controller.ts:109-111` | Refresh viaja en body | Técnico (AUD-001) |

---

## 5. Onboarding existente

- **Qué pide:** nombre, edad (14–100), sexo (`male`/`female`), altura, peso, peso objetivo, plazo, días de entrenamiento, objetivo, entorno, experiencia, limitaciones (`validators.ts:286-310`, `onboarding-dialog.tsx`).
- **Qué no pide en el registro:** ni edad, ni sexo, ni objetivo (`validators.ts:4-8`: solo email, contraseña y nombre). CONFIRMADO.
- **Consentimiento:** banner de cookies (`cookie-consent.tsx`); no hay consentimiento específico para datos de salud ni para menores (AUD-003).
- **Límites:** la edad mínima de 14 años no tiene justificación documentada en las páginas legales (CONFIRMADO: 0 coincidencias).

---

## 6. Accesibilidad (WCAG 2.1 AA) — evaluación desde fuente

| Criterio | Evidencia en fuente | Estado |
|---|---|---|
| Nombres accesibles en formularios de entrenamiento | P2: `fieldset` y `label` nativos (gate `P2-FINAL-GATE-REPORT.md`) | Declarado PASS; **no verificado en navegador** |
| Foco en modales | `hooks/use-focus-trap.ts`; `__tests__/components/modal-scroll-close-and-localization.test.tsx` | CONFIRMADO en test |
| Contraste de la paleta de prueba | `A11Y_COLORS` en `lib/a11y/useAriaLabel.ts` | CONFIRMADO; contraste real NO VERIFICADO |
| Idioma del documento | `DocumentLanguageSync` (P7) | Declarado PASS |
| Ruta Vital en móvil | `safe-area` y tarjetas responsivas (P3) | Declarado PASS |

Ninguna de estas comprobaciones se ha reproducido en navegador. Para cerrar la auditoría de accesibilidad hace falta `agent-browser` / `anclora-visual-qa` (fuera de alcance de esta ejecución).

---

## 7. Visual QA

**No realizada.** Motivo: la auditoría es de solo análisis, y la comprobación visual con navegador requiere ejecutar la aplicación contra el backend de producción. Queda como tarea pendiente (`TASK-013`, E2E y visual QA sobre entorno controlado).

---

## 8. Estados vacíos, errores y comprensión

| Aspecto | Observación | Estado |
|---|---|---|
| Estado vacío de progreso | Lecturas con pocos datos muestran KPI bajos (UX-06) | Documentado; cerrado en P5 |
| Errores de API | `AppError` y mensajes en español/inglés | CONFIRMADO |
| Mensajes de límite de IA | Cuota y reserva de cuota (`idempotency`), mensajes de límite | CONFIRMADO en servicio; texto de UI NO VERIFICADO |
| Errores de validación en onboarding | Zod + mensajes en español | CONFIRMADO |

---

## 9. Hallazgos de producto (IDs en `09_FINDINGS_AND_OPPORTUNITIES.md`)

- **AUD-004**: la cohorte 50–60 acepta usuarios sin edad.
- **AUD-012**: sexo binario y contenido por sexo sin proveniencia.
- **AUD-013**: límites de entrenamiento IA sin revisión profesional.
- **AUD-019**: UX-01 a UX-11 pendientes de verificación en navegador.
- **AUD-021**: Ruta Vital con contenido de 4 semanas plantilla.
- **AUD-009**: promesas comerciales no respaldadas.

---

## 10. Problemas que requieren pruebas con usuarios reales

1. ¿Entiende el usuario 50+ qué es "Ruta Vital" en 10 segundos?
2. ¿Qué tono acepta para preguntas de sexo, edad y salud sin sentirse juzgado?
3. ¿El usuario quiere cambiar de modalidad o prefiere una recomendación única?
4. ¿Le compensa completar el onboarding antes de su primer entrenamiento?
5. ¿El lenguaje "40+" o "50+" le identifica o le estigmatiza?

Diseño de estas pruebas en `15_VALIDATION_AND_KPIS.md`.
