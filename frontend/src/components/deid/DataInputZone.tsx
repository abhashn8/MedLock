"use client";

import Papa from "papaparse";
import { useMemo, useState } from "react";
import { HsModal } from "@/components/hipaa-shield/HsModal";
import { HsPrimaryButton } from "@/components/hipaa-shield/HsPrimaryButton";
import { HsSecondaryButton } from "@/components/hipaa-shield/HsSecondaryButton";
import { HsTextInput } from "@/components/hipaa-shield/HsTextInput";
import { HsTextarea } from "@/components/hipaa-shield/HsTextarea";

export function DataInputZone({
  datasetLabel,
  onDatasetLabelChange,
  onDataParsed,
  maxRows = 500,
}: {
  datasetLabel: string;
  onDatasetLabelChange: (value: string) => void;
  onDataParsed: (payload: { rawText: string; rows: Record<string, unknown>[]; columns: string[] }) => void;
  maxRows?: number;
}) {
  const [raw, setRaw] = useState("");
  const [draftRaw, setDraftRaw] = useState("");
  const [meta, setMeta] = useState<{ rows: number; columns: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [hasInput, setHasInput] = useState(false);

  const privacyNotice = useMemo(
    () =>
      "Data is analyzed in memory only. Raw values are replaced with type-preserving patterns before leaving your browser session. Only findings metadata is stored in MedLock.",
    [],
  );

  function parseText(text: string) {
    try {
      const trimmed = text.trim();
      if (!trimmed) return { rows: [] as Record<string, unknown>[], columns: [] as string[] };
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        const parsed = JSON.parse(trimmed);
        const rows = (Array.isArray(parsed) ? parsed : [parsed]) as Record<string, unknown>[];
        const columns = rows[0] ? Object.keys(rows[0]) : [];
        return { rows: rows.slice(0, maxRows), columns };
      }
      const parsed = Papa.parse<Record<string, unknown>>(trimmed, { header: true, skipEmptyLines: true });
      const rows = (parsed.data ?? []).slice(0, maxRows);
      const columns = parsed.meta.fields ?? [];
      return { rows, columns };
    } catch {
      throw new Error("Could not parse input. Use CSV or JSON.");
    }
  }

  function onChangeText(text: string) {
    setRaw(text);
    setError(null);
    try {
      const parsed = parseText(text);
      setHasInput(text.trim().length > 0);
      setMeta({ rows: parsed.rows.length, columns: parsed.columns.length });
      onDataParsed({ rawText: text, rows: parsed.rows, columns: parsed.columns });
    } catch (e) {
      setMeta(null);
      setError(e instanceof Error ? e.message : "Invalid data");
    }
  }

  async function onUploadFile(file: File) {
    setError(null);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".csv")) {
        const text = await file.text();
        onChangeText(text);
        setOpenModal(false);
        return;
      }
      if (lower.endsWith(".json")) {
        const text = await file.text();
        onChangeText(text);
        setOpenModal(false);
        return;
      }
      throw new Error("Unsupported file type. Upload CSV.");
    } catch (e) {
      setMeta(null);
      setError(e instanceof Error ? e.message : "Upload parsing failed.");
    }
  }

  return (
    <section className="space-y-3 rounded-hs-card border border-hs-border bg-hs-card p-5">
      <HsTextInput
        label="Dataset label"
        value={datasetLabel}
        onChange={(e) => onDatasetLabelChange(e.target.value)}
        placeholder="e.g. Claims export Q2"
        required
      />
      <div className="flex flex-wrap items-center gap-2">
        <HsPrimaryButton
          type="button"
          onClick={() => {
            setInputMode("paste");
            setDraftRaw(raw);
            setOpenModal(true);
          }}
        >
          JSON
        </HsPrimaryButton>
        <HsSecondaryButton
          type="button"
          onClick={() => {
            setInputMode("upload");
            setOpenModal(true);
          }}
        >
          Upload CSV
        </HsSecondaryButton>
      </div>
      {hasInput ? (
        <>
          <HsTextarea
            label="Input preview (read-only)"
            rows={7}
            value={raw}
            readOnly
            className="font-mono text-xs"
          />
          {meta ? (
            <p className="text-hs-caption text-hs-muted">
              Parsed {meta.rows} row{meta.rows === 1 ? "" : "s"} and {meta.columns} column
              {meta.columns === 1 ? "" : "s"}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="rounded-hs border border-hs-border bg-hs-page/60 px-3 py-2 text-hs-caption text-hs-muted">
          Select <span className="font-medium text-hs-text">JSON</span> to paste JSON/CSV or upload a file before running a check.
        </p>
      )}
      {error ? <p className="text-hs-caption text-hs-danger">{error}</p> : null}
      <div className="rounded-hs border border-hs-border bg-hs-page/70 px-3 py-2 text-hs-caption text-hs-muted">{privacyNotice}</div>
      <HsModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={inputMode === "paste" ? "JSON input" : "Upload CSV"}
        footer={
          inputMode === "paste" ? (
            <>
              <HsSecondaryButton type="button" onClick={() => setOpenModal(false)}>
                Cancel
              </HsSecondaryButton>
              <HsPrimaryButton
                type="button"
                onClick={() => {
                  onChangeText(draftRaw);
                  setOpenModal(false);
                }}
              >
                Use this input
              </HsPrimaryButton>
            </>
          ) : undefined
        }
      >
        {inputMode === "paste" ? (
          <HsTextarea
            label="Write or paste JSON (or CSV text)"
            rows={10}
            value={draftRaw}
            onChange={(e) => setDraftRaw(e.target.value)}
            placeholder='[{"id":1,"name":"Jane","dob":"1985-03-12","zip":"07960"}]'
            className="font-mono text-xs"
          />
        ) : (
          <div className="space-y-3">
            <p className="text-hs-caption text-hs-muted">Supported format: `.csv`</p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUploadFile(file);
              }}
              className="block w-full rounded-hs border border-hs-border bg-hs-card px-3 py-2 text-hs-caption text-hs-text"
            />
          </div>
        )}
      </HsModal>
    </section>
  );
}
