export type Finding = {
  line: number;
  lineContent: string;
  phiField: string;
  sink: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  filePath: string;
};

export type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  owner: { login: string };
};

export type ScanSummary = {
  id: string;
  repo_owner: string;
  repo_name: string;
  created_at: string;
  finding_count: number;
};

export type Scan = {
  id: string;
  repo_owner: string;
  repo_name: string;
  findings: Finding[];
  created_at: string;
};

export type PhiScan = {
  id: string;
  created_at: string;
  source_name: string;
  source_type: "github" | "upload";
  status: "pending" | "running" | "complete" | "error";
  triggered_by: string;
  file_path: string;
  progress_percent: number;
  progress_message: string | null;
  error_message: string | null;
};

export type PhiFinding = {
  id: string;
  scan_id: string;
  source: string;
  phi_type: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  line_number: number | null;
  evidence: string;
  recommendation: string;
  status: "open" | "false_positive" | "resolved";
  false_positive_reason: string | null;
  owner: string | null;
  created_at: string;
};

export type PhiScanOverview = {
  scans: PhiScan[];
  findings: PhiFinding[];
  stats: {
    totalFindings: number;
    criticalCount: number;
    sourcesScanned: number;
    falsePositives: number;
  };
};
