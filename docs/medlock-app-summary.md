# MedLock — Complete Application Summary

## 1. Folder structure

```
MedLock/
├── apps/web/                  # Stub — leftover from refactor; only .env.local + .next/ artifacts
├── backend/                   # Express 5 + TypeScript API (port 4000)
│   └── src/
│       ├── data/zip-prefix-populations.json   # Safe Harbor ZIP truncation lookup
│       ├── services/          # Per-feature service modules (12 files)
│       ├── env.ts, http-error.ts, supabase.ts, server.ts
│       └── tsconfig.json
├── frontend/                  # Next.js 14 App Router (port 3000)
│   └── src/
│       ├── app/               # Route handlers + pages
│       ├── components/        # Shared UI (hipaa-shield/*, phi-inventory/*, deid/*, ui/*, hero, header)
│       └── lib/               # api/* (typed client), supabase/*, rbac/*, phi-scan-export, utils
├── packages/
│   ├── phi-detector/          # Regex PHI scanner (legacy; used by /api/scans)
│   └── rbac/                  # Role/permission matrix consumed by both apps
├── supabase/
│   ├── migrations/            # 9 SQL migrations (2026-04-27 → 2026-05-01)
│   └── seed/                  # 2 seed files (mock org + module-records demo data)
├── docs/hipaa-shield-feature-spec.md
├── package.json, package-lock.json, turbo.json
```

Workspaces: `frontend`, `backend`, `packages/*`. Orchestrated by Turborepo (`turbo build/dev/lint`). Package manager `npm@10.8.2`.

---

## 2. Packages and apps

| Component | Stack | Role |
|---|---|---|
| [frontend/](../frontend/) | Next.js 14.2.35, React 18, Tailwind 3.4 + shadcn 4 + Radix, Supabase SSR/JS, jspdf/xlsx/papaparse | User-facing HIPAA compliance console: landing, auth, dashboard with PHI scanner, inventory, de-id checker, RBAC, access review |
| [backend/](../backend/) | Express 5 (ESM), tsx watch, Supabase JS, Anthropic SDK 0.91, pdf-lib | REST API on port 4000. CORS allow-list `[FRONTEND_ORIGIN, :3000, :3005]`, body limit 10mb, `requireAuth` Supabase bearer guard, `requirePermission(page, level)` RBAC guard via `@medlock/rbac` |
| [packages/rbac/](../packages/rbac/) | Pure JS + hand-written `.d.ts` | Authoritative role/permission matrix: 7 roles × 36 NavPages × `{full \| read_only \| none}`. Exposes `can`, `canAccess`, `canWrite`, `pageForRoute`, `permissionMeets` |
| [packages/phi-detector/](../packages/phi-detector/) | Single 100-LOC TS file | Regex-based PHI leakage scanner used by the legacy `/api/scans` endpoint (see §6) |

---

## 3. Pages

### Public
| Route | File | What it does | Backend calls |
|---|---|---|---|
| `/` | [page.tsx](../frontend/src/app/page.tsx) | Landing: header + hero with CTAs to login/signup. Hero contains literal *"Product preview coming soon"* placeholder ([hero.tsx:53](../frontend/src/components/hero.tsx)) | none |
| `/login` | [login/page.tsx](../frontend/src/app/login/page.tsx) | Email/password sign-in + "Continue with GitHub" OAuth | `POST /api/roles/accept-invite` after sign-in |
| `/signup` | [signup/page.tsx](../frontend/src/app/signup/page.tsx) | Supabase email signup with `emailRedirectTo: /auth/callback` | `POST /api/roles/accept-invite` |
| `/auth/callback` | [route.ts](../frontend/src/app/auth/callback/route.ts) | Exchanges OAuth code for session; if GitHub, **upserts `github_connections` directly via Supabase** (bypasses backend); always redirects to `/dashboard` | `POST /api/roles/accept-invite` |

