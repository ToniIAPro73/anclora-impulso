# Guía de Despliegue - Anclora Impulso

Esta guía te ayudará a desplegar la aplicación completa en producción de forma **100% gratuita**.

## Stack de Despliegue (Gratis)

- **Base de datos:** Neon PostgreSQL (500 MB gratis)
- **Backend:** Railway o Render (tier gratuito)
- **Frontend:** Vercel (ilimitado gratis para proyectos personales)

## Paso 1: Configurar Base de Datos en Neon

### 1.1 Crear cuenta

1. Ve a [neon.tech](https://neon.tech)
2. Regístrate con GitHub, Google o email
3. Verifica tu email

### 1.2 Crear proyecto

1. Click en "Create a project"
2. Nombre: `anclora-impulso`
3. Región: Selecciona la más cercana a tus usuarios
4. PostgreSQL version: 17 (última)
5. Click "Create project"

### 1.3 Obtener connection string

1. En el dashboard del proyecto, ve a "Connection Details"
2. Copia la **connection string** que se ve así:

```
postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

3. **Guarda esta URL**, la necesitarás para el backend

## Paso 2: Desplegar Backend en Railway

### 2.1 Preparar el repositorio

Asegúrate de que el backend esté en el repositorio de GitHub:

```bash
cd /ruta/a/Anclora-Impulso
git add .
git commit -m "Add backend with Neon PostgreSQL"
git push origin main
```

### 2.2 Crear cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Regístrate con GitHub
3. Autoriza Railway para acceder a tus repositorios

### 2.3 Crear nuevo proyecto

1. Click en "New Project"
2. Selecciona "Deploy from GitHub repo"
3. Busca y selecciona `ToniIAPro73/Anclora-Impulso`
4. Railway detectará automáticamente que es un proyecto Node.js

### 2.4 Configurar el servicio

1. Click en el servicio creado
2. Ve a "Settings"
3. En "Root Directory", establece: `backend`
4. En "Build Command", establece: `pnpm install && pnpm prisma:generate && pnpm build`
5. En "Start Command", establece: `pnpm start`

### 2.5 Configurar variables de entorno

1. Ve a la pestaña "Variables"
2. Agrega las siguientes variables:

```env
DATABASE_URL=postgresql://<user>:<password>@<host>/<database>?sslmode=require
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://tu-app.vercel.app
OPENAI_API_KEY=
```

**Importante:** 
- Reemplaza `DATABASE_URL` con tu connection string de Neon
- Genera claves secretas seguras (puedes usar: `openssl rand -base64 32`)
- `FRONTEND_URL` lo configurarás después de desplegar en Vercel

### 2.6 Ejecutar migraciones

1. Ve a la pestaña "Deployments"
2. Una vez que el deploy esté completo, ve a "Settings" > "Service"
3. Copia la URL pública (algo como: `https://anclora-impulso-production.up.railway.app`)
4. Abre una terminal y ejecuta:

```bash
cd backend
DATABASE_URL="tu-connection-string-de-neon" pnpm prisma migrate deploy
DATABASE_URL="tu-connection-string-de-neon" pnpm prisma:seed
```

Alternativamente, puedes usar Railway CLI:

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link al proyecto
railway link

# Ejecutar migraciones
railway run pnpm prisma migrate deploy
railway run pnpm prisma:seed
```

### 2.7 Verificar backend

Abre en tu navegador: `https://tu-backend.railway.app/health`

Deberías ver:

```json
{
  "status": "ok",
  "timestamp": "2025-10-28T..."
}
```

## Paso 3: Desplegar Frontend en Vercel

### 3.1 Crear cuenta en Vercel

1. Ve a [vercel.com](https://vercel.com)
2. Regístrate con GitHub
3. Autoriza Vercel para acceder a tus repositorios

### 3.2 Importar proyecto

1. Click en "Add New..." > "Project"
2. Busca y selecciona `ToniIAPro73/Anclora-Impulso`
3. Click en "Import"

### 3.3 Configurar el proyecto

1. **Framework Preset:** Next.js (detectado automáticamente)
2. **Root Directory:** `.` (raíz del proyecto)
3. **Build Command:** `npm run build`
4. **Output Directory:** `.next` (detectado automáticamente)
5. **Package Manager:** `npm`

**Regla operativa de lockfiles**

- Este repo debe mantener un único lockfile activo: `package-lock.json`
- No debe versionarse `pnpm-lock.yaml` salvo migración explícita de todo el proyecto a `pnpm`
- Si existen ambos lockfiles, Vercel puede detectar `pnpm` y fallar con `ERR_PNPM_OUTDATED_LOCKFILE`

### 3.4 Configurar variables de entorno

En la sección "Environment Variables", agrega:

```env
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app/api
```

Reemplaza `tu-backend.railway.app` con la URL de tu backend en Railway.

### 3.5 Desplegar

1. Click en "Deploy"
2. Espera a que termine el build (2-3 minutos)
3. Una vez completado, obtendrás una URL como: `https://anclora-impulso.vercel.app`

### 3.6 Actualizar CORS en el backend

Vuelve a Railway y actualiza la variable `FRONTEND_URL`:

```env
FRONTEND_URL=https://anclora-impulso.vercel.app
```

El servicio se redesplegará automáticamente.

## Paso 4: Configurar Dominio Personalizado (Opcional)

### En Vercel (Frontend)

1. Ve a tu proyecto en Vercel
2. Click en "Settings" > "Domains"
3. Agrega tu dominio (ej: `anclora-impulso.com`)
4. Sigue las instrucciones para configurar DNS

### En Railway (Backend)

1. Ve a tu servicio en Railway
2. Click en "Settings" > "Networking"
3. En "Custom Domain", agrega: `api.anclora-impulso.com`
4. Configura el registro CNAME en tu proveedor de DNS

## Paso 5: Verificar Todo Funciona

### 5.1 Verificar backend

```bash
# Health check
curl https://tu-backend.railway.app/health

# Obtener ejercicios (sin auth)
curl https://tu-backend.railway.app/api/exercises
```

### 5.2 Verificar frontend

1. Abre `https://tu-app.vercel.app`
2. Intenta registrarte
3. Inicia sesión
4. Navega por la app

### 5.3 Verificar integración

1. Registra un usuario nuevo
2. Genera un entrenamiento
3. Revisa que los datos se guarden en la base de datos

## Monitoreo y Logs

### Railway

- **Logs en tiempo real:** Ve a tu servicio > "Deployments" > Click en el deployment activo
- **Métricas:** Ve a "Metrics" para ver CPU, memoria y red

### Vercel

- **Logs:** Ve a tu proyecto > "Deployments" > Click en el deployment > "Logs"
- **Analytics:** Ve a "Analytics" para ver visitas y performance

### Neon

- **Monitoring:** Ve a tu proyecto > "Monitoring" para ver queries y conexiones
- **Logs:** Ve a "Logs" para ver actividad de la base de datos

## Troubleshooting

### Backend no se conecta a la base de datos

1. Verifica que `DATABASE_URL` esté correctamente configurada
2. Asegúrate de incluir `?sslmode=require` al final
3. Revisa los logs en Railway para ver el error específico

### Frontend no puede conectarse al backend

1. Verifica que `NEXT_PUBLIC_API_URL` apunte a la URL correcta
2. Asegúrate de que el backend esté corriendo (health check)
3. Revisa CORS: `FRONTEND_URL` debe coincidir con la URL de Vercel

### Migraciones no se ejecutaron

```bash
# Ejecutar manualmente con Railway CLI
railway run pnpm prisma migrate deploy
railway run pnpm prisma:seed
```

### Error 401 Unauthorized

1. Verifica que `JWT_SECRET` esté configurado
2. Limpia localStorage en el navegador
3. Intenta registrarte de nuevo

## Costos y Límites

### Neon (Gratis)

- ✅ 500 MB de almacenamiento
- ✅ 100 CU-hours de compute
- ✅ Proyectos ilimitados (hasta 20)
- ⚠️ Suspensión después de 5 min de inactividad

### Railway (Gratis)

- ✅ $5 de crédito mensual
- ✅ Suficiente para ~500 horas de uptime
- ⚠️ Después de agotar crédito, el servicio se pausa

### Vercel (Gratis)

- ✅ 100 GB de bandwidth
- ✅ Builds ilimitados
- ✅ Despliegues ilimitados
- ✅ Dominios personalizados

## Alternativas

### Si Railway se queda sin crédito

Usa **Render** (también gratis):

1. Ve a [render.com](https://render.com)
2. Crea un nuevo "Web Service"
3. Conecta tu repositorio
4. Configura igual que Railway
5. **Nota:** Render tiene "spin down" después de 15 min de inactividad

### Si Neon se queda sin espacio

Revisa la retención de tablas operativas y los planes de almacenamiento en [neon.tech](https://neon.tech). No uses Supabase como alternativa de base de datos ni de autenticación (contrato Neon/Prisma vigente).

## Mantenimiento

### Actualizar código

```bash
git add .
git commit -m "Update: descripción"
git push origin main
```

Railway y Vercel se redesplegarán automáticamente.

### Backup de base de datos

Neon hace backups automáticos, pero puedes hacer uno manual:

```bash
# Exportar
pg_dump "postgresql://<user>:<password>@<host>/<database>" > backup.sql

# Importar
psql "postgresql://<user>:<password>@<host>/<database>" < backup.sql
```

### Monitorear uso

- **Neon:** Dashboard > Usage
- **Railway:** Dashboard > Usage
- **Vercel:** Dashboard > Usage

## Conclusión

¡Felicidades! Tu aplicación está desplegada y funcionando en producción de forma completamente gratuita.

**URLs finales:**

- Frontend: `https://tu-app.vercel.app`
- Backend: `https://tu-backend.railway.app`
- Base de datos: Neon PostgreSQL

**Próximos pasos:**

1. Configurar dominio personalizado
2. Agregar Google Analytics
3. Configurar monitoreo de errores (Sentry)
4. Implementar CI/CD avanzado
5. Agregar tests automatizados
