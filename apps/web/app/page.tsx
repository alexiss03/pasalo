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
  is_verified: boolean;
  is_open_for_new_buyers: boolean;
  transaction_status: string;
  auction_enabled: boolean;
  auction_end_at: string | null;
  created_at: string;
  is_featured: boolean;
  last_confirmed_at: string | null;
  preview_image_url?: string | null;
}

interface ListingFeed {
  items: ListingItem[];
  degraded?: boolean;
}

const fallbackImages = {
  hero:
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=80",
  thumb:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
};

const samplePhotoPool = [
  "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600566752227-8f3bce9e1a5f?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=80",
];

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

function formatTagLabel(value: string): string {
  const clean = value.replaceAll("_", " ").trim();
  if (!clean) {
    return value;
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
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

function stringHash(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveListingImage(item: ListingItem, variant: "hero" | "thumb"): string {
  const source = item.preview_image_url;
  if (source && !source.startsWith("/placeholders/")) {
    return source;
  }

  const poolIndex = stringHash(`${item.id}-${variant}`) % samplePhotoPool.length;
  if (variant === "hero") {
    return samplePhotoPool[poolIndex] ?? fallbackImages.hero;
  }

  return samplePhotoPool[poolIndex] ?? fallbackImages.thumb;
}

const testimonials = [
  {
    quote:
      "We closed our condo pasalo in under three weeks because buyers immediately understood the real cash-out and monthly terms.",
    name: "Rizky",
    role: "First-time Homebuyer",
  },
  {
    quote:
      "The verified listing process filtered unserious inquiries. We only handled buyers that were ready to proceed with transfer steps.",
    name: "Andrea",
    role: "Unit Seller",
  },
  {
    quote:
      "Compared to scattered group posts, this gave us one clean place to compare projects, turnover windows, and total cost.",
    name: "Miguel",
    role: "Property Investor",
  },
];

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
  let discoveryData: ListingFeed = { items: [] };
  let degraded = false;

  try {
    data = await apiFetch<ListingFeed>(toApiPath(filters));
  } catch {
    degraded = true;
  }
  try {
    discoveryData = await apiFetch<ListingFeed>("/listings?page=1&pageSize=20");
  } catch {
    degraded = true;
  }
  if (!discoveryData.items.length) {
    discoveryData = data;
  }

  const now = Date.now();
  const toTimestamp = (value: string | null | undefined): number => {
    if (!value) {
      return 0;
    }
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const openItems = data.items.filter((item) => item.is_open_for_new_buyers);
  const displayItems = openItems.length ? openItems : data.items;

  const sectionSource = (() => {
    const source = discoveryData.items.length ? discoveryData.items : data.items;
    const openSource = source.filter((item) => item.is_open_for_new_buyers);
    return openSource.length ? openSource : source;
  })();

  const topListings = [...sectionSource]
    .sort((a, b) => {
      if (a.is_featured !== b.is_featured) {
        return Number(b.is_featured) - Number(a.is_featured);
      }
      return toTimestamp(b.last_confirmed_at ?? b.created_at) - toTimestamp(a.last_confirmed_at ?? a.created_at);
    })
    .slice(0, 4);

  const newestListings = [...sectionSource]
    .sort((a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at))
    .slice(0, 4);

  const ongoingBiddings = [...sectionSource]
    .filter((item) => {
      if (item.transaction_status !== "auctioned" || !item.auction_enabled) {
        return false;
      }
      const endAt = toTimestamp(item.auction_end_at);
      return endAt === 0 || endAt > now;
    })
    .sort((a, b) => toTimestamp(a.auction_end_at) - toTimestamp(b.auction_end_at))
    .slice(0, 4);

  const heroListing = displayItems[0];
  const projectSpotlights = [...new Map(sectionSource.map((item) => [item.project_name || item.id, item])).values()]
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      projectName: item.project_name,
      location: `${item.location_city}, ${item.location_province}`,
      propertyType: formatTagLabel(item.property_type),
      href: `/listings/${item.id}`,
    }));

  const fallbackProjects = [
    { projectName: "Metro Manila Core Projects", location: "Quezon City, Metro Manila", propertyType: "Condo" },
    { projectName: "South Growth Corridor", location: "Santa Rosa, Laguna", propertyType: "House & lot" },
    { projectName: "Cavite Expansion Lots", location: "Dasmarinas, Cavite", propertyType: "Lot only" },
  ];

  const partnerRows = [
    {
      name: "Licensed Broker Network",
      detail: "Broker partners supporting PRC-compliant sales handling and deal closure.",
    },
    {
      name: "Legal Documentation Partners",
      detail: "Attorneys and documentation teams for transfer packets and contract review.",
    },
    {
      name: "Financing Partners",
      detail: "Mortgage and installment providers for in-house and Pag-IBIG-assisted pathways.",
    },
  ];

  const categoryHighlights = [
    {
      label: "Apartments",
      title: "Stylish City Apartments",
      copy: "Explore urban apartments with easier transfer terms and practical monthly dues.",
      href: toBrowseHref({ ...filters, type: "condo" }),
    },
    {
      label: "Commercial",
      title: "Prime Commercial Spaces",
      copy: "Find office and retail units for investors and business owners looking for pasalo exits.",
      href: toBrowseHref({ ...filters, q: "commercial" }),
    },
    {
      label: "Land",
      title: "Residential & Investment Land",
      copy: "Discover lot-only pasalo opportunities for future homes and long-term land plays.",
      href: toBrowseHref({ ...filters, type: "lot_only" }),
      accent: true,
    },
  ];

  const renderEditorialCard = (item: ListingItem, keyPrefix: string) => (
    <Link className="listing-card-link" href={`/listings/${item.id}`} key={`${keyPrefix}-${item.id}`}>
      <article className="card listing-card peg-listing-card editorial-listing-card">
        <img
          alt={item.title}
          className="listing-thumbnail"
          loading="lazy"
          src={resolveListingImage(item, "thumb")}
        />
        <div className="editorial-listing-body">
          <div className="editorial-listing-head">
            <p className="editorial-listing-type">{formatTagLabel(item.property_type)}</p>
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
            {!item.is_open_for_new_buyers && <span className="badge">Not open for new buyers</span>}
            {item.transaction_status === "auctioned" && <span className="badge">Auction</span>}
          </div>
        </div>
      </article>
    </Link>
  );

  return (
    <section className="market-shell">
      <section className="editorial-shell">
        <div className="editorial-category-row">
          {categoryHighlights.map((highlight) => (
            <Link className={`editorial-category-card${highlight.accent ? " editorial-category-card-accent" : ""}`} href={highlight.href} key={highlight.label}>
              <p>{highlight.label}</p>
              <h3>{highlight.title}</h3>
              <span>{highlight.copy}</span>
            </Link>
          ))}
        </div>

        <article className="editorial-hero-card">
          <div className="editorial-hero-topbar">
            <strong>PASALO PROPERTY</strong>
            <nav className="editorial-hero-links" aria-label="Home sections">
              <Link href="#projects">Projects</Link>
              <Link href="#properties">Properties</Link>
              <Link href="#partners">Partners</Link>
              <Link href="#contact">Contact</Link>
            </nav>
            <button type="button">Book a call</button>
          </div>

          {heroListing ? (
            <Link className="editorial-hero-media" href={`/listings/${heroListing.id}`}>
              <img
                alt={heroListing.title}
                className="editorial-hero-image"
                loading="lazy"
                src={resolveListingImage(heroListing, "hero")}
              />
              <div className="editorial-hero-overlay">
                <p>Find Your Perfect Property, Made Simple</p>
                <span>
                  Launch scope: Metro Manila, Laguna, Cavite. Featured listing: {heroListing.project_name} • Cash out{" "}
                  {formatPhp(heroListing.cash_out_price_php)}.
                </span>
              </div>
            </Link>
          ) : (
            <div className="editorial-hero-image peg-main-image-fallback" aria-label="Featured Pasalo property placeholder" role="img">
              <strong>Featured Pasalo property</strong>
              <span>New verified listings from Metro Manila, Laguna, and Cavite will appear here.</span>
            </div>
          )}
        </article>
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

      <section className="testimonial-strip market-section">
        <div className="testimonial-strip-head">
          <div>
            <p>[05]</p>
            <h3>What Our Clients Say</h3>
          </div>
          <div className="testimonial-reviews-chip">
            <strong>200+</strong>
            <span>Client reviews</span>
          </div>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((item) => (
            <article className="testimonial-card" key={item.name}>
              <p>{item.quote}</p>
              <strong>{item.name}</strong>
              <span>{item.role}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section project-section" id="projects">
        <div className="peg-results-head">
          <h3>Projects</h3>
        </div>
        <div className="project-grid">
          {projectSpotlights.length
            ? projectSpotlights.map((project) => (
                <Link className="project-card" href={project.href} key={project.id}>
                  <p>{project.propertyType}</p>
                  <h4>{project.projectName}</h4>
                  <span>{project.location}</span>
                </Link>
              ))
            : fallbackProjects.map((project) => (
                <article className="project-card" key={project.projectName}>
                  <p>{project.propertyType}</p>
                  <h4>{project.projectName}</h4>
                  <span>{project.location}</span>
                </article>
              ))}
        </div>
      </section>

      <section className="market-section partner-section" id="partners">
        <div className="peg-results-head">
          <h3>Partners</h3>
        </div>
        <div className="partner-grid">
          {partnerRows.map((partner) => (
            <article className="partner-card" key={partner.name}>
              <h4>{partner.name}</h4>
              <p>{partner.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section contact-section" id="contact">
        <div className="peg-results-head">
          <h3>Contact</h3>
        </div>
        <div className="contact-grid">
          <p>
            Need listing help or transfer guidance? Use in-app messaging for active listings, or request role access to
            assist with selling, legal, and documentation flow.
          </p>
          <div className="contact-actions">
            <Link className="primary" href="/messages">
              Open messages
            </Link>
            <Link className="ghost-button" href="/apply-role">
              Apply role
            </Link>
          </div>
        </div>
      </section>

      {degraded && (
        <p className="small">Listing database is currently unavailable. Showing an empty fallback feed.</p>
      )}

      <section className="market-sections-stack" id="properties">
        <section className="peg-results market-section">
          <div className="peg-results-head">
            <h3>Top Listings</h3>
          </div>
          <div className="section-grid">
            {topListings.map((item) => renderEditorialCard(item, "top"))}
          </div>
          {!topListings.length && <p className="section-empty">No top listings available yet.</p>}
        </section>

        <section className="peg-results market-section">
          <div className="peg-results-head">
            <h3>Newest Listings</h3>
          </div>
          <div className="section-grid">
            {newestListings.map((item) => renderEditorialCard(item, "new"))}
          </div>
          {!newestListings.length && <p className="section-empty">No new listings available yet.</p>}
        </section>

        <section className="peg-results market-section">
          <div className="peg-results-head">
            <h3>Ongoing Biddings</h3>
          </div>
          <div className="section-grid">
            {ongoingBiddings.map((item) => renderEditorialCard(item, "bid"))}
          </div>
          {!ongoingBiddings.length && <p className="section-empty">No ongoing biddings right now.</p>}
        </section>

        <section className="peg-results market-section">
          <div className="peg-results-head">
            <h3>Fresh inventory</h3>
          </div>

          <div className="section-grid">
            {displayItems.map((item) => renderEditorialCard(item, "fresh"))}
          </div>
          {!displayItems.length && (
            <p className="section-empty">
              No listings matched your current search/filter. Try resetting filters.
            </p>
          )}
        </section>
      </section>
    </section>
  );
}
