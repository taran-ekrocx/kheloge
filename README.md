# Kheloge

Multi-tenant sports academy management platform. Manages organizations, venues, batches, students, attendance, payments, and enquiries.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | [Turborepo](https://turbo.build/) + npm workspaces |
| Backend | [NestJS](https://nestjs.com/) 10 + [Fastify](https://fastify.dev/) |
| ORM | [Prisma](https://www.prisma.io/) 5 |
| Database | PostgreSQL 15+ |
| Cache / Queues | Redis 7 + [Bull](https://github.com/OptimalBits/bull) |
| Frontend | [Next.js](https://nextjs.org/) 14 (App Router) |
| Styling | Tailwind CSS 4 |
| Data fetching | TanStack React Query 5 |
| Validation | Zod + class-validator |
| File storage | Cloudflare R2 (S3-compatible) |
| Payments | Razorpay |
| Real-time | Socket.io (WebSocket gateway for attendance) |
| Language | TypeScript 5 throughout |

## Repository Structure

```
kheloge/
├── apps/
│   ├── api/          # NestJS backend — port 4000
│   └── web/          # Next.js frontend — port 3035
├── packages/
│   ├── database/     # Prisma client + schema + migrations + seed
│   └── shared/       # Shared types, DTOs, and constants
├── turbo.json        # Turborepo task pipeline
└── package.json      # Root workspace config
```

### API modules (`apps/api/src/modules/`)

Auth · Cities · Venues · Sports · Users · Coaches · Students · Batches · Attendance · Enquiries · Fee Structures · Invoices · Payments · Notifications · Uploads · Reports

## Prerequisites

- **Node.js** ≥ 20 (`node --version`)
- **npm** ≥ 11 (`npm --version`)
- **PostgreSQL** 15+ running locally (or via Docker)
- **Redis** 7+ running locally (or via Docker)

Quick way to start PostgreSQL + Redis with Docker:

```bash
docker run -d --name kheloge-pg -e POSTGRES_DB=kheloge_dev -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15-alpine
docker run -d --name kheloge-redis -p 6379:6379 redis:7-alpine
```

## Local Development Setup

> Target: < 10 minutes from zero to running app.

### 1. Clone and install

```bash
git clone <repo-url>
cd kheloge
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in the required values (see comments inside)
```

Minimum required vars to run locally:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kheloge_dev
REDIS_HOST=localhost
JWT_SECRET=local-dev-secret-change-me
JWT_REFRESH_SECRET=local-dev-refresh-secret-change-me
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Apply migrations
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

### 4. Start the development servers

```bash
npm run dev
```

Turborepo starts both apps in parallel:

| App | URL |
|-----|-----|
| API | http://localhost:4000 |
| Swagger docs | http://localhost:4000/docs |
| Frontend | http://localhost:3035 |

### 5. Verify

Open http://localhost:4000/docs — Swagger UI should load.
Open http://localhost:3035 — Login page should render.

## Common Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start all apps in watch mode |
| `npm run build` | Production build (all packages) |
| `npm run test` | Run all test suites |
| `npm run lint` | Lint all packages |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:seed` | Seed the database with sample data |

## Architecture Decision Records

ADRs are in [`docs/adr/`](./docs/adr/). Start with [ADR-001: Tech Stack](./docs/adr/001-tech-stack.md).
