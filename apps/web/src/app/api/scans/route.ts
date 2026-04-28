import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("scans")
    .select("id, repo_owner, repo_name, created_at, findings")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: "scans_query_failed", detail: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    repo_owner: row.repo_owner,
    repo_name: row.repo_name,
    created_at: row.created_at,
    finding_count: Array.isArray(row.findings) ? row.findings.length : 0,
  }));

  return NextResponse.json(rows);
}
