import { Header } from "@/components/header"
import { HeroSection } from "@/components/hero"

export default function Home() {
  return (
    <div className="relative min-h-screen bg-[var(--ml-bg)] text-slate-100 antialiased">
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorks />
        <FeatureGrid />
      </main>
      <Footer />
    </div>
  )
}

function ProblemSection() {
  const scenarios = [
    {
      icon: "fa-triangle-exclamation",
      title: "Patient SSN logged to Sentry",
      desc: "A single console.log of a patient object reaches an error tracker without a BAA. PHI surfaces in dashboards your vendor doesn't legally cover.",
    },
    {
      icon: "fa-eye-slash",
      title: "Patient email sent to analytics",
      desc: "mixpanel.track() called with patient.email by a junior engineer. PHI flows to third-party servers in 60 seconds.",
    },
    {
      icon: "fa-database",
      title: "PHI cached in localStorage",
      desc: "A browser extension reads localStorage. Suddenly 800k records are exposed and you're filing a breach notification with HHS.",
    },
  ]

  return (
    <section className="relative border-t border-slate-900/80 bg-[var(--ml-bg)] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400">
            The cost of a single leak
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="ml-headline-fade">One mistake costs </span>
            <span className="ml-accent-text">$1.9M</span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Average HIPAA settlement when PHI leaves your system. The patterns
            below have all triggered eight-figure penalties.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {scenarios.map((s) => (
            <div
              key={s.title}
              className="group relative rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 transition-colors hover:border-slate-700/80"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
                <i
                  className={`fa-solid ${s.icon} text-lg text-cyan-400`}
                  aria-hidden
                />
              </div>
              <h3 className="mt-5 text-lg font-medium text-slate-100">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: "fa-code-branch",
      title: "Connect your repo",
      desc: "One-click GitHub OAuth. We pull the source bundle for analysis — never your secrets, never your customer data.",
    },
    {
      n: "02",
      icon: "fa-wand-magic-sparkles",
      title: "Scan with AI",
      desc: "Claude inspects every file across 10 HIPAA & SOC 2 categories. Findings come back with HIPAA citations and CWE references.",
    },
    {
      n: "03",
      icon: "fa-shield-halved",
      title: "Fix and prevent",
      desc: "Each finding ships with a recommended fix. Drop our @medlock/safe-logger into your runtime so future PHI never reaches the wire.",
    },
  ]

  return (
    <section
      id="how-it-works"
      className="relative border-t border-slate-900/80 bg-[var(--ml-bg-elevated)] py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400">
            How it works
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight ml-headline-fade md:text-5xl">
            Three steps from connected to compliant
          </h2>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-medium text-cyan-400">
                  {s.n}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-cyan-500/40 to-transparent" />
                <i
                  className={`fa-solid ${s.icon} text-lg text-cyan-400`}
                  aria-hidden
                />
              </div>
              <h3 className="mt-5 text-lg font-medium text-slate-100">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureGrid() {
  const features = [
    {
      icon: "fa-magnifying-glass-chart",
      title: "PHI Detection",
      desc: "Identifies 32+ PHI patterns across variable names, log calls, and risky sinks like Sentry, Mixpanel, and localStorage.",
    },
    {
      icon: "fa-wand-magic-sparkles",
      title: "AI-Powered Analysis",
      desc: "Claude reads every file with a HIPAA auditor's lens — catches what regex never could, with cited recommendations.",
    },
    {
      icon: "fa-book-open",
      title: "Prevention Library",
      desc: "Drop-in @medlock/safe-logger redacts PHI from console.log, error trackers, and analytics at runtime.",
    },
    {
      icon: "fa-chart-column",
      title: "Compliance Reports",
      desc: "Branded PDF audit packages with HIPAA citations and SOC 2 mappings, ready to hand to HHS.",
    },
    {
      icon: "fa-database",
      title: "PHI Inventory",
      desc: "Auto-cataloged systems with risk scores, retention rules, and §164.316(b) review reminders.",
    },
    {
      icon: "fa-eye-slash",
      title: "De-identification",
      desc: "Safe Harbor + Expert Determination workflows with k-anonymity scoring and signed expert reviews.",
    },
  ]

  return (
    <section
      id="features"
      className="relative border-t border-slate-900/80 bg-[var(--ml-bg)] py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-400">
            Built for healthcare developers
          </p>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight ml-headline-fade md:text-5xl">
            One platform. Every PHI surface.
          </h2>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/30 p-6 transition-all hover:border-cyan-500/40 hover:bg-slate-900/50"
            >
              <div
                className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 transition-colors group-hover:border-cyan-500/30">
                <i
                  className={`fa-solid ${f.icon} text-lg text-cyan-400`}
                  aria-hidden
                />
              </div>
              <h3 className="mt-5 text-lg font-medium text-slate-100">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Closing CTA */}
        <div className="relative mt-24 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/80 p-10 text-center md:p-16">
          <div
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10"
            aria-hidden
          />
          <h3 className="text-balance text-3xl font-semibold tracking-tight ml-headline-fade md:text-4xl">
            Ship healthcare software without ending up on the HHS wall of shame.
          </h3>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 text-sm font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_24px_rgba(34,211,238,0.35)] transition-all hover:bg-cyan-300 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.4),0_0_36px_rgba(34,211,238,0.6)]"
            >
              Start Scanning Free
            </a>
            <a
              href="#product"
              className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 px-6 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-900"
            >
              Back to top
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-900/80 bg-[var(--ml-bg)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-slate-500 md:flex-row md:px-6">
        <div className="flex items-center gap-2 font-medium text-slate-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
          MedLock
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <span>© {new Date().getFullYear()} MedLock</span>
          <span>HIPAA-focused</span>
          <span>SOC 2 ready</span>
        </div>
      </div>
    </footer>
  )
}
