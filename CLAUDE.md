<!-- ANCLORA-ECOSYSTEM-CONTEXT-START -->
## Contexto de ecosistema Anclora

Antes de modificar este repositorio, todo agente debe leer:

- `.anclora/global/ANCLORA_ECOSYSTEM_CONTEXT.md`
- `.anclora/global/GLOBAL_AGENT_WORKFLOW.md`
- `.anclora/AGENT_PROJECT_CONTEXT.md`
- `MEMORY.md`

La arquitectura estable del ecosistema se define en:

`anclora-vault/00-governance/contracts/core/ANCLORA_ECOSYSTEM_ARCHITECTURE_CONTRACT.md` (renombrado desde `Boveda-Anclora`)

No asumir infraestructura compartida entre productos. Validar siempre hosting, backend, base de datos, auth, variables y ramas.
<!-- ANCLORA-ECOSYSTEM-CONTEXT-END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Anclora Impulso** is a full-stack fitness application featuring AI-powered workout generation, progress tracking, and personalized training routines. It's a monorepo with separate frontend (Next.js) and backend (Express) applications.

- **Status:** Production-ready
- **Free Deployment:** Vercel (frontend), Railway/Render (backend), Neon (database)

---

## Technology Stack

### Frontend
- **Framework:** Next.js 14 (App Router) with React 18 & TypeScript
- **UI:** Radix UI + shadcn/ui (40+ components)
- **Styling:** Tailwind CSS 4 with PostCSS
- **Package Manager:** pnpm
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod validation
- **i18n:** Custom context-based (Spanish/English)
- **State Management:**
  - Context API for auth, theme, language
  - TanStack React Query v5 for server-state caching & deduplication
- **Testing:** Jest + React Testing Library
- **Accessibility:** WCAG 2.1 Level AA compliance
- **Error Logging:** Custom client-side logger with automatic flushing
- **Security:** CSP headers, input sanitization, XSS prevention
- **Deploy:** Vercel

### Backend
- **Runtime:** Node.js 22+
- **Framework:** Express.js
- **ORM:** Prisma 5.22.0
- **Database:** PostgreSQL 17 (Neon cloud provider)
- **Auth:** JWT (7-day access, 30-day refresh) + bcrypt
- **Validation:** Zod
- **Security:** Helmet, CORS, Rate Limiting, CSP headers
- **Logging:** Winston (daily rotation) + Morgan (HTTP)
- **Testing:** Jest + Supertest
- **Documentation:** OpenAPI 3.0.0 / Swagger UI
- **Package Manager:** pnpm
- **Deploy:** Railway or Render

---

## Key Commands

### Frontend (root directory)
```bash
pnpm dev              # Start dev server (port 3000)
pnpm build            # Production build
pnpm start            # Run production server
pnpm lint             # Run ESLint
pnpm test             # Run Jest tests (watch mode)
pnpm test:ci          # Run tests with coverage (CI mode)
pnpm test:coverage    # Generate coverage report
```

### Backend (backend/ directory)
```bash
pnpm dev                    # Start with hot-reload (tsx watch)
pnpm build                  # Compile TypeScript to dist/
pnpm start                  # Run compiled server
pnpm prisma:generate        # Generate Prisma client
pnpm prisma:migrate         # Run migrations
pnpm prisma:studio          # Open Prisma GUI
pnpm prisma:seed            # Populate database with 70+ exercises
pnpm test                   # Run Jest tests (watch mode)
pnpm test:ci                # Run tests with coverage (CI mode)
pnpm test:coverage          # Generate coverage report
```

### API Documentation
```bash
# Swagger UI (backend must be running)
http://localhost:3001/api/docs/api

# Swagger JSON Schema
http://localhost:3001/api/docs/swagger.json
```

### Full Stack Setup
```bash
# Backend setup
cd backend && pnpm install && cp .env.example .env
# Edit .env with Neon DATABASE_URL
pnpm prisma:generate && pnpm prisma migrate dev && pnpm prisma:seed
pnpm dev  # Backend runs on port 3001

# Frontend setup (in new terminal, from root)
pnpm install
# .env.local already configured: NEXT_PUBLIC_API_URL=http://localhost:3001/api
pnpm dev  # Frontend runs on port 3000
```

