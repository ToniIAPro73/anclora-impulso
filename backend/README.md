# Anclora Impulso - Backend API

Backend RESTful para la aplicación de fitness Anclora Impulso, construido con **Express.js**, **TypeScript**, **Prisma** y **PostgreSQL**.

## Características

- ✅ **Autenticación segura** con JWT y bcrypt
- ✅ **Base de datos PostgreSQL** con Prisma ORM
- ✅ **API RESTful** completa con validación
- ✅ **Generador de entrenamientos** con IA (OpenAI)
- ✅ **Seguimiento de progreso** y estadísticas
- ✅ **Rate limiting** y seguridad con Helmet
- ✅ **TypeScript** para type safety
- ✅ **CORS** configurado para frontend

## Stack Tecnológico

- **Runtime:** Node.js 22
- **Framework:** Express.js
- **Lenguaje:** TypeScript
- **Base de datos:** PostgreSQL (Neon)
- **ORM:** Prisma
- **Autenticación:** JWT + bcrypt
- **Validación:** Zod
- **Seguridad:** Helmet, CORS, Rate Limiting

## Requisitos Previos

- Node.js 18+ (recomendado 22)
- pnpm (o npm/yarn)
- Base de datos PostgreSQL (local o Neon)

## Instalación

1. **Instalar dependencias:**

```bash
cd backend
pnpm install
```

2. **Configurar variables de entorno:**

Copia el archivo `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require"
JWT_SECRET=""
JWT_REFRESH_SECRET=""
FRONTEND_URL="http://localhost:3000"
OPENAI_API_KEY="" # Opcional
```

3. **Generar cliente de Prisma:**

```bash
pnpm prisma:generate
```

4. **Ejecutar migraciones:**

```bash
pnpm prisma:migrate
```

5. **Poblar base de datos (seed):**

```bash
pnpm prisma:seed
```

## Desarrollo

Iniciar servidor en modo desarrollo con hot-reload:

```bash
pnpm dev
```

El servidor estará disponible en `http://localhost:3001`

## Produccion

1. **Aplicar migraciones de Prisma:**

```bash
pnpm prisma:deploy
```

2. **Compilar TypeScript:**

```bash
pnpm build
```

3. **Iniciar servidor:**

```bash
pnpm start
```

## Scripts Disponibles

- `pnpm dev` - Iniciar en modo desarrollo
- `pnpm build` - Compilar TypeScript a JavaScript
- `pnpm start` - Iniciar servidor de producción
- `pnpm test` - Ejecutar tests del backend en modo watch
- `pnpm test:ci` - Ejecutar tests del backend con cobertura
- `pnpm prisma:generate` - Generar cliente de Prisma
- `pnpm prisma:migrate` - Ejecutar migraciones
- `pnpm prisma:deploy` - Aplicar migraciones pendientes en entornos desplegados
- `pnpm prisma:push` - Sincronizar esquema sin crear migracion
- `pnpm prisma:studio` - Abrir Prisma Studio (GUI)
- `pnpm prisma:seed` - Poblar base de datos

## Estructura del Proyecto

