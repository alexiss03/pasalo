"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
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

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMinutesAgo(value: string | null): string {
  if (!value) {
    return "";
  }

  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes <= 0) {
    return "just now";
  }
  return `${minutes} min ago`;
}

export default function MessagesPage() {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setError("Login first to view your messages.");
      setLoading(false);
      return;
    }

    apiFetch<ConversationFeed>("/conversations", { token })
      .then((data) => {
        setItems(data.items);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load conversations");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <section className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Messages</h1>
      </div>

      {loading && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>Loading conversations...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="error" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>No conversations yet. Open any listing and tap Message Seller.</p>
        </div>
      )}

      <div className="grid">
        {items.map((item) => (
          <Link className="listing-card-link" href={`/messages/${item.id}`} key={item.id}>
            <article className="card listing-card">
              <h3 style={{ marginTop: 0 }}>{item.listing_title}</h3>
              <p className="small" style={{ marginTop: -6 }}>
                Buyer: {item.buyer_name ?? "Buyer"} • Seller: {item.seller_name ?? "Seller"}
              </p>
              <p style={{ marginBottom: 6 }}>{item.last_message_body ?? "Start the conversation"}</p>
              <p className="small" style={{ marginBottom: 0 }}>
                {formatDateTime(item.last_message_at ?? item.created_at)}
                {item.last_message_at && ` • ${formatMinutesAgo(item.last_message_at)}`}
              </p>
              {item.unread_count > 0 && <p className="badge">Unread {item.unread_count}</p>}
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
}
