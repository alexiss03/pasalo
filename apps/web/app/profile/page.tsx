"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { clearAuthToken, getAuthToken } from "../../lib/auth";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  verification_status: string | null;
  verification_badge_shown: boolean | null;
  platform_identity_code: string | null;
  identity_review_status: string | null;
  identity_ai_status: string | null;
  identity_submitted_at: string | null;
};

export default function ProfilePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/profile";
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const result = await apiFetch<MeResponse>("/me", { token });
        setMe(result);
      } catch {
        setMe(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const logout = () => {
    clearAuthToken();
    window.location.href = "/";
  };

  return (
    <section className="card profile-card page-card page-card-narrow">
      <h1 style={{ marginTop: 0 }}>Profile</h1>
      {loading && <p className="small">Loading profile...</p>}
      {!loading && !me && <p className="small">Unable to load profile right now.</p>}
      {!loading && me && (
        <div className="profile-layout">
          {me.verification_status !== "verified" && (
            <div className="verification-cta">
              <Link className="verification-cta-button" href="/verify-identity">
                <span className="verification-cta-title">Identity verification required</span>
                <span className="small verification-cta-copy">
                  Use Pasalo Identity for secure in-app photo ID and document authentication.
                </span>
                <span className="verification-cta-label">Verify Now</span>
              </Link>
            </div>
          )}

          <h3 className="profile-subhead">Account Overview</h3>
          <div className="profile-props-grid">
            <article className="profile-prop-card">
              <p>Email</p>
              <strong>{me.email}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Name</p>
              <strong>{me.full_name ?? "N/A"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Role</p>
              <strong>{me.role}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Phone</p>
              <strong>{me.phone ?? "N/A"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>City</p>
              <strong>{me.city ?? "N/A"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Verification</p>
              <strong>{me.verification_status ?? "N/A"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Pasalo ID</p>
              <strong>{me.platform_identity_code ?? "Not issued yet"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Identity auth</p>
              <strong>{me.identity_ai_status ?? "N/A"}</strong>
            </article>
            <article className="profile-prop-card">
              <p>Identity review</p>
              <strong>{me.identity_review_status ?? "N/A"}</strong>
            </article>
          </div>
          <div className="profile-actions">
            <Link className="ghost-button" href="/my-properties">
              My Properties
            </Link>
            <Link className="ghost-button" href="/apply-role">
              Apply Role
            </Link>
            <button className="ghost-button" onClick={logout} type="button">
              Logout
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
