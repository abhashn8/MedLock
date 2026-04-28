import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { runPhiScan } from "./phi-scan.js";

export type ScanSummary = {
  id: string;
  repo_owner: string;
  repo_name: string;
  created_at: string;
  finding_count: number;
};

export type ReportFinding = {
  id: string;
  source: string;
  phi_type: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  line_number: number | null;
  evidence: string;
  title: string | null;
  description: string | null;
  recommendation: string;
  hipaa_reference: string | null;
  status: "open" | "false_positive" | "resolved";
};

export type Scan = {
  id: string;
  repo_owner: string;
  repo_name: string;
  findings: ReportFinding[];
  created_at: string;
};

function splitSourceName(source: string): { repo_owner: string; repo_name: string } {
  const trimmed = (source ?? "").trim();
  const slash = trimmed.indexOf("/");
  if (slash === -1) {
    return { repo_owner: "", repo_name: trimmed };
  }
  return {
    repo_owner: trimmed.slice(0, slash),
    repo_name: trimmed.slice(slash + 1),
  };
}

function readEmbeddedCount(value: unknown): number {
  if (!Array.isArray(value) || !value[0]) return 0;
  const raw = (value[0] as { count?: unknown }).count;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function listScans({ supabase }: AuthContext): Promise<ScanSummary[]> {
  const { data, error } = await supabase
    .from("phi_scans")
    .select("id, source_name, created_at, phi_findings(count)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new HttpError(500, "scans_query_failed", error.message);
  }

  return (data ?? []).map((row) => {
    const { repo_owner, repo_name } = splitSourceName(row.source_name as string);
    return {
      id: row.id as string,
      repo_owner,
      repo_name,
      created_at: row.created_at as string,
      finding_count: readEmbeddedCount((row as Record<string, unknown>).phi_findings),
    };
  });
}

export async function getScan(context: AuthContext, scanId: string): Promise<Scan> {
  const { data: scan, error: scanError } = await context.supabase
    .from("phi_scans")
    .select("id, source_name, created_at")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    throw new HttpError(404, "scan_not_found", scanError?.message ?? "Scan not found.");
  }

  const { data: findings, error: findingsError } = await context.supabase
    .from("phi_findings")
    .select(
      "id, source, phi_type, severity, line_number, evidence, title, description, recommendation, hipaa_reference, status",
    )
    .eq("scan_id", scanId)
    .order("created_at", { ascending: true });

  if (findingsError) {
    throw new HttpError(500, "phi_findings_query_failed", findingsError.message);
  }

  const { repo_owner, repo_name } = splitSourceName(scan.source_name as string);

  return {
    id: scan.id as string,
    repo_owner,
    repo_name,
    created_at: scan.created_at as string,
    findings: (findings ?? []) as ReportFinding[],
  };
}

export async function createScan(
  context: AuthContext,
  input: { owner?: string; repo?: string },
): Promise<{ scanId: string; findingCount: number }> {
  if (!input.owner || !input.repo) {
    throw new HttpError(400, "invalid_request", "owner and repo are required");
  }
  return runPhiScan(context, {
    sourceType: "github",
    repoUrl: `${input.owner}/${input.repo}`,
  });
}
