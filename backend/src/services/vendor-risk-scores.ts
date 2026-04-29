import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { requirePermission } from "./rbac.js";

const RISK_MODEL_VERSION = "v1";

export type BaaStatus = "PASS" | "WARNING" | "FAIL" | "PENDING";

export type RiskFactor = {
  id: string;
  label: string;
  points: number;
};

export type VendorRiskBreakdown = {
  factors: RiskFactor[];
  rawTotal: number;
  score: number;
};

export type VendorPortfolioRow = {
  id: string;
  name: string;
  baa_status: BaaStatus;
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
  subcontractor_worst: BaaStatus | null;
  certification_count: number;
  nearest_cert_expiry: string | null;
};

export type VendorRiskPortfolioResponse = {
  modelVersion: string;
  vendors: VendorPortfolioRow[];
  summary: {
    count: number;
    avgRiskScore: number | null;
    byStatus: Record<BaaStatus, number>;
    expiringBaaWithin60Days: number;
  };
};

export type VendorRiskRecalculateResponse = {
  modelVersion: string;
  updated: number;
  summary: VendorRiskPortfolioResponse["summary"];
};

type VendorDbRow = {
  id: string;
  name: string;
  baa_status: BaaStatus;
  baa_signed_at: string | null;
  baa_expires_at: string | null;
  covered_services: string | null;
  risk_score: number | null;
  mou_document_path: string | null;
  mou_uploaded_at: string | null;
  risk_breakdown: VendorRiskBreakdown | null;
  risk_model_version: string | null;
  risk_computed_at: string | null;
};

type SubRow = { vendor_id: string; baa_status: BaaStatus };
type CertRow = { vendor_id: string; valid_until: string | null };

const STATUS_ORDER: Record<BaaStatus, number> = {
  FAIL: 4,
  WARNING: 3,
  PENDING: 2,
  PASS: 1,
};

function worstStatus(a: BaaStatus | null, b: BaaStatus): BaaStatus | null {
  if (!a) return b;
  return STATUS_ORDER[b] > STATUS_ORDER[a] ? b : a;
}

function parseDay(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (86400 * 1000));
}

function computeRisk(
  vendor: Pick<
    VendorDbRow,
    "baa_signed_at" | "baa_expires_at" | "mou_document_path" | "id"
  >,
  subs: SubRow[],
  certs: CertRow[],
): VendorRiskBreakdown {
  const factors: RiskFactor[] = [];
  const today = startOfTodayUtc();

  const exp = parseDay(vendor.baa_expires_at);
  if (exp) {
    if (exp < today) {
      factors.push({ id: "baa_expired", label: "BAA expired", points: 32 });
    } else {
      const days = daysBetween(today, exp);
      if (days <= 30) factors.push({ id: "baa_expiry_30d", label: "BAA expires within 30 days", points: 22 });
      else if (days <= 60) factors.push({ id: "baa_expiry_60d", label: "BAA expires within 60 days", points: 14 });
      else if (days <= 120) factors.push({ id: "baa_expiry_120d", label: "BAA expires within 120 days", points: 8 });
    }
  } else {
    factors.push({ id: "baa_expiry_unknown", label: "BAA expiration not recorded", points: 10 });
  }

  if (!vendor.baa_signed_at) {
    factors.push({ id: "baa_signed_missing", label: "BAA signed date missing", points: 10 });
  }

  if (!vendor.mou_document_path) {
    factors.push({ id: "mou_missing", label: "Signed MOU not on file", points: 20 });
  }

  const vendorSubs = subs.filter((s) => s.vendor_id === vendor.id);
  let worst: BaaStatus | null = null;
  for (const s of vendorSubs) {
    worst = worstStatus(worst, s.baa_status);
  }
  if (worst === "FAIL") factors.push({ id: "sub_fail", label: "Subcontractor in FAIL status", points: 22 });
  else if (worst === "WARNING") factors.push({ id: "sub_warning", label: "Subcontractor in WARNING status", points: 12 });
  else if (worst === "PENDING") factors.push({ id: "sub_pending", label: "Subcontractor BAA pending", points: 6 });

  const vendorCerts = certs.filter((c) => c.vendor_id === vendor.id);
  if (vendorCerts.length === 0) {
    factors.push({ id: "certs_missing", label: "No certifications on file", points: 10 });
  } else {
    let nearest: Date | null = null;
    for (const c of vendorCerts) {
      const vu = parseDay(c.valid_until);
      if (!vu) continue;
      if (!nearest || vu < nearest) nearest = vu;
    }
    if (nearest) {
      if (nearest < today) {
        factors.push({ id: "cert_expired", label: "Certification expired", points: 14 });
      } else {
        const days = daysBetween(today, nearest);
        if (days <= 60) factors.push({ id: "cert_expiry_60d", label: "Certification expires within 60 days", points: 10 });
        else if (days <= 120) factors.push({ id: "cert_expiry_120d", label: "Certification expires within 120 days", points: 5 });
      }
    }
  }

  const rawTotal = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.min(100, Math.max(0, rawTotal));
  return { factors, rawTotal, score };
}

