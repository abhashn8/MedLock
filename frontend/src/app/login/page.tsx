"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signError) {
      setError(signError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  function GitHubIcon({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={className}
      >
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
      </svg>
    );
  }

  async function handleGitHubSignIn() {
    setError(null);
    const { error: ghError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });

    if (ghError) {
      setError(ghError.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-hs-page px-4">
      <div className="w-full max-w-sm rounded-hs-card border border-hs-border bg-hs-card p-8">
        <div className="mb-8 space-y-2">
          <p className="text-hs-caption font-medium uppercase tracking-wide text-hs-primary">
            MedLock
          </p>
          <h1 className="text-hs-title font-semibold text-hs-text">Sign in</h1>
          <p className="text-hs-body font-normal text-hs-muted">
            Welcome back. Access your compliance workspace.
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-5">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
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
            Sign in
          </HsPrimaryButton>
        </form>

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-hs-border" />
          <span className="text-hs-caption font-medium uppercase tracking-wide text-hs-placeholder">
            or
          </span>
          <div className="h-px flex-1 bg-hs-border" />
        </div>

        <HsSecondaryButton
          type="button"
          className="w-full"
          onClick={handleGitHubSignIn}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <GitHubIcon className="size-4" />
            Continue with GitHub
          </span>
        </HsSecondaryButton>

        <p className="mt-8 text-center text-hs-body font-normal text-hs-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-hs-primary hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