### Authenticated dashboard (real implementations — 6)
| Route | File | What it does | Backend calls |
|---|---|---|---|
| `/dashboard` | [dashboard/page.tsx](../frontend/src/app/dashboard/page.tsx) | Main page: alert banner (mock copy), 4 metric cards (3 hardcoded, 1 real), compliance ring, recent findings table, GitHub repo grid with "Scan this repo" button | `GET /api/scans`, `GET /api/repos`, `POST /api/scans` |
| `/dashboard/phi-inventory` | [phi-inventory/page.tsx](../frontend/src/app/dashboard/phi-inventory/page.tsx) | Filterable PHI systems table, slide-over create/edit, audit log, bulk update, audit-package PDF export, coverage map, risk summary | `GET /api/phi-inventory`, `/coverage`, `/risk-summary`; `PATCH /bulk`; `POST /export/audit-package` |
| `/dashboard/phi-leakage-scanner` | [phi-leakage-scanner/page.tsx](../frontend/src/app/dashboard/phi-leakage-scanner/page.tsx) | GitHub connection panel, multi-repo picker, multi-source scan runner, history dropdown, findings table with action modals, PDF/CSV/XLSX export | `GET /api/repos`, `DELETE /api/repos/connection`, `GET/POST /api/phi-scan`, `PATCH /api/phi-scan/findings/:id`, `POST /api/phi-inventory/sync-from-scanner` |
| `/dashboard/de-identification-checker` | [de-identification-checker/page.tsx](../frontend/src/app/dashboard/de-identification-checker/page.tsx) | Two-tab tool (Checker / De-identifier). Safe Harbor + Expert Determination; 4-step column-mapping → run → download | `POST /api/deid/check`, `GET /:id`, `/recheck`, `/expert-review`, `/report`, `/export.csv`; `POST /api/deid/run`; `GET /api/deid/history` |
| `/dashboard/role-management` | [role-management/page.tsx](../frontend/src/app/dashboard/role-management/page.tsx) | Admin-only: invite form, members list with inline role/suspend, pending invitations, role-change log | `GET /api/roles/{members,invitations,changelog}`, `POST /invite`, `PATCH/DELETE /members/:id` |
| `/dashboard/user-access-review` | [user-access-review/page.tsx](../frontend/src/app/dashboard/user-access-review/page.tsx) | Quarterly access certification campaigns, review queue with approve/revoke/more-info, role-coverage cards | `GET /api/access-review/overview`, `POST /campaigns`, `PATCH /items/:id`, `PATCH /api/roles/members/:id` |
| `/dashboard/no-access` | [no-access/page.tsx](../frontend/src/app/dashboard/no-access/page.tsx) | 19-line empty state shown by middleware when RBAC denies access | none |
| `/dashboard/report/[scanId]` | [report/[scanId]/page.tsx](../frontend/src/app/dashboard/report/[scanId]/page.tsx) | Reads legacy scan, computes safety score (100 − severity-weighted penalty), groups findings | `GET /api/scans/:scanId` |

### Catch-all template (29 stub routes)
[`/dashboard/[...slug]`](../frontend/src/app/dashboard/[...slug]/page.tsx) renders a static spec from [feature-content.ts](../frontend/src/app/dashboard/feature-content.ts) — header, 3 hardcoded metric cards, workflow list, hardcoded "Module controls" table, empty-state preview. Primary/secondary action buttons have **no `onClick` handlers** ([:83, :123](../frontend/src/app/dashboard/[...slug]/page.tsx)). 29 routes resolve here:

`compliance-score-trend, access-control-settings, emergency-access-log, encryption-inventory, audit-log-viewer, anomaly-alerts, network-transmission-security, risk-assessment, findings-remediation, policy-library, controls-checklist, baa-tracker, vendor-risk-scores, subcontractor-register, training-tracker, training-course-library, policy-acknowledgements, sanctions-log, incident-intake, active-incidents, breach-notification-center, incident-history, report-generator, scheduled-reports, audit-packages, previous-reports-archive, organization-profile, integrations, notification-preferences, user-management, billing-plan`