function deriveBaaStatus(
  score: number,
  vendor: Pick<VendorDbRow, "baa_signed_at" | "baa_expires_at" | "mou_document_path">,
): BaaStatus {
  const today = startOfTodayUtc();
  const exp = parseDay(vendor.baa_expires_at);

  if (!vendor.baa_signed_at && !vendor.baa_expires_at) {
    return "PENDING";
  }

  if (exp && exp < today) {
    return "FAIL";
  }

  if (!vendor.mou_document_path && score >= 55) {
    return "FAIL";
  }

  if (score >= 62) return "FAIL";
  if (!vendor.mou_document_path) return "WARNING";
  if (score >= 38) return "WARNING";
  return "PASS";
}

function aggregateSubs(subs: SubRow[], vendorId: string): { count: number; worst: BaaStatus | null } {
  const list = subs.filter((s) => s.vendor_id === vendorId);
  let worst: BaaStatus | null = null;
  for (const s of list) {
    worst = worstStatus(worst, s.baa_status);
  }
  return { count: list.length, worst };
}

function aggregateCerts(certs: CertRow[], vendorId: string): { count: number; nearest: string | null } {
  const list = certs.filter((c) => c.vendor_id === vendorId);
  if (list.length === 0) return { count: 0, nearest: null };
  let min: Date | null = null;
  for (const c of list) {
    const vu = parseDay(c.valid_until);
    if (!vu) continue;
    if (!min || vu < min) min = vu;
  }
  return {
    count: list.length,
    nearest: min ? min.toISOString().slice(0, 10) : null,
  };
}

function portfolioSummary(rows: VendorPortfolioRow[]): VendorRiskPortfolioResponse["summary"] {
  const today = startOfTodayUtc();
  let expiring = 0;
  const byStatus: Record<BaaStatus, number> = {
    PASS: 0,
    WARNING: 0,
    FAIL: 0,
    PENDING: 0,
  };
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    byStatus[r.baa_status] += 1;
    const exp = parseDay(r.baa_expires_at);
    if (exp && exp >= today) {
      const days = daysBetween(today, exp);
      if (days >= 0 && days <= 60) expiring += 1;
    }
    if (r.risk_score != null) {
      sum += r.risk_score;
      n += 1;
    }
  }
  return {
    count: rows.length,
    avgRiskScore: n ? Math.round((sum / n) * 10) / 10 : null,
    byStatus,
    expiringBaaWithin60Days: expiring,
  };
}

