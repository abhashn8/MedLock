import { apiFetch } from "@/lib/api/client";

export type BaaVendor = {
  id: string;
  name: string;
  baa_status: "PASS" | "WARNING" | "FAIL" | "PENDING";
  baa_signed_at: string | null;
  baa_expires_at: string | null;
  covered_services: string | null;
  risk_score: number | null;
  mou_document_path: string | null;
  mou_uploaded_at: string | null;
  risk_breakdown?: Record<string, unknown> | null;
  risk_model_version?: string | null;
  risk_computed_at?: string | null;
  created_at: string;
};

export type BaaVendorPayload = {
  name: string;
  baa_status: BaaVendor["baa_status"];
  baa_signed_at?: string | null;
  baa_expires_at?: string | null;
  covered_services?: string | null;
  risk_score?: number | null;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function getBaaVendors() {
  return readJson<BaaVendor[]>(await apiFetch("/api/vendors"));
}

export async function createBaaVendor(payload: BaaVendorPayload) {
  return readJson<BaaVendor>(
    await apiFetch("/api/vendors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function patchBaaVendor(id: string, payload: Partial<BaaVendorPayload>) {
  return readJson<BaaVendor>(
    await apiFetch(`/api/vendors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
}

export async function uploadBaaVendorMou(id: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);
  const lowerName = file.name.toLowerCase();
  const inferredMime =
    lowerName.endsWith(".pdf")
      ? "application/pdf"
      : lowerName.endsWith(".doc")
        ? "application/msword"
        : lowerName.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "";
  const mimeType = file.type || inferredMime;
  return readJson<BaaVendor>(
    await apiFetch(`/api/vendors/${id}/mou`, {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        fileContent: base64,
        mimeType,
      }),
    }),
  );
}

export async function getBaaVendorMouSignedUrl(id: string, expiresSeconds = 3600) {
  const params = new URLSearchParams();
  params.set("expires", String(expiresSeconds));
  return readJson<{ url: string; expiresIn: number }>(
    await apiFetch(`/api/vendors/${id}/mou/signed-url?${params.toString()}`),
  );
}
