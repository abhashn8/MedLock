import Anthropic from "@anthropic-ai/sdk";
import { Buffer } from "node:buffer";
import { env } from "../env.js";
import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { getGitHubToken } from "./github.js";
import { syncPhiInventoryFromScanner } from "./phi-inventory.js";

let anthropicClient: Anthropic | null = null;
const MAX_REPO_FILES = 80;
const MAX_FILE_BYTES = 12_000;
const MAX_TOTAL_SOURCE_BYTES = 140_000;
const ALLOWED_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".json",
  ".yml",
  ".yaml",
  ".env",
  ".md",
];
const SKIP_SEGMENTS = ["node_modules", ".next", "dist", "build", ".git", ".turbo"];

const ANALYSIS_PROMPT = `You are a senior security auditor specializing in HIPAA and SOC 2 compliance.
Analyze the provided source code, configuration files, or infrastructure definitions
for compliance violations across all 10 categories listed below.

Be thorough and assume the worst reasonable interpretation. If a pattern COULD
leak PHI under certain conditions, flag it. Do not skip findings because they
seem minor. Flag hardcoded emails, tokens, or any test credentials.

Skip findings in:
- Files ending in .test.ts, .spec.ts, .test.js, .spec.js
- Files inside __tests__ or __mocks__ directories
- Comments that merely mention PHI without actually handling it

For each violation found, return ONLY a raw JSON array with no markdown,
no explanation, no preamble. Use exactly this structure:

[{
  "module": "phi_leakage | secrets | access_control | encryption | audit_logging | data_retention | vulnerability | vendor_risk | incident_response | policy_config",
  "severity": "Critical | High | Medium | Low | Informational",
  "title": "Short title of the finding (max 10 words)",
  "file": "path/to/file.ts",
  "line": 42,
  "evidence": "The exact line or pattern (redact actual secret/PHI values with [REDACTED])",
  "description": "What the issue is and why it matters for HIPAA/SOC2",
  "recommendation": "Specific fix with example code if applicable",
  "hipaa_reference": "§164.312(a)(1) | §164.312(e)(2)(ii) | etc or null",
  "soc2_criteria": "CC6.1 | CC7.2 | CC9.2 | etc or null",
  "cwe": "CWE-89 | CWE-312 | etc or null"
}]

If no violations are found return [].

Severity guide:
- Critical: PHI directly exposed, credentials hardcoded, auth bypassed
- High: Missing encryption, broken access control, no audit logging on PHI ops
- Medium: Weak algorithms, missing security headers, excessive data collection
- Low: Code style issues with security implications, missing best practices
- Informational: Observations worth noting but not currently a violation

Run checks for all 10 modules:

1) PHI Leakage
- Check for patient objects passed to console.log, console.error, console.warn, or any logger.* call. Check for the same data being sent to error tracking SDKs like Sentry (captureException, captureMessage, setUser), analytics tools like Mixpanel, Segment, Google Analytics (gtag, ga), Amplitude, PostHog, or LogRocket, or stored in localStorage/sessionStorage.
- Flag any variable named patient, patientName, fullName, dob, dateOfBirth, ssn, mrn, medicalRecordNumber, diagnosis, icd10, insuranceId, policyNumber, or memberId appearing on the same line as or within 5 lines of a risky sink.
- Watch for PHI embedded in URL paths, query strings, error messages, redirect URLs, or email subject lines (e.g. /api/patients/\${ssn}, ?email=user@example.com, throw new Error(\`Failed for patient \${name}\`)).
- Flag full request/response objects being logged when the route handles PHI (e.g. console.log(req.body) inside a /patients route, logger.info({ response }) after fetching from an EHR).

2) Secrets & Credentials
- Hardcoded API keys, OAuth client secrets, JWT signing keys, database passwords, GitHub personal access tokens, AWS access key IDs, Stripe keys, Anthropic/OpenAI API keys, or Supabase service-role keys appearing as string literals in source.
- Connection strings with embedded credentials such as postgres://user:password@host, mongodb://user:pass@..., or Redis URLs with auth.
- Tokens or fake-looking-but-real credentials in test fixtures, .env.example committed with real values, .env files committed to the repo, or credentials in code comments.
- Private keys (-----BEGIN RSA PRIVATE KEY-----, -----BEGIN OPENSSH PRIVATE KEY-----), .pem/.key files, or SSH keys checked into the repository.

3) Access Control & Identity
- Routes that skip authentication middleware: handlers that read req.body or req.params and query the database without first calling requireAuth, verifying req.session, or checking a JWT.
- Permission checks done only on the client (e.g. hiding a button) without matching server-side enforcement on the corresponding API route.
- Hardcoded admin bypasses such as if (user.email === 'admin@company.com'), if (req.user.id === 1), or role checks that compare against string literals instead of an RBAC table.
- Insecure-direct-object-reference patterns: queries scoped by an ID from req.params or req.query without verifying the row belongs to the authenticated user/organization (e.g. supabase.from('patients').select().eq('id', req.params.id) with no ownership filter).

4) Encryption
- Plaintext http:// URLs used to transmit PHI (fetch, axios, request) instead of https://.
- Use of weak or deprecated cryptographic algorithms: MD5, SHA1, DES, 3DES, RC4, ECB block mode, or createCipher (deprecated, replaced by createCipheriv).
- TLS verification disabled in client code: rejectUnauthorized: false, verify=False (Python), NODE_TLS_REJECT_UNAUTHORIZED=0, agent: new https.Agent({ rejectUnauthorized: false }).
- PHI written to local files, S3 buckets, or databases without encryption-at-rest enabled (missing serverSideEncryption on s3.putObject, file writes to /tmp containing patient records, missing pgcrypto or column-level encryption on PHI columns).

5) Audit Logging
- Inserts, updates, or deletes against PHI tables (patients, encounters, claims, prescriptions, ehr_records, lab_results) that do not write a corresponding audit_log or audit_event row.
- Authentication events (login, logout, password reset, MFA enrollment) and failed auth attempts not recorded with timestamp + actor.
- Audit log entries missing required fields: actor user_id, action verb, target resource, timestamp, or source IP.
- Audit logs written to mutable storage (a regular Postgres table without immutability triggers, a log file that gets rotated and overwritten) or with a retention shorter than the HIPAA-required 6 years.

6) Data Retention & Minimization
- Over-broad queries against PHI tables: SELECT * FROM patients, supabase.from('patients').select('*'), or fetching every column when only a subset (id, name) is rendered to the user.
- Long-lived caches of PHI in Redis, in-memory Maps, or service workers without explicit TTLs; duplicate copies of PHI replicated across services without a documented business reason.
- Temporary data — uploaded CSVs, scratch tables, scheduled-export files, exported PDFs — created without a deletion routine, cron job, or storage lifecycle rule.
- Backups, database dumps, or analytics exports retained indefinitely without retention metadata or expiry dates.

7) Vulnerability Patterns
- String-concatenated SQL: \`SELECT * FROM patients WHERE id = '\${req.params.id}'\`, or template literals interpolated directly into raw queries instead of parameterized client.query('... WHERE id = $1', [id]).
- Unescaped HTML insertion from user input: innerHTML, outerHTML, document.write, React dangerouslySetInnerHTML, jQuery .html(), or Vue v-html with values that originate from req.body, URL params, or DB rows.
- Use of eval(), new Function(), setTimeout with a string argument, child_process.exec, or shell=True with user-controlled input.
- Dependencies with known CVEs in package.json/requirements.txt/Pipfile (very old express, lodash <4.17.21, axios <0.21.2, log4j); missing CSRF protection on state-changing POST/PUT/DELETE routes.

8) Vendor & Third-Party Risk
- PHI sent to LLM/AI providers, analytics, telemetry, or session-replay services that typically require a BAA and may not be configured with one (OpenAI, Anthropic, Mixpanel, Segment, Google Analytics, Hotjar, FullStory, LogRocket, Datadog logs without BAA addendum, default Sentry config that captures request bodies).
- Outbound webhooks (Slack, Discord, Zapier, Make, generic POST to a third-party URL) whose payloads include patient names, IDs, or diagnoses.
- Front-end loading PHI-containing pages from non-allowlisted CDNs, iframes embedding non-vetted services, or third-party scripts injected into a page that displays PHI.
- npm or PyPI dependencies that are unmaintained (last release >2 years), low-download typosquat candidates, or packages with unsafe postinstall scripts in any module that touches PHI.

9) Incident Response Readiness
- Catch blocks that silently swallow errors: catch (e) {}, catch (err) { /* ignore */ }, except: pass, or .catch(() => null) without any logging, alerting, or rethrow.
- PHI-handling operations (DB writes, external API calls, file uploads) without try/catch or .catch handlers, so failures pass through unnoticed and PHI may be partially written.
- Missing alerting on critical failure paths: no PagerDuty/Slack/Sentry hook on auth failures, DB connection loss, encryption-key-rotation errors, or BAA-vendor 5xx responses.
- Lack of correlation IDs / request IDs / trace IDs across log lines, making post-incident forensics for a breach investigation effectively impossible.

10) Policy & Configuration
- CORS configured permissively: origin: '*', or a reflective Access-Control-Allow-Origin: req.headers.origin without an allowlist; credentials: true combined with a wildcard origin.
- Cookies set without the Secure, HttpOnly, or SameSite attributes; session cookies with excessively long max-age; auth tokens stored in localStorage instead of HttpOnly cookies.
- Missing or weak security headers in the server response: no Content-Security-Policy, no Strict-Transport-Security (HSTS), no X-Frame-Options, no X-Content-Type-Options, no Referrer-Policy, no Permissions-Policy.
- Insecure defaults in committed config: debug: true / NODE_ENV check missing, default admin credentials (admin/admin, root/root), verbose error pages exposed in production routes, .env files committed, or secrets visible in CI workflow logs.`;

