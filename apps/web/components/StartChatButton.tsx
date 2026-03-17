"use client";

import { useState } from "react";
import { apiFetch } from "../lib/api";
import { getAuthToken } from "../lib/auth";

type Conversation = {
  id: string;
};

export function StartChatButton({
  listingId,
  isOpenForNewBuyers,
}: {
  listingId: string;
  isOpenForNewBuyers: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startChat = async () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}`)}`;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const conversation = await apiFetch<Conversation>("/conversations", {
        method: "POST",
        token,
        body: { listingId },
      });
      window.location.href = `/messages/${conversation.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start chat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 8 }}>
      <button className="primary" onClick={startChat} type="button" disabled={loading}>
        {loading ? "Opening..." : "Message Seller"}
      </button>
      {!isOpenForNewBuyers && (
        <p className="small" style={{ margin: 0 }}>
          Listing is currently locked for new buyers. Existing participants can continue in Messages.
        </p>
      )}
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