### Middleware
[middleware.ts](../frontend/src/middleware.ts): unauthed `/dashboard*` → `/login`; authed user has role looked up from `organization_memberships`; `canAccess(role, page)` false → `/dashboard/no-access`. Membership lookup hits Supabase on every request (no cache).

---

## 4. API routes

All routes except `/api/health` require a Supabase bearer token via `requireAuth`. Most also call `requirePermission(page, level)`.

### Health
- `GET /api/health` — `{ ok: true }`

### Auth / RBAC
- `POST /api/roles/accept-invite` — accepts pending invites for current user (idempotent); fired by login, signup, and OAuth callback
- `GET /api/roles/me` — returns membership + role; bootstraps an org if none exists
- `POST /api/roles/invite` — admin-only invite (7-day expiry)
- `GET /api/roles/{members,invitations,changelog}` — admin-only listings
- `PATCH /api/roles/members/:id` — change role/status; cannot self-edit; only owner manages other admins
- `DELETE /api/roles/members/:id` — soft-remove

### GitHub
- `GET /api/repos` — list user's GitHub repos via stored PAT
- `DELETE /api/repos/connection` — disconnect

### Legacy scans (per-user, regex-based, JSONB)
- `GET /api/scans` — last 20 scans for current user
- `GET /api/scans/:id` — full scan with findings (read by `/dashboard/report/[scanId]`)
- `POST /api/scans` — walks repo, runs `@medlock/phi-detector` regex scan, persists findings JSONB

### Module records (generic CRUD)
- `GET/POST/PATCH/DELETE /api/module-records` — keyed by `module_key`; permission gate derived from `pageForRoute(module)`

### De-identification
- `POST /api/deid/check`, `GET /api/deid/check/:id`, `POST /api/deid/check/:id/recheck`, `POST /api/deid/check/:id/expert-review`, `GET /api/deid/check/:id/report` (PDF), `GET /api/deid/check/:id/export.csv`
- `POST /api/deid/run`, `GET /api/deid/run/:id`
- `GET /api/deid/history`

### PHI Scan (Anthropic, org-scoped)
- `POST /api/phi-scan` — GitHub repo or upload → Claude → `phi_findings` + auto-sync to inventory
- `GET /api/phi-scan` — last 25 scans + findings + stats
- `PATCH /api/phi-scan/findings/:id` — actions: `false_positive | assign_owner | resolve`
- `POST /api/phi-scan/schedule` — persists schedule row; **no executor wired** (see §8)

### PHI Inventory
- `GET /api/phi-inventory` — paginated list with filters + stats
- `GET /api/phi-inventory/coverage` — group by `phi_type`
- `GET /api/phi-inventory/risk-summary` — risk buckets + top risks
- `POST /api/phi-inventory/import` — bulk import
- `PATCH /api/phi-inventory/bulk` — bulk patch
- `POST /api/phi-inventory/export/csv` — CSV
- `POST /api/phi-inventory/export/audit-package` — branded multi-page PDF
- `GET /api/phi-inventory/:id` — system + `compliance_gaps[]`
- `GET /api/phi-inventory/:id/{audit-log,reviews}`
- `GET /api/phi-inventory/:id/review/:review_id/certificate` — review cert PDF
- `POST /api/phi-inventory`, `PATCH /:id`, `DELETE /:id` (soft-delete)
- `POST /api/phi-inventory/:id/review` — periodic review w/ cert number
- `POST /api/phi-inventory/:id/decommission` — `DECOM-XXXXXXXX` cert
- `GET /api/phi-inventory/:id/decommission/certificate` — PDF
- `POST /api/phi-inventory/sync-from-scanner` — pull `phi_findings` rows into inventory

### Access review
- `GET /api/access-review/overview` — current campaign + members + items + stats
- `POST /api/access-review/campaigns` — create campaign + seed items
- `PATCH /api/access-review/items/:id` — record decision

---

## 5. Database