---

## Architecture & Code Organization

### Frontend Structure (`/app, /components, /lib`)

**App Router (Next.js Pages):**
- `/app/auth/` - Login, signup, error pages
- `/app/dashboard/` - Main dashboard
- `/app/exercises/` - Exercise library
- `/app/progress/` - Progress tracking
- `/app/workouts/` - Workout management

**Components:**
- `/components/ui/` - 40+ shadcn/ui components (accordion, button, card, dialog, etc.)
- `/components/dashboard-*.tsx` - Dashboard page components
- `/components/exercise-library.tsx` - Exercise browser with filters
- `/components/workout-generator.tsx` - AI workout generator
- `/components/progress-tracker.tsx` - Charts and statistics

**State Management:**
- `/lib/contexts/auth-context.tsx` - User session & JWT tokens
- `/lib/contexts/theme-context.tsx` - Dark/light mode
- `/lib/contexts/language-context.tsx` - i18n state

**API Client:**
- `/lib/api/client.ts` - Base HTTP client with automatic token refresh
- `/lib/api/auth.ts`, `/lib/api/index.ts` - Service methods for all endpoints
- Auto-appends Bearer token from localStorage
- Handles 401 errors with token refresh

**Custom Hooks (React Query Integration):**
- `/hooks/use-exercises.ts` - Fetch exercises with filters (useQuery + useInfiniteQuery)
  - Automatic 5-minute caching
  - Request deduplication
  - Infinite scroll support
- `/hooks/use-workouts.ts` - Manage workouts with mutations
  - useQuery for fetching
  - useMutation for create/update/delete
  - Optimistic updates
- `/hooks/use-progress.ts` - Progress data and measurements
  - Automatic cache invalidation
  - Measurement mutations
- `/hooks/use-focus-trap.ts` - Accessibility focus management
  - useFocusTrap() - Modal focus trapping (WCAG 2.1 AA)
  - useAriaLive() - Screen reader announcements
  - useSkipLink() - Skip to main content
- `/hooks/use-async-operation.ts` - Generic async state management
  - useAsyncOperation() - Single operation
  - useAsyncOperations() - Multiple parallel operations
- `/hooks/use-mobile.ts` - Mobile device detection

**Security Utilities:**
- `/lib/security/sanitize.ts` - XSS prevention (9 functions)
  - escapeHtml() - HTML character escaping
  - sanitizeInput() - Remove dangerous content
  - sanitizeText() - Full sanitization
  - sanitizeUrl() - URL validation
  - sanitizeEmail() - Email validation
  - sanitizeNumber() - Number validation with bounds
  - sanitizeObject() - Recursive object sanitization
  - stripHtml() - Remove all HTML tags
  - sanitizeWithMaxLength() - Length limiting

**Accessibility (a11y) Utilities:**
- `/lib/a11y/useAriaLabel.ts` - ARIA label utilities
  - getButtonAriaLabel() - Generate button labels
  - getIconAriaLabel() - Generate icon labels
  - getFieldDescription() - Form field descriptions
  - announceToScreenReader() - Dynamic announcements
  - A11Y_COLORS - WCAG AA compliant color palette (4.5:1 contrast)
  - ARIA_ROLES - Semantic ARIA role constants

**Logging & Error Tracking:**
- `/lib/logging/client-logger.ts` - Frontend error logging
  - 4 log levels: debug, info, warn, error
  - Event tracking & performance metrics
  - User context association
  - Automatic flushing every 30 seconds
  - In-memory storage (last 100 logs)
- `/components/error-handler-setup.tsx` - Global error handler
  - Auto-catches unhandled promise rejections
  - Auto-catches uncaught exceptions
  - Sets up error listeners on mount

**Error Handling Components:**
- `/components/error-boundary.tsx` - Error boundary wrapper
  - Catches React component errors
  - Fallback UI with retry option
  - Development: Shows error details
  - Production: Hides sensitive info
- `/components/loading-spinner.tsx` - Loading state UI
  - Reusable spinner (sm, md, lg sizes)
  - Full-screen option
  - SkeletonLoader component

**State Management:**
- `/lib/providers/query-client.tsx` - React Query provider
  - 5-minute stale time
  - 10-minute garbage collection
  - Automatic background refetching

