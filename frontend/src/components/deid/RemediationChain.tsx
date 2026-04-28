"use client";

export function RemediationChain({
  assessment,
  chain,
}: {
  assessment: Record<string, unknown>;
  chain: Array<Record<string, unknown>>;
}) {
  const remediationOf = assessment.remediation_of ? String(assessment.remediation_of) : null;
  return (
    <section className="rounded-hs-card border border-hs-border bg-hs-card p-5">
      <h3 className="text-hs-section font-semibold text-hs-text">Remediation chain</h3>
      {remediationOf ? (
        <p className="mt-2 text-hs-caption text-hs-secondary">
          Re-check of: <span className="font-medium">{remediationOf}</span>
        </p>
      ) : (
        <p className="mt-2 text-hs-caption text-hs-muted">This is the root assessment.</p>
      )}
      {chain.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {chain.map((row) => (
            <li key={String(row.id)} className="rounded-hs border border-hs-border bg-hs-page/60 px-3 py-2 text-hs-caption">
              {String(row.dataset_label ?? "Unnamed")} · {String(row.status ?? "")} ·{" "}
              {new Date(String(row.created_at ?? new Date().toISOString())).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
