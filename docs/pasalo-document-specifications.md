# Pasalo Document Specifications

## Purpose

This document defines all document-related requirements, inputs, validations, statuses, and review flows currently represented in the Pasalo app. It is intended to align product, design, engineering, legal operations, and admin teams on what documents exist in the system and how they should behave.

This specification covers:

- Identity verification documents
- Listing verification documents
- Seller listing agreement records
- Role application document and compliance requirements
- Mobile capture and document submission flows
- AI document-authentication behavior
- Admin review and moderation handling
- Upload, storage, and validation rules

## Scope

This document reflects the current product implementation and extends it into an operational specification. Where useful, it also notes recommended Philippine-market compliance expectations for a real estate pasalo marketplace.

## Principles

- Trust first: documents must improve buyer and seller confidence
- Minimal ambiguity: each document must have a clear purpose and owner
- Traceability: all critical submissions must be attributable to a user, listing, and timestamp
- Reviewability: AI checks may assist, but admin review remains authoritative
- Marketplace safety: identity, authority, and transfer legitimacy must be visible before a listing is treated as trusted

## 1. Document Inventory

### 1.1 Profile Identity Verification

Used to verify the person operating an account.

Required fields:

- Valid ID document
- Selfie capture
- Authority document if acting for another party or organization

Stored under:

- `profile_identity_verifications`

Current provider:

- `pasalo_internal`

Outputs:

- platform identity code
- AI authenticity status
- manual review status
- verification status shown on profile

### 1.2 Listing Verification Documents

Used to verify whether a pasalo listing is supported by documents that suggest a legitimate transferable interest.

Supported document types:

- Reservation agreement
- Statement of account
- Seller ID
- Government clearance optional
- Transfer document
- Title or tax declaration
- Authority document

Stored under:

- `listing_verifications`

Primary current create-listing batch:

- Seller valid ID
- Transfer document
- Title or tax declaration
- Authority document

### 1.3 Seller Listing Agreement

Used to capture seller consent to marketplace lead protection and commission terms before a listing can be published.

Stored under:

- `listing_seller_agreements`

Includes:

- seller signed name
- attorney signed name
- commission rate
- lead validity period
- payment due days
- signature method
- acceptance timestamp
- lead definition clause
- commission clause
- payment clause

### 1.4 Role Application Compliance Details

Used when a registered user applies for another role inside the app.

Roles currently represented:

- Buyer
- Seller
- Agent
- Attorney

Stored under:

- `role_applications`

The app currently captures detailed declarations in the application reason body for buyer, seller, and agent applications. This should be treated as structured compliance metadata even if stored as formatted text today.

### 1.5 Document Processing Assistance

Used when a seller wants support with collection and processing of transfer-related paperwork.

Stored on listing:

- `document_assistance_requested`
- `document_assistance_status`
- `document_assistance_notes`
- request timestamps

### 1.6 Mobile Capture Sessions

Used when document capture starts on desktop but actual photo capture happens on mobile through a QR code and deep link.

Supported capture fields:

- ID
- Selfie
- Authority document

Stored under:

- `mobile_capture_sessions`

## 2. Identity Verification Specification

## 2.1 Objective

Identity verification confirms that the account holder is a real person and that submitted profile credentials are suitable for trust-sensitive marketplace actions such as messaging, posting, and high-value transfer coordination.

## 2.2 Required Inputs

### Valid ID

Accepted purpose:

- prove identity of the account holder

Examples appropriate for Philippine use:

- Passport
- UMID
- Driver’s license
- PhilHealth ID
- SSS ID
- PhilSys ID

Current submission methods:

- uploaded file key
- mobile capture via QR and secure token link

### Selfie

Accepted purpose:

- prove liveness-style identity match support

Expected capture:

- clear face image
- preferably with the ID visible beside the face

Current submission methods:

- uploaded file key
- mobile capture via QR and secure token link

### Authority Document

Required when:

- the user acts for another person
- the user acts for a corporation, partnership, estate, or family representative capacity

Examples:

- Special Power of Attorney
- Board Resolution
- Secretary’s Certificate
- Written authorization

Submission methods:

- uploaded file key
- mobile capture via QR and token link