**Translations:**
- `/lib/translations/es.json` - Spanish (default)
- `/lib/translations/en.json` - English

### Backend Structure (`/backend/src`)

**MVC Architecture:**
- `/routes/` - Express route definitions (auth, exercises, workouts, sessions, progress, health, dashboard, docs)
- `/controllers/` - Request handlers that validate input and delegate to services
- `/services/` - Business logic (auth, exercises, workouts, sessions, progress, metrics, health)
- `/middleware/` - Express middleware (auth token verification, error handling, HTTP logging, validation)
- `/utils/` - Helper functions (bcrypt hashing, JWT generation, Zod schemas)
- `/docs/` - API documentation (Swagger/OpenAPI)

**Configuration:**
- `/config/env.ts` - Environment variable validation
- `/config/database.ts` - Prisma client singleton
- `/config/logger.ts` - Winston logger setup with daily rotation

**Documentation:**
- `/src/docs/swagger.ts` - OpenAPI 3.0.0 complete specification
  - 14 endpoints documented
  - Request/response schemas
  - Authentication documentation
  - Error response examples
- `/src/routes/docs.routes.ts` - Documentation endpoints
  - GET /api/docs/swagger.json - OpenAPI JSON
  - GET /api/docs/api - Swagger UI interface

**Key Middleware Stack:**
- Helmet (security headers + CSP)
- CORS (frontend only)
- Rate limiting (15-min windows: 100 req general, 5 req auth, 30 req write, 5 req AI per hour)
- HTTP logger (Morgan via httpLogger.ts)
- Auth middleware (JWT verification on protected routes)
- Global error handler
- CSP headers (Content-Security-Policy, X-Frame-Options, X-XSS-Protection, etc.)

**Database (Prisma):**
- `/prisma/schema.prisma` - 8 models: User, Exercise, Workout, WorkoutExercise, WorkoutSession, SessionExercise, SessionSet, BodyMeasurement
- `/prisma/seed.ts` - Database seeding script
- `/prisma/complete-exercises-database.ts` - 70+ exercise data
- Relationships: User → Workouts/Sessions/Measurements; Workout → Exercises/Sessions

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login (returns access & refresh tokens)
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Exercises
- `GET /api/exercises` - List exercises (filterable)
- `GET /api/exercises/:id` - Get single exercise
- `GET /api/exercises/meta/categories` - Get categories
- `GET /api/exercises/meta/muscle-groups` - Get muscle groups
- `GET /api/exercises/meta/equipment` - Get equipment types

### Workouts
- `GET /api/workouts` - List user's workouts
- `POST /api/workouts` - Create workout
- `POST /api/workouts/generate` - Generate with AI (OpenAI)
- `PUT /api/workouts/:id` - Update workout
- `DELETE /api/workouts/:id` - Delete workout

### Sessions & Progress
- `GET/POST/PUT/DELETE /api/sessions` - Track completed workout sessions
- `GET /api/progress/stats` - User progress statistics
- `GET /api/progress/complete` - Full progress data
- `GET/POST /api/progress/measurements` - Body measurements

### Monitoring
- `GET /health` - Detailed health check (CPU, memory, DB, disk)
- `GET /health/simple` - Simple status (for load balancers)
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe
- `GET /api/dashboard/summary` - Metrics summary
- `GET /api/dashboard/logs` - Recent logs (filterable)

### Documentation
- `GET /api/docs/swagger.json` - OpenAPI 3.0.0 specification (JSON)
- `GET /api/docs/api` - Interactive Swagger UI
- `POST /api/logs` - Frontend error logging endpoint (receives logs from client)

---

## Logging & Monitoring

### Frontend Error Logging
- **Client Logger:** Automatic error tracking in browser
- **Levels:** debug, info, warn, error
- **Features:**
  - Automatic unhandled rejection catching
  - Global exception handler
  - Event tracking (page views, actions)
  - Performance metrics
  - User context association
  - Automatic flushing every 30 seconds
  - In-memory storage (last 100 logs)
- **Endpoint:** POST /api/logs (sends logs to backend)

