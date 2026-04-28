import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon } from "lucide-react"

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden pt-16">
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-hidden"
      >
        <div
          className={cn(
            "absolute inset-0 isolate -z-10",
            "bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]"
          )}
        />
      </div>

      <div className="relative z-10 flex max-w-2xl flex-col gap-5 px-4">
        {/* Badge */}
        <a
          className={cn(
            "group flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow-xs",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out"
          )}
          href="#"
        >
          <div className="rounded-xs border bg-card px-1.5 py-0.5 shadow-sm">
            <p className="font-mono text-xs">NEW</p>
          </div>
          <span className="text-xs">Now in early access</span>
          <span className="block h-5 border-l" />
          <div className="pr-1">
            <ArrowRightIcon className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
          </div>
        </a>

        {/* Headline */}
        <h1
          className={cn(
            "text-balance font-medium text-4xl text-foreground leading-tight md:text-5xl",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out"
          )}
        >
          Stop PHI From Leaking Into Your Logs Before It Costs You Millions
        </h1>

        {/* Subtext */}
        <p
          className={cn(
            "text-muted-foreground text-sm tracking-wider sm:text-lg md:text-xl",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out"
          )}
        >
          Medlock scans your codebase to find where patient data is flowing into
          Sentry, analytics, and logs — and gives you a library that makes it
          impossible to happen again.
        </p>

        {/* CTA Buttons */}
        <div className="fade-in slide-in-from-bottom-10 flex w-fit animate-in items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button variant="outline">See How It Works</Button>
          <Button>
            Scan Your Repo{" "}
            <ArrowRightIcon className="size-4 ml-2" data-icon="inline-end" />
          </Button>
        </div>
      </div>

      {/* Screenshot placeholder */}
      <div className="relative">
        <div
          className={cn(
            "absolute -inset-x-20 inset-y-0 -translate-y-1/3 scale-120 rounded-full",
            "bg-[radial-gradient(ellipse_at_center,hsl(var(--foreground)/0.1),transparent,transparent)]",
            "blur-[50px]"
          )}
        />
        <div
          className={cn(
            "mask-b-from-60% relative mt-8 overflow-hidden px-2 sm:mt-12 md:mt-20",
            "fade-in slide-in-from-bottom-5 animate-in fill-mode-backwards delay-100 duration-1000 ease-out"
          )}
        >
          <div className="relative inset-shadow-2xs inset-shadow-foreground/10 mx-auto max-w-5xl overflow-hidden rounded-lg border bg-background p-2 shadow-xl ring-1 ring-card dark:inset-shadow-foreground/20 dark:inset-shadow-xs">
            <div className="flex aspect-video items-center justify-center rounded-lg border bg-zinc-950 text-zinc-500">
              <p className="text-sm font-medium tracking-wide">
                Scanner Preview Coming Soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
