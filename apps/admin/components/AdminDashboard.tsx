"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { clearAdminAuthToken, getAdminAuthToken } from "../lib/auth";

type DashboardData = {
  summary: {
    total_listings: number | string;
    live_listings: number | string;
    pending_listings: number | string;
    total_users: number | string;
    buyer_users: number | string;
    seller_users: number | string;
    agent_users: number | string;
    attorney_users: number | string;
    admin_users: number | string;
    average_cash_out_price_php: number | string;
    pending_verifications: number | string;
    pending_document_assistance: number | string;
    pending_role_applications: number | string;
    total_conversations: number | string;
    pending_payment_intents: number | string;
    total_audit_logs: number | string;
  };
  topLocations: Array<{
    location_province: string;
    location_city: string;
    listing_count: number | string;
  }>;
  deals: {
    total_deals: number | string;
    inquiry: number | string;
    qualified: number | string;
    offer: number | string;
    developer_review: number | string;
    closed_won: number | string;
    closed_lost: number | string;
  };
};

type PendingListing = {
  id: string;
  title: string;
  project_name: string;
  location_city: string;
  location_province: string;
  seller_name: string | null;
  verification_status: string | null;
};

type VerificationItem = {
  id: string;
  listing_id: string;
  user_id: string;
  doc_type: string;
  file_key: string;
  ai_auth_status: "pass" | "review" | "fail";
  ai_confidence: number | string;
  ai_flags: string[] | null;
  ai_checked_at: string | null;
  status: string;
  created_at: string;
};

type RoleApplication = {
  id: string;
  user_id: string;
  email: string;
  from_role: string;
  requested_role: string;
  reason: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type UserItem = {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  verification_status: string | null;
  listing_count: number | string;
  created_at: string;
};

type ListingItem = {
  id: string;
  title: string;
  status: string;
  transaction_status: string;
  transfer_status: string;
  is_featured: boolean;
  readiness_score: number;
  owner_email: string | null;
  owner_name: string | null;
  location_city: string;
  location_province: string;
  cash_out_price_php: number | string | null;
  monthly_amortization_php: number | string | null;
  document_assistance_requested: boolean;
  document_assistance_status: string;
  document_assistance_notes: string | null;
  commission_rate_pct: number | string | null;
  lead_validity_months: number | string | null;
  payment_due_days: number | string | null;
};

type LeadItem = {
  id: string;
  listing_title: string;
  buyer_name: string | null;
  buyer_email: string;
  buyer_phone: string | null;
  source: string;
  first_inquiry_at: string;
  last_activity_at: string;
};

type ConversationItem = {
  id: string;
  listing_title: string;
  buyer_email: string | null;
  seller_email: string | null;
  message_count: number | string;
  pending_payment_count: number | string;
  last_message_at: string | null;
};

type PaymentIntentItem = {
  id: string;
  listing_title: string;
  payer_email: string | null;
  payee_email: string | null;
  amount_php: number | string;
  status: string;
  created_at: string;
};

type AuditLogItem = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  actor_email: string | null;
  created_at: string;
};

type PaginatedResponse<T> = {
  items: T[];
};

type ListingDraft = {
  status: string;
  isFeatured: boolean;
  readinessScore: number;
  documentAssistanceRequested: boolean;
  documentAssistanceStatus: string;
  documentAssistanceNotes: string;
  commissionRatePct: number;
  leadValidityMonths: number;
  paymentDueDays: number;
};

type DeveloperItem = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number | string;
  created_at: string;
  updated_at: string;
};

