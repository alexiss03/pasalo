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

  const [isAuctionEnabled, setIsAuctionEnabled] = useState(false);
  const [auctionBiddingDays, setAuctionBiddingDays] = useState(7);
  const [photoUrls, setPhotoUrls] = useState<string[]>(["", "", ""]);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementSignedName, setAgreementSignedName] = useState("");
  const [commissionRatePct, setCommissionRatePct] = useState(3);
  const [leadValidityMonths, setLeadValidityMonths] = useState(12);
  const [paymentDueDays, setPaymentDueDays] = useState(7);

  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
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
    setSubmitStatus(null);

    const token = getAuthToken();
    if (!token) {
      setError("Login first to create a listing.");
      return;
    }

    if (financialErrors.length) {
      setError(financialErrors.join("; "));
      return;
    }

    if (isAuctionEnabled && auctionBiddingDays < 1) {
      setError("Set auction bidding days to at least 1 day.");
      return;
    }
    if (!agreementAccepted) {
      setError("You must accept the Seller Listing Agreement.");
      return;
    }
    if (!agreementSignedName.trim()) {
      setError("Type your full name as digital signature.");
      return;
    }
    if (commissionRatePct < 3 || commissionRatePct > 5) {
      setError("Commission rate must be between 3% and 5%.");
      return;
    }
    if (leadValidityMonths < 6 || leadValidityMonths > 12) {
      setError("Lead validity period must be between 6 and 12 months.");
      return;
    }
    if (paymentDueDays < 1 || paymentDueDays > 30) {
      setError("Commission payment due days must be between 1 and 30.");
      return;
    }

    const cleanedPhotoUrls = photoUrls.map((url) => url.trim()).filter(Boolean);

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
          isAuctionEnabled,
          auctionBiddingDays: isAuctionEnabled ? auctionBiddingDays : undefined,
          photoUrls: cleanedPhotoUrls,
          sellerAgreement: {
            accepted: agreementAccepted,
            signedName: agreementSignedName.trim(),
            commissionRatePct,
            leadValidityMonths,
            paymentDueDays,
            signatureMethod: "typed_name_checkbox",
          },
        },
      });

      setSubmitStatus(`Draft listing created: ${response.listingId}. Saved ${cleanedPhotoUrls.length} photo(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    }
  };

  const setPhotoAt = (index: number, value: string) => {
    setPhotoUrls((prev) => prev.map((photo, i) => (i === index ? value : photo)));
  };

  const addPhotoField = () => {
    setPhotoUrls((prev) => (prev.length >= 15 ? prev : [...prev, ""]));
  };

  const removePhotoField = (index: number) => {
    setPhotoUrls((prev) => {
      if (prev.length <= 1) {
        return [""];
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <section className="grid" style={{ gap: 18 }}>
      <h1 style={{ marginBottom: 0 }}>Create Pasalo Listing</h1>
      <p className="small" style={{ marginTop: -8 }}>
        Include photos, amount labels, and optional auction bidding window.
      </p>

      <form className="grid" onSubmit={submit}>
        <div className="card grid grid-2">
          <div className="form-field">
            <label className="field-label">Listing Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. QC Condo Pasalo - Avida Cloverleaf 1BR" minLength={10} required />
          </div>
          <div className="form-field">
            <label className="field-label">Property Type</label>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}>
              <option value="condo">Condo</option>
              <option value="house_lot">House & lot</option>
              <option value="lot_only">Lot only</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">Project Name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Project name" required />
          </div>
          <div className="form-field">
            <label className="field-label">Developer</label>
            <input value={developerName} onChange={(e) => setDeveloperName(e.target.value)} placeholder="Developer name" required />
          </div>

          <div className="form-field">
            <label className="field-label">City</label>
            <input value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="City" required />
          </div>
          <div className="form-field">
            <label className="field-label">Province</label>
            <input value={locationProvince} onChange={(e) => setLocationProvince(e.target.value)} placeholder="Province" required />
          </div>

          <div className="form-field">
            <label className="field-label">Floor Area (sqm)</label>
            <input value={floorAreaSqm} onChange={(e) => setFloorAreaSqm(Number(e.target.value))} required min={1} type="number" />
          </div>
          <div className="form-field">
            <label className="field-label">Unit Number (Optional)</label>
            <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="Unit number" />
          </div>

          <div className="form-field">
            <label className="field-label">Turnover Date</label>
            <input value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} type="date" />
          </div>

          <div className="form-field">
            <label className="inline-check">
              <input checked={isAuctionEnabled} onChange={(e) => setIsAuctionEnabled(e.target.checked)} type="checkbox" />
              Enable auction bidding for this pasalo
            </label>
            {isAuctionEnabled && (
              <>
                <label className="field-label" style={{ marginTop: 8 }}>
                  Bidding Days
                </label>
                <input
                  min={1}
                  max={90}
                  type="number"
                  value={auctionBiddingDays}
                  onChange={(e) => setAuctionBiddingDays(Number(e.target.value))}
                />
                <p className="field-note">Number of days before auction closes.</p>
              </>
            )}
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Property Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Property details, inclusions, and transfer notes"
              minLength={20}
              required
              rows={4}
            />
          </div>
        </div>

        <div className="card grid">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Photos</h3>
            <button className="ghost-button" onClick={addPhotoField} type="button">
              Add photo
            </button>
          </div>
          <p className="small" style={{ margin: 0 }}>
            Add direct image URLs. First photo is set as primary.
          </p>
          <div className="grid">
            {photoUrls.map((url, index) => (
              <div className="field-row" key={`photo-${index}`}>
                <input
                  value={url}
                  onChange={(e) => setPhotoAt(index, e.target.value)}
                  placeholder={`Photo URL ${index + 1}`}
                  type="url"
                />
                <button className="ghost-button" onClick={() => removePhotoField(index)} type="button">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card grid grid-2">
          <div className="form-field">
            <label className="field-label">Original Price (PHP)</label>
            <input type="number" min={0} value={originalPricePhp} onChange={(e) => setOriginalPricePhp(Number(e.target.value))} />
            <p className="field-note">Developer contract price of the property.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Equity Already Paid (PHP)</label>
            <input type="number" min={0} value={equityPaidPhp} onChange={(e) => setEquityPaidPhp(Number(e.target.value))} />
            <p className="field-note">Total paid equity from current owner.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Remaining Balance (PHP)</label>
            <input
              type="number"
              min={0}
              value={remainingBalancePhp}
              onChange={(e) => setRemainingBalancePhp(Number(e.target.value))}
            />
            <p className="field-note">Outstanding balance buyer will continue paying.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Monthly Amortization (PHP/month)</label>
            <input
              type="number"
              min={0}
              value={monthlyAmortizationPhp}
              onChange={(e) => setMonthlyAmortizationPhp(Number(e.target.value))}
            />
            <p className="field-note">Expected monthly payment after transfer.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Cash Out Price (PHP)</label>
            <input type="number" min={0} value={cashOutPricePhp} onChange={(e) => setCashOutPricePhp(Number(e.target.value))} />
            <p className="field-note">One-time payment requested by seller.</p>
          </div>

          <div className="card" style={{ padding: 12, alignSelf: "end" }}>
            <strong>Total cost to buyer: {formatPhp(computed.estimatedTotalCostPhp)}</strong>
            <p className="small">Computed as cash out + remaining balance.</p>
            {financialErrors.length > 0 && <p className="error">{financialErrors.join("; ")}</p>}
          </div>
        </div>

        <div className="card grid">
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Seller Listing Agreement</h3>
          <p className="small" style={{ margin: 0 }}>
            Before posting, you must agree that buyers introduced by this platform are platform leads.
          </p>
          <ol className="agreement-flow">
            <li>Seller posts property.</li>
            <li>Seller signs listing agreement.</li>
            <li>Buyer inquires or requests viewing.</li>
            <li>Lead is recorded by the platform.</li>
            <li>If buyer purchases, commission terms apply.</li>
          </ol>

          <div className="agreement-box">
            <p>
              <strong>Commission Protection Clause:</strong> The seller agrees that any buyer introduced through this
              platform shall be considered a platform lead. If the property is sold to such buyer within{" "}
              {leadValidityMonths} months from introduction, the seller agrees to pay a commission of {commissionRatePct}%
              of the final selling price.
            </p>
            <p>
              <strong>Payment Terms:</strong> If the seller enters into a sale, contract to sell, or any transfer agreement
              with a buyer introduced through the platform, the seller shall pay the agreed commission within{" "}
              {paymentDueDays} days of the transaction.
            </p>
            <p>
              <strong>Lead Definition:</strong> A platform lead means any buyer account that first inquired, requested
              viewing, or started conversation for this listing through this app.
            </p>
            <p className="small" style={{ marginBottom: 0 }}>
              Licensing reminder (Philippines): Brokerage commissions should be handled by a PRC-licensed broker or under
              a compliant broker partnership.
            </p>
          </div>

          <div className="grid grid-2">
            <div className="form-field">
              <label className="field-label">Commission Rate (%)</label>
              <input
                type="number"
                min={3}
                max={5}
                step={0.1}
                value={commissionRatePct}
                onChange={(e) => setCommissionRatePct(Number(e.target.value))}
              />
              <p className="field-note">Allowed range: 3% to 5%.</p>
            </div>

            <div className="form-field">
              <label className="field-label">Lead Validity (Months)</label>
              <input
                type="number"
                min={6}
                max={12}
                value={leadValidityMonths}
                onChange={(e) => setLeadValidityMonths(Number(e.target.value))}
              />
              <p className="field-note">Usually 6 to 12 months from introduction date.</p>
            </div>

            <div className="form-field">
              <label className="field-label">Commission Payment Due (Days)</label>
              <input
                type="number"
                min={1}
                max={30}
                value={paymentDueDays}
                onChange={(e) => setPaymentDueDays(Number(e.target.value))}
              />
              <p className="field-note">Number of days after transaction completion.</p>
            </div>

            <div className="form-field">
              <label className="field-label">Digital Signature (Typed Full Name)</label>
              <input
                value={agreementSignedName}
                onChange={(e) => setAgreementSignedName(e.target.value)}
                placeholder="Type your full legal name"
              />
              <p className="field-note">Signature method: checkbox + typed name.</p>
            </div>
          </div>

          <label className="inline-check">
            <input checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} type="checkbox" />
            I accept the Seller Listing Agreement and Commission Protection terms.
          </label>
        </div>

        <button className="primary" type="submit">
          Save Draft Listing
        </button>
      </form>

      {submitStatus && <p>{submitStatus}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