type SourceInput =
  | {
      sourceType: "github";
      repoUrl: string;
    }
  | {
      sourceType: "upload";
      fileName: string;
      fileContent: string;
    };

type ParsedRepo = {
  owner: string;
  repo: string;
};

type FindingInsert = {
  source: string;
  module: string | null;
  phi_type: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  title: string | null;
  line_number: number | null;
  evidence: string;
  description: string | null;
  recommendation: string;
  hipaa_reference: string | null;
  soc2_criteria: string | null;
  cwe: string | null;
  status: "open" | "false_positive" | "resolved";
};

type FindingPatchInput = {
  action: "false_positive" | "assign_owner" | "resolve";
  reason?: string;
  owner?: string;
};

function toSafeSeverity(value: unknown): FindingInsert["severity"] {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "critical") return "Critical";
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  if (normalized === "low") return "Low";
  return "Informational";
}

function guessPhiType(moduleValue: string | null, rawType: unknown): string {
  const type = String(rawType ?? "").trim();
  if (type) return type;
  if (!moduleValue) return "Unknown";
  return moduleValue;
}

function extractJsonArray(raw: string): unknown[] {
  const first = raw.indexOf("[");
  const last = raw.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) return [];
  const payload = raw.slice(first, last + 1);
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRepoUrl(repoUrl: string): ParsedRepo {
  const trimmed = repoUrl.trim();
  const patterns = [
    /github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/i,
    /^([^/]+)\/([^/.]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { owner: match[1], repo: match[2] };
    }
  }
  throw new HttpError(400, "invalid_repo_url", "Provide a valid GitHub repository URL.");
}

