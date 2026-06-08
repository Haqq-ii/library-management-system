# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 1-Foundation
**Areas discussed:** Docker dev workflow, App navigation & layout, Catalog display, Member type config

---

## Docker Dev Workflow

### Hot Reload

| Option | Description | Selected |
|--------|-------------|----------|
| Volume mount + polling | Mount src/ into container, enable WATCHPACK_POLLING=true — works reliably on Windows/WSL2 | ✓ |
| Volume mount + inotify | Native file watching — faster but unreliable on Windows/WSL2 | |
| No hot reload in Docker | Rebuild container on changes — slower but simpler | |

**User's choice:** Volume mount + polling
**Notes:** Windows/WSL2 environment — polling is the safe choice.

### Migrations

| Option | Description | Selected |
|--------|-------------|----------|
| Auto on startup | Entrypoint runs `prisma migrate deploy` then seeds before app starts | ✓ |
| Manual via docker exec | Developer runs migration manually when needed | |
| Separate migrate service | One-shot migrate container in docker-compose | |

**User's choice:** Auto on startup

### Seed Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Only on empty DB | Checks if DB is empty before seeding — safe to restart | ✓ |
| Always on startup | Seed runs every time — requires idempotent script | |
| Manual only | Developer decides when to reset data | |

**User's choice:** Only on empty DB

### DB Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Named volume, persists across restarts | `docker compose down -v` to wipe — standard approach | ✓ |
| Bind mount to ./pgdata | Data visible on host filesystem — clutters repo | |
| Ephemeral (no volume) | Fresh DB every startup — only works with always-seed | |

**User's choice:** Named volume

---

## App Navigation & Layout

### Navigation Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar | Persistent left sidebar — standard for admin/management tools | ✓ |
| Top nav | Horizontal navigation bar | |
| Sidebar + top bar | Sidebar for main nav, top bar for user menu | |

**User's choice:** Sidebar

### Librarian Sections

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard | At-a-glance stats: active loans, overdue, new members | ✓ |
| Books | Catalog + copy management | ✓ |
| Members | Register and manage accounts | ✓ |
| Loans | Active loans, process checkout and return | ✓ |

**User's choice:** All four sections selected (multi-select)

### Member View

| Option | Description | Selected |
|--------|-------------|----------|
| Simplified sidebar | Same layout, fewer sections: Search, My Loans, My Reservations, My Profile | ✓ |
| Different layout entirely | Card-based home page for members | |
| Single page app | One dashboard with all member info | |

**User's choice:** Simplified sidebar

### Login Page

| Option | Description | Selected |
|--------|-------------|----------|
| Centered card | Single login card on plain background — clean, standard | ✓ |
| Split layout | Left branding panel, right login form | |
| Full page form | Login form takes most of the page | |

**User's choice:** Centered card

---

## Catalog Display

### Book List View

| Option | Description | Selected |
|--------|-------------|----------|
| Data table | Rows with title, author, ISBN, copy count, availability — sortable, inline actions | ✓ |
| Card grid | Book cards with cover placeholder — more visual but less dense | |
| Table + card toggle | User can switch views — adds complexity | |

**User's choice:** Data table

### Copy Management

| Option | Description | Selected |
|--------|-------------|----------|
| Book detail page with copies sub-table | /books/[id] with book info + copies table | ✓ |
| Expandable row inline | Expand book row to reveal copies | |
| Separate copies section | Books and Copies as separate sidebar sections | |

**User's choice:** Book detail page with copies sub-table

### Member Catalog

| Option | Description | Selected |
|--------|-------------|----------|
| Search bar + results table | Prominent search, table results | |
| Search + card results | Prominent search, card results with availability badge | ✓ |
| Browse + search | Default shows all books paginated | |

**User's choice:** Search + card results

### Book Form

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over panel | Right-side drawer — catalog stays visible | ✓ |
| Full page form | Navigate to /books/new — more space | |
| Modal dialog | Centered modal — cramped with many fields | |

**User's choice:** Slide-over panel

---

## Member Type Config

### Loan Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded DB config table | `LoanPolicy` table, editable via seed script | ✓ |
| Hardcoded constants | Config file constants — requires redeploy to change | |
| Environment variables | Loan durations in .env | |

**User's choice:** Seeded DB config table (`LoanPolicy`)

### Default Values

| Option | Description | Selected |
|--------|-------------|----------|
| Student 14d / Faculty 30d / $0.25/day | Standard university library defaults | ✓ |
| Student 7d / Faculty 14d / $0.50/day | Stricter policy | |
| Custom values | User-specified | |

**User's choice:** Student 14 days / Faculty 30 days / $0.25/day fine rate

### Member Form

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-over panel | Consistent with book form pattern | ✓ |
| Full page form | More space, separate page | |
| Modal dialog | Compact but less space | |

**User's choice:** Slide-over panel

---

## Claude's Discretion

- UI color scheme / brand — open to shadcn/ui defaults (slate/neutral palette)
- Sidebar mobile collapse behavior — standard responsive pattern acceptable
- Catalog/member table pagination — standard offset pagination with page size selector
- Copy barcode/identifier format — auto-incrementing numeric ID acceptable

## Deferred Ideas

- Configurable loan policy via admin UI — v2 scope (ADMIN-v2-01)
- Book cover image upload — v2 scope (CAT-v2-02)
- Member self-registration — v2 scope (MBR-v2-01)
- Bulk CSV book import — v2 scope (CAT-v2-01)
