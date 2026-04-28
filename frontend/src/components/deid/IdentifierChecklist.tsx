"use client";

const ITEMS = [
  "Names",
  "Geographic data smaller than state",
  "Dates except year",
  "Ages over 89",
  "Phone numbers",
  "Fax numbers",
  "Email addresses",
  "SSNs",
  "Medical record numbers",
  "Health plan beneficiary numbers",
  "Account numbers",
  "Certificate and license numbers",
  "Vehicle identifiers and serial numbers",
  "Device identifiers and serial numbers",
  "Web URLs",
  "IP addresses",
  "Biometric identifiers",
  "Full-face photographs and comparable images",
];

function dot(status: "pass" | "fail" | "warning" | "na"): string {
  if (status === "pass") return "bg-emerald-500";
  if (status === "fail") return "bg-rose-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-hs-border";
}

export function IdentifierChecklist({
  passedIdentifiers,
  failedIdentifiers,
  warningIdentifiers,
}: {
  passedIdentifiers: string[];
  failedIdentifiers: string[];
  warningIdentifiers: string[];
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {ITEMS.map((item, idx) => {
        const fail = failedIdentifiers.some((x) => x.toLowerCase() === item.toLowerCase());
        const warn = warningIdentifiers.some((x) => x.toLowerCase() === item.toLowerCase());
        const pass = passedIdentifiers.some((x) => x.toLowerCase() === item.toLowerCase());
        const status = fail ? "fail" : warn ? "warning" : pass ? "pass" : "na";
        return (
          <div key={item} className="flex items-center gap-2 rounded-hs border border-hs-border bg-hs-card px-3 py-2 text-hs-caption">
            <span className={`inline-block size-2 rounded-full ${dot(status)}`} />
            <span className="font-medium text-hs-muted">{idx + 1}.</span>
            <span className="text-hs-text">{item}</span>
          </div>
        );
      })}
    </div>
  );
}