type DeveloperDraft = {
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type AdminTabId = "overview" | "moderation" | "users" | "listings" | "activity" | "payments";

function formatPhp(value: number | string | null): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([]);
  const [verifications, setVerifications] = useState<VerificationItem[]>([]);
  const [roleApplications, setRoleApplications] = useState<RoleApplication[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [developers, setDevelopers] = useState<DeveloperItem[]>([]);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [paymentIntents, setPaymentIntents] = useState<PaymentIntentItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const [listingDrafts, setListingDrafts] = useState<Record<string, ListingDraft>>({});
  const [developerDrafts, setDeveloperDrafts] = useState<Record<string, DeveloperDraft>>({});
  const [newDeveloperName, setNewDeveloperName] = useState("");
  const [newDeveloperSortOrder, setNewDeveloperSortOrder] = useState(0);

  useEffect(() => {
    setToken(getAdminAuthToken());
  }, []);

  const hydrateListingDrafts = useCallback((items: ListingItem[]) => {
    setListingDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.id]) {
          next[item.id] = {
            status: item.status,
            isFeatured: item.is_featured,
            readinessScore: Number(item.readiness_score ?? 0),
            documentAssistanceRequested: Boolean(item.document_assistance_requested),
            documentAssistanceStatus: item.document_assistance_status ?? "not_requested",
            documentAssistanceNotes: item.document_assistance_notes ?? "",
            commissionRatePct: Number(item.commission_rate_pct ?? 3),
            leadValidityMonths: Number(item.lead_validity_months ?? 12),
            paymentDueDays: Number(item.payment_due_days ?? 7),
          };
        }
      }
      return next;
    });
  }, []);

  const hydrateDeveloperDrafts = useCallback((items: DeveloperItem[]) => {
    setDeveloperDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.id]) {
          next[item.id] = {
            name: item.name,
            isActive: item.is_active,
            sortOrder: Number(item.sort_order ?? 0),
          };
        }
      }
      return next;
    });
  }, []);

  const loadAll = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        dashboardResult,
        pendingListingsResult,
        verificationsResult,
        roleApplicationsResult,
        usersResult,
        listingsResult,
        developersResult,
        leadsResult,
        conversationsResult,
        paymentIntentsResult,
        auditLogsResult,
      ] = await Promise.all([
        apiFetch<DashboardData>("/admin/dashboard", { token }),
        apiFetch<{ items: PendingListing[] }>("/admin/listings/pending", { token }),
        apiFetch<{ items: VerificationItem[] }>("/admin/verifications", { token }),
        apiFetch<{ items: RoleApplication[] }>("/admin/role-applications?status=pending", { token }),
        apiFetch<PaginatedResponse<UserItem>>("/admin/users?page=1&pageSize=25", { token }),
        apiFetch<PaginatedResponse<ListingItem>>("/admin/listings?page=1&pageSize=25", { token }),
        apiFetch<{ items: DeveloperItem[] }>("/admin/developers?includeInactive=true", { token }),
        apiFetch<PaginatedResponse<LeadItem>>("/admin/leads?page=1&pageSize=25", { token }),
        apiFetch<PaginatedResponse<ConversationItem>>("/admin/conversations?page=1&pageSize=25", { token }),
        apiFetch<PaginatedResponse<PaymentIntentItem>>("/admin/payment-intents?page=1&pageSize=25", { token }),
        apiFetch<PaginatedResponse<AuditLogItem>>("/admin/audit-logs?page=1&pageSize=25", { token }),
      ]);

      setDashboard(dashboardResult);
      setPendingListings(pendingListingsResult.items);
      setVerifications(verificationsResult.items);
      setRoleApplications(roleApplicationsResult.items);
      setUsers(usersResult.items);
      setListings(listingsResult.items);
      setDevelopers(developersResult.items);
      setLeads(leadsResult.items);
      setConversations(conversationsResult.items);
      setPaymentIntents(paymentIntentsResult.items);
      setAuditLogs(auditLogsResult.items);
      hydrateListingDrafts(listingsResult.items);
      hydrateDeveloperDrafts(developersResult.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load admin dashboard";
      setError(message);

      if (message.toLowerCase().includes("401") || message.toLowerCase().includes("403")) {
        clearAdminAuthToken();
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [hydrateDeveloperDrafts, hydrateListingDrafts, token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const requireToken = (): string | null => {
    if (!token) {
      setError("Admin login is required.");
      return null;
    }
    return token;
  };

  const refresh = async (message: string) => {
    setActionStatus(message);
    await loadAll();
  };

  const reviewListing = async (id: string, action: "approve" | "reject") => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    let rejectionReason: string | undefined;
    if (action === "reject") {
      const reason = window.prompt("Rejection reason (minimum 5 chars):", "");
      if (!reason || reason.trim().length < 5) {
        return;
      }
      rejectionReason = reason.trim();
    }

    try {
      await apiFetch(`/admin/listings/${id}/review`, {
        method: "PATCH",
        token: authToken,
        body: {
          action,
          ...(rejectionReason ? { rejectionReason } : {}),
        },
      });
      await refresh(`Listing ${action}d.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review listing");
    }
  };

  const reviewVerification = async (id: string, action: "approve" | "reject") => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    let rejectionReason: string | undefined;
    if (action === "reject") {
      const reason = window.prompt("Rejection reason (minimum 5 chars):", "");
      if (!reason || reason.trim().length < 5) {
        return;
      }
      rejectionReason = reason.trim();
    }

    try {
      await apiFetch(`/admin/verifications/${id}`, {
        method: "PATCH",
        token: authToken,
        body: {
          action,
          ...(rejectionReason ? { rejectionReason } : {}),
        },
      });
      await refresh(`Verification ${action}d.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review verification");
    }
  };

  const reviewRoleApplication = async (id: string, action: "approve" | "reject") => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    let rejectionReason: string | undefined;
    if (action === "reject") {
      const reason = window.prompt("Rejection reason (minimum 5 chars):", "");
      if (!reason || reason.trim().length < 5) {
        return;
      }
      rejectionReason = reason.trim();
    }

    try {
      await apiFetch(`/admin/role-applications/${id}`, {
        method: "PATCH",
        token: authToken,
        body: {
          action,
          ...(rejectionReason ? { rejectionReason } : {}),
        },
      });
      await refresh(`Role application ${action}d.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review role application");
    }
  };

  const updateUserRole = async (id: string, role: string) => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    try {
      await apiFetch(`/admin/users/${id}/role`, {
        method: "PATCH",
        token: authToken,
        body: { role },
      });
      await refresh("User role updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user role");
    }
  };

  const updateListing = async (item: ListingItem) => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    const draft = listingDrafts[item.id];
    if (!draft) {
      return;
    }

    try {
      await apiFetch(`/admin/listings/${item.id}`, {
        method: "PATCH",
        token: authToken,
        body: {
          status: draft.status,
          isFeatured: draft.isFeatured,
          readinessScore: Number(draft.readinessScore),
          documentAssistanceRequested: draft.documentAssistanceRequested,
          documentAssistanceStatus: draft.documentAssistanceStatus,
          documentAssistanceNotes: draft.documentAssistanceNotes.trim() ? draft.documentAssistanceNotes.trim() : null,
          commissionRatePct: Number(draft.commissionRatePct),
          leadValidityMonths: Number(draft.leadValidityMonths),
          paymentDueDays: Number(draft.paymentDueDays),
        },
      });
      await refresh("Listing updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update listing");
    }
  };

  const createDeveloper = async () => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    const trimmedName = newDeveloperName.trim();
    if (!trimmedName) {
      setError("Developer name is required.");
      return;
    }

    try {
      await apiFetch("/admin/developers", {
        method: "POST",
        token: authToken,
        body: {
          name: trimmedName,
          sortOrder: Number(newDeveloperSortOrder || 0),
          isActive: true,
        },
      });
      setNewDeveloperName("");
      setNewDeveloperSortOrder(0);
      await refresh("Developer added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create developer");
    }
  };

  const updateDeveloper = async (item: DeveloperItem) => {
    const authToken = requireToken();
    if (!authToken) {
      return;
    }

    const draft = developerDrafts[item.id];
    if (!draft) {
      return;
    }

    try {
      await apiFetch(`/admin/developers/${item.id}`, {
        method: "PATCH",
        token: authToken,
        body: {
          name: draft.name.trim(),
          isActive: draft.isActive,
          sortOrder: Number(draft.sortOrder || 0),
        },
      });
      await refresh("Developer updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update developer");
    }
  };

  const logout = () => {
    clearAdminAuthToken();
    setToken(null);
    window.location.href = "/login";
  };

  const cards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { label: "Total listings", value: Number(dashboard.summary.total_listings) },
      { label: "Live listings", value: Number(dashboard.summary.live_listings) },
      { label: "Pending listings", value: Number(dashboard.summary.pending_listings) },
      { label: "Total users", value: Number(dashboard.summary.total_users) },
      { label: "Attorney users", value: Number(dashboard.summary.attorney_users) },
      { label: "Pending verifications", value: Number(dashboard.summary.pending_verifications) },
      { label: "Doc assistance pending", value: Number(dashboard.summary.pending_document_assistance) },
      { label: "Pending role apps", value: Number(dashboard.summary.pending_role_applications) },
      { label: "Conversations", value: Number(dashboard.summary.total_conversations) },
      { label: "Pending payments", value: Number(dashboard.summary.pending_payment_intents) },
    ];
  }, [dashboard]);

  const tabs = useMemo(
    () => [
      { id: "overview" as const, label: "Overview" },
      { id: "moderation" as const, label: "Moderation", badge: pendingListings.length + verifications.length + roleApplications.length },
      { id: "users" as const, label: "Users", badge: users.length },
      { id: "listings" as const, label: "Listings", badge: listings.length },
      { id: "activity" as const, label: "Leads & Chat", badge: leads.length + conversations.length },
      { id: "payments" as const, label: "Payments & Audit", badge: paymentIntents.length + auditLogs.length },
    ],
    [
      pendingListings.length,
      verifications.length,
      roleApplications.length,
      users.length,
      listings.length,
      leads.length,
      conversations.length,
      paymentIntents.length,
      auditLogs.length,
    ],
  );

  if (!token) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <p className="eyebrow">Pasalo Admin</p>
          <h1>Admin access required</h1>
          <p className="muted">Login with an admin account to manage listings, users, verification, and transactions.</p>
          <button onClick={() => (window.location.href = "/login")} type="button">
            Go to login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Pasalo Admin Console</p>
          <h1>Operations Dashboard</h1>
        </div>
        <div className="admin-header-actions">
          <button onClick={() => void loadAll()} type="button" disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="button-ghost" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>

      {actionStatus && <p className="status-text">{actionStatus}</p>}
      {error && <p className="error-text">{error}</p>}

      <nav className="admin-tabs" aria-label="Admin navigation tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`admin-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
            {tab.badge !== undefined && <span className="admin-tab-badge">{tab.badge}</span>}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <section className="panel">
            <h2>Overview</h2>
            <div className="stat-grid">
              {cards.map((card) => (
                <article className="stat-card" key={card.label}>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>
            {dashboard && (
              <div className="meta-grid">
                <p>
                  Average cash out: <strong>{formatPhp(dashboard.summary.average_cash_out_price_php)}</strong>
                </p>
                <p>
                  Deals closed won: <strong>{Number(dashboard.deals.closed_won)}</strong>
                </p>
                <p>
                  Deals closed lost: <strong>{Number(dashboard.deals.closed_lost)}</strong>
                </p>
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Top Locations</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Province</th>
                    <th>City</th>
                    <th>Listings</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard?.topLocations.map((item) => (
                    <tr key={`${item.location_province}-${item.location_city}`}>
                      <td>{item.location_province}</td>
                      <td>{item.location_city}</td>
                      <td>{Number(item.listing_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === "moderation" && (
        <>
          <section className="panel">
            <h2>Pending Listing Reviews</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Project</th>
                    <th>Location</th>
                    <th>Seller</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingListings.map((item) => (
                    <tr key={item.id}>
                      <td>{item.title}</td>
                      <td>{item.project_name}</td>
                      <td>
                        {item.location_city}, {item.location_province}
                      </td>
                      <td>{item.seller_name ?? "N/A"}</td>
                      <td className="inline-actions">
                        <button onClick={() => void reviewListing(item.id, "approve")} type="button">
                          Approve
                        </button>
                        <button className="button-ghost" onClick={() => void reviewListing(item.id, "reject")} type="button">
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel two-col">
            <article>
              <h2>Verification Queue</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Listing</th>
                      <th>Doc Type</th>
                      <th>AI Auth</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((item) => (
                      <tr key={item.id}>
                        <td>{item.listing_id.slice(0, 8)}</td>
                        <td>{item.doc_type}</td>
                        <td className="cell-wrap">
                          {item.ai_auth_status} ({Math.round(Number(item.ai_confidence) * 100)}%)
                          {!!item.ai_flags?.length && (
                            <>
                              <br />
                              <span className="muted">{item.ai_flags.join(", ")}</span>
                            </>
                          )}
                        </td>
                        <td>{item.status}</td>
                        <td className="inline-actions">
                          <button onClick={() => void reviewVerification(item.id, "approve")} type="button">
                            Approve
                          </button>
                          <button className="button-ghost" onClick={() => void reviewVerification(item.id, "reject")} type="button">
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article>
              <h2>Role Applications</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Change</th>
                      <th>Reason</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleApplications.map((item) => (
                      <tr key={item.id}>
                        <td>{item.email}</td>
                        <td>
                          {item.from_role} -&gt; {item.requested_role}
                        </td>
                        <td className="cell-wrap">{item.reason}</td>
                        <td className="inline-actions">
                          <button onClick={() => void reviewRoleApplication(item.id, "approve")} type="button">
                            Approve
                          </button>
                          <button className="button-ghost" onClick={() => void reviewRoleApplication(item.id, "reject")} type="button">
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}

      {activeTab === "users" && (
        <section className="panel">
          <h2>User Management</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Verification</th>
                  <th>Listings</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name ?? "N/A"}</td>
                    <td>
                      <select value={user.role} onChange={(event) => void updateUserRole(user.id, event.target.value)}>
                        <option value="buyer">buyer</option>
                        <option value="seller">seller</option>
                        <option value="agent">agent</option>
                        <option value="attorney">attorney</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{user.verification_status ?? "N/A"}</td>
                    <td>{Number(user.listing_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "listings" && (
        <>
          <section className="panel">
            <h2>Listing Management</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th>Readiness</th>
                    <th>Commission %</th>
                    <th>Lead Validity (months)</th>
                    <th>Payment Due (days)</th>
                    <th>Doc Assist</th>
                    <th>Assist Status</th>
                    <th>Assist Notes</th>
                    <th>Cash Out</th>
                    <th>Owner</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((item) => {
                    const draft = listingDrafts[item.id] ?? {
                      status: item.status,
                      isFeatured: item.is_featured,
                      readinessScore: Number(item.readiness_score ?? 0),
                      documentAssistanceRequested: Boolean(item.document_assistance_requested),
                      documentAssistanceStatus: item.document_assistance_status ?? "not_requested",
                      documentAssistanceNotes: item.document_assistance_notes ?? "",
                      commissionRatePct: Number(item.commission_rate_pct ?? 3),
                      leadValidityMonths: Number(item.lead_validity_months ?? 12),
                      paymentDueDays: Number(item.payment_due_days ?? 7),
                    };

                    return (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td>
                          <select
                            value={draft.status}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  status: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="draft">draft</option>
                            <option value="pending_review">pending_review</option>
                            <option value="live">live</option>
                            <option value="paused">paused</option>
                            <option value="expired">expired</option>
                            <option value="rejected">rejected</option>
                            <option value="archived">archived</option>
                          </select>
                        </td>
                        <td>
                          <input
                            checked={draft.isFeatured}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  isFeatured: event.target.checked,
                                },
                              }))
                            }
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <input
                            min={0}
                            max={100}
                            type="number"
                            value={draft.readinessScore}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  readinessScore: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={3}
                            max={5}
                            step={0.1}
                            value={draft.commissionRatePct}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  commissionRatePct: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={6}
                            max={12}
                            value={draft.leadValidityMonths}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  leadValidityMonths: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={draft.paymentDueDays}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  paymentDueDays: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            checked={draft.documentAssistanceRequested}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  documentAssistanceRequested: event.target.checked,
                                  documentAssistanceStatus: event.target.checked
                                    ? draft.documentAssistanceStatus === "not_requested"
                                      ? "requested"
                                      : draft.documentAssistanceStatus
                                    : "not_requested",
                                  documentAssistanceNotes: event.target.checked ? draft.documentAssistanceNotes : "",
                                },
                              }))
                            }
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <select
                            disabled={!draft.documentAssistanceRequested}
                            value={draft.documentAssistanceStatus}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  documentAssistanceStatus: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="not_requested">not_requested</option>
                            <option value="requested">requested</option>
                            <option value="in_review">in_review</option>
                            <option value="collecting_documents">collecting_documents</option>
                            <option value="processing">processing</option>
                            <option value="completed">completed</option>
                            <option value="declined">declined</option>
                          </select>
                        </td>
                        <td>
                          <input
                            disabled={!draft.documentAssistanceRequested}
                            placeholder="Notes"
                            value={draft.documentAssistanceNotes}
                            onChange={(event) =>
                              setListingDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  documentAssistanceNotes: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                        <td>{formatPhp(item.cash_out_price_php)}</td>
                        <td>{item.owner_email ?? item.owner_name ?? "N/A"}</td>
                        <td>
                          <button onClick={() => void updateListing(item)} type="button">
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h2>Developers Catalog</h2>
            <div className="inline-actions" style={{ marginBottom: 12 }}>
              <input
                placeholder="Add developer name"
                value={newDeveloperName}
                onChange={(event) => setNewDeveloperName(event.target.value)}
              />
              <input
                type="number"
                min={0}
                placeholder="Sort"
                value={newDeveloperSortOrder}
                onChange={(event) => setNewDeveloperSortOrder(Number(event.target.value))}
                style={{ width: 110 }}
              />
              <button onClick={() => void createDeveloper()} type="button">
                Add developer
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Active</th>
                    <th>Sort</th>
                    <th>Updated</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {developers.map((item) => {
                    const draft = developerDrafts[item.id] ?? {
                      name: item.name,
                      isActive: item.is_active,
                      sortOrder: Number(item.sort_order ?? 0),
                    };

                    return (
                      <tr key={item.id}>
                        <td>
                          <input
                            value={draft.name}
                            onChange={(event) =>
                              setDeveloperDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  name: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            checked={draft.isActive}
                            onChange={(event) =>
                              setDeveloperDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  isActive: event.target.checked,
                                },
                              }))
                            }
                            type="checkbox"
                          />
                        </td>
                        <td>
                          <input
                            min={0}
                            type="number"
                            value={draft.sortOrder}
                            onChange={(event) =>
                              setDeveloperDrafts((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...draft,
                                  sortOrder: Number(event.target.value),
                                },
                              }))
                            }
                          />
                        </td>
                        <td>{formatDate(item.updated_at)}</td>
                        <td>
                          <button onClick={() => void updateDeveloper(item)} type="button">
                            Save
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {activeTab === "activity" && (
        <section className="panel two-col">
          <article>
            <h2>Platform Leads</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Buyer</th>
                    <th>Email</th>
                    <th>First Inquiry</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((item) => (
                    <tr key={item.id}>
                      <td>{item.listing_title}</td>
                      <td>{item.buyer_name ?? "N/A"}</td>
                      <td>{item.buyer_email}</td>
                      <td>{formatDate(item.first_inquiry_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article>
            <h2>Conversation Monitor</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Messages</th>
                    <th>Pending Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((item) => (
                    <tr key={item.id}>
                      <td>{item.listing_title}</td>
                      <td>{item.buyer_email ?? "N/A"}</td>
                      <td>{item.seller_email ?? "N/A"}</td>
                      <td>{Number(item.message_count)}</td>
                      <td>{Number(item.pending_payment_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {activeTab === "payments" && (
        <section className="panel two-col">
          <article>
            <h2>Payment Intents</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Payer</th>
                    <th>Payee</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentIntents.map((item) => (
                    <tr key={item.id}>
                      <td>{item.listing_title}</td>
                      <td>{item.payer_email ?? "N/A"}</td>
                      <td>{item.payee_email ?? "N/A"}</td>
                      <td>{formatPhp(item.amount_php)}</td>
                      <td>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article>
            <h2>Audit Logs</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Actor</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((item) => (
                    <tr key={item.id}>
                      <td>{item.action}</td>
                      <td>{item.target_type}</td>
                      <td>{item.actor_email ?? "system"}</td>
                      <td>{formatDate(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}