## 2.3 Identity Verification Record

Each identity verification submission stores:

- user ID
- generated platform identity code
- ID file key
- selfie file key
- authority document file key, if any
- provider
- manual review status
- AI authenticity status
- AI confidence score
- AI flags
- rejection reason
- reviewer
- review timestamp
- created and updated timestamps

## 2.4 Identity Statuses

Manual review status:

- pending
- approved
- rejected

AI authenticity status:

- pass
- review
- fail

Profile-facing outputs:

- verification status
- badge visibility
- Pasalo identity code

## 2.5 Identity UX Requirements

- If user is not verified, profile must show a prominent `Verify Now` CTA
- Desktop flow should support QR generation and mobile handoff
- Mobile capture page should open camera directly when permissions are granted
- Expired capture sessions must not accept new uploads
- Completed mobile sessions should sync back to the desktop page automatically

## 3. Listing Verification Document Specification

## 3.1 Objective

Listing verification documents help determine whether the seller has a legitimate, reviewable, and potentially transferable interest in the property being offered as pasalo.

## 3.2 Required Documents for Current Create Listing Flow

### Seller Valid ID

Purpose:

- ties the listing to a real person

Minimum requirement:

- one government-issued identity document

Required in current implementation:

- yes

### Transfer Document

Purpose:

- shows a transferable contractual basis or a document relevant to assignment/sale/transfer

Examples:

- Deed of Assignment
- Contract to Sell
- Sale/Assignment document

Required in current implementation:

- yes

### Title or Tax Declaration

Purpose:

- gives evidence of the underlying property record or tax basis

Examples:

- TCT
- CCT
- OCT
- Tax Declaration

Required in current implementation:

- yes

### Authority Document

Purpose:

- proves authority when the listing is being posted by a representative

Examples:

- SPA
- Board Resolution
- Secretary’s Certificate

Required in current implementation:

- yes in current batch submission design, though operationally it may be conditionally required depending on seller capacity

## 3.3 Additional Supported Listing Verification Documents

These are represented in the backend and should remain supported for future UI expansion:

- Reservation agreement
- Statement of account
- Government clearance optional

## 3.4 Listing Verification Data Stored

Per document submission:

- listing ID
- user ID
- document type
- file key
- manual review status
- AI authenticity status
- AI confidence
- AI flags
- AI checked timestamp
- created timestamp

## 3.5 Listing Verification Outcome Rules

- A listing may collect documents while still in draft
- Listing review and verification are separate but related decisions
- A verified badge should only be shown when required review conditions are met
- AI `fail` should not auto-publish a listing
- Admin rejection should provide a clear reason when possible

## 4. Seller Listing Agreement Specification

## 4.1 Objective

The seller listing agreement protects platform-generated leads and documents the seller’s consent to commission and payment obligations.

## 4.2 Trigger

Must be accepted before a listing can be submitted for publishing.

## 4.3 Required Agreement Fields

- accepted: must be `true`
- signed name
- attorney signed name
- commission rate percent
- lead validity months
- payment due days
- signature method
- attorney signature method

Current required signature methods:

- `typed_name_checkbox`

## 4.4 Current Validation Rules

- commission rate: 3% to 5%
- lead validity: 6 to 12 months
- payment due days: 1 to 30
- seller signed name: minimum 2 characters
- attorney signed name: minimum 2 characters

## 4.5 Legal Clause Requirements

The stored agreement record must contain these clause types:

- lead definition
- commission clause
- payment clause

Recommended wording intent:

- any buyer introduced through the platform qualifies as a platform lead
- lead protection remains valid for the configured validity period
- commission becomes payable if the transfer or sale closes with that lead inside the protected period
- payment is due within the configured due-days window

## 4.6 Agreement Auditability

Must capture:

- acceptance timestamp
- signer IP if available
- signer user agent if available
- listing ID
- seller user ID
- agreement version

## 5. Role Application Document and Compliance Specification

## 5.1 Objective

Role applications allow registered users to expand their permissions after account creation while giving admins enough compliance context to evaluate legitimacy.

## 5.2 Buyer Application

Current fields captured:

