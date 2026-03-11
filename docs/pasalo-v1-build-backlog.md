# Pasalo Marketplace v1 - Build-Ready Backlog

## 1) Scope and principles

### Product goal (v1)
Launch a trusted pasalo marketplace for Metro Manila, Laguna, and Cavite that can move listings into real closed transactions.

### v1 success criteria (first 6 months post-launch)
- 1,000+ live listings
- 10,000+ MAU
- 2,000+ monthly inquiries
- 50+ closed transactions
- Listing freshness rate >= 85% (reconfirmed within 30 days)

### Non-goals (v1)
- Full escrow rails
- Mortgage pre-approval integrations with banks
- AI pricing engine

## 2) Personas and jobs-to-be-done

### Seller
- Job: Transfer property rights quickly and recover equity.
- Friction: Low trust, unclear process, stale leads.

### Buyer
- Job: Find lower-entry property with clear cash-out and monthly obligations.
- Friction: Scam risk, hidden fees, hard comparisons.

### Agent
- Job: Manage and market multiple pasalo listings efficiently.
- Friction: Scattered channels, manual lead handling.

### Admin / Ops
- Job: Keep marketplace trustworthy, moderate fraud, and track deal progression.

## 3) Epic map and priorities

### P0 (must ship for launch)
1. Account and identity
2. Listing creation and management
3. Search and discovery
4. Listing detail and inquiry flow
5. Messaging and scheduling
6. Verification workflow
7. Listing freshness controls
8. Admin moderation and operations
9. Transfer-readiness scoring
10. Analytics and event tracking

### P1 (first post-launch)
1. Watchlist and alerts
2. Featured listings monetization
3. Agent tools (bulk import, lead inbox)

## 4) User stories with acceptance criteria

## Epic A - Account and identity (P0)

### A1 - Signup/login
As a buyer/seller/agent, I can sign up with email, Google, or Facebook.
- Acceptance:
  - Email/password signup works with verification email.
  - OAuth login (Google, Facebook) creates user profile on first login.
  - Role selected at onboarding: buyer, seller, agent.

### A2 - Profile completion
As a seller/agent, I can add phone and identity details.
- Acceptance:
  - Required profile fields enforced before posting listing.
  - Verification status shown: unverified, pending, verified, rejected.

## Epic B - Listing creation and management (P0)

### B1 - Create listing
As a seller/agent, I can submit property and financial data.
- Acceptance:
  - Required fields validated (type, project, developer, location, floor area, price fields).
  - Unit number optional.
  - Turnover date supports month/year.

### B2 - Financial calculator in form
As a seller, I see total-cost breakdown preview.
- Acceptance:
  - Computed fields update in real time.
  - Currency formatting in PHP.
  - Invalid values blocked (negative amounts, inconsistent balance).

### B3 - Photo upload
As a seller, I can upload 3 to 15 photos.
- Acceptance:
  - Reject if <3 or >15.
  - Images compressed and stored in object storage.
  - Primary image can be selected.

### B4 - Listing lifecycle
As a seller, I can edit/pause/reactivate/archive listing.
- Acceptance:
  - Statuses: draft, pending_review, live, paused, expired, rejected, archived.
  - Edit history and timestamps stored.

## Epic C - Search and discovery (P0)

### C1 - Filtered search
As a buyer, I can search by location, cash-out budget, monthly amortization, property type, developer, turnover date.
- Acceptance:
  - Query returns paginated results with sort options.
  - Filters compose correctly.
  - Empty-state recommendations displayed.

### C2 - Relevance defaults
As a buyer, I see fresher and verified listings first.
- Acceptance:
  - Default sort: verified desc, featured desc, freshness desc, created_at desc.

## Epic D - Listing detail and inquiry flow (P0)

### D1 - Listing page details
As a buyer, I can view complete property and finance details.
- Acceptance:
  - Displays map, photos, amenities, seller badge, readiness score.
  - Shows “last confirmed” date.

