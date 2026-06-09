---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 + React Testing Library 16.3.2 |
| **Config file** | `vitest.config.ts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **E2E framework** | Playwright 1.60.0 |
| **E2E quick run** | `npx playwright test --headed=false` |
| **Estimated runtime** | ~60–120 seconds (unit fast; Playwright includes browser launch) |

> **Async Server Components note:** Vitest does not support async React Server Components. Unit tests cover synchronous components, utility functions, Zod schemas, and Server Actions as plain functions. Playwright covers auth flows, form submissions, and page navigation.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| AUTH-01 | Email + password login succeeds with valid credentials | E2E (Playwright) | `npx playwright test tests/e2e/auth.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-01 | Login fails with wrong password — error message shown | E2E (Playwright) | `npx playwright test tests/e2e/auth.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-02 | Session persists after page refresh | E2E (Playwright) | `npx playwright test tests/e2e/session.spec.ts` | ❌ W0 | ⬜ pending |
| AUTH-03 | MEMBER accessing `/books` (librarian route) gets 403 | Unit (Server Action) | `npx vitest run tests/unit/require-role.test.ts` | ❌ W0 | ⬜ pending |
| AUTH-03 | LIBRARIAN accessing `/catalog` redirected or shown member view | E2E (Playwright) | `npx playwright test tests/e2e/rbac.spec.ts` | ❌ W0 | ⬜ pending |
| CAT-01 | `createBook` Server Action returns error for MEMBER caller | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | ❌ W0 | ⬜ pending |
| CAT-01 | Librarian can add book; row appears in `/books` | E2E | `npx playwright test tests/e2e/catalog.spec.ts` | ❌ W0 | ⬜ pending |
| CAT-01 | Soft-delete sets `deletedAt`; book absent from default list | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | ❌ W0 | ⬜ pending |
| CAT-02 | Adding copy to book increments `totalCopies` | Unit | `npx vitest run tests/unit/catalog-actions.test.ts` | ❌ W0 | ⬜ pending |
| CAT-02 | Copy status badge renders correct color per status | Unit (RTL) | `npx vitest run tests/unit/BookStatusBadge.test.tsx` | ❌ W0 | ⬜ pending |
| CAT-03 | Member catalog search returns matching books | E2E | `npx playwright test tests/e2e/member-catalog.spec.ts` | ❌ W0 | ⬜ pending |
| CAT-04 | `fetchBookByISBN` returns title/author for known ISBN | Unit (mock fetch) | `npx vitest run tests/unit/isbn-fetch.test.ts` | ❌ W0 | ⬜ pending |
| CAT-04 | `fetchBookByISBN` returns `ISBN_NOT_FOUND` for unknown ISBN | Unit (mock fetch) | `npx vitest run tests/unit/isbn-fetch.test.ts` | ❌ W0 | ⬜ pending |
| MBR-01 | Librarian can register a new member; appears in member list | E2E | `npx playwright test tests/e2e/members.spec.ts` | ❌ W0 | ⬜ pending |
| MBR-02 | Soft-delete sets `deletedAt`; member absent from default list | Unit | `npx vitest run tests/unit/member-actions.test.ts` | ❌ W0 | ⬜ pending |
| MBR-03 | Member can view `/my-profile` and sees own name/email/role | E2E | `npx playwright test tests/e2e/member-profile.spec.ts` | ❌ W0 | ⬜ pending |
| INFRA-01 | `docker compose up` succeeds; app reachable at localhost:3000 | Manual smoke | `docker compose up -d && curl http://localhost:3000` | Manual | ⬜ pending |
| INFRA-02 | `.env.development` consumed; no secrets in git | Manual audit | Check `.gitignore` includes `.env.*` | Manual | ⬜ pending |
| INFRA-03 | Seed creates 1 librarian, 10 students, 5 faculty, 20 books, LoanPolicy rows | Unit (seed verification) | `npx vitest run tests/unit/seed-verification.test.ts` | ❌ W0 | ⬜ pending |
| INFRA-04 | No `prisma.model.delete()` calls in codebase | Static (grep) | `grep -r "\.delete(" src/` returns 0 results | Automated grep | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — Vitest configuration
- [ ] `playwright.config.ts` — Playwright configuration
- [ ] `tests/unit/require-role.test.ts` — covers AUTH-03
- [ ] `tests/unit/catalog-actions.test.ts` — covers CAT-01, CAT-02
- [ ] `tests/unit/member-actions.test.ts` — covers MBR-02
- [ ] `tests/unit/isbn-fetch.test.ts` — covers CAT-04 (mocked fetch)
- [ ] `tests/unit/BookStatusBadge.test.tsx` — covers CAT-02 badge rendering
- [ ] `tests/unit/seed-verification.test.ts` — covers INFRA-03
- [ ] `tests/e2e/auth.spec.ts` — covers AUTH-01
- [ ] `tests/e2e/session.spec.ts` — covers AUTH-02
- [ ] `tests/e2e/rbac.spec.ts` — covers AUTH-03
- [ ] `tests/e2e/catalog.spec.ts` — covers CAT-01
- [ ] `tests/e2e/member-catalog.spec.ts` — covers CAT-03
- [ ] `tests/e2e/members.spec.ts` — covers MBR-01
- [ ] `tests/e2e/member-profile.spec.ts` — covers MBR-03
- [ ] Framework install: `npm install --save-dev vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event @playwright/test`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose up` succeeds; login page loads with seeded data | INFRA-01 | Requires running Docker daemon + port 3000 | `docker compose up -d && curl -s http://localhost:3000 \| grep -q "Sign In"` |
| `.env.development` not committed to git | INFRA-02 | Static check outside test runner | Verify `git ls-files .env*` returns empty; check `.gitignore` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
