"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  owner: { login: string };
};

type ScanSummary = {
  id: string;
  repo_owner: string;
  repo_name: string;
  created_at: string;
  finding_count: number;
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

type State =
  | { kind: "loading" }
  | { kind: "needs_connection" }
  | { kind: "ready"; repos: Repo[] }
  | { kind: "error"; message: string };

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/scans");
      if (!res.ok) return;
      const data = (await res.json()) as ScanSummary[];
      if (cancelled) return;
      setRecentScans(data);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/repos");
      const data = await res.json();
      if (cancelled) return;

      if (res.status === 404 && data?.error === "no_github_connection") {
        setState({ kind: "needs_connection" });
        return;
      }

      if (!res.ok) {
        setState({
          kind: "error",
          message:
            typeof data?.message === "string"
              ? data.message
              : "Failed to load repositories.",
        });
        return;
      }

      setState({ kind: "ready", repos: data as Repo[] });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnectGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
        scopes: "repo",
      },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const filteredRepos = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.repos;
    return state.repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.full_name.toLowerCase().includes(q) ||
        (r.description?.toLowerCase().includes(q) ?? false),
    );
  }, [state, query]);

  const scanByRepo = useMemo(() => {
    const map = new Map<string, ScanSummary>();
    for (const scan of recentScans) {
      const key = `${scan.repo_owner}/${scan.repo_name}`;
      if (!map.has(key)) map.set(key, scan);
    }
    return map;
  }, [recentScans]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
              Medlock
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="font-medium text-foreground text-sm">
              Dashboard
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        {state.kind === "loading" && <LoadingState />}

        {state.kind === "needs_connection" && (
          <ConnectGitHubState onConnect={handleConnectGitHub} />
        )}

        {state.kind === "error" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {state.message}
          </div>
        )}

        {state.kind === "ready" && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1">
                <h1 className="font-medium text-2xl text-foreground tracking-tight">
                  Repositories
                </h1>
                <p className="text-muted-foreground text-sm">
                  {state.repos.length} repos · sorted by recently updated
                </p>
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter repositories..."
                className="w-72 rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            {recentScans.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-medium text-foreground text-sm">
                  Recent Scans
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {recentScans.slice(0, 5).map((scan) => (
                    <li
                      key={scan.id}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate font-medium text-foreground text-sm">
                          {scan.repo_owner}/{scan.repo_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {scan.finding_count} finding
                          {scan.finding_count === 1 ? "" : "s"} ·{" "}
                          {timeAgo(scan.created_at)}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/report/${scan.id}`}
                        className="shrink-0 font-medium text-foreground text-xs hover:underline"
                      >
                        View Report
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {filteredRepos.length === 0 ? (
              <p className="rounded-md border border-border bg-card px-4 py-8 text-center text-muted-foreground text-sm">
                No repositories match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {filteredRepos.map((repo) => (
                  <li key={repo.id}>
                    <RepoCard
                      repo={repo}
                      lastScan={scanByRepo.get(repo.full_name)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 text-muted-foreground text-sm">
      <span className="size-2 animate-pulse rounded-full bg-muted-foreground" />
      Loading repositories...
    </div>
  );
}

function ConnectGitHubState({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center shadow-xl">
      <h1 className="font-medium text-2xl text-foreground tracking-tight">
        Connect GitHub
      </h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Authorize Medlock to access your repositories so we can scan them for
        PHI exposure.
      </p>
      <Button className="mt-6 w-full" onClick={onConnect}>
        Connect GitHub
      </Button>
    </div>
  );
}

function RepoCard({
  repo,
  lastScan,
}: {
  repo: Repo;
  lastScan?: ScanSummary;
}) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner.login,
          repo: repo.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Scan failed.",
        );
        setScanning(false);
        return;
      }
      router.push(`/dashboard/report/${data.scanId}`);
    } catch {
      setError("Scan failed.");
      setScanning(false);
    }
  }

  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-lg border bg-card p-4 transition hover:border-foreground/20">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-medium text-foreground text-sm">
            {repo.name}
          </h3>
          <span
            className={
              repo.private
                ? "rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider"
                : "rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground uppercase tracking-wider"
            }
          >
            {repo.private ? "Private" : "Public"}
          </span>
        </div>
        <p className="line-clamp-2 text-muted-foreground text-xs">
          {repo.description ?? "No description"}
        </p>
        {lastScan && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${
                  lastScan.finding_count === 0
                    ? "bg-emerald-500"
                    : "bg-yellow-500"
                }`}
              />
              {lastScan.finding_count} finding
              {lastScan.finding_count === 1 ? "" : "s"}
            </span>
            <span className="text-muted-foreground">
              · {timeAgo(lastScan.created_at)}
            </span>
            <Link
              href={`/dashboard/report/${lastScan.id}`}
              className="text-foreground hover:underline"
            >
              View last report
            </Link>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Scan this repo"}
        </Button>
        {error && (
          <p className="text-destructive text-xs">{error}</p>
        )}
      </div>
    </div>
  );
}