**Example Usage:**
```typescript
import { clientLogger } from '@/lib/logging/client-logger';

// Log events
clientLogger.trackEvent('workout_started', { workoutId: '123' });
clientLogger.trackPageView('/dashboard');

// Log errors
clientLogger.error('Failed to save', error, { workoutId: '123' });

// Set user context
clientLogger.setUser('user-123', { email: 'user@example.com' });
```

### Backend Logging
- **Winston:** Structured JSON logs with daily rotation
- **Levels:** error, warn, info, http, debug
- **File Rotation:** 14-30 days retention, 20 MB max per file
- **Log Files:** `backend/logs/{error|combined|http|exceptions|rejections}-YYYY-MM-DD.log`
- **Frontend Logs:** Received via POST /api/logs endpoint

**Example Usage:**
```typescript
import logger from './config/logger';
logger.info('User registered', { userId: 123, email: 'user@example.com' });
logger.warn('Slow request', { url: '/api/workouts/generate', duration: '2500ms' });
logger.error('Database error', { error: error.message });
```

### Dashboard
- **URL:** `http://localhost:3001/dashboard/dashboard.html` (dev)
- **Features:** Real-time metrics, CPU/memory graphs, logs viewer, health status
- **⚠️ Security:** Currently unprotected. Protect in production with HTTP basic auth or JWT middleware.

### Health Checks
All health checks evaluate database connectivity, memory usage (< 80%), and disk space.
- Responses: `healthy` (200), `degraded` (200), `unhealthy` (503)

---

## Database

### Prisma Commands
```bash
pnpm prisma:migrate    # Create & run migrations
pnpm prisma:studio     # GUI for exploring/editing data
pnpm prisma:seed       # Run seed.ts to populate exercises
```

### Schema Highlights
- **User:** email (unique), passwordHash, fullName, createdAt
- **Exercise:** name, category, difficulty, equipment, images, muscleGroups
- **Workout:** userId, name, exercises (via WorkoutExercise junction)
- **WorkoutSession:** userId, workoutId, date, exercises performed
- **BodyMeasurement:** userId, weight, measurements, date

**Key Relations:**
- Cascade delete: User deletes → Workouts/Sessions deleted
- Unique constraints: User email, Exercise name per category

---

## Development Patterns

### Authentication Flow
1. **Signup/Login** → Backend creates JWT tokens
2. **Access Token** → Sent in Authorization header for protected requests (7-day expiry)
3. **Refresh Token** → Used to get new access token without re-login (30-day expiry, stored in httpOnly cookie)
4. **Frontend** → `/lib/api/client.ts` auto-adds Bearer token to all requests
5. **Token Refresh** → Automatic on 401 response

### Error Handling
- **Backend:** Custom AppError class with HTTP status codes; global error handler returns 500 in production (no stack traces)
- **Frontend:** API client throws errors; components catch and display via toast notifications
- **Validation:** Zod schemas validate all inputs before processing

### TypeScript
- **Strict Mode:** Enabled for both frontend and backend
- **Path Aliases:** `@/*` maps to root in frontend
- **Backend Target:** ES2022, CommonJS
- **Frontend Target:** ES2020 (Next.js handles transpiling)

---

## Common Development Tasks

### Adding a New API Endpoint
1. **Create route** in `/backend/src/routes/feature.routes.ts`
2. **Create controller** in `/backend/src/controllers/feature.controller.ts`
3. **Create service** in `/backend/src/services/feature.service.ts` (business logic)
4. **Add Zod schema** in `/backend/src/utils/validators.ts` (input validation)
5. **Test:** Use Postman/curl or the dashboard

### Adding Frontend Page
1. **Create folder** in `/app/feature/`
2. **Create `page.tsx`** with "use client" directive
3. **Create components** in `/components/feature-*.tsx` if needed
4. **Fetch data** via custom hooks (e.g., `useExercises()`)
5. **Handle loading/error states** with proper UI

### Adding Database Field
1. **Update `schema.prisma`** with new field
2. **Run migration:** `pnpm prisma migrate dev --name add_field_name`
3. **Regenerate Prisma client:** `pnpm prisma generate` (automatic after migrate)
4. **Update services** that interact with the model
5. **Update frontend** API calls and types if needed

