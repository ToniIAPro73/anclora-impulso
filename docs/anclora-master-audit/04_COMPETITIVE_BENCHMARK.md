# 04 — Benchmark competitivo

> **Fecha de consulta:** 2026-11-09. **Método:** búsquedas web públicas (Firecrawl), sin acceso a cuentas de pago ni pruebas de uso.
> **Consultas:** formuladas con términos genéricos de categoría; no se enviaron datos del repositorio ni de usuarios.
> **Límite:** las fichas de precios proceden de tiendas de aplicaciones y de un agregador (`sensai.fit`, ver nivel de confianza). No se ha probado ninguna app. La dimensión UX se marca como **no evaluada** cuando no hay evidencia.

---

## 1. Competidores seleccionados

| Código | Producto | Tipo | Por qué compite | Confianza |
|---|---|---|---|---|
| **A** | Fitbod | **Directo** | Entrenamiento de fuerza personalizado con IA, según objetivo, equipo y recuperación; plan familiar | Alta (web oficial, Play Store, blog oficial) |
| **B** | Freeletics | **Directo** | Coach IA con planes adaptativos; plan gratuito limitado + suscripción | Alta (App Store vía agregador; web oficial) |
| **C** | Hevy | **Indirecto** | Registro de entrenamiento y social; plan gratuito amplio; fuerte en comunidad | Alta (web oficial de funciones) |
| D (referencia) | Fitify, BetterMe, SensAI | Indirecto | Aparecen en comparativas de precios | **Media–baja**: solo vía agregador; no incluidos en la matriz |

**Competidores por edad (40+/50+):** la búsqueda específica no devolvió fuentes utilizables en esta ejecución. **NO VERIFICADO**. Queda como tarea de investigación (`TASK-027`).

---

## 2. Fichas

### A. Fitbod
- **Propuesta:** "Less planning, more progress": plan personal que se actualiza con cuerpo, recuperación y progreso. Fuente: `https://fitbod.me/` (2026-11-09).
- **Funciones verificadas:** entrenamientos generados según objetivo, nivel, equipo disponible y recuperación por grupo muscular; más de 1600 vídeos de ejercicios; estimación de 1RM; puntuación de fuerza por grupo; integración con Apple Watch y Strava; plan familiar con perfiles individuales (hasta 5 miembros). Fuentes: `https://fitbod.me/blog/fitbods-new-family-plan-offering/` y ficha de Play Store (`play.google.com/store/apps/details?id=com.fitbod.fitbod`).
- **Personalización:** perfil de equipo por gimnasio, edición de pesos disponibles, aprendizaje de ediciones del usuario ("adaptive AI learns from your edits") — fuente Play Store.
- **Precio (web oficial, 2026-11-09):** anual 12 meses ~$95,99 (con descuento web $86,39); mensual $15,99 (web $14,39). Familia: Duo $159,99/año; Family hasta 5 miembros $359,99/año — fuente blog oficial.
- **Limitaciones citadas por usuarios (Play Store):** sin modo para lesión o enfermedad con ajuste automático de cargas; el usuario debe registrar manualmente.
- **Automatización:** recomendación por sesión, progresión no lineal.
- **IA:** motor propio de "machine learning" y algoritmo de recuperación (declarado; no auditable).

### B. Freeletics
- **Propuesta:** "The AI Coach for busy people": entrenamientos HIIT, calistenia, gimnasio, cardio y running adaptables.
- **Funciones verificadas (App Store vía agregador, 2026-10-28):** más de 700 ejercicios, 30 planes, plan gratuito con entrenamientos limitados, Coach de pago que "customiza cada entrenamiento al nivel del usuario"; ajustes por días, tiempo y ubicación.
- **Precio (EE. UU., App Store):** Training Coach $34,99 · $59,99 · $74,99 · $79,99 (3–12 meses); sin plan mensual; Training & Nutrition $49,99 / $89,99. Fuente agregadora `sensai.fit/blog/freeletics-review` (nivel media-alta; precios no confirmados por la tienda en la misma consulta).
- **Limitación citada:** la IA "se adapta al feedback, no al sueño ni a la frecuencia cardíaca" (agregador).
- **Integraciones:** Wear OS **no** anunciado en la ficha de Google Play consultada (fuente agregadora).

