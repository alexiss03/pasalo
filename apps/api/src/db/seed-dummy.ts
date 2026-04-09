import { hashPassword } from "../lib/password";
import { pool } from "./pool";

type SeedUser = {
  email: string;
  role: "buyer" | "seller" | "agent" | "attorney" | "admin";
  fullName: string;
  phone: string;
  city: string;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
};

type SeedListing = {
  title: string;
  propertyType: "condo" | "house_lot" | "lot_only";
  projectName: string;
  developerName: string;
  locationCity: string;
  locationProvince: string;
  floorAreaSqm: number;
  unitNumber: string;
  turnoverDate: string;
  description: string;
  status: "live" | "pending_review" | "draft";
  isFeatured: boolean;
  readinessScore: number;
  transactionStatus: "available" | "auctioned" | "in_deal" | "buying_in_progress" | "bought" | "released";
  transferStatus:
    | "not_started"
    | "document_review"
    | "developer_approval"
    | "contract_signing"
    | "transfer_in_process"
    | "transfer_completed"
    | "transfer_blocked";
  auctionEnabled: boolean;
  auctionBiddingDays: number | null;
  originalPricePhp: number;
  equityPaidPhp: number;
  remainingBalancePhp: number;
  monthlyAmortizationPhp: number;
  cashOutPricePhp: number;
  remainingAmortizationMonths: number;
  availableInPagIbig: boolean;
  availableInHouseLoan: boolean;
  documentAssistanceRequested: boolean;
  documentAssistanceStatus: string;
  documentAssistanceNotes: string | null;
  ownerKey: "sellerA" | "sellerB" | "agentA";
  createdDaysAgo: number;
};

const seedUsers: Record<
  "sellerA" | "sellerB" | "agentA" | "buyerA" | "buyerB" | "dummyBuyer" | "adminA" | "attorneyA",
  SeedUser
> = {
  sellerA: {
    email: "seed.seller.a@pasalo.local",
    role: "seller",
    fullName: "Seed Seller Alpha",
    phone: "09170000001",
    city: "Quezon City",
    verificationStatus: "verified",
  },
  sellerB: {
    email: "seed.seller.b@pasalo.local",
    role: "seller",
    fullName: "Seed Seller Bravo",
    phone: "09170000002",
    city: "Santa Rosa",
    verificationStatus: "pending",
  },
  agentA: {
    email: "seed.agent.a@pasalo.local",
    role: "agent",
    fullName: "Seed Agent Atlas",
    phone: "09170000003",
    city: "Taguig",
    verificationStatus: "verified",
  },
  buyerA: {
    email: "seed.buyer.a@pasalo.local",
    role: "buyer",
    fullName: "Seed Buyer Aurora",
    phone: "09170000004",
    city: "Imus",
    verificationStatus: "verified",
  },
  buyerB: {
    email: "seed.buyer.b@pasalo.local",
    role: "buyer",
    fullName: "Seed Buyer Bianca",
    phone: "09170000006",
    city: "Pasig",
    verificationStatus: "verified",
  },
  dummyBuyer: {
    email: "dummy@pasalo.local",
    role: "buyer",
    fullName: "Dummy Buyer Demo",
    phone: "09170000007",
    city: "Quezon City",
    verificationStatus: "verified",
  },
  adminA: {
    email: "seed.admin.a@pasalo.local",
    role: "admin",
    fullName: "Seed Admin Atlas",
    phone: "09170000008",
    city: "Makati",
    verificationStatus: "verified",
  },
  attorneyA: {
    email: "seed.attorney.a@pasalo.local",
    role: "attorney",
    fullName: "Seed Attorney Vega",
    phone: "09170000005",
    city: "Makati",
    verificationStatus: "verified",
  },
};

