"use client";

import { FormEvent, useMemo, useState } from "react";
import { computeListingFinancials, validateListingFinancials } from "@pasalo/shared";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

function formatPhp(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function CreateListingPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState<"condo" | "house_lot" | "lot_only">("condo");
  const [projectName, setProjectName] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationProvince, setLocationProvince] = useState("");
  const [floorAreaSqm, setFloorAreaSqm] = useState(28);
  const [unitNumber, setUnitNumber] = useState("");
  const [turnoverDate, setTurnoverDate] = useState("");

  const [originalPricePhp, setOriginalPricePhp] = useState(3000000);
  const [equityPaidPhp, setEquityPaidPhp] = useState(350000);
  const [remainingBalancePhp, setRemainingBalancePhp] = useState(2650000);
  const [monthlyAmortizationPhp, setMonthlyAmortizationPhp] = useState(18000);
  const [cashOutPricePhp, setCashOutPricePhp] = useState(250000);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const financials = useMemo(
    () => ({
      originalPricePhp,
      equityPaidPhp,
      remainingBalancePhp,
      monthlyAmortizationPhp,
      cashOutPricePhp,
    }),
    [cashOutPricePhp, equityPaidPhp, monthlyAmortizationPhp, originalPricePhp, remainingBalancePhp],
  );

  const computed = useMemo(() => computeListingFinancials(financials), [financials]);
  const financialErrors = useMemo(() => validateListingFinancials(financials), [financials]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const token = getAuthToken();
    if (!token) {
      setError("Login first to create a listing.");
      return;
    }

    if (financialErrors.length) {
      setError(financialErrors.join("; "));
      return;
    }

    try {
      const response = await apiFetch<{ listingId: string }>("/listings", {
        method: "POST",
        token,
        body: {
          title,
          description,
          propertyType,
          projectName,
          developerName,
          locationCity,
          locationProvince,
          floorAreaSqm,
          unitNumber: unitNumber || null,
          turnoverDate: turnoverDate || null,
          financials,
        },
      });

      setStatus(`Draft listing created: ${response.listingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    }
  };

  return (
    <section className="grid" style={{ gap: 18 }}>
      <h1 style={{ marginBottom: 0 }}>Create Pasalo Listing</h1>
      <p className="small" style={{ marginTop: -8 }}>
        Launch form includes core property and financial fields, with live total-cost calculator.
      </p>

      <form className="grid" onSubmit={submit}>
        <div className="card grid grid-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Listing title" minLength={10} required />
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}>
            <option value="condo">Condo</option>
            <option value="house_lot">House & lot</option>
            <option value="lot_only">Lot only</option>
          </select>

          <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" required />
          <input value={developerName} onChange={(e) => setDeveloperName(e.target.value)} placeholder="Developer" required />

          <input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="City" required />
          <input value={locationProvince} onChange={(e) => setLocationProvince(e.target.value)} placeholder="Province" required />

          <input
            value={floorAreaSqm}
            onChange={(e) => setFloorAreaSqm(Number(e.target.value))}
            placeholder="Floor area"
            required
            min={1}
            type="number"
          />
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit number (optional)" />

          <input value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} placeholder="Turnover date YYYY-MM-DD" />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Property details"
            minLength={20}
            required
            rows={4}
          />
        </div>

        <div className="card grid grid-2">
          <input
            type="number"
            min={0}
            value={originalPricePhp}
            onChange={(e) => setOriginalPricePhp(Number(e.target.value))}
            placeholder="Original price"
          />
          <input
            type="number"
            min={0}
            value={equityPaidPhp}
            onChange={(e) => setEquityPaidPhp(Number(e.target.value))}
            placeholder="Equity paid"
          />
          <input
            type="number"
            min={0}
            value={remainingBalancePhp}
            onChange={(e) => setRemainingBalancePhp(Number(e.target.value))}
            placeholder="Remaining balance"
          />
          <input
            type="number"
            min={0}
            value={monthlyAmortizationPhp}
            onChange={(e) => setMonthlyAmortizationPhp(Number(e.target.value))}
            placeholder="Monthly amortization"
          />
          <input
            type="number"
            min={0}
            value={cashOutPricePhp}
            onChange={(e) => setCashOutPricePhp(Number(e.target.value))}
            placeholder="Cash out price"
          />

          <div className="card" style={{ padding: 12 }}>
            <strong>Total cost to buyer: {formatPhp(computed.estimatedTotalCostPhp)}</strong>
            <p className="small">Computed as cash out + remaining balance.</p>
            {financialErrors.length > 0 && <p className="error">{financialErrors.join("; ")}</p>}
          </div>
        </div>

        <button className="primary" type="submit">
          Save Draft Listing
        </button>
      </form>

      {status && <p>{status}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