### D2 - Inquiry CTA
As a buyer, I can send inquiry and schedule viewing request.
- Acceptance:
  - Inquiry requires authenticated account.
  - Seller receives in-app notification and optional email/push.

## Epic E - Messaging and scheduling (P0)

### E1 - Buyer-seller chat
As buyer/seller, I can exchange messages per listing.
- Acceptance:
  - Thread scoped to listing.
  - Supports text, image/file attachment.
  - Read/unread indicators.

### E2 - Viewing scheduler
As buyer/seller, I can propose and confirm viewing schedules.
- Acceptance:
  - Time proposal and confirmation events logged.
  - Calendar invite email sent on confirmation.

## Epic F - Verification and trust (P0)

### F1 - Seller document upload
As a seller, I upload reservation agreement, SOA, and valid ID.
- Acceptance:
  - Supports PDF/JPG/PNG with size limits.
  - Verification status SLA visible (e.g., 24-48h).

### F2 - Verified Pasalo badge
As a buyer, I can identify verified listings quickly.
- Acceptance:
  - Badge appears only when seller identity + listing docs are approved.

## Epic G - Listing freshness and anti-stale controls (P0)

### G1 - 30-day reconfirmation
As platform, stale listings auto-expire if not reconfirmed.
- Acceptance:
  - Reconfirmation reminders at day 23 and day 29.
  - Auto-expire day 30 if no action.
  - Expired listings removed from default search.

## Epic H - Transfer-readiness score (P0)

### H1 - Readiness score computation
As a buyer, I see a readiness score (0-100).
- Acceptance:
  - Score factors: doc completeness, SOA recency, seller verification, developer transfer-policy status.
  - Rule weights versioned and auditable.
  - Tooltip explains score drivers.

## Epic I - Admin moderation and deal ops (P0)

### I1 - Admin listing queue
As admin, I can approve/reject listings and flag scams.
- Acceptance:
  - Queue by pending age and risk.
  - Rejection reason required.

### I2 - Deal pipeline
As admin, I can move deal stages and track drop-off.
- Acceptance:
  - Stages: inquiry -> qualified -> offer -> developer_review -> closed_won/closed_lost.
  - Stage transition timestamps captured.
  - Lost reason taxonomy required.

## Epic J - Analytics and tracking (P0)

### J1 - Funnel tracking
As product team, I can monitor listing and deal conversion.
- Acceptance:
  - Events fire for create_listing, publish_listing, inquiry_sent, viewing_scheduled, offer_made, deal_closed.
  - Dashboard shows conversion by city and property type.

## Epic K - Watchlist and alerts (P1)

### K1 - Save listing
As buyer, I can save favorite listings.
- Acceptance:
  - Save/unsave from card and detail page.
  - Watchlist view with filters.

### K2 - Alerts
As buyer, I receive price-drop and matching-listing alerts.
- Acceptance:
  - User can opt in/out by email/push.

## 5) Data model (PostgreSQL)

## Core entities
- `users`
- `profiles`
- `listings`
- `listing_financials`
- `listing_media`
- `listing_verifications`
- `listing_status_events`
- `inquiries`
- `conversations`
- `messages`
- `viewing_requests`
- `deal_pipelines`
- `deal_stage_events`
- `watchlists`
- `notifications`
- `audit_logs`

## Suggested table sketch (key fields)

### `users`
- id (uuid, pk)
- email (unique)
- password_hash (nullable for oauth users)
- auth_provider (email/google/facebook)
- role (buyer/seller/agent/admin)
- created_at, updated_at

### `profiles`
- user_id (pk, fk users.id)
- full_name
- phone
- city
- verification_status (unverified/pending/verified/rejected)
- verification_badge_shown (bool)