35+ tables across 9 migrations. Postgres extensions, custom enums (`hs_severity`, `hs_status`, `incident_status`), a global `set_updated_at()` trigger, and `bootstrap_organization_for_current_user` / `accept_pending_organization_invitations` SECURITY DEFINER functions. RLS is enabled on every table; the backend uses **only the anon key** with the user's bearer token forwarded as `Authorization` header on every Supabase client, so RLS enforces tenant isolation natively. No service-role key is used anywhere.

**Tenancy / RBAC:** `organizations`, `organization_memberships` (extended in 20260501 with `is_owner, status, full_name, email, …`), `organization_invitations` (7-day expiry), `role_change_log`, `user_profiles`, `app_roles`/`app_role_permissions`/`user_role_assignments` (older alt model, mostly unused).

**Integrations:** `github_connections` (raw PAT persisted per-user).

**Generic module store:** `feature_records` (keyed by `module_key`, used by all 36 dashboard modules).

**Legacy scanner:** `scans` (JSONB findings, per-user), `scan_schedules` (no executor).

**PHI scan (current):** `phi_scans` (status/progress/error_message), `phi_findings` (severity/status/HIPAA-ref/SOC2/CWE), `phi_scan_schedules` (no executor).

**PHI inventory:** `phi_systems` (replaces legacy `phi_inventory_assets`; classification, encryption, retention, `risk_score`, decommission fields), `phi_system_reviews` (cert numbers, cosigner), `phi_system_audit_log` (field-level diff written by trigger).

**De-identification:** `deid_assessments`, `deid_jobs`. Legacy: `deidentification_checks`.

**Access review:** `access_review_campaigns`, `access_review_items`, `emergency_access_events`.

**Compliance core:** `findings`, `finding_activities`, `policies`, `policy_versions`, `controls`, `vendors`, `vendor_certifications`, `vendor_subcontractors`.

**Workforce:** `training_courses`, `training_assignments`, `policy_acknowledgements`, `sanctions_log`.

**Incidents:** `incidents`, `incident_timeline_events`, `breach_notifications`.

**Reporting:** `generated_reports`, `scheduled_reports`, `audit_packages`.

**Settings:** `access_policies`, `alert_rules`, `integration_connections`, `billing_subscriptions`.

**View:** `dashboard_kpi_summary` (open_findings, active_incidents, overdue_training, baa_expiring_soon).

**Storage:** `phi-scans` bucket created in [20260428_phi_scan_entities.sql](../supabase/migrations/20260428_phi_scan_entities.sql); `deid-outputs` bucket **referenced by code but not created in any migration** ([deid.ts:476](../backend/src/services/deid.ts)) — falls back to base64 in response.

**Seed data:** [hipaa_shield_mock_data.sql](../supabase/seed/20260427_hipaa_shield_mock_data.sql) seeds the first auth.users user as owner of "HIPAA Shield Demo Org" with realistic mock data across every legacy table; [module_records_seed.sql](../supabase/seed/20260427_module_records_seed.sql) inserts one `feature_records` row per module key.

---

## 6. phi-detector

Single 100-LOC file: [packages/phi-detector/src/index.ts](../packages/phi-detector/src/index.ts). **Used only by the legacy `/api/scans` endpoint.** The new `/api/phi-scan` uses Claude, not this package.

### What it detects
**10 PHI categories**, all matched against **identifier names** (variable/field names) — not against PHI values:

| Category | Matches |
|---|---|
| `patientName` | `patient`, `fullName`, `firstName`, `lastName` |
| `dateOfBirth` | `dob`, `birthDate`, `birthday` |
| `ssn` | `ssn`, `socialSecurityNumber` |
| `mrn` | `mrn`, `medicalRecordNumber` |
| `email` | `email`, `userEmail`, `patientEmail` |
| `phone` | `phone`, `mobile`, `telephone` |
| `address` | `address`, `streetAddress`, `homeAddress` |
| `diagnosis` | `diagnosis`, `dx`, `icd10` |
| `insuranceId` | `insuranceId`, `policyNumber`, `memberId` |
| `ipAddress` | `ip`, `clientIp`, `remoteIp` |

