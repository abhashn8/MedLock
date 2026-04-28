import { scanFiles, type Finding } from "@medlock/phi-detector";
import { HttpError } from "../http-error.js";
import type { AuthContext } from "../supabase.js";
import { getGitHubToken } from "./github.js";

const ALLOWED_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py"];
const SKIP_SEGMENTS = ["node_modules", ".next", "dist", "build", ".git"];
const MAX_FILES = 50;

type TreeEntry = {
  path: string;
  type: string;
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

export async function listScans({ supabase, user }: AuthContext): Promise<ScanSummary[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, repo_owner, repo_name, created_at, findings")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new HttpError(500, "scans_query_failed", error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    repo_owner: row.repo_owner as string,
    repo_name: row.repo_name as string,
    created_at: row.created_at as string,
    finding_count: Array.isArray(row.findings) ? row.findings.length : 0,
  }));
}

export async function getScan(context: AuthContext, scanId: string): Promise<Scan> {
  const { data, error } = await context.supabase
    .from("scans")
    .select("id, repo_owner, repo_name, findings, created_at")
    .eq("id", scanId)
    .eq("user_id", context.user.id)
    .single();

  if (error || !data) {
    throw new HttpError(404, "scan_not_found", error?.message ?? "Scan not found.");
  }

  return {
    id: data.id as string,
    repo_owner: data.repo_owner as string,
    repo_name: data.repo_name as string,
    findings: (data.findings ?? []) as Finding[],
    created_at: data.created_at as string,
  };
}

export async function createScan(
  context: AuthContext,
  input: { owner?: string; repo?: string },
): Promise<{ scanId: string; findingCount: number }> {
  if (!input.owner || !input.repo) {
    throw new HttpError(400, "invalid_request", "owner and repo are required");
  }

  const token = await getGitHubToken(context);
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const treeResponse = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/git/trees/HEAD?recursive=1`,
    { headers: ghHeaders },
  );

  if (!treeResponse.ok) {
    throw new HttpError(treeResponse.status, "github_tree_failed");
  }

  const tree = (await treeResponse.json()) as { tree?: TreeEntry[] };
  const candidatePaths = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => {
      const segments = path.split("/");
      if (segments.some((segment) => SKIP_SEGMENTS.includes(segment))) return false;
      return ALLOWED_EXTENSIONS.some((extension) => path.endsWith(extension));
    })
    .slice(0, MAX_FILES);

  const files = await Promise.all(
    candidatePaths.map(async (path) => {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/contents/${path}`,
        { headers: ghHeaders },
      );
      if (!response.ok) return null;

      const data = (await response.json()) as {
        content?: string;
        encoding?: string;
      };

      if (!data.content || data.encoding !== "base64") return null;

      return {
        path,
        content: Buffer.from(data.content, "base64").toString("utf-8"),
      };
    }),
  );

  const findings = scanFiles(
    files.filter((file): file is { path: string; content: string } => file !== null),
  );

  const { data: scan, error } = await context.supabase
    .from("scans")
    .insert({
      user_id: context.user.id,
      repo_owner: input.owner,
      repo_name: input.repo,
      findings,
    })
    .select("id")
    .single();

  if (error || !scan) {
    throw new HttpError(500, "scan_insert_failed", error?.message);
  }

  return {
    scanId: scan.id as string,
    findingCount: findings.length,
  };
}