- legal name
- contact number
- city or province
- preferred locations
- budget range
- financing plan
- target purchase timeline
- whether valid government ID is ready
- acknowledgement of transfer process

Recommended buyer-supporting documents:

- valid government ID
- proof of funds or financing readiness, optional for future

## 5.3 Seller Application

Current fields captured:

- legal name
- contact number
- city or province
- seller capacity
- TIN status
- declaration of government ID availability
- declaration of transfer document availability
- declaration of title or tax declaration availability
- declaration of statement of account availability
- declaration of authority document availability
- legal compliance acknowledgement

Seller capacity values:

- registered owner
- co-owner
- authorized representative
- broker partner

Recommended seller-supporting documents:

- government ID
- transfer document
- title or tax declaration
- statement of account
- authority document if representative

## 5.4 Agent Application

Current fields captured:

- legal name
- contact number
- city or province
- PRC license number
- PRC registration validity
- brokerage name
- service areas
- experience level
- government ID readiness
- PTR or official receipt availability
- legal compliance acknowledgement

Recommended required supporting documents:

- government ID
- PRC ID or PRC certificate
- brokerage affiliation proof, if applicable
- PTR or official receipt, if applicable

## 5.5 Attorney Application

The user role exists in the system and attorney signature is supported in listing agreements. A richer attorney-specific application form should be added if attorney onboarding becomes external-facing.

Recommended future attorney fields:

- legal name
- IBP details
- PTR details
- roll number
- office address
- notarization area or service areas

Recommended future attorney supporting documents:

- government ID
- IBP identification
- PTR
- notarial commission, if relevant to the service model

## 6. Document Processing Assistance Specification

## 6.1 Objective

Document processing assistance lets sellers request operational help with the transfer process and document collection.

## 6.2 Listing Fields

- requested: boolean
- notes
- status
- requested timestamp
- updated timestamp

## 6.3 Status Values

- not requested
- requested
- in review
- collecting documents
- processing
- completed
- declined

## 6.4 Operational Usage

When assistance is requested, admin or operations should be able to:

- review what documents are missing
- tell seller what to submit next
- track transfer support stage
- coordinate attorney or broker involvement

## 7. Mobile Capture Specification

## 7.1 Objective

Allow document or photo capture on mobile while the user initiated the process on desktop.

## 7.2 Supported Fields

- ID
- Selfie
- Authority document

## 7.3 Session Data

- session ID
- user ID
- field type
- session token
- status
- expiry
- captured file key
- captured file name
- capture timestamp

## 7.4 Session Statuses

- pending
- completed
- expired
- canceled

## 7.5 UX Requirements

- Desktop page generates QR code and capture link
- Capture link opens mobile capture page
- Mobile page should request camera access
- User captures image and submits
- Desktop page polls until the session is completed

## 7.6 Security Requirements

- tokenized access required
- sessions expire automatically
- completed sessions cannot be resubmitted
- expired or canceled sessions must not accept uploads

## 8. AI Document Authentication Specification

## 8.1 Purpose

AI document authentication provides a preliminary signal about whether a submitted file appears plausible for its intended document type.

This is assistance, not a final legal determination.

## 8.2 Current Method

The current implementation uses heuristic assessment based on:

- expected keywords by document type
- suspicious keywords
- allowed file extensions
- presence of HTTP-style file keys
- naming pattern quality

## 8.3 Supported AI Statuses

- pass
- review
- fail

## 8.4 Confidence Output

Confidence is stored as a decimal value and should be shown only when it helps internal review.

## 8.5 Current File Expectations

Allowed extensions:

- `.pdf`
- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

Suspicious indicators include names containing:

- sample
- template
- dummy
- test
- blur
- invalid
- fake

## 8.6 Review Handling Rules

- `pass` may still require manual review for high-risk listings
- `review` should route to admin attention
- `fail` should block trust signals and strongly recommend admin intervention

## 8.7 Future AI Upgrade Path

Recommended improvements:

- OCR extraction
- facial match scoring between selfie and ID
- tamper detection
- metadata analysis
- duplicate-document detection
- authoritative registry cross-check integrations where legally allowed

## 9. Upload and Storage Specification

## 9.1 Accepted Upload Types

Currently represented as:

