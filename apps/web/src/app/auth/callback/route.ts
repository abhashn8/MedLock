import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (
      session?.provider_token &&
      session.user.app_metadata.provider === "github"
    ) {
      await supabase.from("github_connections").upsert(
        {
          user_id: session.user.id,
          github_access_token: session.provider_token,
          github_username: session.user.user_metadata.user_name,
        },
        { onConflict: "user_id" },
      );
    }
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
