import { apiFetch } from "@/lib/api/client";

export type VendorRiskBaaStatus = "PASS" | "WARNING" | "FAIL" | "PENDING";

export type VendorRiskFactor = {
  id: string;
  label: string;
  points: number;
};

export type VendorRiskBreakdown = {
  factors: VendorRiskFactor[];
  rawTotal: number;
  score: number;
};

export type VendorPortfolioRow = {
  id: string;
  name: string;
  baa_status: VendorRiskBaaStatus;
  baa_signed_at: string | null;
  baa_expires_at: string | null;
  covered_services: string | null;
  risk_score: number | null;
  mou_document_path: string | null;
  mou_uploaded_at: string | null;
  risk_breakdown: VendorRiskBreakdown | null;
  risk_model_version: string | null;
  risk_computed_at: string | null;
  subcontractor_count: number;
  subcontractor_worst: VendorRiskBaaStatus | null;
  certification_count: number;
  nearest_cert_expiry: string | null;
};

export type VendorRiskPortfolioResponse = {
  modelVersion: string;
  vendors: VendorPortfolioRow[];
  summary: {
    count: number;
    avgRiskScore: number | null;
    byStatus: Record<VendorRiskBaaStatus, number>;
    expiringBaaWithin60Days: number;
  };
};

export type VendorRiskRecalculateResponse = {
  modelVersion: string;
  updated: number;
  summary: VendorRiskPortfolioResponse["summary"];
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function getVendorRiskPortfolio() {
  return readJson<VendorRiskPortfolioResponse>(await apiFetch("/api/vendor-risk-scores"));
}

export async function postVendorRiskRecalculate() {
  return readJson<VendorRiskRecalculateResponse>(
    await apiFetch("/api/vendor-risk-scores/recalculate", { method: "POST" }),
  );
}