async function getOrganizationId(context: AuthContext): Promise<string> {
  let { data, error } = await context.supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", context.user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "organization_lookup_failed", error.message);
  }
  if (!data?.organization_id) {
    const orgName = `MedLock - ${context.user.email ?? context.user.id}`;
    const { error: bootstrapError } = await context.supabase.rpc(
      "bootstrap_organization_for_current_user",
      { org_name: orgName },
    );
    if (bootstrapError) {
      throw new HttpError(500, "organization_bootstrap_failed", bootstrapError.message);
    }

    const retry = await context.supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", context.user.id)
      .limit(1)
      .maybeSingle();

    data = retry.data;
    error = retry.error;
    if (error) {
      throw new HttpError(500, "organization_lookup_failed", error.message);
    }
    if (!data?.organization_id) {
      throw new HttpError(404, "organization_not_found", "No organization membership found.");
    }
  }
  return data.organization_id as string;
}

async function updateScanProgress(
  context: AuthContext,
  scanId: string,
  patch: {
    status?: "pending" | "running" | "complete" | "error";
    progress_percent?: number;
    progress_message?: string;
    error_message?: string | null;
  },
): Promise<void> {
  const { error } = await context.supabase.from("phi_scans").update(patch).eq("id", scanId);
  if (error) throw new HttpError(500, "phi_scan_update_failed", error.message);
}

