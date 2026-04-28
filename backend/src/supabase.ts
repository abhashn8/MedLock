import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Request } from "express";
import { env } from "./env.js";
import { HttpError } from "./http-error.js";

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
};

function getBearerToken(request: Request): string {
  const header = request.header("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "unauthorized", "Missing authorization token.");
  }

  return token;
}

export async function requireAuth(request: Request): Promise<AuthContext> {
  const token = getBearerToken(request);
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new HttpError(401, "unauthorized", "Invalid authorization token.");
  }

  return { supabase, user };
}
