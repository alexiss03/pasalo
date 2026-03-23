import Link from "next/link";
import { apiFetch } from "../../../lib/api";

type ListingItem = {
  id: string;
  title: string;
  project_name: string;
  location_city: string;
  location_province: string;
  property_type: string;
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

function toProjectSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toTitleFromSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPhp(amount: string | number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatTag(value: string): string {
  const clean = value.replaceAll("_", " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : value;
}

const fallbackImage = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const slug = resolvedParams.slug;
  const searchNameRaw = resolvedSearch.name;
  const searchName = Array.isArray(searchNameRaw) ? searchNameRaw[0] : searchNameRaw;

  let data: ListingFeed = { items: [] };
  try {
    data = await apiFetch<ListingFeed>("/listings?page=1&pageSize=200");
  } catch {
    data = { items: [] };
  }

  const projectListings = data.items.filter((item) => {
    if (searchName && item.project_name.toLowerCase() === searchName.toLowerCase()) {
      return true;
    }
    return toProjectSlug(item.project_name) === slug;
  });

  const currentListings = projectListings.filter((item) => item.is_open_for_new_buyers);
  const displayListings = currentListings.length ? currentListings : projectListings;
  const projectName = searchName || projectListings[0]?.project_name || toTitleFromSlug(slug);
  const locationSummary = [...new Set(projectListings.map((item) => `${item.location_city}, ${item.location_province}`))]
    .slice(0, 3)
    .join(" • ");

  return (
    <section className="market-shell">
      <section className="market-section">
        <p style={{ marginTop: 0 }}>
          <Link className="nav-chip" href="/projects">
            Projects
          </Link>
        </p>
        <h1 style={{ marginBottom: 8 }}>{projectName}</h1>
        <p className="small" style={{ marginTop: 0 }}>
          {locationSummary || "Project location pending"} • {displayListings.length} current listing
          {displayListings.length === 1 ? "" : "s"}
        </p>
      </section>

      <section className="market-section">
        <div className="section-grid">
          {displayListings.map((item) => (
            <Link className="listing-card-link" href={`/listings/${item.id}`} key={item.id}>
              <article className="card listing-card peg-listing-card editorial-listing-card">
                <img
                  alt={item.title}
                  className="listing-thumbnail"
                  loading="lazy"
                  src={item.preview_image_url || fallbackImage}
                />
                <div className="editorial-listing-body">
                  <div className="editorial-listing-head">
                    <p className="editorial-listing-type">{formatTag(item.property_type)}</p>
                    <span className="editorial-listing-arrow">↗</span>
                  </div>
                  <h3 className="peg-listing-title">{item.title}</h3>
                  <p className="small peg-listing-location">
                    {item.location_city}, {item.location_province}
                  </p>
                  <div className="peg-listing-financials">
                    <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
                    <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
                  </div>
                  <div className="peg-listing-badges">
                    {item.is_verified && <span className="badge">Verified Pasalo</span>}
                    {!item.is_open_for_new_buyers && <span className="badge">Not open for new buyers</span>}
                    {item.transaction_status === "auctioned" && <span className="badge">Auction</span>}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
        {!displayListings.length && (
          <p className="section-empty">No current listings under this project yet.</p>
        )}
      </section>
    </section>
  );
}
