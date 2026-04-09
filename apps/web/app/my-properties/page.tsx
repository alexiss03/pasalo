"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type MyListingItem = {
  id: string;
  title: string;
  location_city: string;
  location_province: string;
  property_type: string;
  project_name: string;
  cash_out_price_php: string;
  monthly_amortization_php: string;
  status: string;
  transaction_status: string;
  is_open_for_new_buyers: boolean;
};

type FavoriteItem = {
  id: string;
  title: string;
  location_city: string;
  location_province: string;
  property_type: string;
  cash_out_price_php: string;
  monthly_amortization_php: string;
  status: string;
};

type MyListingsFeed = {
  items: MyListingItem[];
};

type FavoriteFeed = {
  items: FavoriteItem[];
};

type TabKey = "my-listings" | "saved";

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

export default function MyPropertiesPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("my-listings");
  const [myListings, setMyListings] = useState<MyListingItem[]>([]);
  const [savedListings, setSavedListings] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "saved") {
      setActiveTab("saved");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) {
          setRequiresLogin(true);
          setIsLoading(false);
        }
        return;
      }

      try {
        const [mine, saved] = await Promise.all([
          apiFetch<MyListingsFeed>("/me/listings?page=1&pageSize=20", { token }),
          apiFetch<FavoriteFeed>("/watchlist", { token }),
        ]);

        if (isMounted) {
          setMyListings(mine.items);
          setSavedListings(saved.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load your properties");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "saved") {
      params.set("tab", "saved");
    } else {
      params.delete("tab");
    }
    const queryString = params.toString();
    window.history.replaceState({}, "", queryString ? `/my-properties?${queryString}` : "/my-properties");
  };

  if (requiresLogin) {
    return (
      <section className="card page-card">
        <h1 style={{ marginTop: 0 }}>Listing Hub</h1>
        <p className="small">Login to view your listing portfolio and saved favorites.</p>
        <Link className="nav-action" href="/login?next=%2Fmy-properties">
          Login
        </Link>
      </section>
    );
  }

  const renderMyListingCard = (item: MyListingItem) => (
    <article className="card listing-card peg-listing-card" key={`mine-${item.id}`}>
      <Link className="listing-card-link" href={`/listings/${item.id}`}>
        <h3 className="peg-listing-title">{item.title}</h3>
      </Link>
      <p className="small peg-listing-location">
        {item.project_name} • {item.location_city}, {item.location_province}
      </p>
      <div className="peg-listing-financials">
        <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
        <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
      </div>
      <div className="peg-listing-badges">
        <span className="badge">{formatTagLabel(item.property_type)}</span>
        <span className="badge">Listing {formatTagLabel(item.status)}</span>
        <span className="badge">Deal {formatTagLabel(item.transaction_status)}</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="ghost-button" href={`/listings/${item.id}/edit`}>
          Edit Listing
        </Link>
      </div>
    </article>
  );

  const renderSavedCard = (item: FavoriteItem) => (
    <Link className="listing-card-link" href={`/listings/${item.id}`} key={`saved-${item.id}`}>
      <article className="card listing-card peg-listing-card">
        <h3 className="peg-listing-title">{item.title}</h3>
        <p className="small peg-listing-location">
          {item.location_city}, {item.location_province}
        </p>
        <div className="peg-listing-financials">
          <span>Cash out: {formatPhp(item.cash_out_price_php)}</span>
          <span>Monthly: {formatPhp(item.monthly_amortization_php)}</span>
        </div>
        <div className="peg-listing-badges">
          <span className="badge">{formatTagLabel(item.property_type)}</span>
          <span className="badge">Status {formatTagLabel(item.status)}</span>
        </div>
      </article>
    </Link>
  );

  return (
    <section className="market-section">
      <div className="peg-results-head">
        <h3>Listing Hub</h3>
      </div>

      <div className="segmented-control">
        <button
          aria-pressed={activeTab === "my-listings"}
          className={`segment-button${activeTab === "my-listings" ? " active" : ""}`}
          onClick={() => switchTab("my-listings")}
          type="button"
        >
          My Listings
        </button>
        <button
          aria-pressed={activeTab === "saved"}
          className={`segment-button${activeTab === "saved" ? " active" : ""}`}
          onClick={() => switchTab("saved")}
          type="button"
        >
          Saved Favorites
        </button>
      </div>

      {isLoading && <p className="small">Loading your listings...</p>}
      {error && <p className="error">{error}</p>}

      {!isLoading && !error && activeTab === "my-listings" && (
        <>
          <div className="section-grid">{myListings.map(renderMyListingCard)}</div>
          {!myListings.length && <p className="section-empty">You have not posted any listings yet.</p>}
        </>
      )}

      {!isLoading && !error && activeTab === "saved" && (
        <>
          <div className="section-grid">{savedListings.map(renderSavedCard)}</div>
          {!savedListings.length && <p className="section-empty">You have no saved favorites yet.</p>}
        </>
      )}
    </section>
  );
}
