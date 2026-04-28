"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptRoleInvites } from "@/lib/api/roles";
import { createClient } from "@/lib/supabase/client";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";

export default function SignupPage() {
  const router = useRouter();
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

    const { data, error: signError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });

    setLoading(false);

    if (signError) {
      setError(signError.message);
      return;
    }

    if (data.session) {
      await acceptRoleInvites().catch(() => undefined);
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hs-page px-4">
      <div className="w-full max-w-sm rounded-hs-card border border-hs-border bg-hs-card p-8">
        <div className="mb-8 space-y-2">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-primary">
            MedLock
          </p>
          <h1 className="text-hs-title font-semibold text-hs-text">Create account</h1>
          <p className="text-hs-body font-normal text-hs-muted">
            Start your HIPAA compliance workspace.
          </p>
        </div>

        {success ? (
          <p className="rounded-hs border border-hs-border bg-hs-fill px-4 py-3 text-hs-body font-normal text-hs-text">
            Check your email for a confirmation link.
          </p>
        ) : (
          <form onSubmit={handleSignUp} className="space-y-5">
            <HsTextInput
              id="email"
              name="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.org"
            />

            <HsTextInput
              id="password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
            />

            {error ? (
              <p
                className="rounded-hs border border-hs-danger-border bg-hs-danger-bg px-3 py-2 text-hs-caption text-hs-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <HsPrimaryButton type="submit" className="w-full" disabled={loading} loading={loading}>
              Sign up
            </HsPrimaryButton>
          </form>
        )}

        <p className="mt-8 text-center text-hs-body font-normal text-hs-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-hs-primary hover:underline"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