### `listings`
- id (uuid, pk)
- owner_user_id (fk users.id)
- property_type (condo/house_lot/lot_only)
- project_name
- developer_name
- location_city
- location_province
- floor_area_sqm
- unit_number (nullable)
- turnover_date (date nullable)
- title
- description
- status (draft/pending_review/live/paused/expired/rejected/archived)
- is_featured (bool)
- last_confirmed_at (timestamp nullable)
- readiness_score (int)
- created_at, updated_at

### `listing_financials`
- listing_id (pk, fk listings.id)
- original_price_php (numeric)
- equity_paid_php (numeric)
- remaining_balance_php (numeric)
- monthly_amortization_php (numeric)
- cash_out_price_php (numeric)
- est_total_cost_php (numeric)

### `listing_media`
- id (uuid, pk)
- listing_id (fk listings.id)
- media_type (image/file)
- storage_key
- is_primary (bool)
- created_at

### `listing_verifications`
- id (uuid, pk)
- listing_id (fk listings.id)
- user_id (fk users.id)
- doc_type (reservation_agreement/soa/id/government_clearance_optional)
- file_key
- status (pending/approved/rejected)
- reviewed_by (fk users.id nullable)
- reviewed_at (timestamp nullable)
- rejection_reason (text nullable)

### `inquiries`
- id (uuid, pk)
- listing_id (fk listings.id)
- buyer_user_id (fk users.id)
- message
- status (open/qualified/closed)
- created_at

### `conversations`
- id (uuid, pk)
- listing_id (fk listings.id)
- buyer_user_id
- seller_user_id
- created_at

### `messages`
- id (uuid, pk)
- conversation_id (fk conversations.id)
- sender_user_id
- body
- attachment_key (nullable)
- created_at
- read_at (timestamp nullable)

### `viewing_requests`
- id (uuid, pk)
- listing_id
- buyer_user_id
- seller_user_id
- proposed_at (timestamp)
- status (proposed/accepted/rejected/rescheduled/completed)
- notes

### `deal_pipelines`
- id (uuid, pk)
- listing_id
- buyer_user_id
- owner_user_id
- current_stage (inquiry/qualified/offer/developer_review/closed_won/closed_lost)
- lost_reason (nullable)
- created_at, updated_at

### `deal_stage_events`
- id (uuid, pk)
- pipeline_id
- from_stage
- to_stage
- changed_by
- changed_at

### `watchlists`
- id (uuid, pk)
- user_id
- listing_id
- created_at
- unique(user_id, listing_id)

## 6) API contract (v1)

## Auth
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/oauth/google`
- `POST /api/v1/auth/oauth/facebook`
- `POST /api/v1/auth/logout`

## Profile
- `GET /api/v1/me`
- `PATCH /api/v1/me/profile`
- `POST /api/v1/me/verification-docs`

## Listings
- `POST /api/v1/listings`
- `GET /api/v1/listings` (filters: city, province, type, developer, cash_out_max, monthly_max, turnover_before, verified_only, page, sort)
- `GET /api/v1/listings/{id}`
- `PATCH /api/v1/listings/{id}`
- `POST /api/v1/listings/{id}/publish`
- `POST /api/v1/listings/{id}/pause`
- `POST /api/v1/listings/{id}/reconfirm`
- `POST /api/v1/listings/{id}/media`

## Inquiries and messaging
- `POST /api/v1/listings/{id}/inquiries`
- `GET /api/v1/inquiries`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations/{id}/messages`
- `POST /api/v1/conversations/{id}/messages`

## Viewing and pipeline
- `POST /api/v1/listings/{id}/viewing-requests`
- `PATCH /api/v1/viewing-requests/{id}`
- `GET /api/v1/deals`
- `PATCH /api/v1/deals/{id}/stage`

## Watchlist
- `POST /api/v1/watchlist/{listing_id}`
- `DELETE /api/v1/watchlist/{listing_id}`
- `GET /api/v1/watchlist`

## Admin
- `GET /api/v1/admin/listings/pending`
- `PATCH /api/v1/admin/listings/{id}/review` (approve/reject)
- `GET /api/v1/admin/verifications`
- `PATCH /api/v1/admin/verifications/{id}`
- `GET /api/v1/admin/deals/dashboard`

