"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type UploadedDocMeta = {
  fileName: string;
  storageKey: string;
};

type IdentityVerificationItem = {
  id: string;
  platform_identity_code: string;
  provider: string;
  status: string;
  ai_auth_status: string;
  ai_confidence: number;
  ai_flags: string[];
  created_at: string;
  updated_at: string;
};

type IdentityVerificationResponse = {
  item: IdentityVerificationItem;
  summary: {
    overallStatus: "pass" | "review" | "fail";
    passed: number;
    needsReview: number;
    failed: number;
  };
};

type LatestIdentityResponse = {
  item: IdentityVerificationItem | null;
};

type CaptureField = "id" | "selfie" | "authority_document";

type MobileCaptureCreateResponse = {
  item: {
    id: string;
    field_type: CaptureField;
    status: "pending" | "completed" | "expired" | "canceled";
    token: string;
    expires_at: string;
    created_at: string;
    updated_at: string;
  };
};

type MobileCaptureSessionStatusResponse = {
  item: {
    id: string;
    field_type: CaptureField;
    status: "pending" | "completed" | "expired" | "canceled";
    captured_file_key: string | null;
    captured_file_name: string | null;
    expires_at: string;
    captured_at: string | null;
    created_at: string;
    updated_at: string;
  };
};

type CaptureSessionView = {
  id: string;
  field: CaptureField;
  token: string;
  status: "pending" | "completed" | "expired" | "canceled";
  expiresAt: string;
  captureUrl: string;
  qrUrl: string;
  capturedFileKey: string | null;
  capturedFileName: string | null;
};

function toLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCaptureUrl(sessionId: string, token: string) {
  const url = new URL(`/mobile-capture/${sessionId}`, window.location.origin);
  url.searchParams.set("token", token);
  return url.toString();
}

