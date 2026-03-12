import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import { StartChatButton } from "../../../components/StartChatButton";

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
  readiness_score: number;
  seller_name: string;
  verification_status: string;
  original_price_php: string;
  equity_paid_php: string;
  remaining_balance_php: string;
  monthly_amortization_php: string;
  cash_out_price_php: string;
  est_total_cost_php: string;
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
          Back to Browse
        </Link>
      </section>
    );
  }

  return (
    <section className="grid" style={{ gap: 18 }}>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <Link className="nav-chip" href="/">
            Back to Browse
          </Link>
        </p>
        <h1 style={{ marginBottom: 8 }}>{listing.title}</h1>
        <p className="small" style={{ marginTop: 0 }}>
          {listing.project_name} • {listing.location_city}, {listing.location_province}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <span className="badge">{listing.property_type}</span>
          {listing.verification_status === "verified" && <span className="badge">Verified Pasalo</span>}
          <span className="badge">Readiness {listing.readiness_score}</span>
          <span className="badge">Status {listing.status}</span>
          {!listing.is_open_for_new_buyers && <span className="badge">Not Open To New Buyers</span>}
        </div>
      </div>

      <div className="card grid grid-2">
        <div>
          <h3 style={{ marginTop: 0 }}>Financial Breakdown</h3>
          <p>Cash out: {formatPhp(listing.cash_out_price_php)}</p>
          <p>Monthly: {formatPhp(listing.monthly_amortization_php)}</p>
          <p>Original price: {formatPhp(listing.original_price_php)}</p>
          <p>Equity paid: {formatPhp(listing.equity_paid_php)}</p>
          <p>Remaining balance: {formatPhp(listing.remaining_balance_php)}</p>
          <p>Total estimated cost: {formatPhp(listing.est_total_cost_php)}</p>
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Property Details</h3>
          <p>Developer: {listing.developer_name}</p>
          <p>Floor area: {listing.floor_area_sqm} sqm</p>
          <p>Unit number: {listing.unit_number ?? "N/A"}</p>
          <p>Turnover date: {formatDateOnly(listing.turnover_date)}</p>
          <p>Seller: {listing.seller_name}</p>
        </div>
      </div>

      {listing.media && listing.media.some((item) => item.media_type === "image") && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Photos</h3>
          <div className="photo-grid">
            {listing.media
              .filter((item) => item.media_type === "image")
              .map((item) => (
                <img alt={listing.title} key={item.id} loading="lazy" src={item.storage_key} />
              ))}
          </div>
        </div>
      )}

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
