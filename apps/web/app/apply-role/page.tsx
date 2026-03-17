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

const cityProvinceOptions = [
  "Quezon City, Metro Manila",
  "Makati, Metro Manila",
  "Taguig, Metro Manila",
  "Pasig, Metro Manila",
  "Manila, Metro Manila",
  "Mandaluyong, Metro Manila",
  "Marikina, Metro Manila",
  "Caloocan, Metro Manila",
  "Paranaque, Metro Manila",
  "Las Pinas, Metro Manila",
  "Muntinlupa, Metro Manila",
  "Valenzuela, Metro Manila",
  "San Juan, Metro Manila",
  "Bacoor, Cavite",
  "Dasmarinas, Cavite",
  "Imus, Cavite",
  "General Trias, Cavite",
  "Santa Rosa, Laguna",
  "Binan, Laguna",
  "Calamba, Laguna",
  "San Pedro, Laguna",
  "Cabuyao, Laguna",
];

type SellerCapacity = "registered_owner" | "co_owner" | "authorized_representative" | "broker_partner";
type TinStatus = "with_tin" | "applying_tin" | "unknown";

type SellerDetails = {
  legalName: string;
  contactNumber: string;
  cityProvince: string;
  capacity: SellerCapacity;
  tinStatus: TinStatus;
  hasGovernmentId: boolean;
  hasTransferDocument: boolean;
  hasTitleOrTaxDeclaration: boolean;
  hasStatementOfAccount: boolean;
  hasAuthorityDocument: boolean;
  legalComplianceAccepted: boolean;
};

const capacityLabels: Record<SellerCapacity, string> = {
  registered_owner: "Registered owner",
  co_owner: "Co-owner",
  authorized_representative: "Authorized representative (with SPA/Board Resolution)",
  broker_partner: "Working with licensed broker/partner",
};

const tinStatusLabels: Record<TinStatus, string> = {
  with_tin: "With TIN",
  applying_tin: "Applying for TIN",
  unknown: "Not sure yet",
};

const defaultSellerDetails: SellerDetails = {
  legalName: "",
  contactNumber: "",
  cityProvince: "",
  capacity: "registered_owner",
  tinStatus: "with_tin",
  hasGovernmentId: false,
  hasTransferDocument: false,
  hasTitleOrTaxDeclaration: false,
  hasStatementOfAccount: false,
  hasAuthorityDocument: false,
  legalComplianceAccepted: false,
};

type BuyerTimeline = "immediate_3_months" | "within_6_months" | "within_12_months" | "exploring";
type BuyerFinancing = "cash" | "pagibig" | "bank" | "in_house" | "undecided";

type BuyerDetails = {
  legalName: string;
  contactNumber: string;
  cityProvince: string;
  preferredLocations: string;
  budgetRangePhp: string;
  financingPlan: BuyerFinancing;
  targetTimeline: BuyerTimeline;
  hasGovernmentId: boolean;
  understandsTransferProcess: boolean;
};

const buyerTimelineLabels: Record<BuyerTimeline, string> = {
  immediate_3_months: "Immediate (0-3 months)",
  within_6_months: "Within 6 months",
  within_12_months: "Within 12 months",
  exploring: "Exploring only",
};

const buyerFinancingLabels: Record<BuyerFinancing, string> = {
  cash: "Cash",
  pagibig: "Pag-IBIG",
  bank: "Bank financing",
  in_house: "In-house financing",
  undecided: "Undecided",
};

const defaultBuyerDetails: BuyerDetails = {
  legalName: "",
  contactNumber: "",
  cityProvince: "",
  preferredLocations: "",
  budgetRangePhp: "",
  financingPlan: "undecided",
  targetTimeline: "within_6_months",
  hasGovernmentId: false,
  understandsTransferProcess: false,
};

type AgentExperienceLevel = "new" | "1_3_years" | "4_7_years" | "8_plus_years";

type AgentDetails = {
  legalName: string;
  contactNumber: string;
  cityProvince: string;
  prcLicenseNumber: string;
  prcRegistrationValidUntil: string;
  brokerageName: string;
  serviceAreas: string;
  experienceLevel: AgentExperienceLevel;
  hasGovernmentId: boolean;
  hasPtrOrOfficialReceipt: boolean;
  legalComplianceAccepted: boolean;
};

