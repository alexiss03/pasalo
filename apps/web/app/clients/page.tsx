import Link from "next/link";
import { apiFetch } from "../../lib/api";

type ListingItem = {
  id: string;
  title: string;
  project_name: string;
  location_city: string;
  location_province: string;
  is_verified: boolean;
  is_open_for_new_buyers: boolean;
};

type ListingFeed = {
  items: ListingItem[];
};

const clientStories = [
  {
    quote:
      "I found a verified pasalo listing with clear cash-out and monthly terms. The process was much easier than searching scattered posts.",
    name: "Lianne M.",
    role: "Buyer • Quezon City",
  },
  {
    quote:
      "Our listing got quality inquiries quickly because buyers could review complete details, photos, and transfer requirements in one page.",
    name: "Marco A.",
    role: "Seller • Cavite",
  },
  {
    quote:
      "The project-based view helped me compare available units fast and focus only on listings that were still open for buyers.",
    name: "Denise R.",
    role: "Investor • Laguna",
  },
];

export default async function ClientsPage() {
  let data: ListingFeed = { items: [] };
  try {
    data = await apiFetch<ListingFeed>("/listings?page=1&pageSize=50");
  } catch {
    data = { items: [] };
  }

  const totalListings = data.items.length;
  const openListings = data.items.filter((item) => item.is_open_for_new_buyers).length;
  const verifiedListings = data.items.filter((item) => item.is_verified).length;
  const featuredProjects = [...new Map(data.items.map((item) => [item.project_name, item])).values()].slice(0, 4);

  return (
    <section className="market-shell">
      <section className="market-section">
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Clients</h1>
        <p className="small" style={{ marginTop: 0 }}>
          Buyer and seller outcomes from current pasalo listings.
        </p>
        <div className="project-summary-grid">
          <article className="project-summary-card">
            <p>Total Listings</p>
            <h4>{totalListings}</h4>
          </article>
          <article className="project-summary-card">
            <p>Open Listings</p>
            <h4>{openListings}</h4>
          </article>
          <article className="project-summary-card">
            <p>Verified Listings</p>
            <h4>{verifiedListings}</h4>
          </article>
        </div>
      </section>

      <section className="market-section testimonial-strip">
        <div className="peg-results-head">
          <h3>Client Stories</h3>
        </div>
        <div className="testimonial-grid">
          {clientStories.map((item) => (
            <article className="testimonial-card" key={item.name}>
              <p>{item.quote}</p>
              <strong>{item.name}</strong>
              <span>{item.role}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="market-section">
        <div className="peg-results-head">
          <h3>Projects Clients Are Exploring</h3>
          <Link className="ghost-button" href="/projects">
            Browse projects
          </Link>
        </div>
        <div className="project-grid">
          {featuredProjects.map((project) => (
            <article className="project-card" key={project.id}>
              <p>Project</p>
              <h4>{project.project_name}</h4>
              <span>
                {project.location_city}, {project.location_province}
              </span>
            </article>
          ))}
        </div>
        {!featuredProjects.length && (
          <p className="section-empty">No client activity yet. Listings will appear once projects are live.</p>
        )}
      </section>
    </section>
  );
}
