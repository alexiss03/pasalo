import { apiFetch } from "../lib/api";
import Link from "next/link";

interface ListingItem {
  id: string;
  title: string;
  location_city: string;
  location_province: string;
  property_type: string;
  project_name: string;
  cash_out_price_php: string;
  monthly_amortization_php: string;
  readiness_score: number;
  is_verified: boolean;
  transaction_status: string;
  transfer_status: string;
  is_open_for_new_buyers: boolean;
  last_confirmed_at: string | null;
  preview_image_url?: string | null;
}

interface ListingFeed {
  items: ListingItem[];
  degraded?: boolean;
}

function formatPhp(amount: string | number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function HomePage() {
  let data: ListingFeed = { items: [] };
  let error: string | null = null;

  try {
    data = await apiFetch<ListingFeed>("/listings?page=1&pageSize=20");
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load listings";
  }

  return (
    <section className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Verified Pasalo Listings</h1>
        <p className="small">
          Launch scope: Metro Manila, Laguna, Cavite. Listings are sorted by verification and freshness.
        </p>
        {error && <p className="error">{error}</p>}
        {!error && data.degraded && (
          <p className="small">Listing database is currently unavailable. Showing an empty fallback feed.</p>
        )}
      </div>

      <div className="grid grid-2">
        {data.items.map((item) => (
          <Link className="listing-card-link" href={`/listings/${item.id}`} key={item.id}>
            <article className="card listing-card">
              {item.preview_image_url ? (
                <img
                  alt={item.title}
                  className="listing-thumbnail"
                  loading="lazy"
                  src={item.preview_image_url}
                />
              ) : (
                <div className="listing-thumbnail listing-thumbnail-fallback">No photo yet</div>
              )}
              <h3 style={{ marginTop: 0 }}>{item.title}</h3>
              <p className="small" style={{ marginTop: -6 }}>
                {item.project_name} • {item.location_city}, {item.location_province}
              </p>
              <div className="grid" style={{ gap: 4 }}>
                <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
                <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span className="badge">{item.property_type}</span>
                {item.is_verified && <span className="badge">Verified Pasalo</span>}
                <span className="badge">Readiness {item.readiness_score}</span>
                <span className="badge">Deal {humanize(item.transaction_status)}</span>
                <span className="badge">Transfer {humanize(item.transfer_status)}</span>
                {!item.is_open_for_new_buyers && <span className="badge">Locked</span>}
              </div>
            </article>
          </Link>
        ))}
      </div>

      {!data.items.length && !error && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            No live listings yet. Create one from the Create Listing page.
          </p>
        </div>
      )}
    </section>
  );
}
