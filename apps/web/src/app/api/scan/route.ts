import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scanFiles } from "@medlock/phi-detector";

const ALLOWED_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py"];
const SKIP_SEGMENTS = ["node_modules", ".next", "dist", "build", ".git"];
const MAX_FILES = 50;

interface TreeEntry {
  path: string;
  type: string;
}

export async function POST(request: Request) {
  const { owner, repo } = (await request.json()) as {
    owner?: string;
    repo?: string;
  };

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "owner and repo are required" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("github_connections")
    .select("github_access_token")
    .eq("user_id", user.id)
    .single();

  if (!connection?.github_access_token) {
    return NextResponse.json(
      { error: "no_github_connection" },
      { status: 404 },
    );
  }

  const token = connection.github_access_token as string;
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers: ghHeaders },
  );

  if (!treeRes.ok) {
    return NextResponse.json(
      { error: "github_tree_failed" },
      { status: treeRes.status },
    );
  }

  const tree = (await treeRes.json()) as { tree?: TreeEntry[] };

  const candidatePaths = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => {
      const segments = path.split("/");
      if (segments.some((seg) => SKIP_SEGMENTS.includes(seg))) return false;
      return ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
    })
    .slice(0, MAX_FILES);

  const files = await Promise.all(
    candidatePaths.map(async (path) => {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers: ghHeaders },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { content?: string; encoding?: string };
      if (!data.content || data.encoding !== "base64") return null;
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { path, content };
    }),
  );

  const validFiles = files.filter(
    (f): f is { path: string; content: string } => f !== null,
  );

  const findings = scanFiles(validFiles);

  const { data: scan, error: insertError } = await supabase
    .from("scans")
    .insert({
      user_id: user.id,
      repo_owner: owner,
      repo_name: repo,
      findings,
    })
    .select("id")
    .single();

  if (insertError || !scan) {
    return NextResponse.json(
      { error: "scan_insert_failed", detail: insertError?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scanId: scan.id,
    findingCount: findings.length,
  });
}
