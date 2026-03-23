"use client";

import { FormEvent, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { getAuthToken } from "../lib/auth";

type ViewingRequestResponse = {
  id: string;
  proposed_at: string;
  status: string;
};

function toLocalDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function RequestViewingButton({
  listingId,
  isOpenForNewBuyers,
  viewingAvailabilityEnabled,
  viewingAvailabilitySlots,
  viewingDurationMinutes,
  viewingIntervalMinutes,
}: {
  listingId: string;
  isOpenForNewBuyers: boolean;
  viewingAvailabilityEnabled: boolean;
  viewingAvailabilitySlots: string[];
  viewingDurationMinutes: number;
  viewingIntervalMinutes: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [manualDateTime, setManualDateTime] = useState("");

  const sortedSlots = useMemo(
    () =>
      [...viewingAvailabilitySlots]
        .map((value) => {
          const parsed = new Date(value);
          return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
        })
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [viewingAvailabilitySlots],
  );

  const slotsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of sortedSlots) {
      const dateKey = toLocalDate(slot);
      if (!dateKey) {
        continue;
      }
      const list = map.get(dateKey) ?? [];
      list.push(slot);
      map.set(dateKey, list);
    }
    return map;
  }, [sortedSlots]);

  const dateOptions = useMemo(() => Array.from(slotsByDate.keys()), [slotsByDate]);
  const [selectedDate, setSelectedDate] = useState(dateOptions[0] ?? "");
  const [selectedSlot, setSelectedSlot] = useState("");

  const activeSlotsForDate = useMemo(() => {
    if (!selectedDate) {
      return [];
    }
    return slotsByDate.get(selectedDate) ?? [];
  }, [selectedDate, slotsByDate]);

  const openModal = () => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}`)}`;
      return;
    }
    if (!selectedDate && dateOptions.length) {
      setSelectedDate(dateOptions[0]);
    }
    if (!selectedSlot && dateOptions.length) {
      const firstDateSlots = slotsByDate.get(dateOptions[0]) ?? [];
      if (firstDateSlots.length) {
        setSelectedSlot(firstDateSlots[0]);
      }
    }
    setOpen(true);
    setError(null);
    setStatus(null);
  };

  const closeModal = () => {
    if (loading) {
      return;
    }
    setOpen(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(`/listings/${listingId}`)}`;
      return;
    }

    let proposedAt = "";
    if (viewingAvailabilityEnabled && sortedSlots.length) {
      if (!selectedSlot) {
        setError("Select an available viewing time.");
        return;
      }
      proposedAt = selectedSlot;
    } else {
      if (!manualDateTime) {
        setError("Pick your preferred viewing date and time.");
        return;
      }
      const parsed = new Date(manualDateTime);
      if (!Number.isFinite(parsed.getTime())) {
        setError("Enter a valid viewing date and time.");
        return;
      }
      proposedAt = parsed.toISOString();
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const result = await apiFetch<ViewingRequestResponse>(`/listings/${listingId}/viewing-requests`, {
        method: "POST",
        token,
        body: {
          proposedAt,
          notes: notes.trim() ? notes.trim() : undefined,
        },
      });

      setStatus(`Viewing requested for ${new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(result.proposed_at))}.`);
      setNotes("");
      setManualDateTime("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request viewing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid" style={{ gap: 8 }}>
      <button className="ghost-button" disabled={!isOpenForNewBuyers} onClick={openModal} type="button">
        Request Viewing
      </button>

      {open && (
        <div className="signature-modal-backdrop">
          <form className="signature-modal viewing-modal" onSubmit={submit}>
            <h3 style={{ margin: 0 }}>Request Viewing</h3>
            <p className="small" style={{ margin: 0 }}>
              Duration: {viewingDurationMinutes} min • Interval: {viewingIntervalMinutes} min
            </p>

            {viewingAvailabilityEnabled && sortedSlots.length > 0 ? (
              <>
                <label>
                  <div className="small" style={{ marginBottom: 6 }}>
                    Available date
                  </div>
                  <input
                    list={`viewing-dates-${listingId}`}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      setSelectedDate(nextDate);
                      const nextSlots = slotsByDate.get(nextDate) ?? [];
                      setSelectedSlot(nextSlots[0] ?? "");
                    }}
                    placeholder="YYYY-MM-DD"
                    type="date"
                    value={selectedDate}
                  />
                  <datalist id={`viewing-dates-${listingId}`}>
                    {dateOptions.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </label>

                <div className="viewing-slot-grid">
                  {activeSlotsForDate.map((slot) => (
                    <button
                      className={`viewing-slot-button${selectedSlot === slot ? " active" : ""}`}
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      type="button"
                    >
                      {toLocalTimeLabel(slot)}
                    </button>
                  ))}
                  {!activeSlotsForDate.length && (
                    <p className="small" style={{ margin: 0 }}>
                      No listed slots for this date. Pick another date.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <label>
                <div className="small" style={{ marginBottom: 6 }}>
                  Preferred date and time
                </div>
                <input
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(event) => setManualDateTime(event.target.value)}
                  step={Math.max(1, viewingIntervalMinutes) * 60}
                  type="datetime-local"
                  value={manualDateTime}
                />
              </label>
            )}

            <label>
              <div className="small" style={{ marginBottom: 6 }}>
                Notes (optional)
              </div>
              <textarea
                maxLength={1000}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add preferred meetup details or questions."
                rows={3}
                value={notes}
              />
            </label>

            {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

            <div className="signature-modal-actions">
              <button className="ghost-button" onClick={closeModal} type="button">
                Close
              </button>
              <button className="primary" disabled={loading} type="submit">
                {loading ? "Submitting..." : "Request Viewing"}
              </button>
            </div>
          </form>
        </div>
      )}

      {status && <p className="small" style={{ margin: 0 }}>{status}</p>}
      {!isOpenForNewBuyers && (
        <p className="small" style={{ margin: 0 }}>
          Listing is currently locked for new buyers. Existing participants can continue in Messages.
        </p>
      )}
      {error && !open && <p className="error" style={{ margin: 0 }}>{error}</p>}
    </div>
  );
}
