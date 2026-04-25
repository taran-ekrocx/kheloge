# ADR-001: Tech Stack

**Date:** 2026-04-25
**Status:** Accepted
**Author:** Founding Engineer

---

## Context

Kheloge is a multi-tenant SaaS platform for sports academies. It manages organizations, venues, batches, students, attendance, fees, payments, and enquiries. We are building at startup pace: we need to ship fast, maintain type safety throughout the stack, and keep operational complexity low enough for a small team.

Key constraints:
- Multi-tenancy (organization-scoped data with RBAC)
- Real-time requirements (live attendance marking via WebSocket)
- Async heavy work (invoice PDF generation, notification delivery via queues)
- Payment processing with webhooks
- File uploads (student photos, documents)

---

## Decisions

### 1. Monorepo — Turborepo + npm workspaces

**Decision:** Single Turborepo monorepo with two apps (`api`, `web`) and two shared packages (`@kheloge/database`, `@kheloge/shared`).

**Alternatives considered:**
- Separate repos per app — rejected; too much friction to keep types and contracts in sync.
- Nx — comparable feature set but heavier config; Turborepo is simpler and fast enough.

**Trade-offs:**
- All code in one place simplifies cross-package refactors and type sharing.
- Turborepo's remote cache speeds up CI significantly as the repo grows.

---

### 2. Backend — NestJS 10 + Fastify

**Decision:** NestJS as the application framework, with Fastify replacing Express as the HTTP adapter.

**Why NestJS:**
- Opinionated module system keeps a large multi-module backend organized.
- First-class dependency injection, guards, interceptors, and exception filters reduce boilerplate.
- Built-in Swagger integration from decorators, at zero extra effort.

**Why Fastify over Express:**
- Fastify is measurably faster (lower latency, higher throughput) for the same NestJS code.
- Async-native — no callback leakage.

**Trade-offs:**
- Fastify's multipart handling differs from Express (`@fastify/multipart` required).
- Some third-party NestJS recipes assume Express; minor adaption needed.

---

### 3. ORM — Prisma 5

**Decision:** Prisma as the ORM and migration engine.

**Why:**
- Strongly-typed client generated from schema — no runtime type-casting for DB results.
- Migrations are SQL files, easy to audit and apply in CI.
- Prisma Studio is useful for quick DB inspection in development.

**Alternatives considered:**
- TypeORM — decorator-heavy, weaker type inference for relations.
- Drizzle — lighter, but less mature migration tooling at project start.

**Trade-offs:**
- Prisma does not support all PostgreSQL-specific SQL (e.g., complex `WITH` queries require `$queryRaw`).
- Schema changes require regenerating the client — `npm run db:generate` after every schema edit.

---

### 4. Database — PostgreSQL 15

**Decision:** PostgreSQL as the primary data store.

**Why:**
- Best-in-class JSONB, full-text search, and row-level security (RLS) for multi-tenancy.
- Two migrations already applied that add RLS policies and indexes.

**Trade-offs:**
- Requires a running Postgres instance locally (Docker recommended).

---

### 5. Queue / Cache — Redis 7 + Bull

**Decision:** Redis for both caching and background job queues via Bull.

**Why:**
- Invoice PDF generation and notification dispatch are async workloads better run outside the request cycle.
- Bull (backed by Redis) provides retries, backoff, and job history out of the box.

**Trade-offs:**
- Adds an operational dependency (Redis must be running locally).
- Bull v4 (not BullMQ) chosen for wider NestJS ecosystem support at project start.

---

### 6. Frontend — Next.js 14 (App Router)

**Decision:** Next.js 14 with the App Router.

**Why:**
- Server components reduce client bundle size for data-heavy views.
- File-system routing and layout nesting match the multi-page nature of the admin dashboard.
- Strong TypeScript support and ecosystem.

**Alternatives considered:**
- Vite + React SPA — simpler, but no SSR/SSG if needed later; also misses built-in routing.
- Remix — solid, but smaller ecosystem and team familiarity.

**Trade-offs:**
- App Router is still evolving; some patterns (e.g., `cache()`, `revalidatePath`) require care.
- Local dev server binds to a fixed host (`-H 10.0.0.2`) to match the dev machine's LAN IP — adjust if needed.

---

### 7. Styling — Tailwind CSS 4

**Decision:** Tailwind CSS for all UI styling.

**Why:**
- Utility-first keeps component files self-contained.
- No CSS bundle management; Tailwind's JIT purges unused classes.

**Trade-offs:**
- Long className strings; mitigated by `clsx` + `tailwind-merge` helpers.

---

### 8. File Storage — Cloudflare R2

**Decision:** Cloudflare R2 (S3-compatible) for file uploads.

**Why:**
- Zero egress fees vs. AWS S3 — significant cost saving for media-heavy workloads.
- S3-compatible API means the `@aws-sdk/client-s3` SDK works without modification.
- Presigned URLs avoid routing large uploads through the API server.

**Trade-offs:**
- Requires a Cloudflare account and R2 bucket; local dev can skip uploads or use a local S3-compatible mock (e.g., `localstack`, `minio`).

---

### 9. Payment Processing — Razorpay

**Decision:** Razorpay for payment collection and webhook processing.

**Why:**
- Dominant Indian payment gateway with UPI, cards, net banking, and wallets in one integration.
- Webhook-based confirmation model is simple and reliable.

**Trade-offs:**
- India-only; if the platform expands internationally, a second gateway will be needed.

---

## Summary

| Concern | Choice | Reason |
|---------|--------|--------|
| Monorepo | Turborepo | Fast, simple, type sharing |
| HTTP framework | NestJS + Fastify | Organized, fast, typed |
| ORM | Prisma 5 | Type-safe, migrations-first |
| Database | PostgreSQL 15 | RLS, JSONB, reliability |
| Queues | Redis + Bull | Async jobs, retries |
| Frontend | Next.js 14 | SSR, routing, ecosystem |
| Styling | Tailwind CSS 4 | Utility-first, zero dead CSS |
| File storage | Cloudflare R2 | Zero egress cost |
| Payments | Razorpay | Indian market coverage |
| Language | TypeScript 5 | End-to-end type safety |