### How it scans
Pure regex line-scan (no AST):
1. Splits source on `\n`.
2. For each line, tests 24 **risky sinks**: `console.{log,error,warn,debug,info}`, `logger.{info,error,warn,debug}`, `Sentry.captureException/captureMessage/setUser`, `analytics.track/identify`, `mixpanel.*`, `gtag(`, `ga(`, `posthog.capture`, `LogRocket.identify`, `localStorage.setItem`, `sessionStorage.setItem`, `datadog.logger`, `DD_LOGS`.
3. On a sink hit, looks **5 lines back** (sliding window) for any PHI-name regex hit.
4. Dedupes by `${line}:${phiName}`.

### Severity
Sink-only (PHI category doesn't influence severity):
- `CRITICAL`: Sentry / analytics / mixpanel / gtag / ga / posthog / LogRocket
- `HIGH`: localStorage / sessionStorage
- `MEDIUM`: console.* and logger.*

### Limitations
- Won't catch hardcoded PHI strings (`console.log("123-45-6789")` is missed)
- No AST/scope awareness — false positives when PHI variable is unrelated to the sink
- Backward-only window — PHI on lines after the sink is ignored
- Comments and string literals are scanned identically (`// don't log patient ssn` triggers a finding)

---

## 7. User flow: landing → scan report

1. **`/`** — user sees [hero](../frontend/src/components/hero.tsx) with CTAs to `/login` / `/signup`.
2. **Auth** — three paths:
   - GitHub OAuth via login page → Supabase `signInWithOAuth({provider: "github"})` → `/auth/callback` route handler exchanges code for session, **upserts `github_connections` directly** (bypassing backend), calls `POST /api/roles/accept-invite`, redirects `/dashboard`.
   - Email signup → email confirmation link → `/auth/callback` → `/dashboard`.
   - Email login → `signInWithPassword` → `/dashboard`.
3. **Middleware on `/dashboard`** — Supabase `getUser`, looks up `organization_memberships` for active role, `canAccess(role, "dashboard")` → pass.
4. **Dashboard layout** — [DashboardRbacProvider](../frontend/src/lib/rbac/context.tsx) fetches `GET /api/roles/me`; [HsDashboardShell](../frontend/src/components/hipaa-shield/HsDashboardShell.tsx) renders sidebar+topbar.
5. **Dashboard home** — fires `GET /api/scans` and `GET /api/repos`. If no GitHub connection → empty state with "Connect GitHub" button (re-runs OAuth with `repo` scope).
6. **Trigger scan** — clicking a `<RepoCard>`'s "Scan this repo" → `POST /api/scans { owner, repo }` → backend walks GitHub tree (max 50 files, allowed extensions), runs `scanFiles()` from `@medlock/phi-detector`, persists JSONB → returns `{ scanId, findingCount }` → `router.push("/dashboard/report/" + scanId)`.
7. **Report** — `GET /api/scans/:scanId` → page computes safety score (100 − weighted penalty) and groups findings by severity (CRITICAL/HIGH/MEDIUM).

---

## 8. What is NOT built yet

### Major UI gaps (29 stub routes)
Every catch-all `[...slug]` route renders a **static template with no working CTAs** — no API calls, no data, hardcoded metric values. This includes the entire **Compliance / Risk / Vendors / Workforce / Incidents / Reports / Settings** menu (full list in §3). The only real implementations are: `dashboard`, `phi-inventory`, `phi-leakage-scanner`, `de-identification-checker`, `role-management`, `user-access-review`, plus auth pages.

### Persisted-but-not-executed
- **`POST /api/phi-scan/schedule`** — writes `phi_scan_schedules.next_run` but no worker reads it. Scheduled scans never fire.
- **Legacy `scan_schedules`** — same: written by seed, never executed.

### Mock data hardcoded in real pages
- Dashboard alert banner: *"3 overdue access reviews and 1 expired vendor BAA"* ([:184–191](../frontend/src/app/dashboard/page.tsx))
- Dashboard metric cards: Training "94%", Active BAAs "18", Controls "61/75" — all literals; only "Open findings" is real
- "View all" findings link points to `/dashboard/findings-remediation` which is a stub catch-all
- Hero panel: *"Product preview coming soon"* ([hero.tsx:53](../frontend/src/components/hero.tsx))

### Storage bucket
- `deid-outputs` storage bucket referenced by [deid.ts:476](../backend/src/services/deid.ts) but **never created in any migration**. Code degrades to base64 silently.

### Seed reality issues
- `github_connections.github_access_token = 'demo_token_replace_me'` ([seed:91](../supabase/seed/20260427_hipaa_shield_mock_data.sql)) — any GitHub call as the seeded demo user 401s until replaced.

---

## 9. Known issues & limitations

### Architectural
- **Two parallel scan pipelines that don't share data shape.** The dashboard's "Scan this repo" button uses legacy `/api/scans` (regex, JSONB, severity `"CRITICAL"|"HIGH"|"MEDIUM"`, fields `phiField`/`sink`). The leakage-scanner page uses the new `/api/phi-scan` (Claude, structured `phi_findings` rows, severity `"Critical"|"High"|...`, fields `phi_type`/`source`/`evidence`). The `report/[scanId]` page reads only the legacy shape. The new scanner has no per-scan report page.
- **Legacy & current tables coexist:** `phi_inventory_assets` (legacy) + `phi_systems` (current); `deidentification_checks` (legacy) + `deid_assessments` (current); `app_roles`/`user_role_assignments` (legacy) + `organization_memberships.role` (current). Data is migrated but legacy tables are still queried in places.
- **No service-role key.** All privileged ops go through SECURITY DEFINER SQL functions. Deliberate but inflexible — anything user-RLS would block needs a SECURITY DEFINER function added.
- **Middleware role check is best-effort.** If `organization_memberships` row is missing, `canAccess` is never evaluated and access falls through. Only users with a real membership get RBAC enforcement at the edge.
- **Membership lookup on every middleware request** with no cache.
- **`acceptRoleInvites` fires 3× per login** (login page + signup page + auth callback). Idempotent but wasteful.
- **`/auth/callback` writes to `github_connections` directly via Supabase**, bypassing the backend. Any backend-side validation, audit, or org scoping for that table is silently skipped.

### phi-detector limitations (see §6)
Identifier-name only; no AST; backward-only 5-line window; comments scanned identically; severity is sink-only.

### Operational issues observed in this session
- **Stale `next-server` on port 3000** prevented the new frontend from binding (we killed PID 50036).
- **CORS allow-list is `[FRONTEND_ORIGIN, :3000, :3005]`** ([server.ts:75–77](../backend/src/server.ts)) — if the frontend lands on `:3001` (port 3000 occupied), every API call fails with "Failed to fetch" because no `Access-Control-Allow-Origin` header is returned for that origin.
- **`tsx watch` restart loop** — backend's watcher restarts on every `node_modules` change (pdf-lib, anthropic SDK, date-fns). Server keeps coming back up but it's noisy and slows dev.
- **Fallback error string leaks dev posture** in two pages: *"Start the backend on port 4000 and refresh"* ([role-management:55](../frontend/src/app/dashboard/role-management/page.tsx), [user-access-review:51](../frontend/src/app/dashboard/user-access-review/page.tsx)).
- **`acceptCallback` ignores Supabase exchange errors** — if `exchangeCodeForSession` fails, no error UI; redirects to `/dashboard`, middleware bounces back to `/login`.

### Security
- **GitHub PATs persisted raw** in `github_connections.github_access_token`. No encryption-at-rest layer beyond Postgres defaults.
- **The seeded demo token** `demo_token_replace_me` is stored in plain SQL.