## Webhooks/jobs
- Daily freshness check job
- Reminder notifications job
- Readiness score recompute job

## 7) Event schema (analytics)

Standard event fields:
- event_name
- user_id
- listing_id (nullable)
- session_id
- timestamp
- metadata (jsonb)

Key events:
- `listing_created`
- `listing_submitted_for_review`
- `listing_published`
- `listing_reconfirmed`
- `listing_expired`
- `inquiry_sent`
- `conversation_started`
- `viewing_requested`
- `viewing_confirmed`
- `deal_stage_changed`
- `deal_closed_won`
- `deal_closed_lost`

## 8) 12-week sprint plan (2-week sprints)

## Sprint 1 (Weeks 1-2) - Foundations
- Architecture, repo setup, environments
- Auth + roles (email + oauth)
- Basic profile module
- DB schema v1 migrations
- Tracking scaffolding
- Exit criteria:
  - User can sign up/login and persist profile.
  - CI/CD and staging deployed.

## Sprint 2 (Weeks 3-4) - Listing creation
- Listing CRUD + status model
- Financial breakdown calculator
- Media upload to S3-compatible storage
- Seller dashboard: my listings
- Exit criteria:
  - Seller can create draft and submit listing with required photos.

## Sprint 3 (Weeks 5-6) - Discovery and detail
- Search API with filters and sort
- Listing card and detail pages
- Map integration
- Freshness fields and last-confirmed display
- Exit criteria:
  - Buyer can discover and view listings with correct filters.

## Sprint 4 (Weeks 7-8) - Inquiry and chat
- Inquiry flow
- Conversation/message threads
- Viewing request workflow
- Notification service (email + in-app)
- Exit criteria:
  - Buyer and seller can complete inquiry-to-viewing loop.

## Sprint 5 (Weeks 9-10) - Trust and operations
- Verification document upload and review queue
- Verified Pasalo badge logic
- Transfer-readiness score logic
- Admin moderation panel
- Exit criteria:
  - Admin can approve/reject listing/docs, badge displays correctly.

## Sprint 6 (Weeks 11-12) - Deal pipeline and launch
- Deal pipeline stages + dashboards
- Auto-expiry and reconfirmation jobs
- QA, performance pass, security checklist
- Launch playbooks and instrumentation validation
- Exit criteria:
  - End-to-end from listing creation to closed deal stage works in production.

## 9) Engineering checklist (launch gate)

- OWASP baseline checks for auth/upload endpoints
- Rate-limiting on auth, inquiry, and message endpoints
- PII encryption at rest for sensitive docs
- Audit logs for admin decisions
- Abuse controls for spam inquiries
- Backups and restore drill validated
- Monitoring/alerts: API error rate, job failures, upload failures

## 10) Initial staffing plan (lean)

- 1 Product Manager (part-time acceptable)
- 1 Designer
- 2 Full-stack engineers
- 1 QA (or QA+Ops hybrid)
- 1 Trust & Safety / verification operations associate

## 11) Delivery risks and mitigations

1. Risk: Stale inventory.
   Mitigation: 30-day auto-expiry + reconfirm nudges + stale ranking penalty.
2. Risk: Scam/fraud listings.
   Mitigation: mandatory doc verification + risk flags + admin review SLA.
3. Risk: Low transaction completion.
   Mitigation: deal pipeline ownership + transfer checklist + lost-reason analysis.
4. Risk: Supply shortfall.
   Mitigation: agent onboarding program + assisted import + featured credits.

## 12) Immediate next build tasks (week 0)

1. Create monorepo skeleton (`apps/web`, `apps/api`, `packages/shared`).
2. Implement DB migrations for core entities.
3. Build auth + role guard middleware.
4. Build listing create API + form UI with financial calculator.
5. Set up event tracking contracts and dashboard seed.

