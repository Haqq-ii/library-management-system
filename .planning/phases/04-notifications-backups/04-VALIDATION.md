---
phase: 4
slug: notifications-backups
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript build check (`next build`) + manual smoke tests |
| **Config file** | `tsconfig.json` |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx next build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx next build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | NOTF-01 | — | Resend sends only to authenticated member emails | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | NOTF-02 | — | Overdue alert only fires for ACTIVE loans past dueAt | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | NOTF-03 | — | Hold-ready email fires only when holdTriggered=true | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 2 | NOTF-04 | — | NotificationLog records sent/failed status accurately | build | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 4-04-01 | 04 | 3 | INFRA-05 | — | Backup config present and documented | manual | Visual verification | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install packages: `npm install resend react-email @react-email/components @react-email/render node-cron @types/node-cron`
- [ ] Create `server.ts` custom server entry point with node-cron scheduler
- [ ] Verify `next build` passes after package installs

*Email templates and cron handlers are new files — existing test infra (`next build`) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Due-date reminder email received at member inbox | NOTF-01 | Requires real SMTP delivery and member email | Seed a loan with dueAt = today+3, trigger cron manually, check inbox |
| Overdue alert email received | NOTF-02 | Requires real SMTP delivery | Seed an overdue loan, trigger cron, check inbox |
| Hold-ready email on return | NOTF-03 | Requires real SMTP delivery | Return a book with a reservation, check member inbox |
| Backup file exists after window | INFRA-05 | Requires Railway or Docker exec to verify | Check Railway backup panel or `docker exec pg pg_dump` output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
