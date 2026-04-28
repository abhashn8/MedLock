"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptRoleInvites } from "@/lib/api/roles";
import { createClient } from "@/lib/supabase/client";

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
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[var(--ml-bg)] px-4 py-16 text-slate-100">
      <div className="absolute inset-0 ml-grid-bg ml-radial-fade" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[120px]"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold tracking-tight text-slate-200"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10">
            <span
              className="absolute inset-0 rounded-md bg-cyan-400/20 blur"
              aria-hidden
            />
            <i
              className="fa-solid fa-shield-halved relative text-[13px] text-cyan-300"
              aria-hidden
            />
          </span>
          MedLock
        </Link>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl shadow-cyan-500/10 backdrop-blur">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
              Create your account
            </h1>
            <p className="text-sm text-slate-400">
              Start scanning for PHI leaks in under a minute.
            </p>
          </div>

          {success ? (
            <div className="flex items-start gap-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 text-sm text-cyan-100">
              <i
                className="fa-solid fa-envelope-open-text mt-0.5 text-cyan-300"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="font-medium text-slate-100">
                  Check your email
                </p>
                <p className="text-slate-400">
                  We sent a confirmation link to{" "}
                  <span className="font-medium text-slate-200">{email}</span>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignUp} className="space-y-4">
                <Field
                  id="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hospital.org"
                />

                <Field
                  id="password"
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                />

                {error ? (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200"
                    role="alert"
                  >
                    <i
                      className="fa-solid fa-circle-exclamation mt-0.5 text-rose-400"
                      aria-hidden
                    />
                    <span>{error}</span>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_22px_rgba(34,211,238,0.35)] transition-all hover:bg-cyan-300 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_32px_rgba(34,211,238,0.55)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-cyan-400 disabled:hover:shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_22px_rgba(34,211,238,0.35)]"
                >
                  {loading ? (
                    <>
                      <i
                        className="fa-solid fa-circle-notch fa-spin text-sm"
                        aria-hidden
                      />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <i
                        className="fa-solid fa-arrow-right inline-block text-sm transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </>
                  )}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-800" />
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleGitHubSignIn}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-900"
              >
                <i className="fa-brands fa-github text-base" aria-hidden />
                Continue with GitHub
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
};

function Field({
  id,
  label,
  type,
  autoComplete,
  required,
  value,
  onChange,
  placeholder,
}: FieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-2 block w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 transition-colors placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
      />
    </label>
  );
}
