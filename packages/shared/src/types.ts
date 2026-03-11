export type UserRole = "buyer" | "seller" | "agent" | "admin";

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "live"
  | "paused"
  | "expired"
  | "rejected"
  | "archived";

export type ListingTransactionStatus =
  | "available"
  | "auctioned"
  | "in_deal"
  | "buying_in_progress"
  | "bought"
  | "released";

export type ListingTransferStatus =
  | "not_started"
  | "document_review"
  | "developer_approval"
  | "contract_signing"
  | "transfer_in_process"
  | "transfer_completed"
  | "transfer_blocked";

export type PropertyType = "condo" | "house_lot" | "lot_only";

export interface ListingFinancialInput {
  originalPricePhp: number;
  equityPaidPhp: number;
  remainingBalancePhp: number;
  monthlyAmortizationPhp: number;
  cashOutPricePhp: number;
}

export interface ListingFinancialComputed {
  estimatedTotalCostPhp: number;
}

export interface CreateListingRequest {
  propertyType: PropertyType;
  projectName: string;
  developerName: string;
  locationCity: string;
  locationProvince: string;
  floorAreaSqm: number;
  unitNumber?: string | null;
  turnoverDate?: string | null;
  title: string;
  description: string;
  financials: ListingFinancialInput;
}

export interface ListingSummary {
  id: string;
  title: string;
  propertyType: PropertyType;
  projectName: string;
  locationCity: string;
  locationProvince: string;
  cashOutPricePhp: number;
  monthlyAmortizationPhp: number;
  status: ListingStatus;
  transactionStatus: ListingTransactionStatus;
  transferStatus: ListingTransferStatus;
  lastConfirmedAt: string | null;
  readinessScore: number;
  isVerified: boolean;
  createdAt: string;
}
