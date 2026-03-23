import Link from "next/link";
import { apiFetch } from "../../lib/api";

type ListingItem = {
  id: string;
  title: string;
  location_city: string;
  location_province: string;
  property_type: string;
  project_name: string;
  cash_out_price_php: string;
  monthly_amortization_php: string;
  is_verified: boolean;
  is_open_for_new_buyers: boolean;
  transaction_status: string;
  preview_image_url?: string | null;
};

type ListingFeed = {
  items: ListingItem[];
};

const fallbackApartmentImage =
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=80";

function formatPhp(amount: string | number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatTag(value: string): string {
  const label = value.replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function ApartmentsPage() {
  let data: ListingFeed = { items: [] };

  try {
    data = await apiFetch<ListingFeed>("/listings?page=1&pageSize=24&type=condo&city=Quezon%20City");
  } catch {
    data = { items: [] };
  }

  const listings = data.items.filter((item) => item.is_open_for_new_buyers);

  return (
    <section className="apartments-shell">
      <section className="market-section apartments-hero">
        <p className="apartments-eyebrow">Apartments</p>
        <h1>Stylish City Apartments in Quezon City</h1>
        <p className="apartments-copy">
          Featured: QC Condo Pasalo - Avida Cloverleaf 1BR. Explore urban apartments with easier transfer terms and
          practical monthly dues.
        </p>
        <div className="apartments-actions">
          <Link className="primary" href="/?type=condo&city=Quezon%20City">
            Browse all QC condos
          </Link>
          <Link className="ghost-button" href="/">
            Back to home
          </Link>
        </div>
      </section>

      <section className="market-section">
        <div className="peg-results-head">
          <h3>Quezon City Condo Listings</h3>
        </div>
        {!!listings.length && (
          <div className="section-grid">
            {listings.map((item) => (
              <Link className="listing-card-link" href={`/listings/${item.id}`} key={item.id}>
                <article className="card listing-card peg-listing-card editorial-listing-card">
                  <img
                    alt={item.title}
                    className="listing-thumbnail"
                    loading="lazy"
                    src={item.preview_image_url || fallbackApartmentImage}
                  />
                  <div className="editorial-listing-body">
                    <div className="editorial-listing-head">
                      <p className="editorial-listing-type">{formatTag(item.property_type)}</p>
                      <span className="editorial-listing-arrow">↗</span>
                    </div>
                    <h3 className="peg-listing-title">{item.title}</h3>
                    <p className="small peg-listing-location">
                      {item.project_name} • {item.location_city}, {item.location_province}
                    </p>
                    <div className="peg-listing-financials">
                      <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
                      <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
                    </div>
                    <div className="peg-listing-badges">
                      {item.is_verified && <span className="badge">Verified Pasalo</span>}
                      {item.transaction_status === "auctioned" && <span className="badge">Auction</span>}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
        {!listings.length && (
          <p className="section-empty">No open Quezon City condo listings yet. Check back later for new inventory.</p>
        )}
      </section>
    </section>
  );
}
