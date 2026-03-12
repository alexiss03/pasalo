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
  is_open_for_new_buyers: boolean;
  last_confirmed_at: string | null;
  preview_image_url?: string | null;
}

interface ListingFeed {
  items: ListingItem[];
  degraded?: boolean;
}

type BrowseFilters = {
  q?: string;
  city?: string;
  province?: string;
  developer?: string;
  type?: string;
  cashOutMax?: string;
  monthlyMax?: string;
  verifiedOnly?: string;
};

function formatPhp(amount: string | number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function normalizeFilters(raw: Record<string, string | string[] | undefined>): BrowseFilters {
  const read = (key: keyof BrowseFilters): string | undefined => {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return {
    q: read("q"),
    city: read("city"),
    province: read("province"),
    developer: read("developer"),
    type: read("type"),
    cashOutMax: read("cashOutMax"),
    monthlyMax: read("monthlyMax"),
    verifiedOnly: read("verifiedOnly"),
  };
}

function toApiPath(filters: BrowseFilters): string {
  const query = new URLSearchParams();
  query.set("page", "1");
  query.set("pageSize", "20");

  const maybeSet = (key: string, value: string | undefined) => {
    if (value && value.trim()) {
      query.set(key, value.trim());
    }
  };

  maybeSet("q", filters.q);
  maybeSet("city", filters.city);
  maybeSet("province", filters.province);
  maybeSet("developer", filters.developer);
  maybeSet("type", filters.type);
  maybeSet("cashOutMax", filters.cashOutMax);
  maybeSet("monthlyMax", filters.monthlyMax);
  if (filters.verifiedOnly === "true") {
    query.set("verifiedOnly", "true");
  }

  return `/listings?${query.toString()}`;
}

function toBrowseHref(filters: BrowseFilters): string {
  const query = new URLSearchParams();

  const maybeSet = (key: keyof BrowseFilters) => {
    const value = filters[key];
    if (value && value.trim()) {
      query.set(key, value.trim());
    }
  };

  maybeSet("q");
  maybeSet("city");
  maybeSet("province");
  maybeSet("developer");
  maybeSet("type");
  maybeSet("cashOutMax");
  maybeSet("monthlyMax");
  if (filters.verifiedOnly === "true") {
    query.set("verifiedOnly", "true");
  }

  const qs = query.toString();
  return qs ? `/?${qs}` : "/";
}

function isCategoryActive(category: BrowseFilters, filters: BrowseFilters): boolean {
  const keys: Array<keyof BrowseFilters> = [
    "type",
    "verifiedOnly",
    "q",
    "city",
    "province",
    "developer",
    "cashOutMax",
    "monthlyMax",
  ];

  for (const key of keys) {
    const categoryValue = category[key];
    const filterValue = filters[key];

    if ((categoryValue ?? "") !== (filterValue ?? "")) {
      return false;
    }
  }

  return true;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = normalizeFilters(resolvedSearchParams);

  const categories: Array<{ label: string; filters: BrowseFilters }> = [
    { label: "All", filters: {} },
    { label: "Condo", filters: { type: "condo" } },
    { label: "House & Lot", filters: { type: "house_lot" } },
    { label: "Lot Only", filters: { type: "lot_only" } },
    { label: "Verified", filters: { verifiedOnly: "true" } },
    { label: "Metro Manila", filters: { province: "Metro Manila" } },
    { label: "Laguna", filters: { province: "Laguna" } },
    { label: "Cavite", filters: { province: "Cavite" } },
  ];

  let data: ListingFeed = { items: [] };
  let error: string | null = null;

  try {
    data = await apiFetch<ListingFeed>(toApiPath(filters));
  } catch (err) {
    error = err instanceof Error ? err.message : "Unable to load listings";
  }

  const heroListing = data.items[0];
  const sideTopListing = data.items[1] ?? heroListing;
  const sideBottomListing = data.items[2] ?? sideTopListing ?? heroListing;

  return (
    <section className="market-shell">
      <section className="peg-stage">
        <article className="peg-main-card">
          <div className="peg-main-copy">
            <div>
              <p className="peg-eyebrow">Verified Pasalo Listings</p>
              <h1>Find a place you will call home</h1>
            </div>
            <div className="peg-hero-sidecopy">
              <p>Launch scope: Metro Manila, Laguna, Cavite. Listings are sorted by verification and freshness.</p>
              {heroListing && (
                <Link className="hero-mini-deal" href={`/listings/${heroListing.id}`}>
                  <span>{heroListing.project_name}</span>
                  <strong>{formatPhp(heroListing.cash_out_price_php)}</strong>
                </Link>
              )}
            </div>
          </div>

          {heroListing ? (
            <Link className="peg-main-image-wrap" href={`/listings/${heroListing.id}`}>
              {heroListing.preview_image_url ? (
                <img alt={heroListing.title} className="peg-main-image" loading="lazy" src={heroListing.preview_image_url} />
              ) : (
                <div className="peg-main-image peg-main-image-fallback">No photo yet</div>
              )}
            </Link>
          ) : (
            <div className="peg-main-image peg-main-image-fallback">No listing photo yet</div>
          )}
        </article>

        <aside className="peg-side-rail">
          {sideTopListing && (
            <Link className="peg-side-card" href={`/listings/${sideTopListing.id}`}>
              {sideTopListing.preview_image_url ? (
                <img alt={sideTopListing.title} className="peg-side-card-image" loading="lazy" src={sideTopListing.preview_image_url} />
              ) : (
                <div className="peg-side-card-image peg-main-image-fallback">No photo yet</div>
              )}
              <div className="peg-side-card-meta">
                <p>{sideTopListing.project_name}</p>
                <h3>{sideTopListing.title}</h3>
                <strong>{formatPhp(sideTopListing.cash_out_price_php)}</strong>
              </div>
            </Link>
          )}
          <p className="peg-side-note">
            Virtual tours, verified documents, and guided transfer steps so buyers can move with confidence.
          </p>
          {sideBottomListing && (
            <Link className="peg-side-photo" href={`/listings/${sideBottomListing.id}`}>
              {sideBottomListing.preview_image_url ? (
                <img alt={sideBottomListing.title} className="peg-side-photo-img" loading="lazy" src={sideBottomListing.preview_image_url} />
              ) : (
                <div className="peg-side-photo-img peg-main-image-fallback">No photo yet</div>
              )}
            </Link>
          )}
        </aside>
      </section>

      <section className="peg-filter-studio">
        <div className="peg-filter-head">
          <h2>We help you find the home that will be yours</h2>
          <p>
            Compare cash-out, monthly dues, and verified inventory in one place.
          </p>
        </div>

        <div className="peg-tabs-row">
          {categories.map((category) => (
            <Link
              className={`peg-tab ${isCategoryActive(category.filters, filters) ? "peg-tab-active" : ""}`}
              href={toBrowseHref(category.filters)}
              key={category.label}
            >
              {category.label}
            </Link>
          ))}
        </div>

        <form className="peg-filter-form" method="GET">
          <div className="peg-filter-grid">
            <input defaultValue={filters.q ?? ""} name="q" placeholder="Search title, project, developer, city..." />

            <select defaultValue={filters.type ?? ""} name="type">
              <option value="">All property types</option>
              <option value="condo">Condo</option>
              <option value="house_lot">House & lot</option>
              <option value="lot_only">Lot only</option>
            </select>

            <input defaultValue={filters.city ?? ""} name="city" placeholder="City" />
            <input defaultValue={filters.province ?? ""} name="province" placeholder="Province" />
            <input defaultValue={filters.developer ?? ""} name="developer" placeholder="Developer" />
            <input defaultValue={filters.cashOutMax ?? ""} min={0} name="cashOutMax" placeholder="Max cash out (PHP)" type="number" />
            <input defaultValue={filters.monthlyMax ?? ""} min={0} name="monthlyMax" placeholder="Max monthly (PHP)" type="number" />
          </div>

          <div className="peg-filter-footer">
            <label className="inline-check">
              <input defaultChecked={filters.verifiedOnly === "true"} name="verifiedOnly" type="checkbox" value="true" />
              Verified only
            </label>

            <div className="filter-action-buttons">
              <Link className="ghost-button" href="/">
                Clear filters
              </Link>
              <button className="primary" type="submit">
                Show properties
              </button>
            </div>
          </div>
        </form>
      </section>

      {error && <p className="error">{error}</p>}
      {!error && data.degraded && (
        <p className="small">Listing database is currently unavailable. Showing an empty fallback feed.</p>
      )}

      <section className="peg-results">
        <div className="peg-results-head">
          <h3>Fresh inventory</h3>
          <p className="small">Sorted by verification and freshness.</p>
        </div>

        <div className="grid grid-2">
        {data.items.map((item) => (
          <Link className="listing-card-link" href={`/listings/${item.id}`} key={item.id}>
            <article className="card listing-card peg-listing-card">
              {item.preview_image_url ? (
                <img alt={item.title} className="listing-thumbnail" loading="lazy" src={item.preview_image_url} />
              ) : (
                <div className="listing-thumbnail listing-thumbnail-fallback">No photo yet</div>
              )}
              <h3 className="peg-listing-title">{item.title}</h3>
              <p className="small peg-listing-location">
                {item.project_name} • {item.location_city}, {item.location_province}
              </p>
              <div className="peg-listing-financials">
                <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
                <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
              </div>
              <div className="peg-listing-badges">
                <span className="badge">{item.property_type}</span>
                {item.is_verified && <span className="badge">Verified Pasalo</span>}
                <span className="badge">Readiness {item.readiness_score}</span>
                {!item.is_open_for_new_buyers && <span className="badge">Locked</span>}
              </div>
            </article>
          </Link>
        ))}
        </div>
      </section>

      {!data.items.length && !error && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            No listings matched your current search/filter. Try resetting filters.
          </p>
        </div>
      )}
    </section>
  );
}
