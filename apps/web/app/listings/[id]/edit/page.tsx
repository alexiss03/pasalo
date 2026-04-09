"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, apiFetch } from "../../../../lib/api";
import { getAuthToken } from "../../../../lib/auth";

type ListingDetail = {
  id: string;
  title: string;
  owner_user_id: string;
  viewing_availability_enabled: boolean;
  viewing_availability_slots: unknown;
  viewing_duration_minutes: number | null;
  viewing_interval_minutes: number | null;
};

type MeResponse = {
  id: string;
  role: string;
};

type ViewingRequestItem = {
  id: string;
  buyer_name: string | null;
  proposed_at: string;
  status: "proposed" | "accepted" | "rejected" | "rescheduled" | "completed";
  notes: string | null;
};

type ViewingRequestFeed = {
  items: ViewingRequestItem[];
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const listingId = params.id;

  const [me, setMe] = useState<MeResponse | null>(null);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [requests, setRequests] = useState<ViewingRequestItem[]>([]);
  const [viewingEnabled, setViewingEnabled] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotInput, setSlotInput] = useState("");
  const [viewingDurationMinutes, setViewingDurationMinutes] = useState(30);
  const [viewingIntervalMinutes, setViewingIntervalMinutes] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [slots],
  );

  const load = async () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}/edit`)}`;
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [meData, listingData, requestData] = await Promise.all([
        apiFetch<MeResponse>("/me", { token }),
        apiFetch<ListingDetail>(`/listings/${listingId}`, { token }),
        apiFetch<ViewingRequestFeed>(`/listings/${listingId}/viewing-requests`, { token }),
      ]);

      if (listingData.owner_user_id !== meData.id && meData.role !== "admin") {
        setError("Only the listing owner can edit this listing.");
      }

      const loadedSlots = Array.isArray(listingData.viewing_availability_slots)
        ? listingData.viewing_availability_slots
            .map((value) => (typeof value === "string" ? value : null))
            .filter((value): value is string => Boolean(value))
        : [];

      setMe(meData);
      setListing(listingData);
      setRequests(requestData.items);
      setViewingEnabled(Boolean(listingData.viewing_availability_enabled) && loadedSlots.length > 0);
      setSlots(loadedSlots);
      setViewingDurationMinutes(
        Number.isFinite(Number(listingData.viewing_duration_minutes))
          ? Math.max(15, Math.min(240, Number(listingData.viewing_duration_minutes)))
          : 30,
      );
      setViewingIntervalMinutes(
        Number.isFinite(Number(listingData.viewing_interval_minutes))
          ? Math.max(5, Math.min(240, Number(listingData.viewing_interval_minutes)))
          : 30,
      );
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
        window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}/edit`)}`;
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to load listing editor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [listingId]);

  const addSlot = () => {
    if (!slotInput) {
      setError("Pick a viewing slot date/time first.");
      return;
    }
    const parsed = new Date(slotInput);
    if (!Number.isFinite(parsed.getTime())) {
      setError("Enter a valid date and time.");
      return;
    }
    const iso = parsed.toISOString();
    if (slots.includes(iso)) {
      setError("This slot is already added.");
      return;
    }
    setSlots((current) => [...current, iso]);
    setSlotInput("");
    setError(null);
  };

  const removeSlot = (slot: string) => {
    setSlots((current) => current.filter((item) => item !== slot));
  };

  const saveAvailability = async () => {
    if (!listing) {
      return;
    }
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}/edit`)}`;
      return;
    }
    if (viewingEnabled && slots.length === 0) {
      setError("Add at least one slot or disable viewing availability.");
      return;
    }
    if (viewingEnabled && (viewingDurationMinutes < 15 || viewingDurationMinutes > 240)) {
      setError("Viewing duration must be from 15 to 240 minutes.");
      return;
    }
    if (viewingEnabled && (viewingIntervalMinutes < 5 || viewingIntervalMinutes > 240)) {
      setError("Viewing interval must be from 5 to 240 minutes.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await apiFetch(`/listings/${listing.id}`, {
        method: "PATCH",
        token,
        body: {
          viewingAvailability: {
            enabled: viewingEnabled,
            slots: viewingEnabled ? slots : [],
            durationMinutes: viewingDurationMinutes,
            intervalMinutes: viewingIntervalMinutes,
          },
        },
      });
      setStatus("Viewing availability saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save viewing availability");
    } finally {
      setSaving(false);
    }
  };

  const cancelViewing = async (viewingRequestId: string) => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}/edit`)}`;
      return;
    }

    setError(null);
    setStatus(null);
    try {
      await apiFetch(`/viewing-requests/${viewingRequestId}`, {
        method: "PATCH",
        token,
        body: {
          status: "rejected",
          notes: "Canceled by seller",
        },
      });
      setStatus("Viewing request canceled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel viewing request");
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="small" style={{ margin: 0 }}>
          Loading listing editor...
        </p>
      </section>
    );
  }

  return (
    <section className="grid" style={{ gap: 12 }}>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <Link className="nav-chip" href="/my-properties">
            Listing Hub
          </Link>
        </p>
        <h1 style={{ marginBottom: 0 }}>{listing?.title ?? "Edit Listing"}</h1>
      </div>

      <div className="card grid">
        <h3 style={{ margin: 0 }}>Viewing Availability</h3>
        <label className="inline-check">
          <input
            checked={viewingEnabled}
            disabled={!me || (!!listing && listing.owner_user_id !== me.id && me.role !== "admin")}
            onChange={(event) => setViewingEnabled(event.target.checked)}
            type="checkbox"
          />
          Enable seller viewing availability
        </label>

        {viewingEnabled && (
          <>
            <div className="grid grid-2">
              <label className="form-field">
                <span className="field-label">Viewing Duration (minutes)</span>
                <input
                  max={240}
                  min={15}
                  onChange={(event) => setViewingDurationMinutes(Math.max(0, Number(event.target.value) || 0))}
                  type="number"
                  value={viewingDurationMinutes}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Viewing Interval (minutes)</span>
                <input
                  max={240}
                  min={5}
                  onChange={(event) => setViewingIntervalMinutes(Math.max(0, Number(event.target.value) || 0))}
                  type="number"
                  value={viewingIntervalMinutes}
                />
              </label>
            </div>

            <div className="field-row">
              <input
                min={new Date().toISOString().slice(0, 16)}
                onChange={(event) => setSlotInput(event.target.value)}
                step={Math.max(1, viewingIntervalMinutes) * 60}
                type="datetime-local"
                value={slotInput}
              />
              <button className="ghost-button" onClick={addSlot} type="button">
                Add slot
              </button>
            </div>

            <div className="grid">
              {!sortedSlots.length && (
                <p className="small" style={{ margin: 0 }}>
                  No slots yet.
                </p>
              )}
              {sortedSlots.map((slot) => (
                <div className="field-row" key={slot}>
                  <span className="small">{formatDateTime(slot)}</span>
                  <button className="ghost-button" onClick={() => removeSlot(slot)} type="button">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div>
          <button className="primary" disabled={saving} onClick={saveAvailability} type="button">
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>

      <div className="card grid">
        <h3 style={{ margin: 0 }}>Viewing Requests</h3>
        {!requests.length && (
          <p className="small" style={{ margin: 0 }}>
            No viewing requests yet.
          </p>
        )}
        {requests.map((item) => {
          const cancellable = item.status === "proposed" || item.status === "accepted" || item.status === "rescheduled";
          return (
            <article className="card" key={item.id} style={{ padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{item.buyer_name ?? "Buyer"}</p>
              <p className="small" style={{ margin: "4px 0 0" }}>
                {formatDateTime(item.proposed_at)} - {formatStatus(item.status)}
              </p>
              {item.notes && (
                <p className="small" style={{ margin: "6px 0 0" }}>
                  {item.notes}
                </p>
              )}
              {cancellable && (
                <div style={{ marginTop: 8 }}>
                  <button className="ghost-button" onClick={() => cancelViewing(item.id)} type="button">
                    Cancel Viewing
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