export async function listVendorRiskPortfolio(context: AuthContext): Promise<VendorRiskPortfolioResponse> {
  const actor = await requirePermission(context, "vendor_risk_scores", "read_only");
  const orgId = actor.organization_id;

  const { data: vendorRows, error: vErr } = await context.supabase
    .from("vendors")
    .select(
      "id, name, baa_status, baa_signed_at, baa_expires_at, covered_services, risk_score, mou_document_path, mou_uploaded_at, risk_breakdown, risk_model_version, risk_computed_at",
    )
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (vErr) throw new HttpError(500, "vendors_query_failed", vErr.message);
  const vendors = (vendorRows ?? []) as VendorDbRow[];
  if (vendors.length === 0) {
    return {
      modelVersion: RISK_MODEL_VERSION,
      vendors: [],
      summary: { count: 0, avgRiskScore: null, byStatus: { PASS: 0, WARNING: 0, FAIL: 0, PENDING: 0 }, expiringBaaWithin60Days: 0 },
    };
  }

  const ids = vendors.map((v) => v.id);

  const { data: subData, error: sErr } = await context.supabase
    .from("vendor_subcontractors")
    .select("vendor_id, baa_status")
    .in("vendor_id", ids);

  if (sErr) throw new HttpError(500, "vendor_subcontractors_query_failed", sErr.message);
  const subs = (subData ?? []) as SubRow[];

  const { data: certData, error: cErr } = await context.supabase
    .from("vendor_certifications")
    .select("vendor_id, valid_until")
    .in("vendor_id", ids);

  if (cErr) throw new HttpError(500, "vendor_certifications_query_failed", cErr.message);
  const certs = (certData ?? []) as CertRow[];

  const rows: VendorPortfolioRow[] = vendors.map((v) => {
    const { count: subcontractor_count, worst: subcontractor_worst } = aggregateSubs(subs, v.id);
    const { count: certification_count, nearest: nearest_cert_expiry } = aggregateCerts(certs, v.id);
    return {
      id: v.id,
      name: v.name,
      baa_status: v.baa_status,
      baa_signed_at: v.baa_signed_at,
      baa_expires_at: v.baa_expires_at,
      covered_services: v.covered_services,
      risk_score: v.risk_score,
      mou_document_path: v.mou_document_path,
      mou_uploaded_at: v.mou_uploaded_at,
      risk_breakdown: v.risk_breakdown,
      risk_model_version: v.risk_model_version,
      risk_computed_at: v.risk_computed_at,
      subcontractor_count,
      subcontractor_worst,
      certification_count,
      nearest_cert_expiry,
    };
  });

  return {
    modelVersion: RISK_MODEL_VERSION,
    vendors: rows,
    summary: portfolioSummary(rows),
  };
}

export async function recalculateVendorRiskScores(context: AuthContext): Promise<VendorRiskRecalculateResponse> {
  const actor = await requirePermission(context, "vendor_risk_scores", "full");
  const orgId = actor.organization_id;

  const { data: vendorRows, error: vErr } = await context.supabase
    .from("vendors")
    .select("id, name, baa_signed_at, baa_expires_at, mou_document_path")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });

  if (vErr) throw new HttpError(500, "vendors_query_failed", vErr.message);
  const vendors = (vendorRows ?? []) as Array<
    Pick<VendorDbRow, "id" | "name" | "baa_signed_at" | "baa_expires_at" | "mou_document_path">
  >;

  if (vendors.length === 0) {
    return {
      modelVersion: RISK_MODEL_VERSION,
      updated: 0,
      summary: {
        count: 0,
        avgRiskScore: null,
        byStatus: { PASS: 0, WARNING: 0, FAIL: 0, PENDING: 0 },
        expiringBaaWithin60Days: 0,
      },
    };
  }

  const ids = vendors.map((v) => v.id);

  const { data: subData, error: sErr } = await context.supabase
    .from("vendor_subcontractors")
    .select("vendor_id, baa_status")
    .in("vendor_id", ids);

  if (sErr) throw new HttpError(500, "vendor_subcontractors_query_failed", sErr.message);
  const subs = (subData ?? []) as SubRow[];

  const { data: certData, error: cErr } = await context.supabase
    .from("vendor_certifications")
    .select("vendor_id, valid_until")
    .in("vendor_id", ids);

  if (cErr) throw new HttpError(500, "vendor_certifications_query_failed", cErr.message);
  const certs = (certData ?? []) as CertRow[];

  const now = new Date().toISOString();
  let updated = 0;

  for (const v of vendors) {
    const breakdown = computeRisk(v, subs, certs);
    const baa_status = deriveBaaStatus(breakdown.score, v);

    const { error: uErr } = await context.supabase
      .from("vendors")
      .update({
        risk_score: breakdown.score,
        baa_status,
        risk_breakdown: breakdown,
        risk_model_version: RISK_MODEL_VERSION,
        risk_computed_at: now,
        updated_at: now,
      })
      .eq("organization_id", orgId)
      .eq("id", v.id);

    if (uErr) throw new HttpError(500, "vendor_risk_update_failed", uErr.message);
    updated += 1;
  }

  const portfolio = await listVendorRiskPortfolio(context);
  return {
    modelVersion: RISK_MODEL_VERSION,
    updated,
    summary: portfolio.summary,
  };
}
