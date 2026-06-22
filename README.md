# Library Management System

A web-based library management system for schools and universities. Librarians manage the book catalog, member accounts, loans, fines, and reservations. Students and faculty can search the catalog, check active loans, make reservations, and renew books — all through a browser interface.

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Database:** PostgreSQL 16 + Prisma ORM
- **Auth:** Better Auth (credentials + RBAC)
- **Email:** Resend + React Email
- **UI:** Tailwind CSS v4 + shadcn/ui
- **Scheduled Jobs:** node-cron (daily overdue scan)
- **Deployment:** Docker (Railway or self-hosted)

## Local Development

### Prerequisites

- Docker Desktop
- Node.js 20+ (for type-checking outside Docker)

### Start the stack

```bash
docker compose up -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

The database is seeded with a default librarian account. See `.env.development` for credentials.

### Running migrations

```bash
docker compose exec app npx prisma migrate dev
```

### Stopping

```bash
docker compose down
```

## Database Backups

### Railway (production — recommended)

Railway provides native managed backups for the PostgreSQL add-on. No application code is required.

**To enable:**

1. Open the Railway dashboard and navigate to your PostgreSQL service.
2. Go to **Settings → Backups**.
3. Enable **Daily** backups (retained for 6 days by default).
4. Optionally enable **Weekly** backups for longer retention.

Reference: [docs.railway.com/reference/backups](https://docs.railway.com/reference/backups)

### Self-hosted Docker (local / VPS)

The `db-backup` sidecar service in `docker-compose.yml` runs a daily `pg_dump` at 02:00 UTC and writes compressed backup files to `./backups/` on the host.

**Start the backup sidecar:**

```bash
docker compose up -d db db-backup
```

Confirm the service is running:

```bash
docker compose ps db-backup
```

**Verify a backup is produced:**

Rather than waiting for the 02:00 UTC scheduled run, trigger a manual dump immediately:

```bash
docker compose exec db-backup sh -c "pg_dump -Fc library_dev > /backups/db-manual.dump"
```

Then confirm the file exists on the host with non-zero size:

```bash
ls -la ./backups/
```

You should see a `db-YYYY-MM-DD.dump` (or `db-manual.dump`) file.

**Restore from a backup:**

```bash
docker compose exec db pg_restore -U postgres -d library_dev /backups/db-YYYY-MM-DD.dump
```

**Backup schedule:**

The cron schedule (`0 2 * * *`) can be edited directly in the `db-backup` service `command` in `docker-compose.yml`.

**Retention:**

Backups accumulate in `./backups/`. Prune old files periodically to avoid unbounded disk growth — e.g.:

```bash
find ./backups -name "*.dump" -mtime +30 -delete
```

> **Security note:** Backup files contain the full database including password hashes and PII. The `./backups` directory is gitignored and must never be committed to version control.
