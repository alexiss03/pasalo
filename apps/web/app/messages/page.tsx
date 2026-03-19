"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type ConversationItem = {
  id: string;
  listing_id: string;
  listing_title: string;
  buyer_name: string | null;
  seller_name: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
};

type ConversationFeed = {
  items: ConversationItem[];
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "No messages yet";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No messages yet";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes <= 0) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSortTimestamp(item: ConversationItem): number {
  const source = item.last_message_at ?? item.created_at;
  const parsed = new Date(source).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getConversationCounterparty(item: ConversationItem): string {
  return item.seller_name ?? item.buyer_name ?? "Conversation";
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export default function MessagesPage() {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const sorted = [...items].sort((a, b) => {
      if (a.unread_count !== b.unread_count) {
        return b.unread_count - a.unread_count;
      }
      return getSortTimestamp(b) - getSortTimestamp(a);
    });

    if (!normalizedQuery) {
      return sorted;
    }

    return sorted.filter((item) => {
      const haystack = normalizeText(
        [
          item.listing_title,
          item.last_message_body ?? "",
          item.buyer_name ?? "",
          item.seller_name ?? "",
        ].join(" "),
      );
      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/messages";
      return;
    }

    setLoading(true);
    apiFetch<ConversationFeed>("/conversations", { token })
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login?next=/messages";
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load conversations");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <section className="grid" style={{ gap: 12 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, marginBottom: 10 }}>Messages</h1>
        <input
          aria-label="Search conversations"
          className="message-search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search listing, buyer, seller, or message..."
          value={query}
        />
      </div>

      {loading && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            Loading conversations...
          </p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="error" style={{ margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {!loading && !error && !filteredItems.length && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            {items.length
              ? "No conversations match your search."
              : "No conversations yet. Open any listing and tap Message Seller."}
          </p>
        </div>
      )}

      {!loading && !error && filteredItems.length > 0 && (
        <div className="message-list card">
          {filteredItems.map((item) => (
            <Link className="message-row" href={`/messages/${item.id}`} key={item.id}>
              <div className="message-row-main">
                <p className="message-row-title">{item.listing_title}</p>
                <p className="message-row-meta">
                  {getConversationCounterparty(item)} - {formatDateTime(item.last_message_at ?? item.created_at)}
                </p>
                <p className="message-row-preview">{item.last_message_body ?? "Start the conversation"}</p>
              </div>
              <div className="message-row-side">
                <span className="message-row-age">{formatRelativeTime(item.last_message_at)}</span>
                {item.unread_count > 0 && <span className="badge">Unread {item.unread_count}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
