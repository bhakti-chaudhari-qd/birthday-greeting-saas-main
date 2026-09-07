# Birthday Greeting SaaS

Multi-tenant birthday and occasion greeting platform built with Next.js 16, PostgreSQL, and Prisma.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (local Docker, Neon, Supabase, or similar)

## Local database setup

### Option A: Docker

```bash
docker run --name birthday-greeting-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=birthday_greeting_saas \
  -p 5432:5432 \
  -d postgres:16
```

### Option B: Managed PostgreSQL

Create a database in Neon or Supabase and copy the connection string.

## Environment variables

Copy the example file and update values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (always required) |
| `NODE_ENV` | `development`, `production`, or `test` |
| `CRON_SECRET` | Required for protected internal HTTP scheduler routes (`/api/v1/internal/cron/birthday-automation`, `/api/v1/internal/cron/anniversary-automation`, `/api/v1/internal/cron/custom-automation`, `/api/v1/internal/cron/contact-import`, and `/api/v1/internal/worker/drain`). **Required in production** (boot fail-closed). Not required for `npm run worker:drain` (that CLI calls the worker directly). |
| `CREDENTIALS_ENCRYPTION_KEY` | Base64-encoded 32-byte key for encrypting channel credentials. **Required in production** (boot fail-closed). |
| `BILLING_ENABLED` | Optional. Set `true` when Razorpay billing is live. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Razorpay credentials. In production, if billing is enabled **or** any Razorpay key is set, **all three** are required (boot fail-closed). |
| `APP_URL` | Public site URL for email links (verify / reset password). Defaults to `http://localhost:3000`. |
| `RESEND_API_KEY` | Resend API key for transactional email. In development without a key, messages are logged to the console. |
| `EMAIL_FROM` | From address for Resend (e.g. `Birthday Greeting <onboarding@resend.dev>`). |

Never commit real secrets. `.env.local` is gitignored.

### Production checklist (REQ-OPS)

Before going live, confirm:

1. **Boot fail-closed** - With `NODE_ENV=production`, the app refuses to start if `DATABASE_URL`, `CRON_SECRET`, or `CREDENTIALS_ENCRYPTION_KEY` are missing/invalid. Billing keys are required when `BILLING_ENABLED=true` or any Razorpay env is set. Validation runs via [`src/lib/env.ts`](src/lib/env.ts) (imported from [`instrumentation.ts`](instrumentation.ts) on Node server start). Proof: `npm test -- tests/env.test.ts`.
2. **Seed is local-only** - `npm run db:seed` throws if `NODE_ENV=production` (seed password `password123` must never ship). Proof: `npm test -- tests/env.test.ts` (`assertSeedAllowed`).
3. **Production cron** - Schedule these HTTP routes with `Authorization: Bearer <CRON_SECRET>` (timing-safe compare; missing secret fails closed on the request). Each route accepts **GET** (Vercel Cron) and **POST** (external schedulers / curl):

| Route | Recommended interval | Purpose |
|-------|----------------------|---------|
| `GET|POST /api/v1/internal/cron/tick` | Every 1 minute (preferred external entry) | One call: birthday/anniversary/custom generation + contact-import drain + message worker drain |
| `GET|POST /api/v1/internal/worker/drain` | Every 1-5 minutes | Always-on message queue drain (multi-instance guarantee) |
| `GET|POST /api/v1/internal/cron/contact-import` | Every 1-5 minutes | Drain large contact import jobs |
| `GET|POST /api/v1/internal/cron/birthday-automation` | Every 15 minutes (large tenants) | Generate birthday queue work |
| `GET|POST /api/v1/internal/cron/anniversary-automation` | At least hourly | Generate anniversary queue work |
| `GET|POST /api/v1/internal/cron/custom-automation` | At least hourly | Generate custom-occasion queue work |

