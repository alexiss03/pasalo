"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { computeListingFinancials, validateListingFinancials } from "@pasalo/shared";
import { apiFetch } from "../../lib/api";
import { getAuthToken } from "../../lib/auth";

type VerificationBatchResponse = {
  summary: {
    overallStatus: "pass" | "review" | "fail";
    passed: number;
    needsReview: number;
    failed: number;
  };
};

type UploadedPhoto = {
  id: string;
  fileName: string;
  previewUrl: string;
  storageKey: string;
};

type UploadedDocMeta = {
  fileName: string;
  storageKey: string;
};

type DevelopersCatalogResponse = {
  items: Array<{
    name: string;
  }>;
};

type UploadAssetResponse = {
  provider: "local" | "supabase";
  storageKey: string;
  path: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

type PublishType = "normal" | "premium_top";
const DEFAULT_COMMISSION_RATE_PCT = 3;
const DEFAULT_LEAD_VALIDITY_MONTHS = 12;
const DEFAULT_PAYMENT_DUE_DAYS = 7;
const DEFAULT_VIEWING_DURATION_MINUTES = 30;
const DEFAULT_VIEWING_INTERVAL_MINUTES = 30;

type PublishListingResponse = {
  status: "pending_review";
  publishType: PublishType;
  publishFeePhp: number;
  placement: "normal" | "top";
};

const publishPlanOptions: Array<{
  type: PublishType;
  label: string;
  description: string;
  pricePhp: number;
}> = [
  {
    type: "normal",
    label: "Publish as Normal",
    description: "Standard queue placement",
    pricePhp: 1000,
  },
  {
    type: "premium_top",
    label: "Publish as Premium",
    description: "Top placement in listing feed",
    pricePhp: 5000,
  },
];

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const defaultDeveloperOptions = [
  "SM Development Corporation",
  "Ayala Land",
  "Camella Homes",
  "DMCI Homes",
  "Megaworld",
  "Filinvest Land",
  "Robinsons Land",
  "Vista Land",
  "Federal Land",
  "Rockwell Land",
  "AboitizLand",
  "Ortigas Land",
  "Alveo Land",
  "Avida Land",
  "Amaia Land",
  "Bellavita Land",
  "Empire East Land Holdings",
  "Anchor Land",
  "Shang Properties",
  "Century Properties",
  "Eton Properties Philippines",
  "Landco Pacific Corporation",
  "Arthaland",
  "Greenfield Development Corporation",
  "Sta. Lucia Land",
  "Cebu Landmasters",
  "Damosa Land",
  "AppleOne Properties",
  "Suntrust Properties",
  "Pueblo de Oro Development Corporation",
  "Johndorf Ventures Corporation",
  "NorthPine Land",
  "Property Company of Friends (Pro-Friends)",
  "Phirst Park Homes",
  "Ovialand",
  "Hausland Development Corporation",
  "PrimaryHomes",
  "Grand Land",
  "Paramount Property Ventures",
  "P.A. Properties Hankyu Hanshin",
  "Xavier Estates",
  "Crown Asia",
  "Brittany Corporation",
  "Vista Residences",
  "Camella Manors",
  "Cityland",
  "Primex Realty Corporation",
  "Torre Lorenzo Development Corporation",
  "Phinma Properties",
  "Wee Community Developers",
  "New San Jose Builders",
  "8990 Holdings",
];

function formatPhp(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatStatusLabel(value: "pass" | "review" | "fail"): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CreateListingPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyType, setPropertyType] = useState<"condo" | "house_lot" | "lot_only">("condo");
  const [projectName, setProjectName] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationProvince, setLocationProvince] = useState("");
  const [developerOptions, setDeveloperOptions] = useState<string[]>(defaultDeveloperOptions);
  const [floorAreaSqm, setFloorAreaSqm] = useState(28);
  const [unitNumber, setUnitNumber] = useState("");
  const [turnoverDate, setTurnoverDate] = useState("");

  const [originalPricePhpInput, setOriginalPricePhpInput] = useState("");
  const [equityPaidPhpInput, setEquityPaidPhpInput] = useState("");
  const [remainingBalancePhpInput, setRemainingBalancePhpInput] = useState("");
  const [monthlyAmortizationPhpInput, setMonthlyAmortizationPhpInput] = useState("");
  const [cashOutPricePhpInput, setCashOutPricePhpInput] = useState("");
  const [remainingAmortizationMonthsInput, setRemainingAmortizationMonthsInput] = useState("");
  const [availableInPagIbig, setAvailableInPagIbig] = useState(false);
  const [availableInHouseLoan, setAvailableInHouseLoan] = useState(false);
  const [documentAssistanceRequested, setDocumentAssistanceRequested] = useState(false);
  const [documentAssistanceNotes, setDocumentAssistanceNotes] = useState("");
  const [viewingAvailabilityEnabled, setViewingAvailabilityEnabled] = useState(false);
  const [viewingAvailabilitySlots, setViewingAvailabilitySlots] = useState<string[]>([]);
  const [viewingSlotInput, setViewingSlotInput] = useState("");
  const [viewingDurationMinutesInput, setViewingDurationMinutesInput] = useState(
    String(DEFAULT_VIEWING_DURATION_MINUTES),
  );
  const [viewingIntervalMinutesInput, setViewingIntervalMinutesInput] = useState(
    String(DEFAULT_VIEWING_INTERVAL_MINUTES),
  );

  const [isAuctionEnabled, setIsAuctionEnabled] = useState(false);
  const [auctionBiddingDays, setAuctionBiddingDays] = useState(7);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [idDocFileKey, setIdDocFileKey] = useState("");
  const [transferDocumentFileKey, setTransferDocumentFileKey] = useState("");
  const [titleDeclarationFileKey, setTitleDeclarationFileKey] = useState("");
  const [authorityDocumentFileKey, setAuthorityDocumentFileKey] = useState("");
  const [idDocMeta, setIdDocMeta] = useState<UploadedDocMeta | null>(null);
  const [transferDocMeta, setTransferDocMeta] = useState<UploadedDocMeta | null>(null);
  const [titleDocMeta, setTitleDocMeta] = useState<UploadedDocMeta | null>(null);
  const [authorityDocMeta, setAuthorityDocMeta] = useState<UploadedDocMeta | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementSignedName, setAgreementSignedName] = useState("");
  const [attorneySignedName, setAttorneySignedName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [attorneySignatureDataUrl, setAttorneySignatureDataUrl] = useState("");
  const [signaturePadOpen, setSignaturePadOpen] = useState(false);
  const [signaturePadTarget, setSignaturePadTarget] = useState<"seller" | "attorney">("seller");
  const [signatureHasStroke, setSignatureHasStroke] = useState(false);
  const [publishType, setPublishType] = useState<PublishType>("normal");
  const [submitAction, setSubmitAction] = useState<"draft" | "publish" | null>(null);

  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetUploadsInFlight, setAssetUploadsInFlight] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadContainerRef = useRef<HTMLDivElement>(null);
  const signatureDrawingRef = useRef(false);

  const parseNonNegativeNumber = (value: string): number | null => {
    if (!value.trim()) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  };

  const parseNonNegativeInteger = (value: string): number | null => {
    if (!value.trim()) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  };

  const financials = useMemo(() => {
    const originalPricePhp = parseNonNegativeNumber(originalPricePhpInput);
    const equityPaidPhp = parseNonNegativeNumber(equityPaidPhpInput);
    const remainingBalancePhp = parseNonNegativeNumber(remainingBalancePhpInput);
    const monthlyAmortizationPhp = parseNonNegativeNumber(monthlyAmortizationPhpInput);
    const cashOutPricePhp = parseNonNegativeNumber(cashOutPricePhpInput);
    const remainingAmortizationMonths = parseNonNegativeInteger(remainingAmortizationMonthsInput);

    if (
      originalPricePhp === null ||
      equityPaidPhp === null ||
      remainingBalancePhp === null ||
      monthlyAmortizationPhp === null ||
      cashOutPricePhp === null ||
      remainingAmortizationMonths === null
    ) {
      return null;
    }

    return {
      originalPricePhp,
      equityPaidPhp,
      remainingBalancePhp,
      monthlyAmortizationPhp,
      cashOutPricePhp,
      remainingAmortizationMonths,
      availableInPagIbig,
      availableInHouseLoan,
    };
  }, [
    availableInHouseLoan,
    availableInPagIbig,
    cashOutPricePhpInput,
    equityPaidPhpInput,
    monthlyAmortizationPhpInput,
    originalPricePhpInput,
    remainingAmortizationMonthsInput,
    remainingBalancePhpInput,
  ]);

  const computed = useMemo(
    () => (financials ? computeListingFinancials(financials) : null),
    [financials],
  );
  const financialErrors = useMemo(
    () => (financials ? validateListingFinancials(financials) : []),
    [financials],
  );

  useEffect(() => {
    let disposed = false;

    const loadDevelopers = async () => {
      try {
        const result = await apiFetch<DevelopersCatalogResponse>("/developers?activeOnly=true");
        const names = result.items
          .map((item) => item.name.trim())
          .filter(Boolean);
        if (!disposed && names.length) {
          setDeveloperOptions(Array.from(new Set(names)));
        }
      } catch {
        // Keep fallback list when catalog API is unavailable.
      }
    };

    void loadDevelopers();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!signaturePadOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const canvas = signatureCanvasRef.current;
      const container = signaturePadContainerRef.current;
      if (!canvas || !container) {
        return;
      }

      const width = Math.max(280, container.clientWidth);
      const height = 180;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#16191f";

      const activeSignatureDataUrl =
        signaturePadTarget === "seller" ? signatureDataUrl : attorneySignatureDataUrl;

      if (activeSignatureDataUrl) {
        const image = new Image();
        image.onload = () => {
          ctx.drawImage(image, 0, 0, width, height);
          setSignatureHasStroke(true);
        };
        image.src = activeSignatureDataUrl;
      } else {
        setSignatureHasStroke(false);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [attorneySignatureDataUrl, signatureDataUrl, signaturePadOpen, signaturePadTarget]);

  const getSignaturePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startSignatureDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    const { x, y } = getSignaturePoint(event);
    signatureDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setSignatureHasStroke(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSignatureDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!signatureDrawingRef.current) {
      return;
    }

    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    const { x, y } = getSignaturePoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endSignatureDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    signatureDrawingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // no-op
    }
  };

  const saveSignaturePad = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      return;
    }

    if (!signatureHasStroke) {
      setError("Draw your signature before saving.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    if (signaturePadTarget === "seller") {
      setSignatureDataUrl(dataUrl);
    } else {
      setAttorneySignatureDataUrl(dataUrl);
    }
    setSignaturePadOpen(false);
    setError(null);
  };

  const resetCreateListingForm = () => {
    setTitle("");
    setDescription("");
    setPropertyType("condo");
    setProjectName("");
    setDeveloperName("");
    setLocationCity("");
    setLocationProvince("");
    setFloorAreaSqm(28);
    setUnitNumber("");
    setTurnoverDate("");

    setOriginalPricePhpInput("");
    setEquityPaidPhpInput("");
    setRemainingBalancePhpInput("");
    setMonthlyAmortizationPhpInput("");
    setCashOutPricePhpInput("");
    setRemainingAmortizationMonthsInput("");
    setAvailableInPagIbig(false);
    setAvailableInHouseLoan(false);
    setDocumentAssistanceRequested(false);
    setDocumentAssistanceNotes("");
    setViewingAvailabilityEnabled(false);
    setViewingAvailabilitySlots([]);
    setViewingSlotInput("");
    setViewingDurationMinutesInput(String(DEFAULT_VIEWING_DURATION_MINUTES));
    setViewingIntervalMinutesInput(String(DEFAULT_VIEWING_INTERVAL_MINUTES));

    setIsAuctionEnabled(false);
    setAuctionBiddingDays(7);
    setUploadedPhotos([]);

    setIdDocFileKey("");
    setTransferDocumentFileKey("");
    setTitleDeclarationFileKey("");
    setAuthorityDocumentFileKey("");
    setIdDocMeta(null);
    setTransferDocMeta(null);
    setTitleDocMeta(null);
    setAuthorityDocMeta(null);

    setAgreementAccepted(false);
    setAgreementSignedName("");
    setAttorneySignedName("");
    setSignatureDataUrl("");
    setAttorneySignatureDataUrl("");
    setSignaturePadOpen(false);
    setSignaturePadTarget("seller");
    setSignatureHasStroke(false);
    signatureDrawingRef.current = false;

    setPublishType("normal");
  };

  const submit = async (mode: "draft" | "publish") => {
    setError(null);
    setSubmitStatus(null);
    setSubmitAction(mode);

    const token = getAuthToken();
    if (!token) {
      setError("Login first to create a listing.");
      setSubmitAction(null);
      return;
    }

    if (!financials) {
      setError("Complete all financial breakdown fields with valid values.");
      setSubmitAction(null);
      return;
    }

    if (financialErrors.length) {
      setError(financialErrors.join("; "));
      setSubmitAction(null);
      return;
    }
    if (assetUploadsInFlight > 0) {
      setError("Wait for all uploads to finish before submitting.");
      setSubmitAction(null);
      return;
    }

    if (isAuctionEnabled && auctionBiddingDays < 1) {
      setError("Set auction bidding days to at least 1 day.");
      setSubmitAction(null);
      return;
    }
    if (documentAssistanceRequested && documentAssistanceNotes.trim().length < 10) {
      setError("Add at least 10 characters for document assistance notes.");
      setSubmitAction(null);
      return;
    }
    if (viewingAvailabilityEnabled && viewingAvailabilitySlots.length === 0) {
      setError("Add at least one viewing availability slot or disable availability.");
      setSubmitAction(null);
      return;
    }
    const viewingDurationMinutes = parseNonNegativeInteger(viewingDurationMinutesInput);
    const viewingIntervalMinutes = parseNonNegativeInteger(viewingIntervalMinutesInput);
    if (
      viewingAvailabilityEnabled &&
      (viewingDurationMinutes === null || viewingDurationMinutes < 15 || viewingDurationMinutes > 240)
    ) {
      setError("Viewing duration must be from 15 to 240 minutes.");
      setSubmitAction(null);
      return;
    }
    if (
      viewingAvailabilityEnabled &&
      (viewingIntervalMinutes === null || viewingIntervalMinutes < 5 || viewingIntervalMinutes > 240)
    ) {
      setError("Viewing interval must be from 5 to 240 minutes.");
      setSubmitAction(null);
      return;
    }
    if (!agreementAccepted) {
      setError("You must accept the Seller Listing Agreement.");
      setSubmitAction(null);
      return;
    }
    if (!agreementSignedName.trim()) {
      setError("Type seller full name as digital signature.");
      setSubmitAction(null);
      return;
    }
    if (!signatureDataUrl) {
      setError("Add seller signature before submitting.");
      setSubmitAction(null);
      return;
    }
    if (!attorneySignedName.trim()) {
      setError("Type attorney full name as digital signature.");
      setSubmitAction(null);
      return;
    }
    if (!attorneySignatureDataUrl) {
      setError("Add attorney signature before submitting.");
      setSubmitAction(null);
      return;
    }
    const selectedDeveloper = developerOptions.find(
      (option) => option.toLowerCase() === developerName.trim().toLowerCase(),
    );
    if (!selectedDeveloper) {
      setError("Select a developer from the searchable dropdown list.");
      setSubmitAction(null);
      return;
    }

    const cleanedPhotoUrls = uploadedPhotos.map((photo) => photo.storageKey).filter(Boolean);
    const normalizedUnitNumber = unitNumber.trim();
    const cleanedIdDocFileKey = idDocFileKey.trim();
    const cleanedTransferDocumentFileKey = transferDocumentFileKey.trim();
    const cleanedTitleDeclarationFileKey = titleDeclarationFileKey.trim();
    const cleanedAuthorityDocumentFileKey = authorityDocumentFileKey.trim();

    if (!cleanedIdDocFileKey || !cleanedTransferDocumentFileKey || !cleanedTitleDeclarationFileKey || !cleanedAuthorityDocumentFileKey) {
      setError("Upload all required verification documents: Seller ID, Transfer Document, Title/Tax Declaration, and Authority Document.");
      setSubmitAction(null);
      return;
    }

    let createdListingId: string | null = null;
    try {
      const response = await apiFetch<{ listingId: string }>("/listings", {
        method: "POST",
        token,
        body: {
          title,
          description,
          propertyType,
          projectName,
          developerName: selectedDeveloper,
          locationCity,
          locationProvince,
          floorAreaSqm,
          ...(normalizedUnitNumber.length ? { unitNumber: normalizedUnitNumber } : {}),
          turnoverDate: turnoverDate || null,
          financials,
          isAuctionEnabled,
          auctionBiddingDays: isAuctionEnabled ? auctionBiddingDays : undefined,
          documentAssistance: {
            requested: documentAssistanceRequested,
            notes: documentAssistanceRequested ? documentAssistanceNotes.trim() : null,
          },
          viewingAvailability: {
            enabled: viewingAvailabilityEnabled,
            slots: viewingAvailabilityEnabled ? viewingAvailabilitySlots : [],
            durationMinutes: viewingAvailabilityEnabled
              ? (viewingDurationMinutes ?? DEFAULT_VIEWING_DURATION_MINUTES)
              : DEFAULT_VIEWING_DURATION_MINUTES,
            intervalMinutes: viewingAvailabilityEnabled
              ? (viewingIntervalMinutes ?? DEFAULT_VIEWING_INTERVAL_MINUTES)
              : DEFAULT_VIEWING_INTERVAL_MINUTES,
          },
          photoUrls: cleanedPhotoUrls,
          sellerAgreement: {
            accepted: agreementAccepted,
            signedName: agreementSignedName.trim(),
            attorneySignedName: attorneySignedName.trim(),
            commissionRatePct: DEFAULT_COMMISSION_RATE_PCT,
            leadValidityMonths: DEFAULT_LEAD_VALIDITY_MONTHS,
            paymentDueDays: DEFAULT_PAYMENT_DUE_DAYS,
            signatureMethod: "typed_name_checkbox",
            attorneySignatureMethod: "typed_name_checkbox",
          },
        },
      });
      createdListingId = response.listingId;

      let aiSummaryText = "AI verification pending.";
      let publishSummaryText = "";

      try {
        const aiResponse = await apiFetch<VerificationBatchResponse>("/me/verification-docs/ai-batch", {
          method: "POST",
          token,
          body: {
            listingId: response.listingId,
            idFileKey: cleanedIdDocFileKey,
            transferDocumentFileKey: cleanedTransferDocumentFileKey,
            titleDeclarationFileKey: cleanedTitleDeclarationFileKey,
            authorityDocumentFileKey: cleanedAuthorityDocumentFileKey,
          },
        });

        aiSummaryText = `AI check: ${formatStatusLabel(aiResponse.summary.overallStatus)} (${aiResponse.summary.passed} pass, ${aiResponse.summary.needsReview} review, ${aiResponse.summary.failed} fail).`;
      } catch (verificationErr) {
        const message = verificationErr instanceof Error ? verificationErr.message : "Unable to submit verification docs";
        aiSummaryText = `AI verification submission failed (${message}). You can retry verification from profile/admin.`;
      }

      if (mode === "publish") {
        const publishResult = await apiFetch<PublishListingResponse>(`/listings/${response.listingId}/publish`, {
          method: "POST",
          token,
          body: {
            publishType,
          },
        });

        const publishLabel = publishResult.publishType === "premium_top" ? "Premium (Top Placement)" : "Normal";
        publishSummaryText = `Published as ${publishLabel} for ${formatPhp(publishResult.publishFeePhp)}. Status: ${publishResult.status}.`;
      }

      resetCreateListingForm();
      setError(null);
      setSubmitStatus(
        mode === "publish"
          ? `Listing submitted for publish review: ${response.listingId}. ${publishSummaryText} Saved ${cleanedPhotoUrls.length} photo(s). ${aiSummaryText}`
          : `Draft listing created: ${response.listingId}. Saved ${cleanedPhotoUrls.length} photo(s). ${aiSummaryText}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create listing";
      if (createdListingId && mode === "publish") {
        setError(`Draft created (${createdListingId}) but publish failed: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setSubmitAction(null);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const uploadFileToStorage = async (
    file: File,
    kind: "listing_photo" | "listing_verification",
  ): Promise<UploadAssetResponse> => {
    const token = getAuthToken();
    if (!token) {
      window.location.href = "/login?next=/create-listing";
      throw new Error("Login first to upload files.");
    }

    const dataUrl = await readFileAsDataUrl(file);
    return apiFetch<UploadAssetResponse>("/uploads", {
      method: "POST",
      token,
      body: {
        kind,
        fileName: file.name,
        dataUrl,
      },
    });
  };

  const addViewingSlot = () => {
    if (!viewingSlotInput) {
      setError("Pick a viewing date and time first.");
      return;
    }

    const parsed = new Date(viewingSlotInput);
    if (!Number.isFinite(parsed.getTime())) {
      setError("Enter a valid viewing slot.");
      return;
    }

    const slot = parsed.toISOString();
    if (viewingAvailabilitySlots.includes(slot)) {
      setError("This viewing slot is already added.");
      return;
    }

    setViewingAvailabilitySlots((current) =>
      [...current, slot].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    );
    setViewingSlotInput("");
    setError(null);
  };

  const removeViewingSlot = (slot: string) => {
    setViewingAvailabilitySlots((current) => current.filter((item) => item !== slot));
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !files.length) {
      return;
    }

    const remainingSlots = Math.max(0, 15 - uploadedPhotos.length);
    const toProcess = Array.from(files).slice(0, remainingSlots);

    if (!remainingSlots) {
      setError("Maximum of 15 photos allowed.");
      event.target.value = "";
      return;
    }

    try {
      setAssetUploadsInFlight((count) => count + 1);
      const next: UploadedPhoto[] = [];
      const rejectedFiles: string[] = [];
      for (const file of toProcess) {
        if (!file.type.startsWith("image/")) {
          rejectedFiles.push(`${file.name} (not an image)`);
          continue;
        }
        if (file.size > MAX_PHOTO_SIZE_BYTES) {
          rejectedFiles.push(`${file.name} (exceeds 5MB)`);
          continue;
        }
        const dataUrl = await readFileAsDataUrl(file);
        const uploaded = await apiFetch<UploadAssetResponse>("/uploads", {
          method: "POST",
          token: getAuthToken(),
          body: {
            kind: "listing_photo",
            fileName: file.name,
            dataUrl,
          },
        });
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          previewUrl: dataUrl,
          storageKey: uploaded.storageKey,
        });
      }

      if (!next.length) {
        if (rejectedFiles.length) {
          setError(`No photos uploaded. Limit is 5MB per image. Rejected: ${rejectedFiles.join(", ")}`);
        } else {
          setError("Upload image files only.");
        }
        event.target.value = "";
        return;
      }

      setUploadedPhotos((prev) => [...prev, ...next]);
      if (rejectedFiles.length) {
        setError(`Some files were skipped. Limit is 5MB per image. Rejected: ${rejectedFiles.join(", ")}`);
      } else {
        setError(null);
      }
    } catch (uploadErr) {
      setError(uploadErr instanceof Error ? uploadErr.message : "Unable to upload photo.");
    } finally {
      setAssetUploadsInFlight((count) => Math.max(0, count - 1));
      event.target.value = "";
    }
  };

  const openPhotoPicker = () => {
    photoInputRef.current?.click();
  };

  const removeUploadedPhoto = (id: string) => {
    setUploadedPhotos((prev) => prev.filter((photo) => photo.id !== id));
  };

  const uploadVerificationDoc = async (
    event: ChangeEvent<HTMLInputElement>,
    onMeta: (meta: UploadedDocMeta | null) => void,
    onKey: (value: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      onMeta(null);
      onKey("");
      return;
    }

    try {
      setAssetUploadsInFlight((count) => count + 1);
      const uploaded = await uploadFileToStorage(file, "listing_verification");
      const meta = {
        fileName: uploaded.fileName,
        storageKey: uploaded.storageKey,
      };
      onMeta(meta);
      onKey(meta.storageKey);
      setError(null);
    } catch (uploadErr) {
      onMeta(null);
      onKey("");
      setError(uploadErr instanceof Error ? uploadErr.message : "Unable to upload document.");
    } finally {
      setAssetUploadsInFlight((count) => Math.max(0, count - 1));
      event.target.value = "";
    }
  };

  return (
    <section className="grid" style={{ gap: 18 }}>
      <h1 style={{ marginBottom: 0 }}>Create Pasalo Listing</h1>

      <form
        className="grid"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void submit("draft");
        }}
      >
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
            <input
              list="developer-options"
              value={developerName}
              onChange={(e) => setDeveloperName(e.target.value)}
              placeholder="Search and select developer"
              required
            />
            <datalist id="developer-options">
              {developerOptions.map((developer) => (
                <option key={developer} value={developer}>
                  {developer}
                </option>
              ))}
            </datalist>
            <p className="field-note">Search from the active PH developer catalog.</p>
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
            <p className="field-note">Leave blank if the property has no assigned unit number.</p>
          </div>

          <div className="form-field">
            <label className="field-label">Turnover Date</label>
            <input value={turnoverDate} onChange={(e) => setTurnoverDate(e.target.value)} type="date" />
          </div>

          <div className="form-field">
            <label className="field-label">Seller Signature (Typed Full Name)</label>
            <button
              className="signature-trigger"
              onClick={() => {
                setSignaturePadTarget("seller");
                setSignaturePadOpen(true);
              }}
              type="button"
            >
              {signatureDataUrl ? (
                <img alt="Seller signature preview" className="signature-trigger-preview" src={signatureDataUrl} />
              ) : (
                <span className="small">Tap to open signature pad</span>
              )}
            </button>
            <input
              value={agreementSignedName}
              onChange={(e) => setAgreementSignedName(e.target.value)}
              placeholder="Type your full legal name"
            />
            <p className="field-note">Tap the signature box to draw your signature, then type your full name.</p>
          </div>

          <div className="form-field">
            <label className="field-label">Attorney Signature (Typed Full Name)</label>
            <button
              className="signature-trigger"
              onClick={() => {
                setSignaturePadTarget("attorney");
                setSignaturePadOpen(true);
              }}
              type="button"
            >
              {attorneySignatureDataUrl ? (
                <img alt="Attorney signature preview" className="signature-trigger-preview" src={attorneySignatureDataUrl} />
              ) : (
                <span className="small">Tap to open signature pad</span>
              )}
            </button>
            <input
              value={attorneySignedName}
              onChange={(e) => setAttorneySignedName(e.target.value)}
              placeholder="Type attorney full legal name"
            />
            <p className="field-note">Capture the attorney signature and typed full name for legal review.</p>
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
          <h3 style={{ margin: 0 }}>Auction</h3>
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
        </div>

        <div className="card grid">
          <h3 style={{ margin: 0 }}>Viewing Availability</h3>
          <div className="form-field">
            <label className="inline-check">
              <input
                checked={viewingAvailabilityEnabled}
                onChange={(e) => setViewingAvailabilityEnabled(e.target.checked)}
                type="checkbox"
              />
              Add seller viewing availability
            </label>
            <p className="field-note">Buyers can request viewing from these available slots.</p>
          </div>

          {viewingAvailabilityEnabled && (
            <>
              <div className="grid grid-2">
                <label className="form-field">
                  <span className="field-label">Viewing Duration (minutes)</span>
                  <input
                    min={15}
                    max={240}
                    onChange={(e) => setViewingDurationMinutesInput(e.target.value)}
                    type="number"
                    value={viewingDurationMinutesInput}
                  />
                </label>
                <label className="form-field">
                  <span className="field-label">Viewing Interval (minutes)</span>
                  <input
                    min={5}
                    max={240}
                    onChange={(e) => setViewingIntervalMinutesInput(e.target.value)}
                    type="number"
                    value={viewingIntervalMinutesInput}
                  />
                </label>
              </div>

              <div className="field-row">
                <input
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setViewingSlotInput(e.target.value)}
                  step={Math.max(1, Number(viewingIntervalMinutesInput) || DEFAULT_VIEWING_INTERVAL_MINUTES) * 60}
                  type="datetime-local"
                  value={viewingSlotInput}
                />
                <button className="ghost-button" onClick={addViewingSlot} type="button">
                  Add slot
                </button>
              </div>
              <div className="grid">
                {!viewingAvailabilitySlots.length && (
                  <p className="small" style={{ margin: 0 }}>
                    No viewing slots yet. Add at least one slot.
                  </p>
                )}
                {viewingAvailabilitySlots.map((slot) => (
                  <div className="field-row" key={slot}>
                    <p className="small" style={{ margin: 0 }}>
                      {new Intl.DateTimeFormat("en-PH", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(slot))}
                    </p>
                    <button className="ghost-button" onClick={() => removeViewingSlot(slot)} type="button">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card grid">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Photos</h3>
            <button className="ghost-button" onClick={openPhotoPicker} type="button">
              Add photo
            </button>
            <input
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              ref={photoInputRef}
              style={{ display: "none" }}
              type="file"
            />
          </div>
	          <p className="small" style={{ margin: 0 }}>
	            Upload image files up to 5MB each. First uploaded photo is set as primary.
	          </p>
	          {assetUploadsInFlight > 0 && (
	            <p className="small" style={{ margin: 0 }}>
	              Uploading files...
	            </p>
	          )}
	          <div className="grid">
	            {!uploadedPhotos.length && <p className="small" style={{ margin: 0 }}>No photo uploaded yet.</p>}
	            {uploadedPhotos.map((photo, index) => (
	              <div className="field-row" key={photo.id} style={{ alignItems: "center" }}>
	                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
	                  <img
	                    alt={photo.fileName}
	                    src={photo.previewUrl}
	                    style={{ width: 64, height: 46, objectFit: "cover", border: "1px solid #d7dbe1", flexShrink: 0 }}
	                  />
                  <div style={{ minWidth: 0 }}>
                    <p className="small" style={{ margin: 0, fontWeight: 600, color: "#222733" }}>
                      {index === 0 ? "Primary photo" : `Photo ${index + 1}`}
                    </p>
                    <p className="small" style={{ margin: 0, overflowWrap: "anywhere" }}>{photo.fileName}</p>
                  </div>
                </div>
                <button className="ghost-button" onClick={() => removeUploadedPhoto(photo.id)} type="button">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card grid grid-2">
          <div style={{ gridColumn: "1 / -1" }}>
            <h3 style={{ margin: 0 }}>AI Document Verification</h3>
            <p className="small" style={{ marginTop: 6 }}>
              Upload all required documents. Every listing is screened by AI before review.
            </p>
          </div>

          <div className="form-field">
            <label className="field-label">Seller Valid ID</label>
	            <input
	              type="file"
	              accept=".pdf,image/*"
	              onChange={(e) => void uploadVerificationDoc(e, setIdDocMeta, setIdDocFileKey)}
	            />
            <p className="field-note">
              {idDocMeta ? `Uploaded: ${idDocMeta.fileName}` : "No file uploaded yet."}
            </p>
          </div>

          <div className="form-field">
            <label className="field-label">Transfer Document</label>
	            <input
	              type="file"
	              accept=".pdf,image/*"
	              onChange={(e) => void uploadVerificationDoc(e, setTransferDocMeta, setTransferDocumentFileKey)}
	            />
            <p className="field-note">
              {transferDocMeta ? `Uploaded: ${transferDocMeta.fileName}` : "No file uploaded yet."}
            </p>
          </div>

          <div className="form-field">
            <label className="field-label">Title / Tax Declaration</label>
	            <input
	              type="file"
	              accept=".pdf,image/*"
	              onChange={(e) => void uploadVerificationDoc(e, setTitleDocMeta, setTitleDeclarationFileKey)}
	            />
            <p className="field-note">
              {titleDocMeta ? `Uploaded: ${titleDocMeta.fileName}` : "No file uploaded yet."}
            </p>
          </div>

          <div className="form-field">
            <label className="field-label">Authority Document</label>
	            <input
	              type="file"
	              accept=".pdf,image/*"
	              onChange={(e) => void uploadVerificationDoc(e, setAuthorityDocMeta, setAuthorityDocumentFileKey)}
	            />
            <p className="field-note">
              {authorityDocMeta
                ? `Uploaded: ${authorityDocMeta.fileName}`
                : "Required for authentication checks (SPA/board resolution/authorization file)."}
            </p>
          </div>
        </div>

        <div className="card grid">
          <h3 style={{ margin: 0 }}>Document Processing Assistance</h3>
          <p className="small" style={{ marginTop: 6, marginBottom: 0 }}>
            Request platform help for document collection, review sequencing, and transfer packet prep.
          </p>
          <label className="inline-check">
            <input
              checked={documentAssistanceRequested}
              onChange={(event) => setDocumentAssistanceRequested(event.target.checked)}
              type="checkbox"
            />
            Request document processing assistance
          </label>
          {documentAssistanceRequested && (
            <div className="form-field">
              <label className="field-label">Processing Notes</label>
              <textarea
                minLength={10}
                onChange={(event) => setDocumentAssistanceNotes(event.target.value)}
                placeholder="Share current blockers, missing documents, and preferred timeline."
                required
                rows={3}
                value={documentAssistanceNotes}
              />
              <p className="field-note">Minimum 10 characters.</p>
            </div>
          )}
        </div>

        <div className="card grid grid-2">
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h3 style={{ margin: 0 }}>Price</h3>
            <strong>Total cost to buyer: {computed ? formatPhp(computed.estimatedTotalCostPhp) : "—"}</strong>
          </div>
          <p className="small" style={{ gridColumn: "1 / -1", margin: 0 }}>
            Computed as cash out + remaining balance.
          </p>
          {!financials && (
            <p className="small" style={{ gridColumn: "1 / -1", margin: 0 }}>
              Fill all financial fields to compute total cost.
            </p>
          )}
          {financialErrors.length > 0 && (
            <p className="small" style={{ gridColumn: "1 / -1", margin: 0 }}>
              {financialErrors.join("; ")}
            </p>
          )}

          <div className="form-field">
            <label className="field-label">Original Price (PHP)</label>
            <input type="number" min={0} required value={originalPricePhpInput} onChange={(e) => setOriginalPricePhpInput(e.target.value)} />
            <p className="field-note">Developer contract price of the property.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Equity Already Paid (PHP)</label>
            <input type="number" min={0} required value={equityPaidPhpInput} onChange={(e) => setEquityPaidPhpInput(e.target.value)} />
            <p className="field-note">Total paid equity from current owner.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Remaining Balance (PHP)</label>
            <input
              type="number"
              min={0}
              required
              value={remainingBalancePhpInput}
              onChange={(e) => setRemainingBalancePhpInput(e.target.value)}
            />
            <p className="field-note">Outstanding balance buyer will continue paying.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Monthly Amortization (PHP/month)</label>
            <input
              type="number"
              min={0}
              required
              value={monthlyAmortizationPhpInput}
              onChange={(e) => setMonthlyAmortizationPhpInput(e.target.value)}
            />
            <p className="field-note">Expected monthly payment after transfer.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Cash Out Price (PHP)</label>
            <input type="number" min={0} required value={cashOutPricePhpInput} onChange={(e) => setCashOutPricePhpInput(e.target.value)} />
            <p className="field-note">One-time payment requested by seller.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Remaining Amortization (Months)</label>
            <input
              type="number"
              min={0}
              required
              value={remainingAmortizationMonthsInput}
              onChange={(e) => setRemainingAmortizationMonthsInput(e.target.value)}
            />
            <p className="field-note">Remaining number of monthly amortization periods.</p>
          </div>
          <div className="form-field">
            <label className="field-label">Loan Availability</label>
            <label className="inline-check">
              <input
                checked={availableInPagIbig}
                onChange={(e) => setAvailableInPagIbig(e.target.checked)}
                type="checkbox"
              />
              Available in Pag-IBIG
            </label>
            <label className="inline-check">
              <input
                checked={availableInHouseLoan}
                onChange={(e) => setAvailableInHouseLoan(e.target.checked)}
                type="checkbox"
              />
              Available for in-house loan
            </label>
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
              {DEFAULT_LEAD_VALIDITY_MONTHS} months from introduction, the seller agrees to pay a commission of{" "}
              {DEFAULT_COMMISSION_RATE_PCT}% of the final selling price.
            </p>
            <p>
              <strong>Payment Terms:</strong> If the seller enters into a sale, contract to sell, or any transfer agreement
              with a buyer introduced through the platform, the seller shall pay the agreed commission within{" "}
              {DEFAULT_PAYMENT_DUE_DAYS} days of the transaction.
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
              <input type="text" value={`${DEFAULT_COMMISSION_RATE_PCT}%`} disabled />
              <p className="field-note">Managed by admin. Allowed range: 3% to 5%.</p>
            </div>

            <div className="form-field">
              <label className="field-label">Lead Validity (Months)</label>
              <input type="text" value={`${DEFAULT_LEAD_VALIDITY_MONTHS}`} disabled />
              <p className="field-note">
                Managed by admin. This is how long a platform-introduced buyer remains your protected lead.
              </p>
            </div>

            <div className="form-field">
              <label className="field-label">Commission Payment Due (Days)</label>
              <input type="text" value={`${DEFAULT_PAYMENT_DUE_DAYS}`} disabled />
              <p className="field-note">Managed by admin. Number of days after transaction completion.</p>
            </div>
          </div>

          <label className="inline-check">
            <input checked={agreementAccepted} onChange={(e) => setAgreementAccepted(e.target.checked)} type="checkbox" />
            I accept the Seller Listing Agreement and Commission Protection terms.
          </label>
        </div>

        <div className="card grid">
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Publish Options</h3>
          <p className="small" style={{ margin: 0 }}>
            Before publishing, choose listing placement.
          </p>
          <div className="grid" style={{ gap: 8 }}>
            {publishPlanOptions.map((option) => (
              <label className="inline-check" key={option.type}>
                <input
                  checked={publishType === option.type}
                  name="publishType"
                  onChange={() => setPublishType(option.type)}
                  type="radio"
                  value={option.type}
                />
                {option.label} ({formatPhp(option.pricePhp)}) - {option.description}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="ghost-button" disabled={submitAction !== null} type="submit">
            {submitAction === "draft" ? "Saving Draft..." : "Save Draft"}
          </button>
          <button
            className="primary"
            disabled={submitAction !== null}
            onClick={() => void submit("publish")}
            type="button"
          >
            {submitAction === "publish" ? "Publishing..." : "Publish"}
          </button>
        </div>
      </form>

      {submitStatus && <p>{submitStatus}</p>}
      {error && <p className="small">{error}</p>}

      {signaturePadOpen && (
        <div className="signature-modal-backdrop">
          <div
            className="signature-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${signaturePadTarget === "seller" ? "Seller" : "Attorney"} signature pad`}
          >
            <h3 style={{ margin: 0 }}>
              Add {signaturePadTarget === "seller" ? "Seller" : "Attorney"} Signature
            </h3>
            <p className="small" style={{ margin: 0 }}>
              Draw your signature using finger, stylus, or mouse.
            </p>
            <div className="signature-pad" ref={signaturePadContainerRef}>
              <canvas
                onPointerDown={startSignatureDraw}
                onPointerMove={moveSignatureDraw}
                onPointerUp={endSignatureDraw}
                onPointerLeave={endSignatureDraw}
                ref={signatureCanvasRef}
              />
            </div>
            <div className="signature-modal-actions">
              <button className="ghost-button" onClick={() => setSignaturePadOpen(false)} type="button">
                Cancel
              </button>
              <button className="primary" onClick={saveSignaturePad} type="button">
                Save signature
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
