"use client";

import { HsSelect } from "@/components/hipaa-shield/HsSelect";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";

export type MappingRow = {
  column_name: string;
  phi_type?: string | null;
  action: string;
  custom_value?: string | null;
};

const ACTIONS = [
  "keep",
  "remove",
  "truncate_year",
  "truncate_zip",
  "generalize_age",
  "hash",
  "mask",
  "synthetic",
  "suppress",
];

export function ColumnMappingTable({
  columns,
  mappings,
  onChange,
  onAutoMap,
}: {
  columns: string[];
  mappings: MappingRow[];
  onChange: (rows: MappingRow[]) => void;
  onAutoMap?: () => void;
}) {
  const mapByCol = new Map(mappings.map((m) => [m.column_name, m]));

  return (
    <section className="space-y-3 rounded-hs-card border border-hs-border bg-hs-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-hs-section font-semibold text-hs-text">Column mapping</h3>
        {onAutoMap ? (
          <HsSecondaryButton type="button" className="h-8 px-2 text-hs-caption" onClick={onAutoMap}>
            Auto-map from checker findings
          </HsSecondaryButton>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-hs border border-hs-border">
        <table className="w-full min-w-[680px] border-collapse">
          <thead className="bg-hs-page">
            <tr>
              {["Column", "Detected PHI", "Action", "Preview"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-hs-caption font-medium uppercase tracking-wide text-hs-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => {
              const m = mapByCol.get(col) ?? { column_name: col, action: "keep" };
              return (
                <tr key={col} className="border-t border-hs-fill">
                  <td className="px-3 py-2 text-hs-caption text-hs-text">{col}</td>
                  <td className="px-3 py-2 text-hs-caption text-hs-secondary">{m.phi_type ?? "—"}</td>
                  <td className="px-3 py-2">
                    <HsSelect
                      value={m.action}
                      onChange={(e) => {
                        const next = columns.map((c) => {
                          const old = mapByCol.get(c) ?? { column_name: c, action: "keep" };
                          if (c !== col) return old;
                          return { ...old, action: e.target.value };
                        });
                        onChange(next);
                      }}
                    >
                      {ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </HsSelect>
                  </td>
                  <td className="px-3 py-2 text-hs-caption text-hs-muted">{previewForAction(m.action)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function previewForAction(action: string): string {
  if (action === "remove") return "[REMOVED]";
  if (action === "mask") return "[REDACTED]";
  if (action === "hash") return "a3f9b2...";
  if (action === "truncate_year") return "YYYY";
  if (action === "truncate_zip") return "ZIP3";
  if (action === "generalize_age") return "90+ (if >89)";
  if (action === "synthetic") return "synthetic value";
  if (action === "suppress") return "row suppressed";
  return "kept";
}