### Testing Database Locally
```bash
cd backend
# Use Prisma Studio to browse data
pnpm prisma:studio

# Or query directly with prisma:
npx prisma db execute --stdin < query.sql
```

---

## Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api  # Backend URL (exposed to browser)
```

### Backend (`.env`)
```
DATABASE_URL=postgresql://...  # PostgreSQL connection
JWT_SECRET=                    # Set from secret manager
JWT_REFRESH_SECRET=            # Set from secret manager
NODE_ENV=development|production
FRONTEND_URL=http://localhost:3000  # For CORS
OPENAI_API_KEY=                # Optional, set from secret manager
```

---

## Security & Accessibility

### Frontend Security
- **CSP Headers:** Content-Security-Policy with strict script/style/font rules
  - Located in: `/middleware.ts`
  - Applied to all responses automatically
- **Input Sanitization:** 9 sanitization functions in `/lib/security/sanitize.ts`
  - HTML escaping, script removal, event handler blocking
  - URL validation (blocks javascript: and data: protocols)
  - Email and number validation
  - Recursive object sanitization
- **XSS Prevention:**
  - All user input sanitized before display
  - event handlers removed from untrusted content
  - No dangerous protocols allowed
- **Other Headers:**
  - X-Content-Type-Options: nosniff (MIME sniffing prevention)
  - X-Frame-Options: DENY (clickjacking prevention)
  - X-XSS-Protection: 1; mode=block (legacy browser support)
  - Strict-Transport-Security (HTTPS enforcement)
  - Referrer-Policy & Permissions-Policy

**Example:**
```typescript
import { sanitizeText, sanitizeEmail } from '@/lib/security/sanitize';

const safeName = sanitizeText(userInput);      // Safe for display
const email = sanitizeEmail(emailInput);       // Validated email
```

### Frontend Accessibility (WCAG 2.1 Level AA)
- **Focus Management:** `hooks/use-focus-trap.ts`
  - useFocusTrap() - Modal focus trapping
  - useAriaLive() - Screen reader announcements
  - useSkipLink() - Skip to main content link
- **ARIA Labels:** `lib/a11y/useAriaLabel.ts`
  - getButtonAriaLabel() - Button labels
  - getIconAriaLabel() - Icon labels
  - getFieldDescription() - Form field descriptions
  - announceToScreenReader() - Dynamic announcements
- **Color Palette:** `A11Y_COLORS` with 4.5:1 contrast minimum
  - All interactive colors compliant with WCAG AA
- **Form Accessibility:**
  - All inputs have aria-label or aria-describedby
  - Required fields marked with aria-required
  - Error messages have role="alert" and aria-live="polite"
  - Submit buttons have aria-busy for loading states
- **Keyboard Navigation:**
  - All interactive elements accessible via Tab
  - Focus trapping in modals (Escape key closes)
  - Visible focus indicators on all elements

**Example:**
```typescript
import { useFocusTrap, useAriaLive } from '@/hooks/use-focus-trap';
import { getButtonAriaLabel } from '@/lib/a11y/useAriaLabel';

