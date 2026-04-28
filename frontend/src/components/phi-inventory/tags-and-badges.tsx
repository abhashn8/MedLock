import type { PhiInventoryPhiType, PhiSystemClassification, PhiSystemStatus, PhiSystemType } from "@/lib/api/types";
import {
  Archive,
  Boxes,
  Cloud,
  Database,
  FolderOpen,
  HardDrive,
  Mail,
  Network,
} from "lucide-react";

const PHI_TYPE_LABELS: Record<PhiInventoryPhiType, string> = {
  ssn: "SSN",
  mrn: "MRN",
  dob: "DOB",
  name: "Name",
  email: "Email",
  phone: "Phone",
  fax: "Fax",
  address: "Address",
  zip: "ZIP",
  dates: "Dates",
  age_over_89: "Age 89+",
  diagnosis: "Diagnosis",
  insurance_id: "Insurance ID",
  account_number: "Account #",
  certificate_number: "Certificate #",
  device_identifier: "Device ID",
  ip_address: "IP",
  biometric: "Biometric",
  photo: "Photo",
  url: "URL",
  bank_account: "Bank",
  other: "Other",
};

export const ALL_PHI_TYPES = Object.keys(PHI_TYPE_LABELS) as PhiInventoryPhiType[];

export function PhiTypeTag({ type }: { type: string }) {
  const label = PHI_TYPE_LABELS[type as PhiInventoryPhiType] ?? type.replace(/_/g, " ");
  return (
    <span className="inline-flex max-w-full truncate rounded-hs-pill border border-hs-border bg-hs-fill px-2 py-0.5 text-[11px] font-medium capitalize text-hs-secondary">
      {label}
    </span>
  );
}

const CLASS_STYLES: Record<PhiSystemClassification, string> = {
  clinical: "border-emerald-200 bg-emerald-50 text-emerald-900",
  direct_identifier: "border-rose-200 bg-rose-50 text-rose-900",
  financial: "border-amber-200 bg-amber-50 text-amber-900",
  contact: "border-sky-200 bg-sky-50 text-sky-900",
  derived: "border-violet-200 bg-violet-50 text-violet-900",
};

export function ClassificationBadge({ classification }: { classification: PhiSystemClassification }) {
  return (
    <span
      className={`inline-flex rounded-hs-pill border px-2 py-0.5 text-[11px] font-medium capitalize ${CLASS_STYLES[classification]}`}
    >
      {classification.replace(/_/g, " ")}
    </span>
  );
}

const STATUS_STYLES: Record<PhiSystemStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-900",
  needs_review: "border-amber-200 bg-amber-50 text-amber-900",
  at_risk: "border-rose-200 bg-rose-50 text-rose-900",
  decommissioned: "border-hs-border bg-hs-fill text-hs-muted line-through decoration-hs-muted",
};

export function SystemStatusBadge({ status }: { status: PhiSystemStatus }) {
  const label =
    status === "needs_review"
      ? "Needs review"
      : status === "at_risk"
        ? "At risk"
        : status === "decommissioned"
          ? "Decommissioned"
          : "Active";
  return (
    <span
      title={
        status === "needs_review"
          ? "Needs review: §164.308(a)(1)(ii)(A)"
          : status === "at_risk"
            ? "At risk: §164.308(a)(2), §164.316(b)(2)"
            : undefined
      }
      className={`inline-flex rounded-hs-pill border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

export function RiskScoreBadge({ score }: { score: number }) {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const level = safe >= 81 ? "Critical" : safe >= 61 ? "High" : safe >= 31 ? "Medium" : "Low";
  const style =
    safe >= 81
      ? "border-rose-300 bg-rose-100 text-rose-900"
      : safe >= 61
        ? "border-orange-300 bg-orange-100 text-orange-900"
        : safe >= 31
          ? "border-amber-300 bg-amber-100 text-amber-900"
          : "border-emerald-300 bg-emerald-100 text-emerald-900";
  return (
    <span className={`inline-flex items-center gap-1 rounded-hs-pill border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      <span className="tabular-nums">{safe}</span>
      <span>{level}</span>
    </span>
  );
}

const TYPE_ICONS: Record<PhiSystemType, typeof Database> = {
  database: Database,
  object_storage: HardDrive,
  api: Network,
  saas: Cloud,
  email: Mail,
  file_share: FolderOpen,
  backup: Archive,
  other: Boxes,
};

export function SystemTypeIcon({ systemType }: { systemType: PhiSystemType }) {
  const Icon = TYPE_ICONS[systemType] ?? Boxes;
  return <Icon className="size-4 shrink-0 text-hs-muted" aria-hidden />;
}