const agentExperienceLabels: Record<AgentExperienceLevel, string> = {
  new: "Newly licensed",
  "1_3_years": "1-3 years",
  "4_7_years": "4-7 years",
  "8_plus_years": "8+ years",
};

const defaultAgentDetails: AgentDetails = {
  legalName: "",
  contactNumber: "",
  cityProvince: "",
  prcLicenseNumber: "",
  prcRegistrationValidUntil: "",
  brokerageName: "",
  serviceAreas: "",
  experienceLevel: "new",
  hasGovernmentId: false,
  hasPtrOrOfficialReceipt: false,
  legalComplianceAccepted: false,
};

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildSellerReason(baseReason: string, seller: SellerDetails): string {
  const lines = [
    "[Seller Role Application - PH Standard Details]",
    `Purpose: ${normalizeSingleLine(baseReason)}`,
    `Legal name: ${normalizeSingleLine(seller.legalName)}`,
    `Contact number: ${normalizeSingleLine(seller.contactNumber)}`,
    `City/Province: ${normalizeSingleLine(seller.cityProvince)}`,
    `Seller capacity: ${capacityLabels[seller.capacity]}`,
    `TIN status: ${tinStatusLabels[seller.tinStatus]}`,
    "Document readiness:",
    `- Government ID: ${seller.hasGovernmentId ? "yes" : "no"}`,
    `- Notarized transfer document (sale/assignment): ${seller.hasTransferDocument ? "yes" : "no"}`,
    `- Tax declaration or title copy (OCT/TCT/CCT): ${seller.hasTitleOrTaxDeclaration ? "yes" : "no"}`,
    `- Statement of account / payment history: ${seller.hasStatementOfAccount ? "yes" : "no"}`,
    `- Authority document (SPA/Board Resolution), if representative: ${seller.hasAuthorityDocument ? "yes" : "no"}`,
    "Compliance acknowledgment: accepted",
  ];

  return lines.join("\n");
}

function buildBuyerReason(baseReason: string, buyer: BuyerDetails): string {
  const lines = [
    "[Buyer Role Application - Standard Details]",
    `Purpose: ${normalizeSingleLine(baseReason)}`,
    `Legal name: ${normalizeSingleLine(buyer.legalName)}`,
    `Contact number: ${normalizeSingleLine(buyer.contactNumber)}`,
    `City/Province: ${normalizeSingleLine(buyer.cityProvince)}`,
    `Preferred locations: ${normalizeSingleLine(buyer.preferredLocations)}`,
    `Budget range (PHP): ${normalizeSingleLine(buyer.budgetRangePhp)}`,
    `Financing plan: ${buyerFinancingLabels[buyer.financingPlan]}`,
    `Target timeline: ${buyerTimelineLabels[buyer.targetTimeline]}`,
    `Valid government ID ready: ${buyer.hasGovernmentId ? "yes" : "no"}`,
    "Transfer process acknowledgement: accepted",
  ];

  return lines.join("\n");
}

function buildAgentReason(baseReason: string, agent: AgentDetails): string {
  const lines = [
    "[Agent Role Application - PH Compliance Details]",
    `Purpose: ${normalizeSingleLine(baseReason)}`,
    `Legal name: ${normalizeSingleLine(agent.legalName)}`,
    `Contact number: ${normalizeSingleLine(agent.contactNumber)}`,
    `City/Province: ${normalizeSingleLine(agent.cityProvince)}`,
    `PRC license number: ${normalizeSingleLine(agent.prcLicenseNumber)}`,
    `PRC registration valid until: ${agent.prcRegistrationValidUntil}`,
    `Brokerage/Company: ${normalizeSingleLine(agent.brokerageName)}`,
    `Service areas: ${normalizeSingleLine(agent.serviceAreas)}`,
    `Experience level: ${agentExperienceLabels[agent.experienceLevel]}`,
    `Valid government ID ready: ${agent.hasGovernmentId ? "yes" : "no"}`,
    `PTR/Official Receipt available: ${agent.hasPtrOrOfficialReceipt ? "yes" : "no"}`,
    "RA 9646 compliance acknowledgement: accepted",
  ];

  return lines.join("\n");
}