const label = getButtonAriaLabel('Delete', 'Workout')  // "Delete Workout"
const ref = useFocusTrap(isModalOpen)
const announcement = useAriaLive('Saved successfully', 'polite')
```

### Backend Security
- **Rate Limiting:** Granular by operation type
  - General: 100 requests/15 minutes
  - Auth: 5 failed attempts/15 minutes (per email)
  - Write: 30 operations/15 minutes (per user ID)
  - AI: 5 generations/hour (per user ID)
- **Authentication:** JWT with secure token refresh
  - Access token: 7-day expiry
  - Refresh token: 30-day expiry in httpOnly cookie
- **Validation:** Zod schemas for all inputs
- **Password Security:** bcrypt with salt rounds (10)
- **Middleware Stack:** Helmet + custom security headers

---

## Performance Considerations

### Frontend
- **Code Splitting:** Next.js automatic per route
- **Images:** Use `next/image` (lazy loading, optimization)
- **Components:** All marked with "use client" (client-rendered)
- **Caching:** React Query with TanStack v5
  - 5-minute stale time (requests cached automatically)
  - 10-minute garbage collection
  - Request deduplication (same query = single API call)
  - Automatic background refetching
  - Optimistic updates for mutations
- **Context:** Auth/Theme/Language contexts cause full re-render; minimize updates
- **Hooks:** Custom hooks handle data fetching with React Query

### Backend
- **Database Queries:** Prisma includes (avoid N+1); use `select` to reduce payload
- **Rate Limiting:** 100 req/15min general, 5 req/15min auth
- **Response Time:** Slow requests (> 1s) logged as warnings
- **Memory:** Logs warn if usage > 80%
- **CPU:** Health check monitors load average

---

## Deployment Notes

### Vercel (Frontend)
- Auto-deploys on git push to main
- No build-time checks (ESLint/TS disabled per `next.config.mjs`)
- Environment: Set `NEXT_PUBLIC_API_URL` to production backend URL

### Railway/Render (Backend)
- Provide DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET as env vars
- Runs `npm install && npm run build && npm start`
- Health check endpoint: `GET /health/simple`

### Neon (Database)
- 500 MB free tier
- PostgreSQL 17
- Connection pooling available
- Automatic backups

---

## Testing

### Frontend Testing
- **Framework:** Jest + React Testing Library
- **Test Files:** `__tests__/` folder
- **Components:** Test rendering, user interactions, error states
- **Hooks:** Test data fetching, caching, state management
- **Scripts:**
  - `pnpm test` - Run in watch mode
  - `pnpm test:ci` - Run with coverage (CI mode)
  - `pnpm test:coverage` - Generate coverage report
- **Coverage Targets:** 50% branches, functions, lines, statements

### Backend Testing
- **Framework:** Jest + Supertest
- **Test Files:** `backend/tests/` folder
- **Unit Tests:** Utilities, validators, password, JWT
- **Integration Tests:** Auth, exercises, workouts, progress
- **Scripts:**
  - `pnpm test` - Run in watch mode (from backend/)
  - `pnpm test:ci` - Run with coverage
  - `pnpm test:coverage` - Generate coverage report
- **Coverage:** 23+ tests across critical paths

### CI/CD Pipeline
- **File:** `.github/workflows/test.yml`
- **Services:** PostgreSQL for integration tests
- **Jobs:**
  - Frontend tests
  - Backend tests
  - Build verification
  - ESLint checks
- **Runs on:** Every push and pull request

---

## File Structure Quick Reference

```
Anclora-Impulso/
├── app/                           # Next.js pages (App Router)
│   ├── auth/                      # Login, signup, error pages
│   ├── dashboard/                 # Main dashboard
│   ├── exercises/                 # Exercise library
│   ├── progress/                  # Progress tracking
│   ├── workouts/                  # Workout management
│   ├── api/logs/                  # Frontend logging API
│   └── layout.tsx                 # Root layout with providers
│
├── components/
│   ├── ui/                        # 40+ shadcn/ui components
│   ├── error-boundary.tsx         # Error boundary wrapper
│   ├── error-handler-setup.tsx    # Global error handler
│   ├── loading-spinner.tsx        # Loading states
│   └── [feature]/                 # Feature-specific components
│
├── lib/
│   ├── api/                       # API client & service methods
│   ├── contexts/                  # Auth, theme, language contexts
│   ├── a11y/                      # ARIA labels & utilities (NEW)
│   ├── security/                  # Input sanitization (NEW)
│   ├── logging/                   # Client-side logger (NEW)
│   ├── providers/                 # React Query provider (NEW)
│   ├── storage/                   # Local storage utilities
│   └── translations/              # i18n files
│
├── hooks/
│   ├── use-exercises.ts           # React Query hook
│   ├── use-workouts.ts            # React Query hook
│   ├── use-progress.ts            # React Query hook
│   ├── use-focus-trap.ts          # Accessibility hooks (NEW)
│   ├── use-async-operation.ts     # Generic async hook (NEW)
│   └── use-mobile.ts              # Mobile detection
│
├── __tests__/                     # Jest tests (NEW)
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── backend/
│   ├── src/
│   │   ├── routes/                # Express routes (+ docs.routes.ts)
│   │   ├── controllers/           # Request handlers
│   │   ├── services/              # Business logic
│   │   ├── middleware/            # Express middleware
│   │   ├── utils/                 # Helpers
│   │   ├── docs/                  # Swagger/OpenAPI spec (NEW)
│   │   ├── config/                # Logger, database, env
│   │   └── app.ts                 # Main Express app
│   │
│   ├── tests/                     # Jest tests (NEW)
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Database seeding
│   │
│   └── logs/                      # Winston logs (daily rotation)
│
├── public/                        # Static assets
├── middleware.ts                  # CSP & security headers (NEW)
│
├── docs/
│   ├── README.md                  # Documentation index
│   ├── archive/                   # Phase summaries and historical docs
│   ├── development/               # Integration, references, roadmap
│   ├── operations/                # Deployment and operational guides
│   ├── standards/                 # Internal implementation contracts
│   ├── business/                  # Executive business material
│   └── investors/                 # Investor package
│
├── .github/workflows/
│   └── test.yml                   # CI/CD pipeline (NEW)
│
└── Configuration/
    ├── .env.example               # Backend env template
    ├── .env.local                 # Frontend env (git-ignored)
    ├── package.json               # Root dependencies
    ├── tsconfig.json              # TypeScript config
    ├── next.config.mjs            # Next.js config
    └── jest.config.js             # Jest config
