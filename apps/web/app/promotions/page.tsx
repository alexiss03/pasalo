"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type MeResponse = {
  email: string;
  full_name: string | null;
  role: string;
};

type PromotionLead = {
  fullName: string;
  email: string;
  audience: string;
  interest: string;
  submittedAt: string;
};

const storageKey = "pasalo-promotions-early-access";

const promotionPrograms = [
  {
    title: "Early Access",
    copy: "Get first access to premium placements, verification upgrades, and launch campaigns before public rollout.",
  },
  {
    title: "Featured Launch Boosts",
    copy: "Reserve launch-week placement for high-priority pasalo listings across Metro Manila, Laguna, and Cavite.",
  },
  {
    title: "Partner Promotions",
    copy: "Join seller, broker, attorney, or developer campaigns when Pasalo opens bundled promotional slots.",
  },
];

export default function PromotionsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [audience, setAudience] = useState("buyer");
  const [interest, setInterest] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();

    const load = async () => {
      try {
        if (token) {
          const me = await apiFetch<MeResponse>("/me", { token });
          setEmail((current) => current || me.email);
          setFullName((current) => current || me.full_name || "");
          setAudience((current) => current || me.role || "buyer");
        }
      } catch {
        // Prefill is optional.
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!fullName.trim() || !email.trim()) {
      setError("Enter your full name and email.");
      return;
    }

    const nextLead: PromotionLead = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      audience: audience.trim() || "buyer",
      interest: interest.trim(),
      submittedAt: new Date().toISOString(),
    };

    try {
      const raw = window.localStorage.getItem(storageKey);
      const current = raw ? (JSON.parse(raw) as PromotionLead[]) : [];
      const deduped = current.filter((item) => item.email !== nextLead.email);
      window.localStorage.setItem(storageKey, JSON.stringify([nextLead, ...deduped]));
      setStatus("You’re in the early access list for promotions.");
      setInterest("");
    } catch {
      setStatus("You’re in the early access list for promotions.");
    }
  };

  return (
    <section className="grid" style={{ gap: 18 }}>
      <div className="card">
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Promotions</h1>
        <p className="small" style={{ margin: 0 }}>
          Join the early access list for launch promotions, featured placement offers, and partner campaigns.
        </p>
      </div>

      <div className="project-summary-grid">
        {promotionPrograms.map((item) => (
          <article className="card" key={item.title}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>{item.title}</h3>
            <p className="small" style={{ margin: 0 }}>
              {item.copy}
            </p>
          </article>
        ))}
      </div>

      <form className="card grid page-card page-card-narrow" onSubmit={submit}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Join Early Access</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Add yourself to the promotions list and we’ll keep your details ready for upcoming launch offers.
          </p>
        </div>

        <label className="form-field">
          <span className="field-label">Full Name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
          />
        </label>

        <label className="form-field">
          <span className="field-label">Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
          />
        </label>

        <label className="form-field">
          <span className="field-label">I’m joining as</span>
          <select value={audience} onChange={(event) => setAudience(event.target.value)}>
            <option value="buyer">Buyer</option>
            <option value="seller">Seller</option>
            <option value="agent">Agent</option>
            <option value="attorney">Attorney</option>
            <option value="developer">Developer</option>
            <option value="partner">Partner</option>
          </select>
        </label>

        <label className="form-field">
          <span className="field-label">Promotion Interest</span>
          <textarea
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            placeholder="Tell us what kind of promo access you want."
            rows={4}
          />
        </label>

        <button className="primary" disabled={loading} type="submit">
          {loading ? "Loading..." : "Join Early Access"}
        </button>

        {status && (
          <p className="small" style={{ margin: 0, color: "#173d7a", fontWeight: 600 }}>
            {status}
          </p>
        )}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      </form>
    </section>
  );
}
