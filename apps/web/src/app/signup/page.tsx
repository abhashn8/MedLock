"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-xl">
        <div className="mb-6 space-y-1">
          <h1 className="font-medium text-2xl text-foreground tracking-tight">
            Create account
          </h1>
          <p className="text-muted-foreground text-sm">
            Get started with Medlock.
          </p>
        </div>

        {success ? (
          <p className="rounded-md border border-border bg-background px-3 py-3 text-foreground text-sm">
            Check your email for a confirmation link.
          </p>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block font-mono text-muted-foreground text-xs uppercase tracking-wider"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                placeholder="you@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block font-mono text-muted-foreground text-xs uppercase tracking-wider"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive text-xs">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