### C. Hevy
- **Propuesta:** "The #1 workout tracker": registro, rutinas y social.
- **Funciones verificadas (`hevyapp.com/features`):** registro de series, temporizador de descanso, RPE, supersets, calculadora de calentamiento y de discos, récords en vivo, seguimiento de series por grupo muscular a la semana, rachas de constancia, feed social, perfiles, comparación entre atletas, compartir rutinas, integración con Strava, Apple Watch y Wear OS, entrenador que asigna entrenamientos.
- **Precio:** núcleo gratuito; suscripción Pro (importe **NO VERIFICADO** en esta ejecución; comentario de usuario en Reddit dice "la mayoría de funciones gratis").
- **IA:** no anunciada para la generación de planes (NO VERIFICADO); el énfasis es el registro y la comunidad.

---

## 3. Matriz comparativa

Escala cualitativa: **+** fuerte · **=** equivalente / suficiente · **−** débil · **?** no evaluado. "Anclora Impulso" se valora solo con lo que el código implementa (CONFIRMADO) y se marca "?" en UX porque no se ha probado.

| Dimensión | Anclora Impulso | A · Fitbod | B · Freeletics | C · Hevy | Oportunidad |
|---|---|---|---|---|---|
| **Funcionalidades (núcleo)** | = Generación con IA, ejecución, progreso, biblioteca (~143 ejercicios en seed, INFERIDO), nutrición, gamificación, coach | + Generación + recuperación + 1RM + familia | + Planes variados (HIIT, calistenia, gimnasio) | + Registro completo y social | Diferenciar por contexto de vida (50+) y continuidad, no por el registro |
| **Personalización** | + Perfil (edad, sexo, objetivo, días, entorno, limitaciones), 40+ y sexo en textos, progresión, validador de planes | + Equipo por gimnasio, recuperación por músculo, aprendizaje de ediciones | = Nivel, días, tiempo, lugar | − Principalmente manual (plantillas) | Personalización explicable y reversible (ver 07) |
| **UX / UI** | ? Sin prueba de uso; defectos documentados en SPEC (UX-01 a UX-11) | ? | ? | ? | Medir con usuarios (15) |
| **Automatización** | = Progresión, respaldo determinista, cuotas | + Sugerencia por sesión y recuperación | + Ajuste continuo según feedback | − Automatización baja | Automatizar el "siguiente paso" (quick win) |
| **Integraciones** | − Wearables en esquema y API; proveedores reales NO VERIFICADOS | + Apple Watch, Strava | = Apple Watch / Wear OS (según ficha) | + Strava, Apple Watch, Wear OS | Integración con wearables sólo tras verificar proveedores |
| **Diferenciación** | Ruta Vital 50–60 (opt-in, safety, proveniencia) y 40+ por sexo; bilingüe ES/EN | Familia y motor de recuperación | Variedad y comunidad | Comunidad y registro | Ver 05 |
| **Modelo comercial** | N/E (`subscriptionTier`; cobro NO VERIFICADO) | Suscripción anual/mensual y familiar | Solo suscripción de 3–12 meses | Gratuito con Pro | Ver 05 §6 |
| **Contenido por edad** | + 40+ y 50+ (Ruta Vital) | − No anunciado | − No anunciado | − No anunciado | **Principal hueco abierto para diferenciación** |
| **Privacidad y salud** | − Sin marco legal de menores/salud (AUD-003) | ? | ? | ? | Un marco legal sólido sería ventaja y requisito |

---

## 4. Lectura estratégica

1. **Paridad:** Anclora ya tiene generación personalizada, progresión y registro; no es necesario copiar la comunidad de Hevy ni el catálogo de Freeletics.
2. **Hueco real:** ningún competidor verificado anuncia contenido específico para 40–60 años con enfoque de hábitos y proveniencia. Es una **hipótesis de posicionamiento**, no una ventaja demostrada: falta investigación de mercado y pruebas con usuarios.
3. **Precios:** el rango de Fitbod/Freeletics (≈ 6–16 €/mes equivalentes) define el marco del mercado; no se propone precio aquí porque no hay datos de conversión ni coste verificado del producto.
4. **Riesgo de copia:** la personalización por IA es fácil de replicar; la proveniencia de contenido y el marco de salud sí requieren trabajo y pueden ser más difíciles de copiar.

---

## 5. Lo que debe verificarse

| Pregunta | Método | Estado |
|---|---|---|
| Precio actual de Hevy Pro y Fitify/BetterMe | Consulta a tienda oficial | NO VERIFICADO |
| Existencia de planes 40+/50+ en Ladder, Future, Caliber | Búsqueda específica y pruebas de cuenta | NO VERIFICADO |
| Calidad de UX de competidores | Prueba de uso con cuentas de prueba | NO VERIFICADO |
| Tratamiento de datos de salud por competidores | Políticas de privacidad oficiales | NO VERIFICADO |
