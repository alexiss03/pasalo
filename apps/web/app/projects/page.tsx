import Link from "next/link";
import { apiFetch } from "../../lib/api";

type ListingItem = {
  id: string;
  title: string;
  project_name: string;
  location_city: string;
  location_province: string;
  property_type: string;
  is_open_for_new_buyers: boolean;
  created_at: string;
};

type ListingFeed = {
  items: ListingItem[];
};

type ProjectSummary = {
  projectName: string;
  location: string;
  totalListings: number;
  openListings: number;
  latestCreatedAt: string;
  sampleType: string;
};

function toProjectSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatTag(value: string): string {
  const clean = value.replaceAll("_", " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : value;
}

export default async function ProjectsPage() {
  let data: ListingFeed = { items: [] };

  try {
    data = await apiFetch<ListingFeed>("/listings?page=1&pageSize=200");
  } catch {
    data = { items: [] };
  }

  const projectMap = new Map<string, ProjectSummary>();

  for (const item of data.items) {
    const key = item.project_name.trim();
    const existing = projectMap.get(key);
    const location = `${item.location_city}, ${item.location_province}`;
    if (!existing) {
      projectMap.set(key, {
        projectName: key,
        location,
        totalListings: 1,
        openListings: item.is_open_for_new_buyers ? 1 : 0,
        latestCreatedAt: item.created_at,
        sampleType: item.property_type,
      });
      continue;
    }

    existing.totalListings += 1;
    if (item.is_open_for_new_buyers) {
      existing.openListings += 1;
    }
    if (new Date(item.created_at).getTime() > new Date(existing.latestCreatedAt).getTime()) {
      existing.latestCreatedAt = item.created_at;
      existing.location = location;
      existing.sampleType = item.property_type;
    }
  }

  const projects = [...projectMap.values()].sort((a, b) => {
    if (a.openListings !== b.openListings) {
      return b.openListings - a.openListings;
    }
    if (a.totalListings !== b.totalListings) {
      return b.totalListings - a.totalListings;
    }
    return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
  });

  return (
    <section className="market-shell">
      <section className="market-section">
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Projects</h1>
        <p className="small" style={{ marginTop: 0 }}>
          Tap a project to view current listings under it.
        </p>
      </section>

      <section className="market-section">
        <div className="peg-results-head">
          <h3>Active Project Directory</h3>
          <Link className="ghost-button" href="/">
            Back to home
          </Link>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <Link
              className="project-card"
              href={`/projects/${toProjectSlug(project.projectName)}?name=${encodeURIComponent(project.projectName)}`}
              key={project.projectName}
            >
              <p>{formatTag(project.sampleType)}</p>
              <h4>{project.projectName}</h4>
              <span>{project.location}</span>
              <span className="small">
                {project.openListings} current listing{project.openListings === 1 ? "" : "s"} • {project.totalListings} total
              </span>
            </Link>
          ))}
        </div>
        {!projects.length && (
          <p className="section-empty">No projects yet. Listings will appear here once posted live.</p>
        )}
      </section>
    </section>
  );
}