async function loadGitHubSource(context: AuthContext, repoUrl: string): Promise<{
  sourceName: string;
  fileName: string;
  payload: string;
}> {
  const parsed = parseRepoUrl(repoUrl);
  const token = await getGitHubToken(context);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const treeResponse = await fetch(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/HEAD?recursive=1`,
    { headers },
  );
  if (!treeResponse.ok) {
    throw new HttpError(treeResponse.status, "github_tree_failed", "Unable to list files.");
  }
  const tree = (await treeResponse.json()) as { tree?: Array<{ path: string; type: string }> };
  const paths = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => {
      const segments = path.split("/");
      if (segments.some((segment) => SKIP_SEGMENTS.includes(segment))) return false;
      return ALLOWED_EXTENSIONS.some((extension) => path.endsWith(extension));
    })
    .slice(0, MAX_REPO_FILES);

  const sourceParts: string[] = [];
  let totalBytes = 0;
  for (const path of paths) {
    if (totalBytes >= MAX_TOTAL_SOURCE_BYTES) break;
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${path}`,
      { headers },
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { content?: string; encoding?: string };
    if (!data.content || data.encoding !== "base64") continue;
    const decoded = Buffer.from(data.content, "base64").toString("utf8");
    const snippet = decoded.slice(0, MAX_FILE_BYTES);
    const chunk = `FILE: ${path}\n${snippet}\n`;
    totalBytes += Buffer.byteLength(chunk, "utf8");
    if (totalBytes <= MAX_TOTAL_SOURCE_BYTES) {
      sourceParts.push(chunk);
    }
  }

  if (sourceParts.length === 0) {
    throw new HttpError(400, "no_supported_files", "No supported source files were found.");
  }

  return {
    sourceName: `${parsed.owner}/${parsed.repo}`,
    fileName: `${parsed.owner}-${parsed.repo}.txt`,
    payload: sourceParts.join("\n-----------------\n").slice(0, MAX_TOTAL_SOURCE_BYTES),
  };
}

function loadUploadSource(input: Extract<SourceInput, { sourceType: "upload" }>): {
  sourceName: string;
  fileName: string;
  payload: string;
} {
  if (!input.fileName?.trim() || !input.fileContent?.trim()) {
    throw new HttpError(400, "invalid_upload", "fileName and fileContent are required.");
  }
  return {
    sourceName: input.fileName.trim(),
    fileName: input.fileName.trim(),
    payload: input.fileContent.slice(0, MAX_TOTAL_SOURCE_BYTES),
  };
}

async function insertFindings(
  context: AuthContext,
  organizationId: string,
  scanId: string,
  findings: FindingInsert[],
): Promise<void> {
  if (findings.length === 0) return;
  const rows = findings.map((finding) => ({
    scan_id: scanId,
    organization_id: organizationId,
    ...finding,
  }));
  const { error } = await context.supabase.from("phi_findings").insert(rows);
  if (error) throw new HttpError(500, "phi_findings_insert_failed", error.message);
}

function normalizeFindings(raw: unknown[]): FindingInsert[] {
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const moduleValue = typeof item.module === "string" ? item.module : null;
      const source = typeof item.file === "string" ? item.file : "unknown";
      const evidenceText =
        typeof item.evidence === "string" && item.evidence.trim()
          ? item.evidence.trim()
          : "[REDACTED]";

      return {
        source,
        module: moduleValue,
        phi_type: guessPhiType(moduleValue, item.phi_type),
        severity: toSafeSeverity(item.severity),
        title: typeof item.title === "string" ? item.title.slice(0, 120) : null,
        line_number: Number.isInteger(item.line) ? (item.line as number) : null,
        evidence: evidenceText,
        description: typeof item.description === "string" ? item.description : null,
        recommendation:
          typeof item.recommendation === "string" && item.recommendation.trim()
            ? item.recommendation.trim()
            : "Review and remediate based on HIPAA minimum necessary requirements.",
        hipaa_reference: typeof item.hipaa_reference === "string" ? item.hipaa_reference : null,
        soc2_criteria: typeof item.soc2_criteria === "string" ? item.soc2_criteria : null,
        cwe: typeof item.cwe === "string" ? item.cwe : null,
        status: "open",
      };
    });
}

