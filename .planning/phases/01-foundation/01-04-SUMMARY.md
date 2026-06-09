---
plan: 01-04
phase: 01-foundation
status: complete
completed: 2026-06-09
wave: 3
---

# Plan 01-04 Summary: Auth UI + App Shell

## What Was Built

- `src/app/layout.tsx` — Root layout with Sonner Toaster and skip-to-main link (WCAG)
- `src/features/auth/LoginCard.tsx` — Login form with RHF + Zod + authClient.signIn.email; role-based redirect (librarian → /dashboard, member → /catalog); isPending disabled state; generic error copy (no user enumeration)
- `src/app/(auth)/login/page.tsx` — Full-screen bg-slate-50 centering LoginCard
- `src/middleware.ts` — UX-only redirect with CVE-2025-29927 documentation comment
- `src/app/(app)/layout.tsx` — Async Server Component; auth.api.getSession → redirect("/login") if absent; renders AppSidebar + main#main
- `src/components/layout/AppSidebar.tsx` — Role-aware 240px desktop sidebar; librarian nav (Dashboard/Books/Members/Loans-disabled); member nav (Search Catalog/My Loans/Reservations-disabled/My Profile); aria-current active state; mobile Sheet via hamburger with aria-label="Open navigation"; authClient.signOut footer
- `src/features/dashboard/DashboardStats.tsx` — Async Server Component; prisma.book.count + prisma.user.count(MEMBER) + prisma.bookCopy.count; 3 stat cards
- `src/app/(app)/dashboard/page.tsx` — Renders DashboardStats under an h1

## Deviations

| # | Rule | Deviation | Resolution |
|---|------|-----------|------------|
| 1 | Rule 1 | Permission block in worktree prevented writing DashboardStats.tsx and dashboard/page.tsx | Orchestrator wrote files directly on main after merge; SUMMARY.md also written by orchestrator |
| 2 | Rule 1 | SheetTrigger `asChild` prop not available — sheet.tsx uses Base UI (not Radix UI); `asChild` is a Radix pattern | Fixed by switching to Base UI `render` prop pattern; type-check passes |

## Self-Check

- [x] `src/features/auth/LoginCard.tsx` contains `authClient.signIn.email` and `zodResolver`
- [x] `src/app/(auth)/login/page.tsx` uses `bg-slate-50` and renders `<LoginCard`
- [x] `src/app/layout.tsx` renders Sonner `Toaster` and contains skip link
- [x] `src/middleware.ts` redirects to `/login` with UX-only comment
- [x] `src/app/(app)/layout.tsx` contains `auth.api.getSession` and `redirect("/login")`
- [x] `src/components/layout/AppSidebar.tsx` contains `aria-current`, `aria-label="Open navigation"`, `authClient.signOut`
- [x] `src/features/dashboard/DashboardStats.tsx` contains `prisma.book.count` with `deletedAt: null`
- [x] `npx tsc --noEmit` exits 0

## Key Files

```
key-files:
  created:
    - src/app/layout.tsx
    - src/features/auth/LoginCard.tsx
    - src/app/(auth)/login/page.tsx
    - src/middleware.ts
    - src/app/(app)/layout.tsx
    - src/components/layout/AppSidebar.tsx
    - src/features/dashboard/DashboardStats.tsx
    - src/app/(app)/dashboard/page.tsx
    - tests/unit/login-card.test.tsx
```

## Self-Check: PASSED
