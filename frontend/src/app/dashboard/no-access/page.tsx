"use client";

import { useRouter } from "next/navigation";
import { HsEmptyState } from "@/components/hipaa-shield/HsEmptyState";

export default function NoAccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-full bg-hs-page p-8">
      <HsEmptyState
        title="You do not have access to this page"
        description="Your current MedLock role does not include permission for this dashboard area. Contact an admin if you need access."
        actionLabel="Back to Dashboard"
        onAction={() => router.push("/dashboard")}
      />
    </div>
  );
}