**Preferred external cron (free, reliable every minute):** [cron-job.org](https://cron-job.org)

1. Create a free account → [console.cron-job.org](https://console.cron-job.org/) → Settings → create an **API key**.
2. Ensure Vercel `CRON_SECRET` matches what you will send as `Authorization: Bearer …`.
3. Run locally (or CI):

```bash
CRONJOB_ORG_API_KEY=... CRON_SECRET=... CRON_BASE_URL=https://birthday-greeting-saas.vercel.app npm run cron:setup-external
```

That creates/updates one job titled `birthday-greeting-saas production cron tick` that **POSTs** `/api/v1/internal/cron/tick` **every minute** (timezone `Asia/Kolkata` by default).

**Manual console setup (no API key):** create one job with:

- URL: `https://birthday-greeting-saas.vercel.app/api/v1/internal/cron/tick`
- Method: `POST`
- Header: `Authorization: Bearer <CRON_SECRET>`
- Schedule: every minute, timezone Asia/Kolkata

**Vercel Hobby:** Built-in Cron is limited to **once per day** ([`vercel.json`](vercel.json) keeps daily backup ticks).

**GitHub Actions backup:** [`.github/workflows/production-cron.yml`](.github/workflows/production-cron.yml) also POSTs `/tick` about every 5 minutes (best-effort; can miss slots). Secrets: `CRON_BASE_URL`, `CRON_SECRET`.

Automation **refuses to enqueue before** the org send time, so frequent ticks are safe; work only appears once the send window opens. Set `CRON_SECRET` in Vercel — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically on its daily jobs.

Local CLIs (`npm run worker:drain`, `npm run automation:tick`) call the same functions and do **not** need `CRON_SECRET`; production must use the Bearer-protected HTTP routes.

## Install dependencies

```bash
npm install
```

## Prisma commands

Generate the Prisma client:

```bash
npm run db:generate
```

Create and apply the initial migration:

```bash
npm run db:migrate
```

Seed test organizations and admin users (local/dev/test only - **refuses `NODE_ENV=production`**):

```bash
npm run db:seed
```

Seeded logins:

- Organization Owner: `admin@acme.test` / `password123` (Staff: `staff@acme.test`)
- Organization Owner: `admin@beta.test` / `password123`
- Organization Owner: `admin@gamma.test` / `password123`
- Organization Owner (inactive org): `admin@delta.test` / `password123`
- Platform Admin: `platform@admin.test` / `password123`
- Vendor: `vendor@demo.test` / `password123` (referral code `DEMOVENDOR`)

Portals:

- Organization: `/login` → `/dashboard` (company workspace; roles Owner / Staff)
- Platform Admin: `/admin/login` → `/admin` (operates all organizations - not an org Owner)
- Vendor: `/vendor/login` → `/vendor` (referral code, referred clients, delivery insights)

### Organization roles (RBAC)

Organization users have database roles `ADMIN` (shown as **Owner**) or `STAFF` (shown as **Staff**). Cookies for Organization / Platform Admin / Vendor stay separate (`bg_session`, `bg_admin_session`, `bg_vendor_session`); an organization session cannot call Platform Admin or Vendor APIs.

| Capability | Staff | Owner |
|------------|-------|-------|
| Contacts CRUD + import | Yes | Yes |
| Contact export | No (403) | Yes |
| View templates / starters | Yes | Yes |
| Create / edit templates | No (403) | Yes |
| Manual send + preview | No (403) | Yes |
| Queue list | Yes | Yes |
| Queue generate / send / retry | No (403) | Yes |
| View deliveries | Yes | Yes |
| Refresh delivery status | No (403) | Yes |
| SMS / WhatsApp channel config | No (403) | Yes |
| DLT / Advanced SMS setup | No (403) | Yes |
| Automation settings | No (403) | Yes |
| Billing upgrade | No (403) | Yes |

Sidebar and settings pages hide or redirect Staff away from Owner-only areas. Acceptance check: `staff@acme.test` gets **403** on `PUT /api/v1/channel-config/sms`; `admin@acme.test` (Owner) succeeds.

### Auth hardening (REQ-AUTH)

- Login (Organization / Platform Admin / Vendor) and registration are rate-limited: ~5 failed logins / 15 minutes per IP+email → **429** + temporary lockout; ~3 registrations / hour / IP → **429**.
- Passwords must be at least **10** characters, or **8+** with uppercase, lowercase, and a number (register + reset).
- Password reset: hashed token, **≤ 1 hour**, single use; email via Resend (`RESEND_API_KEY`) or console log in local dev.
- Logout destroys the current server session. Organization Owners get **Sign out everywhere** (revokes all sessions).

### Anti-abuse & live channels (REQ-ABUSE)

- Vendor referral: each Vendor has one referral code (Platform Admin → Vendors). Register form includes an optional referral field; attributed orgs appear in the Vendor portal under Referred clients.
- New orgs stay on **TEST** messaging by default. Enabling **Custom HTTP** needs Owner + (paid ACTIVE plan STARTER/PRO/CUSTOM **or** Platform Admin **Approve live Custom HTTP**).
- Unpaid subscription statuses `PAST_DUE` / `CANCELLED` block queue generate, manual send, and worker send (**402**).
- Per-org send velocity: `SEND_VELOCITY_PER_MINUTE` (default 60) and `SEND_VELOCITY_PER_DAY` (default 5000). The worker paces claims to remaining capacity and soft-defers overflow (retryable) instead of permanently failing.
- WhatsApp `tlsInsecure` is rejected in production (config save + outbound HTTP).

### Billing (REQ-BILL) - Razorpay

- Server plan catalogue (`src/lib/billing/catalogue.ts`): **FREE** (500/500), **STARTER** (₹499 · 1 000 contacts · 10 000 msgs/mo), **PRO** (₹1 499 · 10 000 contacts · 100 000 msgs/mo). **CUSTOM** is Platform Admin only (no online checkout).
- Owner UI: **Settings → Billing** (`/dashboard/settings/billing`). Checkout disabled until all three Razorpay env vars are set.
- APIs: `GET /api/v1/billing`, `POST /api/v1/billing/checkout`, `POST /api/v1/billing/confirm` (Owner-only); webhooks at `POST /api/v1/billing/webhooks/razorpay` and alias `POST /api/webhooks/razorpay` (HMAC signature + idempotent `BillingEvent`).
- On `payment.captured` / `order.paid` / `payment_link.paid` (or verified confirm): set plan + limits from catalogue, `status=ACTIVE`. `payment.failed` → `PAST_DUE` (sends stay blocked by Phase 4).
- Webhook URL (deploy): `{APP_URL}/api/webhooks/razorpay` (or the `/api/v1/billing/webhooks/razorpay` path). Enable events: `payment.captured`, `payment_link.paid`, optionally `payment.failed`. Local sandbox: Razorpay test keys (`rzp_test_…`) in `.env.local` + tunnel if you need webhooks against localhost.

`npm run db:seed` also upserts a **Demo Live OTP** SMS template (DLT-ready) on `acme-corp`, `beta-inc`, and on `SMS_CONFIG_ORGANIZATION_SLUG` (default `acme-corp-demo`) when that org exists. Use it for live SMS demos: **Send Message → Demo Live OTP**. Re-run only the template with `npm run sms:ensure-demo-otp`.

Open Prisma Studio:

```bash
npm run db:studio
```

## Run the application

Development server:

```bash
npm run dev
```

`npm run dev` starts Next.js **and** the local automation scheduler (demo default: every **1 minute**).  
Use `npm run dev:app` (or `DEV_AUTOMATION=0`) if you only want the web app.

### Local message processing (TEST / development)

Send Message and birthday generation create durable work for the shared message worker. The browser/API request does **not** call SMS providers directly.

### Local / browser product flow

1. Start the app: `npm run dev`
2. In the browser: configure SMS (Test or Live), then **Send Message** → review → **Send Message(s)**
3. Wait briefly - the app schedules `runMessageWorker()` after a successful submit (same worker as production)
4. Open **Activity** and confirm the result

You should **not** need `npm run worker:drain` for normal browser testing.

Optional ops CLIs (same worker / automation functions, no `CRON_SECRET`):

```bash
npm run worker:drain
npm run automation:tick
npm run automation:scheduler
npm run dev:app
```

Notes:

- Activity status **Submitted** means the provider accepted the simulated/live submit, not that the handset confirmed delivery.
- TEST mode makes **no real SMS/WhatsApp network calls**.
- `worker:drain` remains useful for ops/debugging and does not require `CRON_SECRET`.
- With `npm run dev`, occasion automation also runs on a local interval (enable automation in Settings; no second terminal required for demos).
### Production worker scheduling

Production should still call the protected endpoint on a scheduler:

`POST /api/v1/internal/worker/drain` with `Authorization: Bearer <CRON_SECRET>`

That keeps processing reliable if the Node process that handled the customer request is not the one that can finish background work (multi-instance / serverless). The in-request `after()` schedule is best-effort for the same runtime; the cron drain remains the production guarantee.

Production build:

```bash
npm run build
npm run start
```

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response when the database is connected:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "connected",
  "timestamp": "2026-07-10T12:00:00.000Z"
}
```

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
```

Integration tests require `DATABASE_URL` and a migrated database. Without a database, schema integration tests are skipped automatically.

## Project structure

```text
prisma/
  schema.prisma       # Database models and constraints
  seed.ts             # Test organizations and users
src/
  app/api/v1/health/  # Health endpoint
  app/api/v1/contacts/ # Session-authenticated contacts API (CRUD + CSV import/export)
  app/api/v1/templates/ # Session-authenticated templates API
  lib/
    db.ts             # Prisma singleton
    env.ts            # Zod environment validation
    contacts/         # Tenant-scoped contact services
    templates/        # Tenant-scoped template services and rendering
    queue/            # Birthday queue generation, manual send, sending, and listing
    messaging/        # Provider abstraction, test provider, and legacy HTTP SMS adapter
tests/                # Schema and database constraint tests
```

## Foundation milestone scope

This repository currently includes:

- PostgreSQL + Prisma schema for all core models
- Tenant ownership via `organizationId` on every tenant-owned table
- Queue idempotency via `@@unique([organizationId, idempotencyKey])`
- Delivery history protection via `onDelete: Restrict`
- `GET /api/v1/health`
- Authentication, protected dashboard, contacts CRUD with CSV import/export, message templates CRUD, birthday queue generation, test message sending, delivery logs, legacy HTTP SMS provider integration, and tenant SMS channel settings

API keys, automatic delivery-status polling, and deeper vendor partner tooling are not fully implemented yet. Razorpay billing checkout/webhooks are implemented; set test keys to exercise sandbox pay. Platform Admin manages organizations and vendor referral codes; Vendor portal shows referred clients and delivery insights.

### Contact CSV import / export

Authenticated tenants can import and export contacts from `/dashboard/contacts`.

CSV columns (header required; case-insensitive):

- `name` (required)
- `mobile` (required, E.164 such as `+919876543210`)
- `email` (optional)
- `dateOfBirth` (optional, `YYYY-MM-DD`)
- `anniversaryDate` (optional, `YYYY-MM-DD`)
- `customOccasionDate` (optional, `YYYY-MM-DD`)
- `category` (optional; organization-defined name, e.g. default `VVIP`, `VIP`, `Relative`, or `Friend`)
- `address` (optional)
- `note` (optional free-text note)
- `isActive` (optional, `true` / `false`; defaults to `true`)

Behavior:

- Import accepts JSON `{ "csv": "..." }` or `{ "excelBase64": "..." }` at `POST /api/v1/contacts/import` (up to 500,000 data rows via background job; files over 500 rows enqueue async processing; Excel uses the first worksheet)
- Supported upload types in the dashboard: `.csv`, `.xlsx`, `.xls`
- Duplicate mobiles update the existing contact (name, email, dates, group, address, note, active). Duplicate rows inside the same file are still skipped.
- Active contact limit stops further creates; remaining rows are reported as skipped
- Export downloads filtered contacts as CSV from `GET /api/v1/contacts/export` (up to 500,000 rows per request; use `cursor` query param for the next chunk when `X-Contact-Export-Next-Cursor` is returned)
- Template download: `GET /api/v1/contacts/import/template`

## Message templates

Templates are tenant-scoped reusable greeting messages stored in `MessageTemplate`.

Supported template types:

- `BIRTHDAY`
- `ANNIVERSARY`
- `CUSTOM`

Supported channels:

- `SMS`
- `WHATSAPP`

Supported variables:

- `{{name}}`

Templates are soft-deactivated via `isActive`. Hard delete is not used.

API routes (session-authenticated dashboard API):

- `POST /api/v1/templates`
- `GET /api/v1/templates`
- `GET /api/v1/templates/[id]`
- `PATCH /api/v1/templates/[id]`

Unknown variables such as `{{firstName}}` are rejected on create/update. Rendering fails explicitly when a required supported variable value is missing or empty.

### Template library and starter drafts

The Templates dashboard (`/dashboard/templates`) is the everyday template library experience:

- View tenant-owned templates with preview and SMS readiness labels
- Create blank templates or tenant-owned templates from small server-defined starter drafts
- Edit template name, channel, message body, and personalization only

Starter drafts are generic application drafts only. They are not DLT-approved, do not include DLT Template IDs, and are usable with the `TEST` provider without advanced setup.

### Advanced SMS Template Setup

Real SMS through `CUSTOM_HTTP` requires Advanced SMS Template Setup at `/dashboard/settings/sms/templates`.

For each SMS template, authorized users can configure:

- DLT Template ID (from tenant/provider/DLT records)
- Approved DLT content (exact approved structure from DLT records)

The application validates structural compatibility between the application template body and approved DLT content:

- Application templates use `{{name}}` placeholders.
- Approved DLT content may use application-style `{{...}}` placeholders or `{#...#}` opaque slots at the same positions.
- The legacy HTTP provider sends a fully rendered message body and does not perform placeholder substitution in this codebase.
- Other DLT placeholder syntaxes are not parsed; structural verification stays conservative and does not claim DLT approval.

It does not verify DLT approval, generate DLT IDs, or fetch templates from external DLT portals.

Readiness for real SMS is derived server-side (`realSmsReady`) and is never accepted from the client. Normal template create/update APIs reject DLT fields and readiness overrides.

Changing an existing configured DLT pair requires explicit review acknowledgement (`confirmDltPairReviewed`) in the advanced setup API.

API routes:

- `GET /api/v1/templates/starters`
- `POST /api/v1/templates/starters/[starterId]`
- `GET /api/v1/templates/[id]/sms-setup`
- `PUT /api/v1/templates/[id]/sms-setup`

Normal template API routes remain:

- `POST /api/v1/templates`
- `GET /api/v1/templates`
- `GET /api/v1/templates/[id]`
- `PATCH /api/v1/templates/[id]`

Queue generation creates tenant-scoped `SendQueue` records for **BIRTHDAY** occasions only.

Policy:

- `POST /api/v1/queue/generate` requires an explicit `templateId` for an active `BIRTHDAY` template in the authenticated organization.
- Optional `targetDate` (`YYYY-MM-DD`) defaults to the current India Standard Time (`Asia/Kolkata`) calendar date - the same day automation uses.
- Eligible contacts must be active, tenant-owned, have a matching birthday month/day, and have the required channel destination data (`mobile` for SMS/WhatsApp).
- Feb 29 birthdays are also eligible on Feb 28 in non-leap years.
- Rendered message snapshots are stored on `SendQueue.renderedBody` and are not changed if the contact or template is edited later.
- Idempotency uses deterministic occurrence keys (`contact`, `channel`, `BIRTHDAY`, `targetDate`) and the existing PostgreSQL unique constraint on `(organizationId, idempotencyKey)`.
- Monthly capacity is reserved at generation time by incrementing `Subscription.messagesSentThisMonth` for each newly created queue record. Duplicate generation does not consume additional capacity.

API routes:

- `POST /api/v1/queue/generate`
- `GET /api/v1/queue`
- `POST /api/v1/queue/send`
- `POST /api/v1/queue/[id]/retry`

## Birthday Automation

Birthday Automation generates durable birthday queue work for enabled organizations using a protected internal scheduler endpoint. Background workers deliver queued messages.

Schedule:

- Birthday Automation uses India Standard Time (`Asia/Kolkata`).
- Each organization configures a shared **send hour/minute** (IST), default **6:00 AM IST**.
- Configure an external scheduler to invoke the internal cron endpoints **at least hourly** so work starts after each org's configured time.
- Configure the same (or another) scheduler to invoke the worker drain endpoint so queued messages are delivered.

### Local automation scheduler (development)

`npm run dev` already starts the local automation scheduler for demos (default every **1 minute**; override with `AUTOMATION_SCHEDULER_INTERVAL_MINUTES`).

Setup:

1. Enable birthday / anniversary / custom automation in the dashboard and select templates.
2. Leave `npm run dev` running - no second terminal needed for demos.
3. Check **Activity** after a tick (first tick runs soon after startup).

Standalone controls:

```bash
# Next.js only
npm run dev:app
# or
DEV_AUTOMATION=0 npm run dev

# One generate + drain cycle, then exit
npm run automation:tick

# Scheduler alone - default every 60 minutes
npm run automation:scheduler

# Custom interval
npm run automation:scheduler -- --interval-minutes 5
```

These CLIs call the same generation + worker functions as the protected HTTP routes and do **not** need `CRON_SECRET`. Production should still use an external scheduler against the `CRON_SECRET`-protected endpoints.

Activation:

- `Organization.autoSendEnabled` must be `true` (legacy org-wide path when no category rules exist)
- Or category Automatic Greetings rules enable SMS/WhatsApp/Email for birthday contacts
- Organization must be active
- Template(s) must be active tenant-owned `BIRTHDAY` templates for the enabled channels
- Current IST time must be at or after the configured send time (per category rule, or org `automationSendHour`:`automationSendMinute` for legacy)

Dashboard settings (customer UI):

- **Automatic Greetings:** `/dashboard/settings/greeting-routes` (birthday / anniversary / custom tabs)
- Legacy URLs `/dashboard/settings/birthday-automation`, `/anniversary-automation`, `/custom-automation`, and `/automation` redirect to greeting routes
- APIs: `GET` / `PUT` `/api/v1/settings/category-automation` (primary); legacy `GET` / `PATCH` `/api/v1/settings/birthday-automation` remain for older clients

Internal scheduler endpoint (not session-authenticated):

- `POST /api/v1/internal/cron/birthday-automation`
- Requires `Authorization: Bearer <CRON_SECRET>`
- `CRON_SECRET` must be configured server-side; missing configuration fails closed
- The endpoint does not accept `organizationId` or `targetDate` from the request body
- The endpoint is **generation-only** - it does not call messaging providers

Internal worker drain endpoint (not session-authenticated):

- `POST /api/v1/internal/worker/drain`
- Requires the same `Authorization: Bearer <CRON_SECRET>`
- Does not accept `organizationId`, queue IDs, concurrency, or batch size from the request
- Recovers expired leases, claims work with `FOR UPDATE SKIP LOCKED` (max 25 per tenant per cycle), and sends with global concurrency capped at 10
- Lease duration is 5 minutes; provider HTTP runs outside long database transactions
- Production worker hosting remains a deployment decision; this repository does not claim a specific messages/hour throughput
- Customer submits (Manual Send / birthday generate) schedule `runMessageWorker()` via Next.js `after()` for same-runtime processing
- Production should still call `POST /api/v1/internal/worker/drain` with `CRON_SECRET` on a scheduler as the reliable multi-instance guarantee
- Optional local ops CLI: `npm run worker:drain` (same `runMessageWorker()`; no `CRON_SECRET`)

Processing policy:

- Birthday matching uses the current IST calendar date (not `Organization.timezone`)
- At most one automatic birthday occurrence per contact/channel/`BIRTHDAY`/IST date, even if the selected template changes
- Per organization per generation invocation: at most 50 new queue rows
- Repeated same-day generation invocations continue remaining eligible contacts safely
- Dashboard-generated and automation-generated birthday queue rows share the same birthday occurrence pipeline and the same worker delivery path
- CUSTOM_HTTP organizations skip queue creation when the selected template is not server-derived Ready for Real SMS
- Inactive contacts are not sent at provider processing time for `BIRTHDAY`, `ANNIVERSARY`, or `CUSTOM` queue items
- Send-time CUSTOM_HTTP/DLT validation remains the final safety backstop
- Automatically retry only safely classified transient failures (max 5 attempts, exponential backoff with jitter)
- Ambiguous provider outcomes (`FAILED` + `AMBIGUOUS_PROVIDER_OUTCOME`) are never auto-retried; manual retry requires explicit `confirmAmbiguousRetry=true` and may duplicate a message

Current limitations: no missed-day automatic backfill, no automation history tables.

## Anniversary Automation

Anniversary Automation mirrors Birthday Automation: it generates durable anniversary queue work for enabled organizations. Background workers deliver queued messages.

Schedule:

- Uses India Standard Time (`Asia/Kolkata`) and the org's shared `automationSendHour` / `automationSendMinute` (default 6:00 AM IST).
- Configure an external scheduler to invoke the anniversary cron endpoint at least hourly, then the worker drain endpoint.

Activation:

- `Organization.anniversaryAutoSendEnabled` must be `true` (legacy path), or category Automatic Greetings rules for anniversaries
- Organization must be active
- Active tenant-owned `ANNIVERSARY` template(s) for enabled channels
- Current IST time must be at or after the configured send time

Dashboard settings (customer UI):

- **Automatic Greetings:** `/dashboard/settings/greeting-routes` (Anniversaries tab)
- Legacy `/dashboard/settings/anniversary-automation` redirects there
- APIs: category-automation (primary); legacy `GET` / `PATCH` `/api/v1/settings/anniversary-automation`

Internal scheduler endpoint (not session-authenticated):

- `POST /api/v1/internal/cron/anniversary-automation`
- Requires `Authorization: Bearer <CRON_SECRET>`
- Generation-only; does not accept `organizationId` or `targetDate` from the request body

Processing policy:

- Anniversary matching uses the current IST calendar date against contact `anniversaryMonth` / `anniversaryDay`
- At most one automatic anniversary occurrence per contact/channel/`ANNIVERSARY`/IST date
- Per organization per generation invocation: at most 50 new queue rows
- Contacts need an `anniversaryDate` (or month/day) to be eligible

## Custom Occasion Automation

Custom occasion automation mirrors birthday/anniversary for per-contact custom dates (festivals, joining day, and similar).

Schedule:

- Same IST clock and shared org send time as birthday/anniversary automation.
- Cron: `POST /api/v1/internal/cron/custom-automation` with `CRON_SECRET`, at least hourly.

Activation:

- `Organization.customAutoSendEnabled` must be `true` (legacy path), or category Automatic Greetings rules for custom occasions
- Active tenant-owned `CUSTOM` template(s) for enabled channels
- Contacts need a `customOccasionDate` (stored as month/day for matching)

Dashboard settings (customer UI):

- **Automatic Greetings:** `/dashboard/settings/greeting-routes` (Custom tab)
- Legacy `/dashboard/settings/custom-automation` redirects there
- APIs: category-automation (primary); legacy `GET` / `PATCH` `/api/v1/settings/custom-automation`

## Manual Send Messages

Authenticated tenants send personalized SMS or WhatsApp messages to selected active contacts from `/dashboard/messages/send`.

User flow:

1. Select active tenant-owned contacts
2. Select an eligible active template
3. Preview personalized messages generated server-side
4. Review (template, recipient count, sample preview, Test mode or Custom HTTP)
5. Click **Send Message** / **Send Messages** - durable work is created and background processing is scheduled automatically
6. Open **Activity** to follow progress and results

Selection rules:

- UI selection cap: up to 500 contacts (Confirm Send loops automatically in batches of 50)
- Each `POST /api/v1/manual-send` and preview request still accepts at most 50 `contactIds`
- Preview samples the first batch; recipient count reflects the full selection
- **Select all matching** loads active contacts across pages (respecting search) up to the selection cap
- The browser sends only `templateId` and `contactIds` - no phone numbers, rendered bodies, organization IDs, provider selection, readiness flags, or usage values

Template eligibility (validated server-side):

- **Test mode** (`TEST` provider or no active SMS channel config): any active tenant-owned SMS template
- **Custom HTTP** (`CUSTOM_HTTP`): active tenant-owned SMS template that is Ready for Real SMS (Advanced SMS Setup complete)

Server-side preview and send APIs:

- `POST /api/v1/manual-send/preview`
- `POST /api/v1/manual-send`

Request body:

```json
{
  "templateId": "template-id",
  "contactIds": ["contact-id-1", "contact-id-2"]
}
```

Preview behavior:

- Renders messages server-side using `{{name}}` from each contact
- Creates no work rows, reserves no usage, and calls no provider
- Returns safe preview fields only (no DLT IDs, credentials, or cross-tenant data)

Manual send behavior:

- Validates the full requested contact set before creating work; missing, inactive, or foreign contact IDs reject the entire request
- Generates a server-side operation/batch ID per confirmed send request
- Creates durable `SendQueue` rows with `occasionType = CUSTOM`, server-rendered `renderedBody`, and operation-specific idempotency keys
- Reserves monthly capacity inside the existing creation transaction (same semantics as birthday generation)
- If selected recipients exceed remaining capacity, creates rows only up to available capacity in deterministic contact order and reports `skippedLimit`
- Does **not** call messaging providers inside the request handler - `scheduleMessageWorkerProcessing()` runs the shared `runMessageWorker()` after the response (Next.js `after()`), and production cron drain remains the multi-instance guarantee

Usage reservation:

- `messagesSentThisMonth` increments only for successfully created queue rows at creation time
- Sending and retries do not increment usage again
- Usage limits use **Asia/Kolkata calendar months**
- On the first reservation in a new IST month, the subscription row lock lazily resets `messagesSentThisMonth` to 0 and advances `billingPeriodStart` / `billingPeriodEnd` (messaging usage-period watermarks)
- Correctness does not depend on a monthly reset cron
- Usage-limit skips are not provider failures

Repeat sends:

- Intentional same-day repeated sends to the same contact/template are allowed across separate confirmed requests (each receives a new server-generated operation ID)
- Within one operation, duplicate contact IDs create one queue row per unique contact

HTTP retry limitation:

- Because no persistent client request token exists in the current schema/API, a browser/network retry that reaches the server as a new POST may create a new manual-send operation
- The UI disables repeated Send clicks while a request is in progress
- Exactly-once semantics across independent HTTP requests are not claimed

Delivery semantics:

- **Submitted** means the provider accepted the message submission
- **Submitted** does not mean the message was delivered to the handset
- Track delivery outcomes through Activity → Submitted and manual refresh flow

Automated tests mock provider fetch for `CUSTOM_HTTP` and never call live SMS/provider endpoints.

## Message sending and delivery logs

The app includes a provider abstraction in `src/lib/messaging/providers/` and a deterministic `TEST` provider for local development and automated tests.

Queue state transitions:

- `PENDING` → `SENDING` → `SENT`
- `PENDING` → `SENDING` → `FAILED` (with optional `nextAttemptAt` for safely retryable failures)
- `FAILED` → worker reclaim → `SENDING` → `SENT` via scheduled/manual retry
- Ambiguous provider outcomes stay `FAILED` with `lastErrorCode = AMBIGUOUS_PROVIDER_OUTCOME` until explicit manual retry

Sending uses the stored `renderedBody` snapshot. Each provider-reaching attempt creates an immutable `DeliveryLog` record. Retries create new delivery log rows and do not mutate previous attempts.

`SendQueue` is the durable PostgreSQL-backed work queue (no Redis/BullMQ/SQS in this milestone). Workers claim with `FOR UPDATE SKIP LOCKED`, hold a 5-minute lease, and never call the provider inside long database transactions.

Monthly usage semantics:

- `messagesSentThisMonth` represents reserved monthly capacity at queue generation time (IST calendar months).
- Sending and retries do not increment usage again.

Test provider behavior:

- No network calls or credentials required.
- Mobile numbers ending in `000001` fail on attempt 1 and succeed on retry.
- Provider message IDs are deterministic: `test-{idempotencyKey}-{attemptNumber}`.

Delivery API:

- `GET /api/v1/deliveries`
- `POST /api/v1/deliveries/[id]/refresh`

Delivery status semantics:

- `SENT` on a `DeliveryLog` means the provider accepted the submission and returned a provider message ID. It does not mean handset delivery.
- `DELIVERED` means a manual refresh confirmed handset delivery through the provider status endpoint.
- `UNDELIVERED` means a manual refresh confirmed a blocked or otherwise undelivered outcome. The related `SendQueue` item remains `SENT` for this milestone.
- Pending or unknown provider outcomes leave the `DeliveryLog` at `SENT` and store safe refresh metadata in `providerResponse.deliveryStatus` without claiming handset delivery.

Manual delivery-status refresh:

- Available from the Deliveries dashboard for eligible `SENT` logs with a `providerMessageId`
- Tenant-scoped and session-authenticated only
- Uses the configured provider's delivery-status lookup (`GET /status.aspx` for `CUSTOM_HTTP`)
- Requires the original submission calendar date formatted `yyyy-MM-dd` using the organization's timezone and `SendQueue.sentAt`
- Does not send another SMS, increment `attemptCount`, create a new send-attempt `DeliveryLog`, or call send retry logic
- Confirmed handset delivery transitions `SendQueue` from `SENT` to `DELIVERED`
- Provider credentials and credential-bearing request URLs are never logged or exposed to the browser

Current limitation: Automatic delivery-status polling, webhooks, and bulk refresh are not implemented yet.

## WhatsApp (TEST + Configurable Custom HTTP)

WhatsApp messaging uses the existing queue/worker architecture.

### TEST provider

- Tenant WhatsApp `ChannelConfig` for `ChannelProvider.TEST` (`/dashboard/settings/channels?tab=whatsapp`; legacy `/dashboard/settings/whatsapp` redirects)
- Deterministic local sends with no live network calls
- Recommended default for development

### Custom HTTP WhatsApp (`CUSTOM_HTTP`) - testing only

- Generic multipart adapter for temporary provider testing. **No vendor base URL is hardcoded** in the product.
- Uses a native multipart HTTPS client that can skip TLS certificate verification for IP / self-signed test gateways (matches Postman with SSL verification off). Default: insecure TLS allowed; toggle in WhatsApp settings.
- Request timeout defaults to 60 seconds.

You must configure per tenant from **Settings → Channels → WhatsApp** (`/dashboard/settings/channels?tab=whatsapp`):

- Base URL (e.g. `https://your-provider.example`)
- Send path (e.g. `/api/CustomAPI/CustomAPI_SendWhatsApp`)
- Username (password optional)

Request shape (when using a CustomAPI-compatible gateway):

`POST {baseUrl}{sendPath}` multipart:

- `username` (required)
- `password` (optional)
- `MobileNumber` (Indian `91XXXXXXXXXX` from contact E.164)
- `TemplateName` (from `MessageTemplate.whatsappTemplateName`)
- `language` (from `MessageTemplate.whatsappLanguage`)
- `file` (JPEG; tenant-uploaded image from WhatsApp settings, or a built-in default if none is set)

Success response (observed on one test gateway): Meta-like JSON with `messages[0].id` (e.g. `wamid.…`) and `error: null`. That id is stored as `DeliveryLog.providerMessageId`.

Prefer **TEST** for normal development. Treat Custom HTTP as advanced/temporary until a production WhatsApp contract is finalized.

What exists:

- Tenant WhatsApp `ChannelConfig` for `TEST` and `CUSTOM_HTTP`
- Tenant-owned WhatsApp template metadata (`whatsappTemplateName`, `whatsappLanguage`, `whatsappParameterOrder`)
- Manual WhatsApp Send through Manual Send + PostgreSQL `SendQueue`
- Birthday, anniversary, and custom-occasion WhatsApp automation with independent
  enablement and templates alongside SMS automation
- Immutable queue snapshots for template name/language/parameters
- Background workers deliver WhatsApp rows via TEST or Custom HTTP
- `DeliveryLog` persistence with provider message IDs

Important limitations:

- Custom HTTP can use a tenant-uploaded JPEG from WhatsApp settings (falls back to a default JPEG)
- WhatsApp delivery status refresh/polling/webhooks are not supported
- Media/file WhatsApp messages beyond the required CustomAPI file are not a first-class product feature
- Inbound messages and session/free-form messaging are not supported
- Automated tests never call live WhatsApp provider endpoints

SMS and WhatsApp occasion automations are generation-only; background workers
deliver the queued messages.

## SMS (TEST + Configurable Custom HTTP)

SMS messaging uses the existing queue/worker architecture.

### TEST provider

- Tenant SMS `ChannelConfig` for `ChannelProvider.TEST` (`/dashboard/settings/channels`; legacy `/dashboard/settings/sms` redirects)
- Deterministic local sends with no live network calls
- Recommended default for development

### Custom HTTP SMS (`CUSTOM_HTTP`) - testing only

Generic legacy-HTTP adapter for temporary provider testing. **No vendor base URL is hardcoded** in the product.

You must configure per tenant from **Settings → Channels → SMS** (`/dashboard/settings/channels`):

- Base URL (e.g. `https://your-provider.example`)
- Send path (e.g. `/send.aspx`)
- Username and password
- Route and sender ID

Request shape (when using a CustomAPI-compatible legacy gateway):

`GET {baseUrl}{sendPath}` with query parameters:

- `username`, `pass`, `route`, `senderid`, `numbers`, `message`, `templateid`

Success response (plain text): `Status|Units|smsid`. Queue items are marked `SENT` only when status is exactly `1` and a non-empty provider SMS ID is returned.

Status and balance checks use fixed relative paths under the tenant base URL (`/status.aspx`, `/balance.aspx`) for this testing adapter.

Prefer **TEST** for normal development. Treat Custom HTTP as advanced/temporary until a production SMS contract is finalized.

Configuration is stored per tenant in `ChannelConfig`:

- `encryptedCredentials`: AES-256-GCM encrypted JSON with `username` and `password`
- `settings`: non-secret JSON with required `baseUrl`, `sendPath`, `route`, `senderId`, and optional `requestTimeoutMs`

Required environment variable for credential encryption:

- `CREDENTIALS_ENCRYPTION_KEY`: base64-encoded 32-byte key

SMS templates store DLT metadata in `MessageTemplate.dltTemplateId` and `MessageTemplate.dltApprovedContent`. Configure these through Advanced SMS Template Setup. `CUSTOM_HTTP` requires a ready SMS template; the `TEST` provider does not require DLT setup.

Indian recipient formatting for the Custom HTTP SMS testing adapter:

- Stored contacts remain E.164 (for example `+919876543210`)
- The adapter converts supported Indian numbers to `919876543210` before submission
- Non-Indian numbers are rejected safely for this adapter

Security note:

- The upstream provider requires HTTP GET with credentials in query parameters
- Request URLs and credential-bearing query strings must never be logged
- Credentials are decrypted server-side only and are never returned to the browser or stored in delivery error fields

## SMS channel settings

Authenticated tenants can manage SMS `ChannelConfig` from the dashboard at **Settings → Channels** (`/dashboard/settings/channels`).

Supported providers:

- `TEST` - local deterministic provider; does not send real SMS and does not require provider credentials
- `CUSTOM_HTTP` - temporary Custom HTTP SMS testing adapter; requires base URL, send path, encrypted credentials, and route/sender settings

API routes (session-authenticated, tenant-scoped):

- `GET /api/v1/channel-config/sms`
- `PUT /api/v1/channel-config/sms`
- `POST /api/v1/channel-config/sms/verify`

Security and persistence:

- Credentials are encrypted at rest with `CREDENTIALS_ENCRYPTION_KEY`
- Passwords are never returned to the browser
- Editing an existing `CUSTOM_HTTP` configuration with a blank password preserves the stored password
- Switching to `TEST` clears stored Custom HTTP credentials and settings; switching back to `CUSTOM_HTTP` requires credentials again
- Provider base URL and send path are tenant-configured (no product-default vendor URL). Request timeout remains server-controlled and is not accepted from the client
- Dashboard verification (`POST /api/v1/channel-config/sms/verify`) uses a read-only provider balance lookup for `CUSTOM_HTTP` and sends no SMS
- Verification does not create `SendQueue` or `DeliveryLog` records and does not display provider balance

Tenant isolation:

- All reads, writes, and verification use trusted `organizationId` from the session only
- Cross-tenant configuration access is impossible through the API

Local development tooling remains available:

- `npm run sms:configure`
- `npm run sms:verify`

Not yet integrated:

- Provider balance UI - balance lookup is used only for manual configuration verification
- Automatic delivery-status polling or webhooks
- Unicode SMS / provider-side scheduling beyond the testing adapter

Live verification:

1. Set `CREDENTIALS_ENCRYPTION_KEY`, `SMS_USERNAME`, `SMS_PASSWORD`, `SMS_BASE_URL`, and `SMS_CONFIG_ORGANIZATION_SLUG` in `.env.local`
2. Optionally set `SMS_SEND_PATH` (default `/send.aspx`), `SMS_ROUTE`, and `SMS_SENDER_ID`
3. Run `npm run sms:configure`
4. Run `npm run sms:verify`
5. Complete Advanced SMS Template Setup with a DLT Template ID and approved content that structurally match the application template body
6. Create a contact with a valid Indian mobile number
7. Generate and send one queue item to an authorized test recipient through the application pipeline

Local development configuration:

- `npm run sms:configure` reads local env vars and upserts encrypted SMS `ChannelConfig` for the target organization
- `npm run sms:verify` checks provider, settings, encrypted credentials, and provider factory resolution without sending SMS or calling the live provider
- Dashboard verification is separate and performs the read-only balance lookup for saved `CUSTOM_HTTP` configuration
