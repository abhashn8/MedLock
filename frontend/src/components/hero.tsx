import Link from "next/link"
import { cn } from "@/lib/utils"
import { ArrowRight } from "lucide-react"
import { HsIcon } from "@/components/hipaa-shield/HsIcon"

export function HeroSection() {
  return (
    <section
      id="product"
      className="relative mx-auto w-full max-w-5xl overflow-hidden px-4 pb-16 pt-12 md:pt-16"
    >
      <div className="relative z-10 flex max-w-2xl flex-col gap-6">
        <p className="inline-flex w-fit items-center gap-2 rounded-hs-pill border border-hs-border bg-hs-card px-3 py-1 text-hs-caption font-medium text-hs-muted">
          <span className="text-hs-primary">HIPAA</span>
          <span>Compliance platform</span>
        </p>

        <h1 className="text-balance text-hs-title font-semibold leading-tight text-hs-text">
          Operational HIPAA compliance for security and privacy teams
        </h1>

        <p className="max-w-xl text-hs-body font-normal leading-relaxed text-hs-muted">
          MedLock centralizes PHI protection, access reviews, vendor BAAs,
          workforce training, and audit evidence in one professional workspace.
        </p>

        <div id="security" className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/login"
            className={cn(
              "inline-flex h-10 items-center justify-center rounded-hs border border-hs-border bg-hs-card px-4 text-hs-body font-medium text-[#374151]",
              "hover:bg-hs-fill-hover focus-visible:outline-none focus-visible:shadow-hs-focus",
            )}
          >
            See how it works
          </Link>
          <Link
            href="/signup"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-hs bg-hs-primary px-4 text-hs-body font-medium text-white",
              "hover:bg-hs-primary-hover focus-visible:outline-none focus-visible:shadow-hs-focus",
            )}
          >
            Get started
            <HsIcon icon={ArrowRight} className="text-white" />
          </Link>
        </div>
      </div>

      <div className="relative mt-12 md:mt-16">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-hs-card border border-hs-border bg-hs-card p-2">
          <div className="flex aspect-video items-center justify-center rounded-hs border border-hs-border bg-hs-fill">
            <p className="text-hs-body font-medium text-hs-muted">
              Product preview coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