```
backend/
├── docs/                # Documentacion operativa del backend
├── scripts/             # Utilidades de desarrollo y seed manual
├── tests/               # Tests del backend
├── src/
│   ├── config/          # Configuración (DB, env, JWT)
│   ├── middleware/      # Middleware (auth, validate, errors)
│   ├── routes/          # Rutas de la API
│   ├── controllers/     # Controladores
│   ├── services/        # Lógica de negocio
│   ├── utils/           # Utilidades (password, jwt, validators)
│   ├── app.ts           # Configuración de Express
│   └── server.ts        # Punto de entrada
├── prisma/
│   ├── schema.prisma    # Esquema de la base de datos
│   ├── migrations/      # Migraciones versionadas
│   └── seed.ts          # Datos iniciales
├── jest.config.js
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints

### Despacho de notificaciones y Neon (scale-to-zero)

El despachador de recordatorios por email (`dispatchDueNotifications`) se controla con variables de entorno:

| Variable | Defecto | Efecto |
|---|---|---|
| `NOTIFICATION_DISPATCH_MODE` | `interval` | `interval`: comportamiento histórico, consulta la BD cada `NOTIFICATION_DISPATCH_INTERVAL_MINUTES`. `lazy`: mantiene en memoria las horas de recordatorio y **solo consulta la BD cuando se abre una ventana** (`reminderTime` … `+ NOTIFICATION_DISPATCH_INTERVAL_MINUTES`). |
| `NOTIFICATION_DISPATCH_INTERVAL_MINUTES` | `15` | Ventana de recordatorio (y periodo en modo `interval`). |
| `NOTIFICATION_LAZY_REFRESH_MINUTES` | `120` | Solo `lazy`: cada cuánto se recargan de la BD las horas de recordatorio (cubre cambios externos o varias instancias). Mínimo 5. |

Modo `lazy`: un temporizador local de 60 s comprueba `now >= nextDueAt` sin tocar la BD; la lógica de negocio y el formato de las notificaciones no cambian. Crear usuarios o cambiar `remindersEnabled`/`reminderTime` actualiza `nextDueAt` en memoria. Retraso máximo de envío: ~1 min tras `reminderTime` (en `interval`, hasta 15 min). Para activarlo: definir `NOTIFICATION_DISPATCH_MODE=lazy` en el servicio y reiniciar. **Limitación:** con más de una instancia, una instancia solo conoce los cambios hechos en otra tras el refresco de seguridad; las horas eliminadas solo se descartan en el refresco.

## Endpoints de salud y Neon (scale-to-zero)

Neon (plan Free) suspende el cómputo tras 5 min sin actividad; una sonda periódica que consulte la BD lo mantiene despierto.

- `GET /health` y `GET /health/simple` (ligeros, por defecto): **no consultan la BD**; `checks.database` devuelve `{"status":"pass","message":"skipped"}`. Úsalos en Render/Docker/monitores.
- `GET /health?deep=1` y `GET /health/simple?deep=1` (o `deep=true`): ejecutan `SELECT 1`; 503 si la BD falla.
- `GET /health/ready`: readiness; **siempre** comprueba la BD. No lo uses como sonda periódica externa.
- `GET /health/live`: liveness, sin BD.

## Autenticación

```
POST   /api/auth/register        # Registrar usuario
POST   /api/auth/login           # Iniciar sesión
GET    /api/auth/me              # Obtener usuario actual
POST   /api/auth/refresh         # Refrescar token
POST   /api/auth/logout          # Cerrar sesión
```

### Ejercicios

```
GET    /api/exercises                    # Listar ejercicios
GET    /api/exercises/:id                # Obtener ejercicio
GET    /api/exercises/meta/categories    # Categorías
GET    /api/exercises/meta/muscle-groups # Grupos musculares
GET    /api/exercises/meta/equipment     # Equipos
```

### Entrenamientos

```
GET    /api/workouts             # Listar entrenamientos
GET    /api/workouts/:id         # Obtener entrenamiento
POST   /api/workouts             # Crear entrenamiento
PUT    /api/workouts/:id         # Actualizar entrenamiento
DELETE /api/workouts/:id         # Eliminar entrenamiento
POST   /api/workouts/generate    # Generar con IA
```

### Sesiones

```
GET    /api/sessions             # Listar sesiones
GET    /api/sessions/:id         # Obtener sesión
POST   /api/sessions             # Registrar sesión
PUT    /api/sessions/:id         # Actualizar sesión
DELETE /api/sessions/:id         # Eliminar sesión
```

### Progreso

```
GET    /api/progress/stats           # Estadísticas
GET    /api/progress/complete        # Progreso completo
GET    /api/progress/measurements    # Medidas corporales
POST   /api/progress/measurements    # Agregar medida
PUT    /api/progress/measurements/:id # Actualizar medida
DELETE /api/progress/measurements/:id # Eliminar medida
```

## Autenticación

La API usa **JWT** para autenticación. Para acceder a rutas protegidas:

1. Registrarse o iniciar sesión para obtener un token
2. Incluir el token en el header `Authorization`:

```
Authorization: Bearer <tu-token-jwt>
```

## Base de Datos

### Configurar Neon (Recomendado)

1. Crear cuenta en [Neon](https://neon.tech)
2. Crear nuevo proyecto
3. Copiar la connection string
4. Pegar en `DATABASE_URL` en `.env`

### Migraciones

Crear nueva migración después de cambiar el schema:

```bash
pnpm prisma migrate dev --name nombre-migracion
```

### Prisma Studio

Explorar y editar datos con GUI:

```bash
pnpm prisma:studio
```

## Seguridad

- ✅ Contraseñas hasheadas con bcrypt (10 rounds)
- ✅ JWT con expiración configurable
- ✅ Rate limiting (100 req/15min general, 5 req/15min auth)
- ✅ Helmet para headers de seguridad
- ✅ CORS configurado
- ✅ Validación de entrada con Zod
- ✅ Sanitización de errores en producción

## Variables de Entorno

| Variable | Descripción | Requerido | Default |
|----------|-------------|-----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ | - |
| `JWT_SECRET` | Clave secreta para JWT | ✅ | - |
| `JWT_EXPIRES_IN` | Expiración del access token | ❌ | `7d` |
| `JWT_REFRESH_SECRET` | Clave secreta para refresh token | ✅ | - |
| `JWT_REFRESH_EXPIRES_IN` | Expiración del refresh token | ❌ | `30d` |
| `PORT` | Puerto del servidor | ❌ | `3001` |
| `NODE_ENV` | Entorno (development/production) | ❌ | `development` |
| `FRONTEND_URL` | URL del frontend para CORS | ❌ | `http://localhost:3000` |
| `OPENAI_API_KEY` | API key de OpenAI (opcional) | ❌ | - |

## Deploy

### Railway

1. Crear cuenta en [Railway](https://railway.app)
2. Conectar repositorio de GitHub
3. Agregar servicio PostgreSQL
4. Configurar variables de entorno
5. Deploy automático

### Render

1. Crear cuenta en [Render](https://render.com)
2. Crear nuevo Web Service
3. Conectar repositorio
4. Configurar build command: `pnpm install && pnpm build`
5. Configurar start command: `pnpm start`
6. Agregar variables de entorno

## Licencia

MIT
