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

  const res = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=50",
    {
      headers: {
        Authorization: `Bearer ${connection.github_access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
