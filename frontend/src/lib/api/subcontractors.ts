import { apiFetch } from "@/lib/api/client";

export type SubcontractorRow = {
  id: string;
  vendor_id: string;
  parent_vendor_name: string;
  parent_covered_services: string | null;
  name: string;
  baa_status: "PASS" | "WARNING" | "FAIL" | "PENDING";
  created_at: string;
};

export type SubcontractorPayload = {
  vendor_id: string;
  name: string;
  baa_status?: SubcontractorRow["baa_status"];
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message ?? "Request failed");
  }
  return data as T;
}

export async function getSubcontractors() {
  return readJson<SubcontractorRow[]>(await apiFetch("/api/subcontractors"));
}

export async function createSubcontractor(payload: SubcontractorPayload) {
  return readJson<SubcontractorRow>(
    await apiFetch("/api/subcontractors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  );
}

export async function patchSubcontractor(id: string, payload: Partial<SubcontractorPayload>) {
  return readJson<SubcontractorRow>(
    await apiFetch(`/api/subcontractors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  );
}
