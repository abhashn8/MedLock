"use client";

import { useEffect, useState } from "react";

const PREFIX = "phi-inventory-alert-dismissed:";

export type PhiInventoryAlertId = "missing-owners" | "retention-gaps" | "reviews-due";

function isDismissed(id: PhiInventoryAlertId): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(PREFIX + id) === "1";
}

function dismiss(id: PhiInventoryAlertId) {
  sessionStorage.setItem(PREFIX + id, "1");
}

export function PhiInventoryAlertBanner({
  missingOwners,
  retentionGaps,
  reviewOverdue,
}: {
  missingOwners: number;
  retentionGaps: number;
  reviewOverdue: number;
}) {
  const [hidden, setHidden] = useState<Record<PhiInventoryAlertId, boolean>>({
    "missing-owners": true,
    "retention-gaps": true,
    "reviews-due": true,
  });

  useEffect(() => {
    setHidden({
      "missing-owners": isDismissed("missing-owners"),
      "retention-gaps": isDismissed("retention-gaps"),
      "reviews-due": isDismissed("reviews-due"),
    });
  }, []);

  const items: { id: PhiInventoryAlertId; show: boolean; text: string }[] = [
    {
      id: "missing-owners",
      show: missingOwners > 0 && !hidden["missing-owners"],
      text: `${missingOwners} system${missingOwners === 1 ? "" : "s"} missing business or technical owner.`,
    },
    {
      id: "retention-gaps",
      show: retentionGaps > 0 && !hidden["retention-gaps"],
      text: `${retentionGaps} system${retentionGaps === 1 ? "" : "s"} have no retention policy (years) on file.`,
    },
    {
      id: "reviews-due",
      show: reviewOverdue > 0 && !hidden["reviews-due"],
      text: `${reviewOverdue} system${reviewOverdue === 1 ? "" : "s"} need a scheduled review or are overdue.`,
    },
  ];

  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className="flex flex-wrap items-start justify-between gap-3 border-l-4 border-hs-warning bg-hs-warning-bg px-4 py-3 text-hs-body text-hs-text"
        >
          <p>{item.text}</p>
          <button
            type="button"
            className="shrink-0 text-hs-caption font-medium text-hs-secondary underline decoration-hs-border underline-offset-2 hover:text-hs-text"
            onClick={() => {
              dismiss(item.id);
              setHidden((h) => ({ ...h, [item.id]: true }));
            }}
          >
            Dismiss for this session
          </button>
        </div>
      ))}
    </div>
  );
}