```

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found` | Run `pnpm install` in root and `backend/` |
| `DATABASE_URL is missing` | Create `backend/.env` from `backend/.env.example` |
| `Prisma client out of sync` | Run `pnpm prisma:generate` |
| `Port 3000 already in use` | Change `next.config.mjs` or kill process using port |
| `Port 3001 already in use` | Kill backend process or use different port |
| `CORS error` | Verify `FRONTEND_URL` in backend `.env` matches frontend origin |
| `401 Unauthorized` | Token expired; check JWT_SECRET matches; frontend should auto-refresh |
| `Database connection timeout` | Verify DATABASE_URL is correct; check network/VPN; Neon might be sleeping (free tier) |
| `Health check unhealthy` | Check `/health` endpoint response; verify DB connection, memory < 80% |

---

## Additional Resources

### Project Documentation
- **docs/README.md** - Navigation guide for all documentation
- **docs/archive/PROJECT_COMPLETION_SUMMARY.md** - Complete project overview
- **docs/development/QUICK_REFERENCE_PHASE3.md** - Quick code examples and usage patterns

### Phase Documentation
- **docs/archive/PHASE1_COMPLETED.md** - Security vulnerabilities fixes, testing setup
- **docs/archive/PHASE2_COMPLETED.md** - React Query caching, error boundaries, loading states
- **docs/archive/PHASE3_COMPLETED.md** - Accessibility, sanitization, CSP, logging, Swagger

### User & Deployment Guides
- **README.md** - User-facing quick start and repo entry point
- **docs/operations/DEPLOY.md** - Deployment guide for Vercel, Railway, Neon
- **docs/development/INTEGRATION.md** - Frontend-backend integration details

### Monitoring & Configuration
- **backend/docs/DASHBOARD.md** - Dashboard metrics and configuration
- **backend/docs/LOGGING.md** - Logging and monitoring guide

### Business Documentation
- **docs/business/EXECUTIVE-SUMMARY.md**
- **docs/investors/INVESTOR-FAQ.md**

### External Links
- **API Documentation:** http://localhost:3001/api/docs/api (interactive Swagger UI)
- **WCAG 2.1 Guidelines:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Practices:** https://www.w3.org/WAI/ARIA/apg/
- **React Query Docs:** https://tanstack.com/query/latest
- **OpenAPI Spec:** https://spec.openapis.org/oas/v3.0.3
- **CSP Documentation:** https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

---

## Project Status

- ✅ **Phase 1:** Security & Testing (complete)
- ✅ **Phase 2:** Performance & UX (complete)
- ✅ **Phase 3:** Quality & Accessibility (complete)
- ✅ **Production Ready:** Yes

**Total Implementation:** ~5 hours (estimated 12 weeks)
**Files:** 50+ created/modified
**Code:** 2,500+ lines added
**Tests:** 23+ test cases
**Security Fixes:** 10
**Accessibility Score:** 95% (WCAG 2.1 AA)

---

*Last updated: November 20, 2025*