- remote HTTP file keys
- uploaded data URLs for some local/browser capture flows
- mobile-captured image uploads converted to file keys

## 9.2 Photo Limits

Listing photos:

- minimum expected UX: 1 or more
- current UI target: up to 15 photos
- per-photo size limit: 5 MB

## 9.3 Mobile Capture Limits

Current mobile capture size limit:

- 10 MB

## 9.4 Storage Key Conventions

Current implementation expects URL-like storage keys such as:

- `https://uploads.pasalo.local/...`

Recommended future production storage:

- object storage with signed URLs
- MIME validation
- antivirus or malware scan for documents
- derivative generation for previews

## 10. Admin Review Specification

## 10.1 Admin Responsibilities

Admins should be able to:

- review pending listings
- approve or reject listing verification documents
- review identity verification submissions
- approve or reject role applications
- manage developers
- audit payment and conversation activity
- track lead and document-assistance status

## 10.2 Review Inputs

For every document or submission, admin should see:

- submitter
- related listing or profile
- document type
- file reference
- AI status
- AI confidence
- AI flags
- created timestamp
- prior review history if any

## 10.3 Decision Outputs

Allowed admin outputs:

- approve
- reject

If rejected, a rejection reason should be captured.

## 10.4 Audit Logging

All material admin actions should be written to audit logs, especially:

- developer management
- listing review changes
- verification review changes
- role application decisions
- user role changes

## 11. Document Visibility Rules

## 11.1 Buyer-Facing

Buyers should not see raw private documents.

Buyer should see only trust outcomes such as:

- verified badge
- verification status
- listing completeness cues
- seller identity trust indicators where appropriate

## 11.2 Seller-Facing

Seller should see:

- what documents are required
- upload or capture state
- AI or review outcome summary
- whether anything still needs correction

## 11.3 Admin-Facing

Admin should see the full review context, subject to internal access control.

## 12. Market and Compliance Notes for the Philippines

These are product guidance notes, not legal advice.

### Sellers

Common expected documents in Philippine property transfer contexts include:

- government-issued ID
- transfer or assignment document
- title copy or tax declaration, as applicable
- statement of account or amortization record
- authority document if seller is represented
- TIN information for tax-related steps

### Agents and Brokerage

If brokerage commissions are being collected, the marketplace should ensure the relevant structure is handled by or through properly licensed professionals where required.

### Attorneys

If attorney services are offered in-platform, attorney identity and authority should be reviewed separately from generic seller verification.

## 13. Current Gaps and Recommended Next Steps

Current gaps worth addressing:

- attorney-specific application form is still thin
- buyer, seller, and agent role application details are stored as formatted text rather than structured columns
- listing verification badge logic should be documented in stricter business rules
- document expiry handling is not yet formalized
- duplicate-document detection is not yet implemented
- there is no document version history UI yet
- there is no explicit OCR or registry-validation layer yet

Recommended next product moves:

1. convert role application detail blocks into structured schema columns
2. define exact verified-badge eligibility rules
3. add document expiry and renewal tracking
4. add admin-side preview and side-by-side review for uploaded documents
5. move AI verification from filename heuristics toward OCR and image analysis
6. formalize attorney and broker credential verification workflows

## 14. Reference Surface in Current Codebase

Primary implementation references:

- `apps/api/src/modules/profile/routes.ts`
- `apps/api/src/modules/profile/documentAuth.ts`
- `apps/api/src/modules/listings/routes.ts`
- `apps/api/src/modules/admin/routes.ts`
- `apps/api/src/modules/interactions/routes.ts`
- `apps/web/app/create-listing/page.tsx`
- `apps/web/app/verify-identity/page.tsx`
- `apps/web/app/mobile-capture/[sessionId]/page.tsx`
- `apps/web/app/apply-role/page.tsx`
- `apps/api/src/db/sql/006_seller_agreements_and_platform_leads.sql`
- `apps/api/src/db/sql/008_ai_document_verification.sql`
- `apps/api/src/db/sql/011_profile_identity_verifications.sql`
- `apps/api/src/db/sql/013_attorney_role_and_signature.sql`
- `apps/api/src/db/sql/015_document_processing_assistance.sql`
