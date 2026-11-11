# 08 — Arquitectura objetivo y diagramas

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> Regla: lo que aparece como **propuesto** no existe. Los diagramas distinguen situación actual y objetivo.

---

## 1. Principios

1. **Reutilizar motores** (workouts, progression, nutrition, gamification, progress). Health Plans **orquesta**, no duplica.
2. **Configuración en datos** (catálogo versionado) antes que código por modalidad.
3. **Migraciones aditivas** y compatibles con datos existentes; sin borrados ni backfill destructivo (`SPEC §7.2`).
4. **Opt-in** y **sin inferencias** de capacidad por edad o sexo.
5. **Fail-closed** en seguridad: ante la duda, no se recomienda entrenamiento de carga.
6. **Un único entorno de datos** según contrato (producción) hasta que Toni decida otra cosa; ningún cambio asume infraestructura compartida entre productos.

---

## 2. Arquitectura actual

```mermaid
flowchart LR
  subgraph Cliente
    FE[Next.js 14 · App Router<br/>React Query · Radix/shadcn]
  end
  subgraph Render
    API[Express 4 · TypeScript<br/>routes → controllers → services]
    MW[Helmet · CORS · rate limit<br/>authenticate · requireAdmin]
    API --- MW
    API --> LLM[LLM: Groq<br/>+ determinista]
  end
  subgraph Neon
    DB[(PostgreSQL · Prisma 5<br/>57 modelos · 26 migraciones)]
  end
  FE -- "HTTPS JSON · Bearer" --> API
  API --> DB
  FE -. "refresh en localStorage (AUD-001)" .-> FE
```

Fuentes: `PRODUCTION_RUNTIME.md` §2–§3; `backend/src/app.ts`; `backend/src/services/llm/`.

---

## 3. Arquitectura objetivo

```mermaid
flowchart TB
  subgraph Frontend
    UI1[Onboarding no clínico]
    UI2[Selección y cambio de modalidad]
    UI3[Semana y pilares]
    UI4[Preferencias y explicación]
  end
  subgraph Backend
    CAT[Catálogo de planes<br/>HealthPlanDefinition v+]
    ELI[Elegibilidad por bandas<br/>puro, testeable]
    ENR[Inscripción y cambio<br/>historial]
    REC[Motor de reglas<br/>explicable]
    SAF[Safety fail-closed<br/>classifySafety]
    PRG[Proyección de progreso<br/>read model]
    EXP[Explicación IA opcional<br/>flag + límites]
    OBS[Eventos y métricas<br/>ProductEvent]
  end
  subgraph Motores_existentes
    WK[Workouts + plan-validator]
    PG[Progression engine]
    NU[Nutrición]
    GM[Gamificación]
  end
  UI1 --> ELI
  UI2 --> ENR
  UI3 --> PRG
  UI4 --> REC
  ENR --> CAT
  ELI --> CAT
  REC --> SAF
  REC --> ELI
  PRG --> WK
  PRG --> PG
  PRG --> NU
  PRG --> GM
  REC --> EXP
  ENR --> OBS
  PRG --> OBS
```

### 3.1 Clasificación de componentes

| Componente | Clase | Estado | Notas |
|---|---|---|---|
| Catálogo de planes (`HealthPlanDefinition`, `Phase`, `Week`, `Action`, `Pillar`) | **Imprescindible** | Existe | Añadir cohorte y variante (`TASK-017`) |
| Elegibilidad por bandas | **Imprescindible** | Propuesto | `isInCohort` ya existe; corregir `null` (`TASK-008`, `TASK-020`) |
| Inscripción y cambio | **Imprescindible** | Parcial (inscripción) | Cambio con historial (`TASK-023`) |
| Safety | **Imprescindible** | Existe | `classifySafety` |
| Motor de reglas | **Imprescindible** | Propuesto | `TASK-026` |
| Proyección de progreso | **Imprescindible** | Parcial | Reutilizar lecturas de progreso y sesiones |
| Onboarding no clínico | Opcional de primera versión | Propuesto | `TASK-025` |
| Explicación IA | Opcional | Propuesto | `TASK-029`, tras reglas |
| Panel administrativo de planes | Futuro | Propuesto | Solo si Toni lo necesita; hoy el catálogo se siembra |
| Motor de recomendaciones con ML | Futuro | Descartado por ahora | Sin datos suficientes |
| Interfaz de comparación de modalidades | Futuro | Propuesto | Útil para 10 modalidades (`TASK-022`) |

---

## 4. Modelo de datos propuesto

```mermaid
erDiagram
  HealthPlanDefinition ||--o{ HealthPlanPhase : contiene
  HealthPlanDefinition ||--o{ HealthPlanPillar : define
  HealthPlanDefinition ||--o{ HealthPlanContentReference : cita
  HealthPlanDefinition ||--o{ HealthPlanEnrollment : inscribe
  HealthPlanPhase ||--o{ HealthPlanWeek : agrupa
  HealthPlanWeek ||--o{ HealthPlanAction : propone
  HealthPlanWeek ||--o{ HealthPlanWeekStatus : estado
  HealthPlanEnrollment ||--o| HealthPlanProfile : perfil
  HealthPlanEnrollment ||--o{ HealthPlanWeekStatus : semanas
  HealthPlanEnrollment ||--o{ HealthPlanActionStatus : acciones
  HealthPlanAction ||--o{ HealthPlanActionStatus : completa
  User ||--o{ HealthPlanEnrollment : elige
  User ||--o{ HealthPlanProfile : declara
```

