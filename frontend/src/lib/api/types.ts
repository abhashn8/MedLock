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
  findings: PhiFinding[];
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
  /** Populated by API: count of findings for this scan (stable when findings list is filtered). */
  finding_count?: number;
};

export type PhiFinding = {
  id: string;
  scan_id: string;
  source: string;
  phi_type: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  line_number: number | null;
  evidence: string;
  title?: string | null;
  description?: string | null;
  recommendation: string;
  hipaa_reference?: string | null;
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

export type PhiSystemClassification =
  | "clinical"
  | "direct_identifier"
  | "financial"
  | "contact"
  | "derived";

export type PhiSystemType =
  | "database"
  | "object_storage"
  | "api"
  | "saas"
  | "email"
  | "file_share"
  | "backup"
  | "other";

export type PhiSystemStatus = "active" | "needs_review" | "at_risk" | "decommissioned";

export type PhiSystemSource = "manual" | "scanner";

export type PhiInventoryPhiType =
  | "ssn"
  | "mrn"
  | "dob"
  | "name"
  | "email"
  | "phone"
  | "fax"
  | "address"
  | "zip"
  | "dates"
  | "age_over_89"
  | "diagnosis"
  | "insurance_id"
  | "account_number"
  | "certificate_number"
  | "device_identifier"
  | "ip_address"
  | "biometric"
  | "photo"
  | "url"
  | "bank_account"
  | "other";

export type PhiSystem = {
  id: string;
  organization_id?: string;
  name: string;
  description: string | null;
  system_type: PhiSystemType;
  host_or_url: string | null;
  department: string;
  classification: PhiSystemClassification;
  phi_types: string[];
  business_owner_id: string | null;
  technical_owner_id: string | null;
  business_owner_name?: string | null;
  technical_owner_name?: string | null;
  encryption_at_rest: boolean;
  encryption_at_rest_method: string | null;
  encryption_in_transit: boolean;
  encryption_in_transit_protocol: string | null;
  access_control_method: "rbac" | "iam" | "password" | "none";
  baa_required: boolean;
  baa_id: string | null;
  retention_years: number | null;
  retention_legal_basis: "hipaa_minimum" | "state_law" | "contract" | "custom" | null;
  retention_notes: string | null;
  review_cadence: "quarterly" | "semi_annual" | "annual";
  last_reviewed_at: string | null;
  next_review_due_at: string | null;
  source: PhiSystemSource;
  phi_scan_id: string | null;
  status: PhiSystemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  days_until_review?: number | null;
  risk_score?: number;
  compliance_gaps?: Array<{ key: string; citation: string }>;
};

export type PhiSystemReviewRow = {
  id: string;
  organization_id: string;
  system_id: string;
  reviewed_by: string;
  reviewed_at: string;
  changes_made: string | null;
  next_review_due_at: string;
  created_at: string;
  reviewer_name?: string | null;
};

export type PhiInventoryListResponse = {
  items: PhiSystem[];
  total: number;
  stats: {
    systemsCataloged: number;
    missingOwners: number;
    retentionGaps: number;
    reviewOverdue: number;
  };
  departments: string[];
};

export type PhiInventoryCoverageRow = {
  phi_type: string;
  system_count: number;
  systems: { id: string; name: string }[];
};

export type PhiInventorySyncResult = {
  created: number;
  already_exists: number;
};

export type PhiSystemAuditLogRow = {
  id: string;
  organization_id: string;
  system_id: string;
  changed_by: string | null;
  changed_by_name?: string | null;
  changed_at: string;
  action: "created" | "updated" | "reviewed" | "decommissioned";
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
};

export type PhiInventoryRiskSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  top_risks: PhiSystem[];
};

export type PhiReviewSubmitPayload = {
  reviewer_role: "privacy_officer" | "compliance_manager" | "system_owner" | "security_officer";
  changes_made: string;
  checklist_confirmed: boolean;
  cosigner_id?: string | null;
  cosigner_role?: string | null;
};

export type PhiBulkUpdatePayload = {
  ids: string[];
  updates: Partial<PhiSystem>;
};

export type PhiBulkUpdateResult = {
  updated: number;
  errors: Array<{ id: string; reason: string }>;
};

export type PhiImportResult = {
  imported: number;
  warnings: Array<{ row: number; message: string }>;
  blocked: Array<{ row: number; reason: string }>;
};

export type PhiDecommissionPayload = {
  method: string;
  date?: string;
  authorized_by?: string;
  successor_system?: string;
  legal_hold_ref?: string;
  notes?: string;
};

export type DeidStandard = "safe_harbor" | "expert_determination";

export type DeidFinding = {
  identifier_type: string;
  hipaa_category: "direct" | "quasi" | "unique";
  column_name: string;
  sample_pattern: string;
  row_count_affected: number;
  severity: "blocker" | "warning";
  remediation: string;
  safe_harbor_item: number;
};

export type DeidAssessment = {
  id: string;
  organization_id: string;
  created_by: string | null;
  dataset_label: string;
  standard: DeidStandard;
  tool: "checker" | "deidentifier";
  status: "pending" | "running" | "pass" | "fail" | "needs_expert" | "error";
  row_count: number | null;
  column_count: number | null;
  columns_detected: Array<{ name: string; inferred_type: string; phi_type: string | null }>;
  findings: DeidFinding[];
  identifier_count: number;
  passed_identifiers: string[];
  failed_identifiers: string[];
  reidentification_risk: number | null;
  kanonymity_value: number | null;
  quasi_identifiers: string[];
  remediation_of: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DeidJob = {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  dataset_label: string;
  status: "pending" | "running" | "complete" | "error";
  row_count: number | null;
  column_count: number | null;
  column_mapping: Array<{ column_name: string; phi_type?: string | null; action: string; custom_value?: string | null }>;
  transformations_applied: Array<{ column: string; action: string; rows_transformed: number; rows_suppressed: number; notes: string | null }>;
  output_row_count: number | null;
  output_column_count: number | null;
  suppressed_rows: number;
  output_storage_path: string | null;
  created_at: string;
  completed_at: string | null;
};
