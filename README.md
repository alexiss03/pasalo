# Pasalo Marketplace Monorepo

Implementation baseline for the Pasalo v1 MVP.

## Apps
- `apps/api`: Fastify + PostgreSQL API with auth, profiles, and listing flows.
- `apps/web`: Next.js app with login, create-listing form, and listing feed.
- `packages/shared`: Shared domain types and financial calculation logic.

## Quick Start
1. Copy env files:
   - `cp .env.example .env`
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
2. Start PostgreSQL:
   - `docker compose -f infra/docker-compose.yml up -d`
3. Install dependencies:
   - `npm install`
4. Run migrations:
   - `npm run db:migrate`
5. Start services:
   - `npm run dev:api`
   - `npm run dev:web`

## Implemented API endpoints (v1 foundation)
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/oauth/google` (stubbed)
- `POST /api/v1/auth/oauth/facebook` (stubbed)
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`
- `PATCH /api/v1/me/profile`
- `POST /api/v1/me/verification-docs`
- `POST /api/v1/me/role-applications`
- `GET /api/v1/me/role-applications`
- `POST /api/v1/listings`
- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`
- `PATCH /api/v1/listings/:id`
- `PATCH /api/v1/listings/:id/market-status`
- `GET /api/v1/listings/:id/leads`
- `POST /api/v1/listings/:id/publish`
- `POST /api/v1/listings/:id/pause`
- `POST /api/v1/listings/:id/reconfirm`
- `POST /api/v1/listings/:id/media`
- `POST /api/v1/listings/:id/inquiries`
- `POST /api/v1/listings/:id/viewing-requests`
- `GET /api/v1/inquiries`
- `POST /api/v1/conversations`
- `GET /api/v1/conversations`
- `GET /api/v1/conversations/:id`
- `GET /api/v1/conversations/:id/messages`
- `POST /api/v1/conversations/:id/messages`
- `GET /api/v1/conversations/:id/payment-intents`
- `POST /api/v1/conversations/:id/payment-intents`
- `PATCH /api/v1/payment-intents/:id`
- `PATCH /api/v1/viewing-requests/:id`
- `POST /api/v1/watchlist/:listingId`
- `DELETE /api/v1/watchlist/:listingId`
- `GET /api/v1/watchlist`
- `GET /api/v1/admin/listings/pending`
- `PATCH /api/v1/admin/listings/:id/review`
- `GET /api/v1/admin/verifications`
- `PATCH /api/v1/admin/verifications/:id`
- `GET /api/v1/admin/deals/dashboard`
- `GET /api/v1/admin/role-applications`
- `PATCH /api/v1/admin/role-applications/:id`

## Notes
- Signup allows `buyer` and `seller` roles only.
- Users can request additional roles (for example `agent`) after registration through role applications.
- Listings are created as `draft` and can be submitted to `pending_review`.
- Listing creation now requires a digitally accepted Seller Listing Agreement (typed-name + checkbox signature) with commission %, lead validity months, and payment due days.
- Search endpoint returns only `live` listings by default.
- Payment-related text is blocked in inquiries, chat messages, and viewing notes.
- Payments are tracked as in-app payment intents inside conversation threads.
- Conversation inbox includes unread counts; opening threads marks incoming messages as read (`read_at`) and shows minute-based read time.
- Listings now track both `transaction_status` (available, auctioned, in deal, buying in progress, bought, released) and legal `transfer_status`.
- When a listing is not open to new buyers (`in_deal`, `buying_in_progress`, `bought`, or `auctioned`), new buyer inquiries/conversation starts are blocked unless it is the active buyer.
- Platform lead records are automatically logged on inquiry, conversation start, and viewing request with buyer name, contact number, email, inquiry date, and property ID.
- Core schema includes deal, messaging, verification, watchlist, and audit tables for next sprints.
- Freshness job is included: `npm run job:freshness --workspace @pasalo/api`.
