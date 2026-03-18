import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { StartChatButton } from "../../../components/StartChatButton";
import { ListingPhotoCarousel } from "../../../components/ListingPhotoCarousel";
import { FavoriteToggleButton } from "../../../components/FavoriteToggleButton";

interface ListingMedia {
  id: string;
  media_type: "image" | "file";
  storage_key: string;
  is_primary: boolean;
}

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  property_type: string;
  project_name: string;
  developer_name: string;
  location_city: string;
  location_province: string;
  floor_area_sqm: string;
  unit_number: string | null;
  turnover_date: string | null;
  status: string;
  is_open_for_new_buyers: boolean;
  seller_name: string;
  verification_status: string;
  original_price_php: string;
  equity_paid_php: string;
  remaining_balance_php: string;
  monthly_amortization_php: string;
  cash_out_price_php: string;
  est_total_cost_php: string;
  remaining_amortization_months: number | string;
  available_in_pagibig: boolean;
  available_in_house_loan: boolean;
  media?: ListingMedia[];
}

function formatPhp(amount: string | number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDateOnly(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const datePart = value.split("T")[0];
  if (!datePart) {
    return "N/A";
  }

  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    return datePart;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatLoanAvailability(listing: ListingDetail): string {
  const options: string[] = [];
  if (listing.available_in_pagibig) {
    options.push("Pag-IBIG");
  }
  if (listing.available_in_house_loan) {
    options.push("In-house loan");
  }

  return options.length ? options.join(", ") : "N/A";
}

function formatTagLabel(value: string): string {
  const clean = value.replaceAll("_", " ").trim();
  if (!clean) {
    return value;
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let listing: ListingDetail | null = null;
  let error: string | null = null;

  try {
    listing = await apiFetch<ListingDetail>(`/listings/${id}`);
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load listing";
  }

  if (!listing) {
    return (
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Listing unavailable</h1>
        <p className="error">{error ?? "This listing could not be loaded."}</p>
        <Link className="nav-chip" href="/">
          Browse
        </Link>
      </section>
    );
  }

  const photos = (listing.media ?? [])
    .filter((item) => item.media_type === "image")
    .map((item) => ({
      id: item.id,
      src: item.storage_key,
      isPrimary: item.is_primary,
    }));

  return (
    <section className="grid" style={{ gap: 18 }}>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <Link className="nav-chip" href="/">
            Browse
          </Link>
        </p>
        <h1 style={{ marginBottom: 8 }}>{listing.title}</h1>
        <p className="small" style={{ marginTop: 0 }}>
          {listing.project_name} • {listing.location_city}, {listing.location_province}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span className="badge">{formatTagLabel(listing.property_type)}</span>
          {listing.verification_status === "verified" && <span className="badge">Verified Pasalo</span>}
          <span className="badge">Status {formatTagLabel(listing.status)}</span>
        </div>
        <div style={{ marginTop: 12 }}>
          <FavoriteToggleButton listingId={listing.id} />
        </div>
      </div>

      {photos.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Photos</h3>
          <ListingPhotoCarousel photos={photos} title={listing.title} />
        </div>
      )}

      <div className="card grid grid-2">
        <div className="detail-section">
          <h3 style={{ marginTop: 0 }}>Financial Breakdown</h3>
          <div className="detail-list">
            <p className="detail-row">
              <span>Cash out:</span>
              <strong>{formatPhp(listing.cash_out_price_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Monthly:</span>
              <strong>{formatPhp(listing.monthly_amortization_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Original price:</span>
              <strong>{formatPhp(listing.original_price_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Equity paid:</span>
              <strong>{formatPhp(listing.equity_paid_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Remaining balance:</span>
              <strong>{formatPhp(listing.remaining_balance_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Total estimated cost:</span>
              <strong>{formatPhp(listing.est_total_cost_php)}</strong>
            </p>
            <p className="detail-row">
              <span>Remaining months:</span>
              <strong>{Number(listing.remaining_amortization_months)} months</strong>
            </p>
            <p className="detail-row">
              <span>Loan availability:</span>
              <strong>{formatLoanAvailability(listing)}</strong>
            </p>
          </div>
        </div>

        <div className="detail-section">
          <h3 style={{ marginTop: 0 }}>Property Details</h3>
          <div className="detail-list">
            <p className="detail-row">
              <span>Developer:</span>
              <strong>{listing.developer_name}</strong>
            </p>
            <p className="detail-row">
              <span>Floor area:</span>
              <strong>{listing.floor_area_sqm} sqm</strong>
            </p>
            <p className="detail-row">
              <span>Unit number:</span>
              <strong>{listing.unit_number ?? "N/A"}</strong>
            </p>
            <p className="detail-row">
              <span>Turnover date:</span>
              <strong>{formatDateOnly(listing.turnover_date)}</strong>
            </p>
            <p className="detail-row">
              <span>Seller:</span>
              <strong>{listing.seller_name}</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Description</h3>
        <p style={{ marginBottom: 0 }}>{listing.description}</p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Chat With Seller</h3>
        <p className="small">
          Payment terms are blocked in chat. Use the in-app payment section after starting a conversation.
        </p>
        <StartChatButton
          listingId={listing.id}
          isOpenForNewBuyers={listing.is_open_for_new_buyers}
        />
      </div>
    </section>
  );
}