export default function ApplyRolePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<RoleApplication[]>([]);
  const [requestedRole, setRequestedRole] = useState<AppRole>("agent");
  const [reason, setReason] = useState("");
  const [buyerRequirementsAccepted, setBuyerRequirementsAccepted] = useState(false);
  const [buyerDetails, setBuyerDetails] = useState<BuyerDetails>(defaultBuyerDetails);
  const [sellerRequirementsAccepted, setSellerRequirementsAccepted] = useState(false);
  const [sellerDetails, setSellerDetails] = useState<SellerDetails>(defaultSellerDetails);
  const [agentRequirementsAccepted, setAgentRequirementsAccepted] = useState(false);
  const [agentDetails, setAgentDetails] = useState<AgentDetails>(defaultAgentDetails);
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

    if (requestedRole === "buyer" && !buyerRequirementsAccepted) {
      setError("Confirm buyer requirements before submitting a buyer application.");
      return;
    }

    if (requestedRole === "buyer") {
      if (!normalizeSingleLine(buyerDetails.legalName)) {
        setError("Buyer legal name is required.");
        return;
      }
      if (!normalizeSingleLine(buyerDetails.contactNumber)) {
        setError("Buyer contact number is required.");
        return;
      }
      if (!normalizeSingleLine(buyerDetails.cityProvince)) {
        setError("Buyer city/province is required.");
        return;
      }
      if (!normalizeSingleLine(buyerDetails.preferredLocations)) {
        setError("Preferred locations are required.");
        return;
      }
      if (!normalizeSingleLine(buyerDetails.budgetRangePhp)) {
        setError("Buyer budget range is required.");
        return;
      }
      if (!buyerDetails.hasGovernmentId) {
        setError("Declare government ID readiness to continue.");
        return;
      }
      if (!buyerDetails.understandsTransferProcess) {
        setError("Acknowledge the transfer-process reminder to continue.");
        return;
      }
    }

    if (requestedRole === "seller" && !sellerRequirementsAccepted) {
      setError("Confirm seller requirements before submitting a seller application.");
      return;
    }

    if (requestedRole === "seller") {
      if (!normalizeSingleLine(sellerDetails.legalName)) {
        setError("Seller legal name is required.");
        return;
      }

      if (!normalizeSingleLine(sellerDetails.contactNumber)) {
        setError("Seller contact number is required.");
        return;
      }

      if (!normalizeSingleLine(sellerDetails.cityProvince)) {
        setError("Seller city/province is required.");
        return;
      }

      if (!sellerDetails.legalComplianceAccepted) {
        setError("Accept the legal compliance reminder to continue.");
        return;
      }
    }

    if (requestedRole === "agent" && !agentRequirementsAccepted) {
      setError("Confirm agent requirements before submitting an agent application.");
      return;
    }

    if (requestedRole === "agent") {
      if (!normalizeSingleLine(agentDetails.legalName)) {
        setError("Agent legal name is required.");
        return;
      }
      if (!normalizeSingleLine(agentDetails.contactNumber)) {
        setError("Agent contact number is required.");
        return;
      }
      if (!normalizeSingleLine(agentDetails.cityProvince)) {
        setError("Agent city/province is required.");
        return;
      }
      if (!normalizeSingleLine(agentDetails.prcLicenseNumber)) {
        setError("PRC license number is required for agent applications.");
        return;
      }
      if (!agentDetails.prcRegistrationValidUntil) {
        setError("PRC registration validity date is required.");
        return;
      }
      if (!normalizeSingleLine(agentDetails.brokerageName)) {
        setError("Brokerage/company name is required.");
        return;
      }
      if (!normalizeSingleLine(agentDetails.serviceAreas)) {
        setError("Service areas are required.");
        return;
      }
      if (!agentDetails.hasGovernmentId) {
        setError("Declare government ID readiness to continue.");
        return;
      }
      if (!agentDetails.hasPtrOrOfficialReceipt) {
        setError("Declare PTR/Official Receipt readiness to continue.");
        return;
      }
      if (!agentDetails.legalComplianceAccepted) {
        setError("Accept RA 9646 compliance reminder to continue.");
        return;
      }
    }

    const finalReason =
      requestedRole === "seller"
        ? buildSellerReason(reason, sellerDetails)
        : requestedRole === "buyer"
          ? buildBuyerReason(reason, buyerDetails)
          : buildAgentReason(reason, agentDetails);

    try {
      await apiFetch("/me/role-applications", {
        method: "POST",
        token,
        body: {
          requestedRole,
          reason: finalReason,
        },
      });
      setStatus("Role application submitted successfully.");
      setReason("");
      setBuyerRequirementsAccepted(false);
      setBuyerDetails(defaultBuyerDetails);
      setSellerRequirementsAccepted(false);
      setSellerDetails(defaultSellerDetails);
      setAgentRequirementsAccepted(false);
      setAgentDetails(defaultAgentDetails);
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

        {requestedRole === "buyer" && (
          <div className="agreement-box">
            <p>
              <strong>Standard Buyer Requirements</strong>
            </p>
            <ol className="agreement-flow">
              <li>Provide legal name and active contact number for seller coordination.</li>
              <li>Declare preferred location, budget range, and financing plan.</li>
              <li>Confirm valid government ID readiness for KYC and transfer documentation.</li>
              <li>Acknowledge transfer-process steps before deal execution.</li>
            </ol>
            <div className="seller-details-grid">
              <label className="form-field">
                <span className="field-label">Buyer Legal Name</span>
                <input
                  value={buyerDetails.legalName}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, legalName: event.target.value }))}
                  placeholder="As shown on your valid ID"
                  required={requestedRole === "buyer"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Buyer Contact Number</span>
                <input
                  value={buyerDetails.contactNumber}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  placeholder="09XXXXXXXXX"
                  required={requestedRole === "buyer"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">City / Province</span>
                <select
                  value={buyerDetails.cityProvince}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, cityProvince: event.target.value }))}
                  required={requestedRole === "buyer"}
                >
                  <option value="" disabled>
                    Select city / province
                  </option>
                  {cityProvinceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Preferred Locations</span>
                <input
                  value={buyerDetails.preferredLocations}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, preferredLocations: event.target.value }))}
                  placeholder="Quezon City, Pasig, Cavite"
                  required={requestedRole === "buyer"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Budget Range (PHP)</span>
                <input
                  value={buyerDetails.budgetRangePhp}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, budgetRangePhp: event.target.value }))}
                  placeholder="e.g. 2,000,000 - 3,500,000"
                  required={requestedRole === "buyer"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Financing Plan</span>
                <select
                  value={buyerDetails.financingPlan}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, financingPlan: event.target.value as BuyerFinancing }))}
                >
                  {Object.entries(buyerFinancingLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Target Timeline</span>
                <select
                  value={buyerDetails.targetTimeline}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, targetTimeline: event.target.value as BuyerTimeline }))}
                >
                  {Object.entries(buyerTimelineLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="seller-doc-checks">
              <label className="inline-check">
                <input
                  checked={buyerDetails.hasGovernmentId}
                  onChange={(event) => setBuyerDetails((prev) => ({ ...prev, hasGovernmentId: event.target.checked }))}
                  type="checkbox"
                />
                I have a valid government ID ready.
              </label>
              <label className="inline-check">
                <input
                  checked={buyerDetails.understandsTransferProcess}
                  onChange={(event) =>
                    setBuyerDetails((prev) => ({ ...prev, understandsTransferProcess: event.target.checked }))
                  }
                  type="checkbox"
                />
                I understand the pasalo transfer process and documentary steps.
              </label>
            </div>
            <label className="inline-check" style={{ marginTop: 6 }}>
              <input
                checked={buyerRequirementsAccepted}
                onChange={(event) => setBuyerRequirementsAccepted(event.target.checked)}
                type="checkbox"
              />
              I confirm all buyer details above are accurate.
            </label>
          </div>
        )}

        {requestedRole === "agent" && (
          <div className="agreement-box">
            <p>
              <strong>Standard Agent Requirements (Philippines)</strong>
            </p>
            <ol className="agreement-flow">
              <li>PRC license information is required for real estate service practice under RA 9646.</li>
              <li>Provide brokerage/company and service coverage areas.</li>
              <li>Provide contact information and valid government ID readiness.</li>
              <li>Declare PTR/official receipt readiness for compliant operations.</li>
            </ol>
            <p className="small" style={{ margin: "4px 0 8px" }}>
              Reference:{" "}
              <a href="https://lawphil.net/statutes/repacts/ra2009/ra_9646_2009.html" rel="noreferrer noopener" target="_blank">
                RA 9646 (Real Estate Service Act)
              </a>
            </p>
            <div className="seller-details-grid">
              <label className="form-field">
                <span className="field-label">Agent Legal Name</span>
                <input
                  value={agentDetails.legalName}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, legalName: event.target.value }))}
                  placeholder="As shown on PRC and valid ID"
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Agent Contact Number</span>
                <input
                  value={agentDetails.contactNumber}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  placeholder="09XXXXXXXXX"
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">City / Province</span>
                <select
                  value={agentDetails.cityProvince}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, cityProvince: event.target.value }))}
                  required={requestedRole === "agent"}
                >
                  <option value="" disabled>
                    Select city / province
                  </option>
                  {cityProvinceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">PRC License Number</span>
                <input
                  value={agentDetails.prcLicenseNumber}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, prcLicenseNumber: event.target.value }))}
                  placeholder="PRC license number"
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">PRC Registration Valid Until</span>
                <input
                  type="date"
                  value={agentDetails.prcRegistrationValidUntil}
                  onChange={(event) =>
                    setAgentDetails((prev) => ({ ...prev, prcRegistrationValidUntil: event.target.value }))
                  }
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Brokerage / Company</span>
                <input
                  value={agentDetails.brokerageName}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, brokerageName: event.target.value }))}
                  placeholder="Company name"
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Service Areas</span>
                <input
                  value={agentDetails.serviceAreas}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, serviceAreas: event.target.value }))}
                  placeholder="Metro Manila, Laguna, Cavite"
                  required={requestedRole === "agent"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Experience Level</span>
                <select
                  value={agentDetails.experienceLevel}
                  onChange={(event) =>
                    setAgentDetails((prev) => ({ ...prev, experienceLevel: event.target.value as AgentExperienceLevel }))
                  }
                >
                  {Object.entries(agentExperienceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="seller-doc-checks">
              <label className="inline-check">
                <input
                  checked={agentDetails.hasGovernmentId}
                  onChange={(event) => setAgentDetails((prev) => ({ ...prev, hasGovernmentId: event.target.checked }))}
                  type="checkbox"
                />
                I have a valid government ID ready.
              </label>
              <label className="inline-check">
                <input
                  checked={agentDetails.hasPtrOrOfficialReceipt}
                  onChange={(event) =>
                    setAgentDetails((prev) => ({ ...prev, hasPtrOrOfficialReceipt: event.target.checked }))
                  }
                  type="checkbox"
                />
                I can provide PTR/Official Receipt for compliance.
              </label>
              <label className="inline-check">
                <input
                  checked={agentDetails.legalComplianceAccepted}
                  onChange={(event) =>
                    setAgentDetails((prev) => ({ ...prev, legalComplianceAccepted: event.target.checked }))
                  }
                  type="checkbox"
                />
                I understand and will comply with RA 9646 requirements.
              </label>
            </div>
            <label className="inline-check" style={{ marginTop: 6 }}>
              <input
                checked={agentRequirementsAccepted}
                onChange={(event) => setAgentRequirementsAccepted(event.target.checked)}
                type="checkbox"
              />
              I confirm all agent details above are accurate.
            </label>
          </div>
        )}

        {requestedRole === "seller" && (
          <div className="agreement-box">
            <p>
              <strong>Standard Seller Requirements (Philippines)</strong>
            </p>
            <ol className="agreement-flow">
              <li>TIN of seller and buyer reflected in a TIN Verification Slip (BIR ONETT requirement).</li>
              <li>Notarized transfer document (e.g., Deed of Sale/Transfer/Assignment) and valid IDs of parties.</li>
              <li>Certified true copies of Tax Declaration and title document (OCT/TCT/CCT).</li>
              <li>If represented: notarized SPA (individual) or Secretary&apos;s Certificate/Board Resolution (entity).</li>
              <li>If transferor is married: marriage certificate and proper spouse participation/consent where applicable.</li>
              <li>For installment/deferred sale: Contract to Sell and schedule of payments.</li>
              <li>For brokered transactions with commissions: comply with RA 9646 licensing requirements.</li>
            </ol>
            <p className="small" style={{ margin: 0 }}>
              This is platform guidance only. Final documentary requirements vary by RDO/developer/lender.
            </p>
            <p className="small" style={{ margin: "4px 0 0" }}>
              References:{" "}
              <a href="https://bir-cdn.bir.gov.ph/BIR/pdf/citizens-charter-rr-rdo-2024-v3.pdf" rel="noreferrer noopener" target="_blank">
                BIR Citizen&apos;s Charter (ONETT OCS – Onerous Transfer of Real Property)
              </a>{" "}
              ·{" "}
              <a href="https://bir-cdn.bir.gov.ph/BIR/pdf/RMO%20No.%2028-2016%20Annex%20B.pdf" rel="noreferrer noopener" target="_blank">
                BIR CDR Annex B
              </a>{" "}
              ·{" "}
              <a href="https://lawphil.net/statutes/repacts/ra2009/ra_9646_2009.html" rel="noreferrer noopener" target="_blank">
                RA 9646 (Real Estate Service Act)
              </a>
            </p>
            <div className="seller-details-grid">
              <label className="form-field">
                <span className="field-label">Seller Legal Name</span>
                <input
                  value={sellerDetails.legalName}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, legalName: event.target.value }))}
                  placeholder="As shown on your valid ID"
                  required={requestedRole === "seller"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">Seller Contact Number</span>
                <input
                  value={sellerDetails.contactNumber}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, contactNumber: event.target.value }))}
                  placeholder="09XXXXXXXXX"
                  required={requestedRole === "seller"}
                />
              </label>
              <label className="form-field">
                <span className="field-label">City / Province</span>
                <select
                  value={sellerDetails.cityProvince}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, cityProvince: event.target.value }))}
                  required={requestedRole === "seller"}
                >
                  <option value="" disabled>
                    Select city / province
                  </option>
                  {cityProvinceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">Seller Capacity</span>
                <select
                  value={sellerDetails.capacity}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, capacity: event.target.value as SellerCapacity }))}
                >
                  {Object.entries(capacityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span className="field-label">TIN Status</span>
                <select
                  value={sellerDetails.tinStatus}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, tinStatus: event.target.value as TinStatus }))}
                >
                  {Object.entries(tinStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="small" style={{ margin: 0 }}>
              Document readiness declaration:
            </p>
            <div className="seller-doc-checks">
              <label className="inline-check">
                <input
                  checked={sellerDetails.hasGovernmentId}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, hasGovernmentId: event.target.checked }))}
                  type="checkbox"
                />
                Valid government ID
              </label>
              <label className="inline-check">
                <input
                  checked={sellerDetails.hasTransferDocument}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, hasTransferDocument: event.target.checked }))}
                  type="checkbox"
                />
                Notarized transfer document (sale/assignment)
              </label>
              <label className="inline-check">
                <input
                  checked={sellerDetails.hasTitleOrTaxDeclaration}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, hasTitleOrTaxDeclaration: event.target.checked }))}
                  type="checkbox"
                />
                Title copy (OCT/TCT/CCT) or latest tax declaration
              </label>
              <label className="inline-check">
                <input
                  checked={sellerDetails.hasStatementOfAccount}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, hasStatementOfAccount: event.target.checked }))}
                  type="checkbox"
                />
                Statement of account / payment history
              </label>
              <label className="inline-check">
                <input
                  checked={sellerDetails.hasAuthorityDocument}
                  onChange={(event) => setSellerDetails((prev) => ({ ...prev, hasAuthorityDocument: event.target.checked }))}
                  type="checkbox"
                />
                SPA / secretary&apos;s certificate (if representative)
              </label>
            </div>
            <label className="inline-check" style={{ marginTop: 6 }}>
              <input
                checked={sellerRequirementsAccepted}
                onChange={(event) => setSellerRequirementsAccepted(event.target.checked)}
                type="checkbox"
              />
              I confirm I understand the seller requirements above.
            </label>
            <label className="inline-check">
              <input
                checked={sellerDetails.legalComplianceAccepted}
                onChange={(event) => setSellerDetails((prev) => ({ ...prev, legalComplianceAccepted: event.target.checked }))}
                type="checkbox"
              />
              I understand brokerage commissions in the Philippines require PRC-licensed broker compliance under RA 9646.
            </label>
          </div>
        )}

        <label>
          <div className="small" style={{ marginBottom: 6 }}>
            Why are you requesting this role?
          </div>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={10}
            maxLength={2500}
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