const seedListings: SeedListing[] = [
  {
    title: "Seed Pasalo QC Condo - Avida Cloverleaf 1BR",
    propertyType: "condo",
    projectName: "Avida Towers Cloverleaf",
    developerName: "Avida Land",
    locationCity: "Quezon City",
    locationProvince: "Metro Manila",
    floorAreaSqm: 26,
    unitNumber: "12B",
    turnoverDate: "2027-05-31",
    description: "Verified 1BR condo in Cloverleaf. Clean transfer history and updated statement of account.",
    status: "live",
    isFeatured: true,
    readinessScore: 88,
    transactionStatus: "available",
    transferStatus: "not_started",
    auctionEnabled: false,
    auctionBiddingDays: null,
    originalPricePhp: 3000000,
    equityPaidPhp: 350000,
    remainingBalancePhp: 2650000,
    monthlyAmortizationPhp: 18000,
    cashOutPricePhp: 250000,
    remainingAmortizationMonths: 180,
    availableInPagIbig: true,
    availableInHouseLoan: true,
    documentAssistanceRequested: false,
    documentAssistanceStatus: "not_requested",
    documentAssistanceNotes: null,
    ownerKey: "sellerA",
    createdDaysAgo: 1,
  },
  {
    title: "Seed Pasalo BGC Studio - Avida 34th",
    propertyType: "condo",
    projectName: "Avida CityFlex Towers BGC",
    developerName: "Avida Land",
    locationCity: "Taguig",
    locationProvince: "Metro Manila",
    floorAreaSqm: 23.5,
    unitNumber: "20A",
    turnoverDate: "2026-11-30",
    description: "Studio unit with strong rental demand. Updated docs and flexible turnover schedule.",
    status: "live",
    isFeatured: true,
    readinessScore: 84,
    transactionStatus: "available",
    transferStatus: "document_review",
    auctionEnabled: false,
    auctionBiddingDays: null,
    originalPricePhp: 4200000,
    equityPaidPhp: 520000,
    remainingBalancePhp: 3680000,
    monthlyAmortizationPhp: 24000,
    cashOutPricePhp: 320000,
    remainingAmortizationMonths: 204,
    availableInPagIbig: false,
    availableInHouseLoan: true,
    documentAssistanceRequested: true,
    documentAssistanceStatus: "in_review",
    documentAssistanceNotes: "Need support for developer approval packet and notarized docs.",
    ownerKey: "agentA",
    createdDaysAgo: 3,
  },
  {
    title: "Seed Pasalo Cavite House - Camella Dasma",
    propertyType: "house_lot",
    projectName: "Camella Dasmarinas",
    developerName: "Camella Homes",
    locationCity: "Dasmarinas",
    locationProvince: "Cavite",
    floorAreaSqm: 65,
    unitNumber: "Blk 7 Lot 19",
    turnoverDate: "2026-09-15",
    description: "Ready house and lot in Cavite with complete owner docs and active payment history.",
    status: "live",
    isFeatured: false,
    readinessScore: 80,
    transactionStatus: "released",
    transferStatus: "developer_approval",
    auctionEnabled: false,
    auctionBiddingDays: null,
    originalPricePhp: 3500000,
    equityPaidPhp: 600000,
    remainingBalancePhp: 2900000,
    monthlyAmortizationPhp: 22000,
    cashOutPricePhp: 180000,
    remainingAmortizationMonths: 168,
    availableInPagIbig: true,
    availableInHouseLoan: true,
    documentAssistanceRequested: false,
    documentAssistanceStatus: "not_requested",
    documentAssistanceNotes: null,
    ownerKey: "sellerA",
    createdDaysAgo: 6,
  },
  {
    title: "Seed Pasalo Laguna Condo - South Residences",
    propertyType: "condo",
    projectName: "South Residences",
    developerName: "SM Development Corporation",
    locationCity: "Binan",
    locationProvince: "Laguna",
    floorAreaSqm: 28,
    unitNumber: "9C",
    turnoverDate: "2026-12-20",
    description: "Near transport hubs and malls. Good for end-use or rental with manageable cash out.",
    status: "live",
    isFeatured: false,
    readinessScore: 77,
    transactionStatus: "available",
    transferStatus: "not_started",
    auctionEnabled: false,
    auctionBiddingDays: null,
    originalPricePhp: 2900000,
    equityPaidPhp: 420000,
    remainingBalancePhp: 2480000,
    monthlyAmortizationPhp: 17000,
    cashOutPricePhp: 210000,
    remainingAmortizationMonths: 174,
    availableInPagIbig: true,
    availableInHouseLoan: false,
    documentAssistanceRequested: false,
    documentAssistanceStatus: "not_requested",
    documentAssistanceNotes: null,
    ownerKey: "sellerB",
    createdDaysAgo: 8,
  },
  {
    title: "Seed Pasalo Cavite Lot - Lancaster",
    propertyType: "lot_only",
    projectName: "Lancaster New City",
    developerName: "Property Company of Friends (Pro-Friends)",
    locationCity: "General Trias",
    locationProvince: "Cavite",
    floorAreaSqm: 120,
    unitNumber: "Phase 3 Block 12",
    turnoverDate: "2027-02-14",
    description: "Lot-only pasalo for future build. Document packet complete and taxes current.",
    status: "live",
    isFeatured: false,
    readinessScore: 73,
    transactionStatus: "auctioned",
    transferStatus: "document_review",
    auctionEnabled: true,
    auctionBiddingDays: 10,
    originalPricePhp: 1800000,
    equityPaidPhp: 260000,
    remainingBalancePhp: 1540000,
    monthlyAmortizationPhp: 12000,
    cashOutPricePhp: 95000,
    remainingAmortizationMonths: 132,
    availableInPagIbig: true,
    availableInHouseLoan: false,
    documentAssistanceRequested: true,
    documentAssistanceStatus: "requested",
    documentAssistanceNotes: "Need help validating transfer tax declaration and lot plan.",
    ownerKey: "agentA",
    createdDaysAgo: 2,
  },
  {
    title: "Seed Pasalo Makati Condo - Air Residences",
    propertyType: "condo",
    projectName: "Air Residences",
    developerName: "SM Development Corporation",
    locationCity: "Makati",
    locationProvince: "Metro Manila",
    floorAreaSqm: 27,
    unitNumber: "31F",
    turnoverDate: "2027-03-01",
    description: "Premium location with strong rental upside. Listing submitted for final review.",
    status: "pending_review",
    isFeatured: false,
    readinessScore: 69,
    transactionStatus: "available",
    transferStatus: "document_review",
    auctionEnabled: false,
    auctionBiddingDays: null,
    originalPricePhp: 5200000,
    equityPaidPhp: 880000,
    remainingBalancePhp: 4320000,
    monthlyAmortizationPhp: 28000,
    cashOutPricePhp: 420000,
    remainingAmortizationMonths: 216,
    availableInPagIbig: false,
    availableInHouseLoan: true,
    documentAssistanceRequested: true,
    documentAssistanceStatus: "collecting_documents",
    documentAssistanceNotes: "Pending developer certification and updated statement.",
    ownerKey: "sellerA",
    createdDaysAgo: 0,
  },
];