function buildQrUrl(captureUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(captureUrl)}`;
}

const emptySessions: Record<CaptureField, CaptureSessionView | null> = {
  id: null,
  selfie: null,
  authority_document: null,
};

export default function VerifyIdentityPage() {
  const [idDocMeta, setIdDocMeta] = useState<UploadedDocMeta | null>(null);
  const [selfieMeta, setSelfieMeta] = useState<UploadedDocMeta | null>(null);
  const [authorityDocMeta, setAuthorityDocMeta] = useState<UploadedDocMeta | null>(null);
  const [captureSessions, setCaptureSessions] = useState<Record<CaptureField, CaptureSessionView | null>>(emptySessions);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<IdentityVerificationItem | null>(null);
  const [result, setResult] = useState<IdentityVerificationResponse | null>(null);

  const isLocalhostOrigin = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1";
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/verify-identity";
      return;
    }

    const loadLatest = async () => {
      try {
        const response = await apiFetch<LatestIdentityResponse>("/me/identity-verification", { token });
        setLatest(response.item);
      } catch {
        setLatest(null);
      } finally {
        setLoadingLatest(false);
      }
    };

    void loadLatest();
  }, []);

  useEffect(() => {
    const hasPending = Object.values(captureSessions).some((session) => session?.status === "pending");
    if (!hasPending) {
      return;
    }

    let disposed = false;

    const poll = async () => {
      if (disposed) {
        return;
      }
      const token = getAuthToken();
      if (!token) {
        return;
      }

      const entries = Object.entries(captureSessions) as Array<[CaptureField, CaptureSessionView | null]>;
      for (const [field, session] of entries) {
        if (!session || session.status !== "pending") {
          continue;
        }

        try {
          const response = await apiFetch<MobileCaptureSessionStatusResponse>(
            `/me/mobile-capture-sessions/${session.id}`,
            { token },
          );
          const item = response.item;

          setCaptureSessions((prev) => {
            const existing = prev[field];
            if (!existing) {
              return prev;
            }

            return {
              ...prev,
              [field]: {
                ...existing,
                status: item.status,
                capturedFileKey: item.captured_file_key,
                capturedFileName: item.captured_file_name,
                expiresAt: item.expires_at,
              },
            };
          });

          if (item.status === "completed" && item.captured_file_key) {
            const meta = {
              fileName: item.captured_file_name || `${field}.jpg`,
              storageKey: item.captured_file_key,
            };
            if (field === "id") {
              setIdDocMeta(meta);
            } else if (field === "selfie") {
              setSelfieMeta(meta);
            } else {
              setAuthorityDocMeta(meta);
            }
            setError(null);
          }
        } catch {
          // Skip transient polling errors; the next interval retries.
        }
      }
    };

    void poll();
    const interval = window.setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [captureSessions]);

  const startMobileCapture = async (field: CaptureField) => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/verify-identity";
      return;
    }

    try {
      setError(null);
      if (field === "id") {
        setIdDocMeta(null);
      } else if (field === "selfie") {
        setSelfieMeta(null);
      } else {
        setAuthorityDocMeta(null);
      }
      const response = await apiFetch<MobileCaptureCreateResponse>("/me/mobile-capture-sessions", {
        method: "POST",
        token,
        body: { field },
      });
      const captureUrl = buildCaptureUrl(response.item.id, response.item.token);
      setCaptureSessions((prev) => ({
        ...prev,
        [field]: {
          id: response.item.id,
          field,
          token: response.item.token,
          status: response.item.status,
          expiresAt: response.item.expires_at,
          captureUrl,
          qrUrl: buildQrUrl(captureUrl),
          capturedFileKey: null,
          capturedFileName: null,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create mobile capture session.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/verify-identity";
      return;
    }

    if (!idDocMeta || !selfieMeta) {
      setError("Capture both Photo ID and Selfie before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiFetch<IdentityVerificationResponse>("/me/identity-verification", {
        method: "POST",
        token,
        body: {
          idFileKey: idDocMeta.storageKey,
          selfieFileKey: selfieMeta.storageKey,
          authorityDocumentFileKey: authorityDocMeta?.storageKey ?? null,
        },
      });
      setResult(response);
      setLatest(response.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit identity verification.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderCaptureField = (
    field: CaptureField,
    title: string,
    required: boolean,
    note: string,
    meta: UploadedDocMeta | null,
  ) => {
    const session = captureSessions[field];
    const statusLabel = session ? toLabel(session.status) : "Not started";

    return (
      <article className="capture-field-card">
        <h3>{title}</h3>
        <p className="small" style={{ margin: 0 }}>
          {note}
        </p>
        <p className="small" style={{ margin: "2px 0 0" }}>
          {required ? "Required" : "Optional"} • Status: {statusLabel}
        </p>

        {meta && (
          <p className="field-note" style={{ margin: "8px 0 0" }}>
            Captured: {meta.fileName}
          </p>
        )}

        <div className="capture-field-actions">
          <button className="primary" onClick={() => startMobileCapture(field)} type="button">
            Generate QR and capture link
          </button>
        </div>

        {session && (
          <div className="capture-session-box">
            <img alt={`${title} QR code`} className="capture-qr" src={session.qrUrl} />
            <a className="capture-link" href={session.captureUrl} rel="noreferrer noopener" target="_blank">
              Open mobile camera capture
            </a>
            <p className="small" style={{ margin: 0 }}>
              Expires: {new Date(session.expiresAt).toLocaleString()}
            </p>
            {isLocalhostOrigin && (
              <p className="small" style={{ margin: 0 }}>
                Localhost links may not open on another device. Use your LAN URL when scanning.
              </p>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="card profile-card page-card">
      <h1 style={{ marginTop: 0 }}>Verify Identity</h1>
      <p className="small">Use QR flow to capture documents from mobile camera, then submit verification from web.</p>

      {loadingLatest && <p className="small">Loading latest verification...</p>}
      {!loadingLatest && latest && (
        <div className="profile-props-grid" style={{ marginBottom: 12 }}>
          <article className="profile-prop-card">
            <p>Pasalo ID</p>
            <strong>{latest.platform_identity_code}</strong>
          </article>
          <article className="profile-prop-card">
            <p>Auth status</p>
            <strong>{toLabel(latest.ai_auth_status)}</strong>
          </article>
          <article className="profile-prop-card">
            <p>Review status</p>
            <strong>{toLabel(latest.status)}</strong>
          </article>
          <article className="profile-prop-card">
            <p>Submitted</p>
            <strong>{new Date(latest.created_at).toLocaleString()}</strong>
          </article>
        </div>
      )}

      <form className="grid" onSubmit={submit}>
        <div className="capture-grid">
          {renderCaptureField(
            "id",
            "Photo ID",
            true,
            "Scan QR on your phone and capture a clear photo of a valid government ID.",
            idDocMeta,
          )}
          {renderCaptureField(
            "selfie",
            "Selfie Holding ID",
            true,
            "Scan QR on your phone and capture selfie while holding your ID beside your face.",
            selfieMeta,
          )}
          {renderCaptureField(
            "authority_document",
            "Authority Document",
            false,
            "Optional: capture SPA/authorization document if acting for owner.",
            authorityDocMeta,
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <button className="primary" disabled={submitting} type="submit">
          {submitting ? "Submitting..." : "Submit Identity Verification"}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            Result: {toLabel(result.summary.overallStatus)} ({result.summary.passed} pass, {result.summary.needsReview}{" "}
            review, {result.summary.failed} fail)
          </p>
          <p className="small" style={{ margin: "4px 0 0" }}>
            Pasalo ID issued: {result.item.platform_identity_code}
          </p>
        </div>
      )}

      <div className="profile-actions" style={{ marginTop: 14 }}>
        <Link className="ghost-button" href="/profile">
          Profile
        </Link>
      </div>
    </section>
  );
}
