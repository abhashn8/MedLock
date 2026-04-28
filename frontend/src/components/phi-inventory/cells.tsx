import type { PhiSystem } from "@/lib/api/types";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";

export function OwnerCell({
  system,
  onAssign,
}: {
  system: Pick<PhiSystem, "business_owner_name" | "technical_owner_name">;
  onAssign?: () => void;
}) {
  const missing = !system.business_owner_name || !system.technical_owner_name;
  if (missing) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-hs-caption text-hs-muted">— Unassigned</span>
        {onAssign ? (
          <HsSecondaryButton type="button" className="h-8 w-fit px-2 text-hs-caption" onClick={onAssign}>
            Assign owners
          </HsSecondaryButton>
        ) : null}
      </div>
    );
  }
  return (
    <div className="text-hs-caption leading-snug text-hs-secondary">
      <p>
        <span className="text-hs-muted">Business:</span> {system.business_owner_name}
      </p>
      <p>
        <span className="text-hs-muted">Technical:</span> {system.technical_owner_name}
      </p>
    </div>
  );
}

/**
 * Retention progress: min(100%, elapsed_since_created / (retention_years * 365.25d)) * 100
 * where elapsed is wall-clock time from created_at to now (not calendar-year precise).
 */
export function RetentionCell({ system }: { system: Pick<PhiSystem, "retention_years" | "created_at"> }) {
  if (system.retention_years == null) {
    return <span className="text-hs-caption text-hs-muted">No policy set</span>;
  }
  const years = system.retention_years;
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - new Date(system.created_at).getTime();
  const denom = years * msPerYear;
  const pct = Math.min(100, denom > 0 ? (elapsed / denom) * 100 : 0);

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-hs-caption font-medium text-hs-text">
        {years} {years === 1 ? "year" : "years"}
      </p>
      <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-hs-fill">
        <div className="h-full rounded-full bg-hs-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-hs-muted">Elapsed vs policy window</p>
    </div>
  );
}
