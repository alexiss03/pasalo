"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type AppRole = "buyer" | "seller" | "agent";

type Me = {
  id: string;
  email: string;
  role: AppRole | "admin";
};

type RoleApplication = {
  id: string;
  from_role: AppRole | "admin";
  requested_role: AppRole;
  reason: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

const roleLabels: Record<AppRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
};

export default function ApplyRolePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<RoleApplication[]>([]);
  const [requestedRole, setRequestedRole] = useState<AppRole>("agent");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const token = getAuthToken();
    if (!token) {
      setError("Login first to submit a role application.");
      return;
    }

    const [meResponse, appsResponse] = await Promise.all([
      apiFetch<Me>("/me", { token }),
      apiFetch<{ items: RoleApplication[] }>("/me/role-applications", { token }),
    ]);

    setMe(meResponse);
    setItems(appsResponse.items);
  };

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Unable to load role application data");
    });
  }, []);

  const availableRoles = useMemo(() => {
    if (!me || me.role === "admin") {
      return ["buyer", "seller", "agent"] as AppRole[];
    }

    return (["buyer", "seller", "agent"] as AppRole[]).filter((role) => role !== me.role);
  }, [me]);

  useEffect(() => {
    if (!availableRoles.includes(requestedRole)) {
      setRequestedRole(availableRoles[0] ?? "agent");
    }
  }, [availableRoles, requestedRole]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    const token = getAuthToken();
    if (!token) {
      setError("Login first to submit a role application.");
      return;
    }

    try {
      await apiFetch("/me/role-applications", {
        method: "POST",
        token,
        body: {
          requestedRole,
          reason,
        },
      });
      setStatus("Role application submitted successfully.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit role application");
    }
  };

  return (
    <section className="grid" style={{ gap: 18 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Apply For Another Role</h1>
        <p className="small" style={{ marginBottom: 0 }}>
          Signup is limited to Buyer or Seller. Additional roles are granted after admin review.
        </p>
      </div>

      <form className="card grid" onSubmit={submit}>
        <label>
          <div className="small" style={{ marginBottom: 6 }}>
            Requested Role
          </div>
          <select
            value={requestedRole}
            onChange={(event) => setRequestedRole(event.target.value as AppRole)}
            disabled={availableRoles.length === 0}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div className="small" style={{ marginBottom: 6 }}>
            Why are you requesting this role?
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={1200}
            rows={4}
            placeholder="Explain your use case and intended activity on the platform"
            required
          />
        </label>

        <button className="primary" type="submit">
          Submit Application
        </button>

        {status && <p>{status}</p>}
        {error && <p className="error">{error}</p>}
      </form>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>My Applications</h2>
        {!items.length && <p className="small">No applications submitted yet.</p>}

        <div className="grid" style={{ gap: 10 }}>
          {items.map((item) => (
            <article className="card" key={item.id} style={{ padding: 14 }}>
              <p style={{ margin: 0 }}>
                <strong>
                  {item.from_role} → {item.requested_role}
                </strong>
              </p>
              <p className="small" style={{ margin: "6px 0" }}>
                Status: {item.status}
              </p>
              <p style={{ margin: "6px 0" }}>{item.reason}</p>
              {item.rejection_reason && <p className="error">Reason: {item.rejection_reason}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