export async function runPhiScan(
  context: AuthContext,
  input: SourceInput,
): Promise<{ scanId: string; findingCount: number }> {
  if (!env.anthropicApiKey) {
    throw new HttpError(500, "anthropic_not_configured", "ANTHROPIC_API_KEY is not configured.");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.anthropicApiKey });
  }

  const organizationId = await getOrganizationId(context);
  const sourcePayload =
    input.sourceType === "github" ? await loadGitHubSource(context, input.repoUrl) : loadUploadSource(input);

  const { data: insertedScan, error: scanInsertError } = await context.supabase
    .from("phi_scans")
    .insert({
      organization_id: organizationId,
      source_name: sourcePayload.sourceName,
      source_type: input.sourceType,
      status: "pending",
      triggered_by: context.user.email ?? context.user.id,
      file_path: "pending",
      progress_percent: 5,
      progress_message: "Queued for ingestion",
    })
    .select("id")
    .single();

  if (scanInsertError || !insertedScan?.id) {
    throw new HttpError(500, "phi_scan_insert_failed", scanInsertError?.message);
  }
  const scanId = insertedScan.id as string;

  try {
    await updateScanProgress(context, scanId, {
      status: "running",
      progress_percent: 20,
      progress_message: "Uploading source bundle to storage",
    });

    const storagePath = `${organizationId}/${scanId}/${sourcePayload.fileName}`;
    const uploadResult = await context.supabase.storage
      .from("phi-scans")
      .upload(storagePath, Buffer.from(sourcePayload.payload, "utf8"), {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      });

    if (uploadResult.error) {
      throw new HttpError(500, "storage_upload_failed", uploadResult.error.message);
    }

    await updateScanProgress(context, scanId, {
      progress_percent: 50,
      progress_message: "Analyzing source with Anthropic",
    });
    await context.supabase
      .from("phi_scans")
      .update({ file_path: storagePath })
      .eq("id", scanId);

    const analysis = await anthropicClient.messages.create({
      model: env.anthropicModel,
      max_tokens: 8192,
      system: [
        {
          type: "text",
          text: ANALYSIS_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Analyze this source and return JSON array only.\n\nSOURCE: ${sourcePayload.sourceName}\n\n${sourcePayload.payload}`,
        },
      ],
    });

    const textBlocks = analysis.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    const normalized = normalizeFindings(extractJsonArray(textBlocks));

    await updateScanProgress(context, scanId, {
      progress_percent: 80,
      progress_message: "Saving findings",
    });
    await insertFindings(context, organizationId, scanId, normalized);

    try {
      await syncPhiInventoryFromScanner(context, scanId);
    } catch (syncError) {
      console.error("[phi_inventory_sync_failed]", syncError);
    }

    await updateScanProgress(context, scanId, {
      status: "complete",
      progress_percent: 100,
      progress_message: "Scan complete",
      error_message: null,
    });

    return {
      scanId,
      findingCount: normalized.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    await updateScanProgress(context, scanId, {
      status: "error",
      progress_percent: 100,
      progress_message: "Scan failed",
      error_message: message,
    });
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "phi_scan_failed", message);
  }
}

export async function getPhiScanOverview(
  context: AuthContext,
  filters: {
    scan_id?: string;
    severity?: string;
    phi_type?: string;
    status?: string;
    source?: string;
  },
): Promise<{
  scans: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  stats: {
    totalFindings: number;
    criticalCount: number;
    sourcesScanned: number;
    falsePositives: number;
  };
}> {
  const organizationId = await getOrganizationId(context);

  const scanQuery = context.supabase
    .from("phi_scans")
    .select(
      "id, created_at, source_name, source_type, status, triggered_by, file_path, progress_percent, progress_message, error_message, phi_findings(count)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(25);

  const findingsQuery = context.supabase
    .from("phi_findings")
    .select(
      "id, scan_id, source, phi_type, severity, line_number, evidence, title, description, recommendation, status, false_positive_reason, owner, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.scan_id) findingsQuery.eq("scan_id", filters.scan_id);
  if (filters.severity) findingsQuery.eq("severity", filters.severity);
  if (filters.phi_type) findingsQuery.ilike("phi_type", `%${filters.phi_type}%`);
  if (filters.status) findingsQuery.eq("status", filters.status);
  if (filters.source) findingsQuery.ilike("source", `%${filters.source}%`);

  const [{ data: scans, error: scanError }, { data: findings, error: findingError }] =
    await Promise.all([scanQuery, findingsQuery]);

  if (scanError) throw new HttpError(500, "phi_scans_query_failed", scanError.message);
  if (findingError) throw new HttpError(500, "phi_findings_query_failed", findingError.message);

  const resultFindings = findings ?? [];
  const normalizedScans: Record<string, unknown>[] = (scans ?? []).map((row) => {
    const embedded = (row as Record<string, unknown>).phi_findings;
    let finding_count = 0;
    if (Array.isArray(embedded) && embedded[0]) {
      const rawCount = (embedded[0] as { count?: unknown }).count;
      if (typeof rawCount === "number" && Number.isFinite(rawCount)) {
        finding_count = rawCount;
      } else if (typeof rawCount === "string" && rawCount.trim() !== "") {
        const parsed = Number.parseInt(rawCount, 10);
        finding_count = Number.isFinite(parsed) ? parsed : 0;
      }
    }
    const { phi_findings: _omit, ...rest } = row as Record<string, unknown>;
    return { ...rest, finding_count };
  });
  const allScanSourceNames = new Set<string>(
    normalizedScans.map((scan) => String(scan.source_name ?? "")).filter(Boolean),
  );
  const scopedScanId = filters.scan_id?.trim();
  const sourcesScanned =
    scopedScanId && normalizedScans.some((s) => String(s.id) === scopedScanId)
      ? 1
      : scopedScanId
        ? 0
        : allScanSourceNames.size;

  return {
    scans: normalizedScans,
    findings: resultFindings,
    stats: {
      totalFindings: resultFindings.length,
      criticalCount: resultFindings.filter((row) => row.severity === "Critical").length,
      sourcesScanned,
      falsePositives: resultFindings.filter((row) => row.status === "false_positive").length,
    },
  };
}

export async function patchPhiFinding(
  context: AuthContext,
  findingId: string,
  input: FindingPatchInput,
): Promise<void> {
  const organizationId = await getOrganizationId(context);
  const updateData: Record<string, unknown> = {};

  if (input.action === "false_positive") {
    if (!input.reason?.trim()) {
      throw new HttpError(400, "invalid_request", "Reason is required for false positive.");
    }
    updateData.status = "false_positive";
    updateData.false_positive_reason = input.reason.trim();
  } else if (input.action === "assign_owner") {
    if (!input.owner?.trim()) {
      throw new HttpError(400, "invalid_request", "Owner is required.");
    }
    updateData.owner = input.owner.trim();
  } else if (input.action === "resolve") {
    updateData.status = "resolved";
  } else {
    throw new HttpError(400, "invalid_action", "Unsupported finding action.");
  }

  const { error } = await context.supabase
    .from("phi_findings")
    .update(updateData)
    .eq("id", findingId)
    .eq("organization_id", organizationId);

  if (error) throw new HttpError(500, "phi_finding_update_failed", error.message);
}

export async function createPhiScanSchedule(
  context: AuthContext,
  input: { source: string; frequency: "daily" | "weekly" | "monthly" },
): Promise<void> {
  const organizationId = await getOrganizationId(context);
  if (!input.source?.trim()) {
    throw new HttpError(400, "invalid_request", "source is required");
  }

  const now = new Date();
  const nextRun = new Date(now);
  if (input.frequency === "daily") nextRun.setDate(nextRun.getDate() + 1);
  if (input.frequency === "weekly") nextRun.setDate(nextRun.getDate() + 7);
  if (input.frequency === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);

  const { error } = await context.supabase.from("phi_scan_schedules").insert({
    organization_id: organizationId,
    source: input.source.trim(),
    frequency: input.frequency,
    next_run: nextRun.toISOString(),
    created_by: context.user.email ?? context.user.id,
  });

  if (error) throw new HttpError(500, "phi_schedule_insert_failed", error.message);
}