Estado actual: las entidades existen (CONFIRMADO en `schema.prisma:939-1120`).

### 4.1 Cambios propuestos (aditivos)

| Entidad | Campo nuevo | Tipo | Motivo | Compatibilidad |
|---|---|---|---|---|
| `HealthPlanDefinition` | `cohortKey` (P01–P10 o `RV-50-60`) | String, único por `key`+versión | Catálogo de 10 | Filas existentes conservan valores |
| `HealthPlanDefinition` | `variantKey` (`M`, `F`, `NEUTRAL`) | String? | Variante de contenido | Nullable |
| `HealthPlanDefinition` | `ageMin`, `ageMax` (`ageMax` nullable) | Int | Bandas sin solape | Ruta Vital existente: `50`, `60` (decisión 06 §3) |
| `User` | `sexAtBirth`, `genderIdentity` | String? | Separación de atributos | Campo `sex` se mantiene |
| `HealthPlanEnrollment` | `previousPlanId` | String? | Historial de cambio | Nullable |
| `HealthPlanDefinition` | `consentVersion` | String? | Consentimiento | Nullable |

Migraciones: una por bloque, con prueba de adelanto y de restauración (`SPEC §7.2`).

---

## 5. Flujos

### 5.1 Selección inicial del plan

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant FE as Frontend
  participant API as API Health Plans
  participant EL as Elegibilidad
  participant DB as PostgreSQL
  U->>FE: Abre Ruta / Modalidades
  FE->>API: GET catálogo
  API->>DB: definiciones publicadas
  API-->>FE: catálogo
  alt edad declarada
    FE->>API: GET sugerencia (edad)
    API->>EL: banda(edad)
    EL-->>API: modalidad sugerida + motivo
    API-->>FE: sugerencia explicada
  else sin edad
    FE-->>U: pedir edad (no sugerir)
  end
  U->>FE: Elige modalidad (opt-in)
  FE->>API: POST inscripción
  API->>DB: crear inscripción y perfil
  API-->>FE: inscripción creada
```

### 5.2 Cambio de modalidad

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant API as API
  participant DB as PostgreSQL
  U->>API: PATCH cambio a modalidad B
  API->>DB: leer inscripción activa
  alt misma cohorte
    API->>DB: actualizar variante
  else otra cohorte
    API->>DB: cerrar inscripción A (leftAt) y crear B (previousPlanId=A)
  end
  API->>DB: registrar evento ProductEvent
  API-->>U: estado nuevo + historial conservado
```

### 5.3 Personalización progresiva

```mermaid
flowchart LR
  S1[Perfil declarado] --> R[Reglas R1–R6]
  S2[Sesiones y cargas] --> R
  S3[Semana completada o perdida] --> A[getAdaptation]
  A --> R
  S4[Descartes y ediciones] --> R
  R --> X[Sugerencia + motivo]
  X --> U{Usuario acepta?}
  U -- sí --> N[Aplicar y registrar]
  U -- no --> M[Mantener y registrar descarte]
  N --> H[(Historial)]
  M --> H
```

### 5.4 Relaciones entre servicios

```mermaid
flowchart TB
  HP[health-plans.service] --> WK[workouts.service]
  HP --> PG[progression.service]
  HP --> NU[nutrition.service]
  HP --> GM[gamification.service]
  HP --> PR[progress.service]
  HP --> SA[health-plans.domain · safety]
  WK --> PV[plan-validator]
  WK --> DF[deterministic-fallback]
  NU --> PW[personalization-guidance]
```

Regla: ningún servicio de la flecha inferior importa de `health-plans.*` (no hay dependencia circular). Esta regla se verificará con un test de importaciones (`TASK-020`).

---

## 6. Estrategia de evolución

| Pregunta | Respuesta |
|---|---|
| ¿Qué conservar? | Motores de workouts, progression, nutrition, gamification, progress; validadores Zod; safety de dominio; esquema de Health Plans |
| ¿Qué modificar? | Elegibilidad (`null`), `User` (atributos), catálogo (cohorte y variante), refresh token (AUD-001) |
| ¿Qué añadir? | Onboarding no clínico, selección y cambio, motor de reglas, proyección de progreso, explicación opcional |
| ¿Qué resolver antes? | AUD-006 (migración en producción), AUD-003 (legal), AUD-001 (refresh), AUD-005 (tipos) |
| ¿Cómo incrementar? | Feature flags por modalidad; una modalidad piloto (P07) antes de las demás |
| ¿Cómo evitar regresiones? | Tests de caracterización antes de partir servicios (`TASK-014`); E2E de la ruta (`TASK-013`) |
| ¿Cómo mantener datos? | Migraciones aditivas; nada se borra; `previousPlanId` guarda historia |
| ¿Qué pruebas? | Unitarias de bandas y safety; integración en CI con Postgres de test; E2E con usuario QA dedicado |

---

## 7. Restricciones de despliegue

- Las migraciones se aplican **antes** del backend que las usa (CONFIRMADO en `PRODUCTION_RUNTIME.md` §4).
- El backend se despliega manualmente en Render; no hay auto-deploy.
- Frontend en Vercel; producción ligada a `main`.
- Local = producción por contrato; ver AUD-014 y decisión de Toni.
