# Pasalo Marketplace Test Plan

## 1. Objective

Validate that all current features work end-to-end across:

- Web app (`apps/web`)
- API (`apps/api`)
- Admin app (`apps/admin`)
- Core business rules (verification, listing lifecycle, anti-scam/payment controls)

## 2. Test Environments

1. Local dev: web on `3001`, API on `4000`, admin app running
2. Test database with seed users/listings/developers
3. Browser matrix:
- Chrome latest
- Safari latest
- Mobile viewport (iPhone 12/13 size)
4. API client: Postman/Insomnia for direct endpoint verification

## 3. Test Data Setup

1. Accounts:
- Buyer account
- Seller account
- Agent account
- Admin account
2. Listings:
- Live listing (verified seller)
- Draft listing
- Auction-enabled listing
- Listing in `in_deal` / `buying_in_progress`
3. Media/docs:
- Valid image files (`< 5MB`)
- Oversized images (`> 5MB`)
- Valid PDF/image docs for ID and transfer docs
4. Developers:
- Active developer entries
- Inactive developer entries

## 4. Test Strategy

1. Smoke tests (every deploy)
2. Feature functional tests (positive + negative)
3. API integration tests
4. Role/permission tests
5. Regression suite (all previously fixed issues)
6. Basic non-functional checks (layout, responsiveness, error handling)

## 5. Feature Test Coverage

### A. Authentication & Session

1. Signup works for Buyer/Seller (segmented control)
2. Password + confirm password validation
3. Login works from navbar form
4. Signup navigation switches correctly to signup page
5. Unauthorized users are redirected on protected pages (`/profile`, `/create-listing`, `/messages`, `/verify-identity`)
6. Logout clears session and returns to public state

### B. Navbar & Global UI

1. `Messages` appears on right for logged-in users
2. `Post a property` hidden when logged out
3. Profile shown in right actions when logged in
4. Header alignment remains correct across breakpoints
5. Font is Satoshi globally
6. No uppercase status labels where removed

### C. Browse/Home + Filters

1. Category pills and location filters work without breaking header
2. Search/filter results update correctly
3. Sorting by verification/freshness is applied
4. Scope locations (Metro Manila / Laguna / Cavite) filter correctly
5. Listing cards are clickable to detail page

### D. Listing Details

1. Photo carousel appears at top
2. Financial breakdown renders with correct labels/amounts
3. Turnover date displays without timezone ISO artifact
4. Developer/unit/floor area/seller details render correctly
5. Verified badge shown only when verified

### E. Create Listing

1. Requires login
2. Developer field is searchable dropdown and accepts only active catalog values
3. Unit number truly optional (blank accepted)
4. Financial calculations and validations are enforced
5. Remaining amortization months, Pag-IBIG/in-house loan fields save correctly
6. Signature pad opens from “Seller Signature” field and submission requires signature
7. Seller Listing Agreement acceptance required
8. AI verification docs required (ID, transfer doc, title/tax, authority doc)
9. Photo upload:
- Image only
- Max 15 photos
- Max 5MB per photo (client + server enforced)
10. Auction checkbox + bidding days validation if enabled

### F. Messaging, Inquiries, Viewing, Payment Controls

1. Buyer can create conversation/inquiry on available listing
2. Not logged in user tapping chat is redirected to login
3. Payment-related text in inquiries/messages is blocked with proper message
4. In-app payment intent flow is accessible where applicable
5. Listings in restricted transaction status are blocked for other buyers

### G. Profile + Identity Verification

1. Unverified profile shows internal “Verify Now” CTA (not external Persona)
2. `/verify-identity` page loads for authenticated users only
3. Can submit required docs: Photo ID + selfie
4. Optional authority doc accepted
5. Status and issued Pasalo ID shown after submission
6. Profile shows Pasalo ID, identity auth status, review status
7. API returns `401` on identity endpoints without token

### H. Apply Role

1. User can submit role application from profile/apply-role
2. Role application status persists and is visible in admin moderation
3. Duplicate pending application blocked

### I. Developers Catalog

1. Public `/developers?activeOnly=true` returns active list
2. Admin can create/update developer entries
3. Duplicate developer names blocked
4. Create Listing uses updated catalog values after admin changes

### J. Admin App

1. Admin login works
2. Dashboard loads key metrics
3. Moderation flows:
- Approve/reject listings
- Approve/reject verification docs
- Approve/reject role applications
4. User management:
- List/filter users
- Update user roles
5. Developers tab:
- List, create, edit, activate/deactivate
6. Audit logs populate for admin actions

## 6. Regression Tests (Must Run Every Release)

1. Next dev/runtime cache corruption scenario no longer causes blank/500 after clean start
2. `/create-listing` no 500 errors
3. Homepage not empty after rebuild
4. CSS/layout at `/signup` and profile screens remains intact
5. “Messages in navbar right” remains preserved
6. Unit number optional behavior stays intact
7. 5MB photo guard remains enforced
8. Internal verify flow remains linked from profile

## 7. Automation Plan

1. API integration tests:
- Auth
- Listings create/list/get
- Interaction routes (message payment-blocking)
- Identity verification endpoints
- Admin developer CRUD
2. UI E2E (Playwright/Cypress):
- Auth journey
- Create listing journey
- Chat/login redirect journey
- Profile verification journey
- Admin moderation journey
3. Unit tests:
- `documentAuth` + selfie assessment
- Payment keyword detector
- Financial computation/validation helpers

## 8. Exit Criteria

1. All smoke tests pass
2. No critical/P1 defects open
3. Core journeys pass E2E:
- Signup/Login
- Create listing with docs/signature/photos
- Browse to detail
- Message flow with payment text blocking
- Verify identity flow
- Admin moderation + developer management
4. Build passes for web/api/admin
5. No 500s in critical pages/endpoints
