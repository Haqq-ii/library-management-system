---
phase: 01-foundation
plan: "03"
subsystem: infrastructure
tags: [docker, docker-compose, postgresql, entrypoint, env-config, infra]
dependency_graph:
  requires:
    - "01-02: prisma/seed.ts, src/lib/db.ts, src/lib/auth.ts — required by entrypoint"
  provides:
    - "Dockerfile — multi-stage build: deps, development (postgresql-client), builder, runner (standalone)"
    - "docker-compose.yml — postgres:16-alpine + app service, named volume, healthcheck, WATCHPACK_POLLING"
    - "docker-entrypoint.sh — pg_isready wait -> prisma generate -> migrate deploy -> conditional seed -> start"
    - ".env.development — dev DATABASE_URL, BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL"
    - ".env.example — committed key template with empty values (T-03-01)"
    - "next.config.ts — output standalone for production runner"
  affects:
    - "Walking Skeleton: docker compose up now brings up a seeded Postgres + Next.js stack"
    - "INFRA-01: Docker-first dev environment contract"
    - "INFRA-02: Environment config separation (dev/staging/prod)"
tech_stack:
  added: []
  patterns:
    - "Multi-stage Dockerfile: deps -> development (postgresql-client) -> builder -> runner (standalone)"
    - "docker-compose health check: pg_isready on db before app starts"
    - "Entrypoint ordering: prisma generate BEFORE prisma migrate deploy (Pitfall 2)"
    - "D-03 conditional seed: psql User-count guard prevents double-seeding on restart"
    - "D-04 named volume: postgres_data persists across docker compose down/up"
    - "WATCHPACK_POLLING=true for reliable hot reload on Windows/WSL2 (D-01)"
key_files:
  created:
    - "Dockerfile — multi-stage with development target + postgresql-client"
    - "docker-compose.yml — two services (db + app), named volume, healthcheck, env_file"
    - "docker-entrypoint.sh — health -> generate -> migrate -> seed guard -> start"
    - ".env.development — dev DATABASE_URL, BETTER_AUTH_URL, NEXT_PUBLIC_BETTER_AUTH_URL"
    - ".env.staging — placeholder keys for staging environment"
    - ".env.production — placeholder keys for production environment"
    - ".env.example — committed template with empty values"
  modified:
    - "next.config.ts — added output: standalone for production runner stage"
decisions:
  - "Used docker compose v2 format (no version: key) — avoids deprecation warning"
  - "postgresql-client installed in development stage only (not production runner)"
  - "Entrypoint uses psql for seed check (more reliable than prisma db execute in shell — Open Q2)"
  - ".env.staging and .env.production have placeholder values only — no real secrets in git"
metrics:
  completed_date: "2026-06-09"
  tasks_completed: 1
  tasks_total: 2
  files_created: 7
  files_modified: 1
  stopped_at: "checkpoint:human-verify (Task 2)"
---

# Phase 01 Plan 03: Docker Infrastructure Summary

Multi-stage Dockerfile with development target (postgresql-client), docker-compose stack wiring Next.js to PostgreSQL 16 with named volume and Windows-safe hot reload, and an entrypoint that orchestrates pg_isready wait -> prisma generate -> migrate deploy -> conditional seed -> start. Three env configs plus the committed .env.example template.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Dockerfile, docker-compose, entrypoint, env files | b15ab29 | Dockerfile, docker-compose.yml, docker-entrypoint.sh, .env.development, .env.staging, .env.production, .env.example, next.config.ts |

## Tasks Pending (awaiting checkpoint)

| Task | Name | Type | Status |
|------|------|------|--------|
| 2 | Walking Skeleton smoke test — docker compose up | checkpoint:human-verify | AWAITING HUMAN VERIFICATION |

## Deviations from Plan

None — plan executed exactly as specified. The compose file `version:` key was omitted (docker compose v2 ignores it with a deprecation warning; removing it is cleaner).

## Known Stubs

None. All files are infrastructure configuration with no UI or data stubs.

## Threat Surface Scan

| Control | File | Status |
|---------|------|--------|
| T-03-01: env files not in git | .env.development, .env.staging, .env.production | MITIGATED — all three gitignored; only .env.example (empty values) committed |
| T-03-02: seed on every restart | docker-entrypoint.sh | MITIGATED — D-03 psql User-count guard; seed skipped when User table non-empty |
| T-03-03: migration order | docker-entrypoint.sh | MITIGATED — prisma generate on line 10, prisma migrate deploy on line 13 (generate precedes migrate) |
| T-03-04: default postgres creds | docker-compose.yml | ACCEPTED — dev-only postgres/postgres on isolated Docker network; production uses managed creds via env config |

## Self-Check: PASSED

- `Dockerfile` contains `AS development` — verified (line 8)
- `Dockerfile` contains `apk add --no-cache postgresql-client` — verified (line 11)
- `docker-compose.yml` contains `postgres:16-alpine` — verified
- `docker-compose.yml` contains `postgres_data` — verified
- `docker-compose.yml` contains `WATCHPACK_POLLING: "true"` — verified
- `docker-compose.yml` contains `condition: service_healthy` — verified
- `docker-compose.yml` contains `env_file` — verified
- `docker-entrypoint.sh` contains `pg_isready` — verified
- `docker-entrypoint.sh` contains `npx prisma generate` — verified (line 10)
- `docker-entrypoint.sh` contains `npx prisma migrate deploy` — verified (line 13)
- `docker-entrypoint.sh` contains `npx prisma db seed` — verified
- `docker-entrypoint.sh` contains `SELECT COUNT(*) FROM "User"` — verified
- prisma generate (line 10) LESS THAN prisma migrate deploy (line 13) — CORRECT ORDER
- `.env.development` contains `DATABASE_URL=postgresql://postgres:postgres@db:5432/library_dev` — verified
- `.env.development` contains `BETTER_AUTH_URL` — verified
- `.env.development` contains `NEXT_PUBLIC_BETTER_AUTH_URL` — verified
- `.env.example` contains `DATABASE_URL=` (empty value) — verified
- `.env.example` contains `BETTER_AUTH_SECRET=` (empty value) — verified
- `git ls-files .env.development` returns empty (gitignored) — verified
- `docker compose config -q` exits 0 — PASSED
- Commit b15ab29 present in git log — verified
