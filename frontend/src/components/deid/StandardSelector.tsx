"use client";

import { cn } from "@/lib/utils";

export type DeidStandard = "safe_harbor" | "expert_determination";

export function StandardSelector({
  value,
  onChange,
}: {
  value: DeidStandard;
  onChange: (next: DeidStandard) => void;
}) {
  const cards: Array<{
    key: DeidStandard;
    title: string;
    subtitle: string;
    detail: string;
  }> = [
    {
      key: "safe_harbor",
      title: "Safe Harbor",
      subtitle: "Remove all 18 HIPAA identifiers",
      detail: "Binary pass/fail. No statistical expertise required. Best for research exports and vendor data shares.",
    },
    {
      key: "expert_determination",
      title: "Expert Determination",
      subtitle: "Statistical re-identification risk < 9%",
      detail: "Requires qualified statistician sign-off. Best when selective identifiers must be retained.",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            className={cn(
              "rounded-hs-card border p-4 text-left",
              active ? "border-hs-primary bg-hs-info-bg" : "border-hs-border bg-hs-card hover:bg-hs-fill-hover",
            )}
          >
            <p className="text-hs-body font-semibold text-hs-text">{c.title}</p>
            <p className="mt-1 text-hs-caption font-medium text-hs-primary">{c.subtitle}</p>
            <p className="mt-2 text-hs-caption text-hs-muted">{c.detail}</p>
          </button>
        );
      })}
    </div>
  );
}