const photoPool = [
  "/placeholders/listing-hero-v2.svg",
  "/placeholders/listing-side-v2.svg",
  "/placeholders/listing-thumb-v2.svg",
];

async function run() {
  const client = await pool.connect();
  const seedPassword = "SeedPass123!";
  const passwordHash = await hashPassword(seedPassword);

  try {
    await client.query("begin");

    const userIds = {} as Record<keyof typeof seedUsers, string>;
    for (const key of Object.keys(seedUsers) as Array<keyof typeof seedUsers>) {
      const user = seedUsers[key];
      const userResult = await client.query(
        `
        insert into users (email, password_hash, auth_provider, role)
        values ($1, $2, 'email', $3::user_role)
        on conflict (email) do update
        set
          password_hash = excluded.password_hash,
          auth_provider = 'email',
          role = excluded.role,
          updated_at = now()
        returning id
      `,
        [user.email, passwordHash, user.role],
      );

      const userId = userResult.rows[0].id as string;
      userIds[key] = userId;

      await client.query(
        `
        insert into profiles (
          user_id,
          full_name,
          phone,
          city,
          verification_status,
          verification_badge_shown
        )
        values ($1, $2, $3, $4, $5::verification_status, $6)
        on conflict (user_id) do update
        set
          full_name = excluded.full_name,
          phone = excluded.phone,
          city = excluded.city,
          verification_status = excluded.verification_status,
          verification_badge_shown = excluded.verification_badge_shown,
          updated_at = now()
      `,
        [userId, user.fullName, user.phone, user.city, user.verificationStatus, user.verificationStatus === "verified"],
      );
    }

    await client.query("delete from listings where title like 'Seed Pasalo %'");

    const listingIds: string[] = [];
    for (let index = 0; index < seedListings.length; index += 1) {
      const seed = seedListings[index];
      const ownerUserId = userIds[seed.ownerKey];
      const now = Date.now();
      const createdAt = new Date(now - seed.createdDaysAgo * 24 * 60 * 60 * 1000);
      const updatedAt = createdAt;
      const lastConfirmedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
      const auctionStartAt = seed.auctionEnabled ? createdAt : null;
      const auctionEndAt =
        seed.auctionEnabled && seed.auctionBiddingDays
          ? new Date(createdAt.getTime() + seed.auctionBiddingDays * 24 * 60 * 60 * 1000)
          : null;
      const estimatedTotalCost = seed.cashOutPricePhp + seed.remainingBalancePhp;

      const listingResult = await client.query(
        `
        insert into listings (
          owner_user_id,
          property_type,
          project_name,
          developer_name,
          location_city,
          location_province,
          floor_area_sqm,
          unit_number,
          turnover_date,
          title,
          description,
          status,
          is_featured,
          last_confirmed_at,
          readiness_score,
          transaction_status,
          transfer_status,
          auction_enabled,
          auction_start_at,
          auction_end_at,
          auction_bidding_days,
          document_assistance_requested,
          document_assistance_status,
          document_assistance_notes,
          document_assistance_requested_at,
          document_assistance_updated_at,
          created_at,
          updated_at
        )
        values (
          $1, $2::property_type, $3, $4, $5, $6, $7, $8, $9::date, $10, $11,
          $12::listing_status, $13, $14, $15, $16::listing_transaction_status,
          $17::listing_transfer_status, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
        )
        returning id
      `,
        [
          ownerUserId,
          seed.propertyType,
          seed.projectName,
          seed.developerName,
          seed.locationCity,
          seed.locationProvince,
          seed.floorAreaSqm,
          seed.unitNumber,
          seed.turnoverDate,
          seed.title,
          seed.description,
          seed.status,
          seed.isFeatured,
          lastConfirmedAt,
          seed.readinessScore,
          seed.transactionStatus,
          seed.transferStatus,
          seed.auctionEnabled,
          auctionStartAt,
          auctionEndAt,
          seed.auctionBiddingDays,
          seed.documentAssistanceRequested,
          seed.documentAssistanceStatus,
          seed.documentAssistanceNotes,
          seed.documentAssistanceRequested ? createdAt : null,
          updatedAt,
          createdAt,
          updatedAt,
        ],
      );

      const listingId = listingResult.rows[0].id as string;
      listingIds.push(listingId);

      await client.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by, changed_at)
        values ($1, null, $2::listing_status, $3, $4)
      `,
        [listingId, seed.status, ownerUserId, createdAt],
      );

      await client.query(
        `
        insert into listing_financials (
          listing_id,
          original_price_php,
          equity_paid_php,
          remaining_balance_php,
          monthly_amortization_php,
          cash_out_price_php,
          est_total_cost_php,
          remaining_amortization_months,
          available_in_pagibig,
          available_in_house_loan
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
        [
          listingId,
          seed.originalPricePhp,
          seed.equityPaidPhp,
          seed.remainingBalancePhp,
          seed.monthlyAmortizationPhp,
          seed.cashOutPricePhp,
          estimatedTotalCost,
          seed.remainingAmortizationMonths,
          seed.availableInPagIbig,
          seed.availableInHouseLoan,
        ],
      );

      for (let mediaIndex = 0; mediaIndex < photoPool.length; mediaIndex += 1) {
        await client.query(
          `
          insert into listing_media (listing_id, media_type, storage_key, is_primary, created_at)
          values ($1, 'image', $2, $3, $4)
        `,
          [listingId, photoPool[(index + mediaIndex) % photoPool.length], mediaIndex === 0, createdAt],
        );
      }

      const commissionRatePct = 3;
      const leadValidityMonths = 12;
      const paymentDueDays = 7;
      const signedName = seedUsers[seed.ownerKey].fullName;
      const attorneyName = seedUsers.attorneyA.fullName;
      const leadDefinition =
        "A platform lead means any buyer account that first inquired, requested viewing, or started conversation for this listing through the platform.";
      const commissionClause = `The seller agrees that any buyer introduced through this platform shall be considered a platform lead. If the property is sold to such buyer within ${leadValidityMonths} months from introduction, the seller agrees to pay a commission of ${commissionRatePct}% of the final selling price.`;
      const paymentClause = `If the seller enters into a sale, contract to sell, or any transfer agreement with a buyer introduced through the platform, the seller shall pay the agreed commission within ${paymentDueDays} days of the transaction.`;

      await client.query(
        `
        insert into listing_seller_agreements (
          listing_id,
          seller_user_id,
          agreement_version,
          commission_rate_pct,
          lead_validity_months,
          payment_due_days,
          lead_definition,
          commission_clause,
          payment_clause,
          signed_name,
          attorney_signed_name,
          signature_method,
          attorney_signature_method,
          accepted_at,
          signer_ip,
          signer_user_agent
        )
        values (
          $1, $2, 'seller_listing_agreement_v1', $3, $4, $5, $6, $7, $8, $9, $10, 'typed_name_checkbox',
          'typed_name_checkbox', $11, '127.0.0.1', 'seed-script'
        )
      `,
        [
          listingId,
          ownerUserId,
          commissionRatePct,
          leadValidityMonths,
          paymentDueDays,
          leadDefinition,
          commissionClause,
          paymentClause,
          signedName,
          attorneyName,
          createdAt,
        ],
      );

      await client.query(
        `
        insert into listing_verifications (
          listing_id,
          user_id,
          doc_type,
          file_key,
          ai_auth_status,
          ai_confidence,
          ai_flags,
          ai_checked_at,
          status,
          reviewed_by,
          reviewed_at,
          created_at
        )
        values ($1, $2, 'id', $3, 'pass', 0.9800, '{}'::text[], $4, 'approved', $5, $4, $4)
      `,
        [listingId, ownerUserId, "/seed/seller-id.pdf", createdAt, userIds.attorneyA],
      );

      await client.query(
        `
        insert into platform_leads (
          listing_id,
          buyer_user_id,
          buyer_name,
          buyer_phone,
          buyer_email,
          source,
          first_inquiry_at,
          last_activity_at
        )
        values ($1, $2, $3, $4, $5, 'platform', $6, $6)
        on conflict (listing_id, buyer_user_id) do update
        set
          last_activity_at = excluded.last_activity_at,
          buyer_name = excluded.buyer_name,
          buyer_phone = excluded.buyer_phone,
          buyer_email = excluded.buyer_email,
          updated_at = now()
      `,
        [
          listingId,
          userIds.buyerA,
          seedUsers.buyerA.fullName,
          seedUsers.buyerA.phone,
          seedUsers.buyerA.email,
          createdAt,
        ],
      );
    }

    if (listingIds.length) {
      const conversationSeeds: Array<{
        listingId: string;
        buyerUserId: string;
        sellerUserId: string;
        createdHoursAgo: number;
        messages: Array<{
          sender: "buyer" | "seller";
          body: string;
          minutesAfterStart: number;
          readMinutesAfterStart?: number;
        }>;
      }> = [
        {
          listingId: listingIds[0],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 5,
          messages: [
            {
              sender: "buyer",
              body: "Hi! Is this listing still available?",
              minutesAfterStart: 5,
              readMinutesAfterStart: 14,
            },
            {
              sender: "seller",
              body: "Yes, still available. We can schedule an on-site viewing this week.",
              minutesAfterStart: 18,
              readMinutesAfterStart: 26,
            },
            {
              sender: "buyer",
              body: "Great. Could you share if the developer statement of account is updated this month?",
              minutesAfterStart: 29,
              readMinutesAfterStart: 38,
            },
            {
              sender: "seller",
              body: "It is updated. I uploaded the latest SOA and reservation docs for verification.",
              minutesAfterStart: 42,
            },
          ],
        },
        {
          listingId: listingIds[3],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.sellerB,
          createdHoursAgo: 28,
          messages: [
            {
              sender: "buyer",
              body: "Hello, I’m interested in this Laguna unit. Is transfer processing already started?",
              minutesAfterStart: 3,
              readMinutesAfterStart: 12,
            },
            {
              sender: "seller",
              body: "Transfer is not started yet, but all seller documents are prepared for review.",
              minutesAfterStart: 20,
              readMinutesAfterStart: 28,
            },
            {
              sender: "buyer",
              body: "Nice. Can we arrange viewing on Saturday afternoon?",
              minutesAfterStart: 36,
            },
          ],
        },
        {
          listingId: listingIds[1],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.agentA,
          createdHoursAgo: 52,
          messages: [
            {
              sender: "buyer",
              body: "Hi agent, I’m comparing this BGC studio against another option in Makati.",
              minutesAfterStart: 8,
              readMinutesAfterStart: 16,
            },
            {
              sender: "seller",
              body: "Happy to help. This one has flexible turnover and complete verification checks.",
              minutesAfterStart: 17,
              readMinutesAfterStart: 25,
            },
            {
              sender: "buyer",
              body: "Can you send the floor plan and latest timeline for developer approval?",
              minutesAfterStart: 33,
              readMinutesAfterStart: 45,
            },
            {
              sender: "seller",
              body: "Sure. I’ll upload both in the listing files and confirm once ready.",
              minutesAfterStart: 47,
              readMinutesAfterStart: 60,
            },
            {
              sender: "buyer",
              body: "Thanks, I’ll review and get back with my preferred viewing time.",
              minutesAfterStart: 70,
            },
          ],
        },
        {
          listingId: listingIds[2],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 10,
          messages: [
            {
              sender: "buyer",
              body: "Hi! I’m checking if this Cavite house listing is still open for new buyers.",
              minutesAfterStart: 4,
              readMinutesAfterStart: 10,
            },
            {
              sender: "seller",
              body: "Yes, still open. Transfer status is currently in developer approval.",
              minutesAfterStart: 11,
              readMinutesAfterStart: 18,
            },
            {
              sender: "buyer",
              body: "Understood. Do you allow a weekday viewing after office hours?",
              minutesAfterStart: 20,
              readMinutesAfterStart: 28,
            },
            {
              sender: "seller",
              body: "Yes. Please send your preferred schedule via Request Viewing so we can lock the slot.",
              minutesAfterStart: 31,
            },
            {
              sender: "buyer",
              body: "Perfect. I’ll submit a viewing request for Thursday evening.",
              minutesAfterStart: 36,
            },
          ],
        },
        {
          listingId: listingIds[4],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.agentA,
          createdHoursAgo: 18,
          messages: [
            {
              sender: "buyer",
              body: "Good day. Is this lot listing currently under active bidding?",
              minutesAfterStart: 2,
              readMinutesAfterStart: 7,
            },
            {
              sender: "seller",
              body: "Yes, auction is live. You can still submit your interest and we’ll keep you updated.",
              minutesAfterStart: 9,
              readMinutesAfterStart: 13,
            },
            {
              sender: "buyer",
              body: "Noted. Please include me in updates if top bid changes.",
              minutesAfterStart: 15,
            },
          ],
        },
        {
          listingId: listingIds[5],
          buyerUserId: userIds.buyerA,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 72,
          messages: [
            {
              sender: "buyer",
              body: "Hi, I saw this Makati condo marked as pending review. Any update on publish status?",
              minutesAfterStart: 7,
              readMinutesAfterStart: 20,
            },
            {
              sender: "seller",
              body: "Admin review is in progress. I’ll notify you once it is fully live.",
              minutesAfterStart: 23,
              readMinutesAfterStart: 31,
            },
            {
              sender: "buyer",
              body: "Thanks. I’m mainly checking monthly terms and turnover schedule.",
              minutesAfterStart: 32,
              readMinutesAfterStart: 41,
            },
            {
              sender: "seller",
              body: "Sure. I can share those details here as soon as the listing clears review.",
              minutesAfterStart: 45,
            },
          ],
        },
        {
          listingId: listingIds[0],
          buyerUserId: userIds.buyerB,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 14,
          messages: [
            {
              sender: "buyer",
              body: "Hello, I’m comparing this Cloverleaf unit with another one nearby. Is the cash out firm?",
              minutesAfterStart: 6,
              readMinutesAfterStart: 17,
            },
            {
              sender: "seller",
              body: "There is slight room for discussion after viewing, but the listed amount is close to target.",
              minutesAfterStart: 19,
              readMinutesAfterStart: 27,
            },
            {
              sender: "buyer",
              body: "That helps. I’m mostly looking for something with a clean transfer path and updated docs.",
              minutesAfterStart: 34,
            },
          ],
        },
        {
          listingId: listingIds[3],
          buyerUserId: userIds.buyerB,
          sellerUserId: userIds.sellerB,
          createdHoursAgo: 8,
          messages: [
            {
              sender: "buyer",
              body: "Hi seller, I like the South Residences listing. Are amenity areas already complete?",
              minutesAfterStart: 3,
              readMinutesAfterStart: 14,
            },
            {
              sender: "seller",
              body: "Most amenities are operational already. I can send updated site photos in the listing shortly.",
              minutesAfterStart: 18,
              readMinutesAfterStart: 29,
            },
            {
              sender: "buyer",
              body: "Nice. I’m free for a viewing on Friday afternoon if slots are open.",
              minutesAfterStart: 41,
            },
          ],
        },
        {
          listingId: listingIds[1],
          buyerUserId: userIds.buyerB,
          sellerUserId: userIds.agentA,
          createdHoursAgo: 22,
          messages: [
            {
              sender: "buyer",
              body: "Good evening. Can you clarify if this BGC unit is better suited for rental or end use?",
              minutesAfterStart: 5,
              readMinutesAfterStart: 13,
            },
            {
              sender: "seller",
              body: "It works for both, but most buyers ask about rental because of the business-district location.",
              minutesAfterStart: 16,
              readMinutesAfterStart: 24,
            },
            {
              sender: "buyer",
              body: "Understood. Please keep me posted if the seller updates the turnover flexibility.",
              minutesAfterStart: 33,
              readMinutesAfterStart: 42,
            },
            {
              sender: "seller",
              body: "Will do. I’ll message here once I have the revised timeline from the owner.",
              minutesAfterStart: 47,
            },
          ],
        },
        {
          listingId: listingIds[0],
          buyerUserId: userIds.dummyBuyer,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 3,
          messages: [
            {
              sender: "buyer",
              body: "Hi, I’m the demo account and I’m checking whether this listing is still accepting viewings this week.",
              minutesAfterStart: 4,
              readMinutesAfterStart: 10,
            },
            {
              sender: "seller",
              body: "Yes, still open. You can use the Request Viewing button and pick from the listed schedule slots.",
              minutesAfterStart: 12,
              readMinutesAfterStart: 18,
            },
            {
              sender: "buyer",
              body: "Perfect. I also want to confirm that the updated statement of account is already available in the listing packet.",
              minutesAfterStart: 24,
            },
          ],
        },
        {
          listingId: listingIds[2],
          buyerUserId: userIds.dummyBuyer,
          sellerUserId: userIds.sellerA,
          createdHoursAgo: 40,
          messages: [
            {
              sender: "buyer",
              body: "Hello, this is the dummy test buyer account. I’m interested in the Cavite house listing and want to compare the monthly terms.",
              minutesAfterStart: 6,
              readMinutesAfterStart: 14,
            },
            {
              sender: "seller",
              body: "Sure. The monthly amortization is reflected in the listing and the transfer status is already with developer approval.",
              minutesAfterStart: 16,
              readMinutesAfterStart: 25,
            },
          ],
        },
      ];

      for (const seedConversation of conversationSeeds) {
        const conversationCreatedAt = new Date(Date.now() - seedConversation.createdHoursAgo * 60 * 60 * 1000);
        const conversationResult = await client.query(
          `
          insert into conversations (listing_id, buyer_user_id, seller_user_id, created_at)
          values ($1, $2, $3, $4)
          returning id
        `,
          [
            seedConversation.listingId,
            seedConversation.buyerUserId,
            seedConversation.sellerUserId,
            conversationCreatedAt,
          ],
        );

        const conversationId = conversationResult.rows[0].id as string;
        for (const message of seedConversation.messages) {
          const senderUserId =
            message.sender === "buyer" ? seedConversation.buyerUserId : seedConversation.sellerUserId;
          const createdAt = new Date(conversationCreatedAt.getTime() + message.minutesAfterStart * 60 * 1000);
          const readAt =
            typeof message.readMinutesAfterStart === "number"
              ? new Date(conversationCreatedAt.getTime() + message.readMinutesAfterStart * 60 * 1000)
              : null;
          await client.query(
            `
            insert into messages (conversation_id, sender_user_id, body, created_at, read_at)
            values ($1, $2, $3, $4, $5)
          `,
            [conversationId, senderUserId, message.body, createdAt, readAt],
          );
        }
      }

      await client.query(
        `
        insert into watchlists (user_id, listing_id)
        values
          ($1, $2),
          ($1, $3),
          ($1, $4),
          ($5, $2),
          ($5, $6)
        on conflict (user_id, listing_id) do nothing
      `,
        [userIds.buyerA, listingIds[0], listingIds[1], listingIds[3], userIds.dummyBuyer, listingIds[2]],
      );
    }

    await client.query(
      `
      insert into audit_logs (actor_user_id, action, target_type, target_id, context)
      values ($1, 'seed_dummy_data', 'system', null, $2::jsonb)
    `,
      [
        userIds.attorneyA,
        JSON.stringify({
          seededAt: new Date().toISOString(),
          listingCount: seedListings.length,
          userEmails: Object.values(seedUsers).map((item) => item.email),
        }),
      ],
    );

    await client.query("commit");

    console.log("Dummy data seeded.");
    console.log(`Seed user password: ${seedPassword}`);
    for (const item of Object.values(seedUsers)) {
      console.log(`- ${item.role}: ${item.email}`);
    }
    console.log(`Listings inserted: ${seedListings.length}`);
  } catch (error) {
    await client.query("rollback");
    console.error("Failed to seed dummy data.");
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
