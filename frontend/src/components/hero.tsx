import Link from "next/link"

export function HeroSection() {
  return (
    <section
      id="product"
      className="relative isolate overflow-hidden bg-[var(--ml-bg)]"
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 ml-grid-bg ml-radial-fade"
        aria-hidden
      />
      {/* Background glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-cyan-500/15 blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 md:px-6 md:pb-32 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            <span className="ml-headline-fade">Stop PHI leaks before</span>
            <br />
            <span className="ml-headline-fade">they cost you </span>
            <span className="ml-accent-text">millions</span>
            <span className="ml-headline-fade">.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-slate-400 md:text-xl">
            MedLock scans your codebase with AI to find HIPAA violations,
            redacts PHI at runtime, and gives you the audit evidence to prove
            it.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_24px_rgba(34,211,238,0.35)] transition-all hover:bg-cyan-300 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_36px_rgba(34,211,238,0.6)]"
            >
              Start Scanning Free
              <i
                className="fa-solid fa-arrow-right inline-block text-sm transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 px-6 text-sm font-semibold text-slate-200 backdrop-blur transition-colors hover:border-slate-700 hover:bg-slate-900"
            >
              See How It Works
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2">
              <i
                className="fa-solid fa-shield-halved text-cyan-400/80"
                aria-hidden
              />
              HIPAA-focused
            </span>
            <span className="inline-flex items-center gap-2">
              <i
                className="fa-solid fa-lock text-cyan-400/80"
                aria-hidden
              />
              SOC 2 ready
            </span>
            <span className="inline-flex items-center gap-2">
              <i
                className="fa-solid fa-code text-cyan-400/80"
                aria-hidden
              />
              Developer native
            </span>
          </div>
        </div>

        {/* Mock terminal */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          <div
            className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/15 to-cyan-500/20 blur-2xl"
            aria-hidden
          />
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-cyan-500/10 backdrop-blur">
            {/* Window chrome */}
            <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-700/80" />
                <span className="h-3 w-3 rounded-full bg-slate-700/80" />
                <span className="h-3 w-3 rounded-full bg-slate-700/80" />
              </div>
              <span className="hidden font-mono text-xs text-slate-500 sm:inline">
                src/api/patients.ts — MedLock scan
              </span>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-rose-300">
                3 findings
              </span>
            </div>

            {/* Code body */}
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed">
              <CodeLine n={17}>
                <span className="text-fuchsia-400">app</span>
                <span className="text-slate-400">.</span>
                <span className="text-cyan-300">post</span>
                <span className="text-slate-400">(</span>
                <span className="text-emerald-400">{"'/api/patients'"}</span>
                <span className="text-slate-400">{", (req, res) => {"}</span>
              </CodeLine>
              <CodeLine n={18}>
                <span className="text-slate-400">{"  "}</span>
                <span className="text-fuchsia-400">const</span>
                <span className="text-slate-400">{" { patient } = req.body;"}</span>
              </CodeLine>
              <CodeLine n={19} />
              <CodeLine n={20} flag="critical">
                <span className="text-slate-400">{"  console."}</span>
                <span className="text-rose-400">log</span>
                <span className="text-slate-400">(</span>
                <span className="text-emerald-400">{"'New patient:'"}</span>
                <span className="text-slate-400">, </span>
                <span className="text-rose-400">patient</span>
                <span className="text-slate-400">{");"}</span>
              </CodeLine>
              <CodeLine n={21} flag="high">
                <span className="text-slate-400">{"  "}</span>
                <span className="text-cyan-300">sendToAnalytics</span>
                <span className="text-slate-400">(</span>
                <span className="text-rose-400">patient.email</span>
                <span className="text-slate-400">{");"}</span>
              </CodeLine>
              <CodeLine n={22}>
                <span className="text-slate-400">{"});"}</span>
              </CodeLine>
            </pre>

            {/* Findings strip */}
            <div className="space-y-2 border-t border-slate-800/80 bg-slate-900/40 px-6 py-4 font-mono text-xs">
              <div className="flex flex-wrap items-center gap-2 text-rose-300">
                <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  Critical
                </span>
                <span>line 20 · PHI logged to console</span>
                <span className="text-slate-500">· HIPAA §164.312(b)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-amber-300">
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  High
                </span>
                <span>line 21 · Patient email leaked to analytics</span>
                <span className="text-slate-500">· No BAA</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-emerald-300">
                <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span>Auto-fix available · safe-logger redacts at runtime</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CodeLine({
  n,
  children,
  flag,
}: {
  n: number
  children?: React.ReactNode
  flag?: "critical" | "high"
}) {
  const flagBg =
    flag === "critical"
      ? "bg-rose-500/[0.07] border-l-2 border-rose-500/60"
      : flag === "high"
        ? "bg-amber-500/[0.06] border-l-2 border-amber-500/50"
        : "border-l-2 border-transparent"

  return (
    <div className={`-mx-6 flex px-6 ${flagBg}`}>
      <span className="select-none pr-4 text-slate-600 tabular-nums">
        {String(n).padStart(2, " ")}
      </span>
      <span className="flex-1">
        {children ?? <span className="text-slate-700">·</span>}
      </span>
    </div>
  )
}
