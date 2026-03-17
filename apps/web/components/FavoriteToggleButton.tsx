"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "../lib/api";
import { getAuthToken } from "../lib/auth";

type WatchlistFeed = {
  items: Array<{ id: string }>;
};

type FavoriteToggleButtonProps = {
  listingId: string;
};

export function FavoriteToggleButton({ listingId }: FavoriteToggleButtonProps) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFavoriteState = async () => {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsFavorite(false);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsAuthenticated(true);
      }

      try {
        const feed = await apiFetch<WatchlistFeed>("/watchlist", { token });
        if (isMounted) {
          setIsFavorite(feed.items.some((item) => item.id === listingId));
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load favorites");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadFavoriteState();

    return () => {
      isMounted = false;
    };
  }, [listingId]);

  const toggleFavorite = async () => {
    const token = getAuthToken();
    if (!token) {
      const next = pathname && pathname.startsWith("/") ? pathname : "/";
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      if (isFavorite) {
        await apiFetch(`/watchlist/${listingId}`, {
          method: "DELETE",
          token,
        });
        setIsFavorite(false);
      } else {
        await apiFetch(`/watchlist/${listingId}`, {
          method: "POST",
          body: {},
          token,
        });
        setIsFavorite(true);
      }
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update favorite");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="favorite-stack">
      <button className={isFavorite ? "primary" : "ghost"} disabled={isLoading || isSaving} onClick={toggleFavorite} type="button">
        {isLoading ? "Loading..." : isFavorite ? "Remove favorite" : "Save to favorites"}
      </button>
      {!isAuthenticated && !isLoading && <p className="small">Login required to save favorites.</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
