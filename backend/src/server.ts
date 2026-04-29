import { createSafeConsole } from "@medlock/safe-logger";
createSafeConsole();

import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { pageForRoute, type NavPage } from "@medlock/rbac";
import { Buffer } from "node:buffer";
import { env } from "./env.js";
import { HttpError } from "./http-error.js";
import {
  createAccessReviewCampaign,
  getAccessReviewOverview,
  updateAccessReviewItem,
} from "./services/access-review.js";
import { disconnectGitHub, listRepos } from "./services/github.js";
import {
  createModuleRecord,
  deleteModuleRecord,
  listModuleRecords,
  updateModuleRecord,
} from "./services/module-records.js";
import {
  createPhiSystem,
  decommissionPhiSystem,
  exportPhiInventoryCsv,
  getPhiInventoryCoverage,
  getPhiInventoryRiskSummary,
  getPhiSystemAuditLog,
  getPhiSystemById,
  importPhiSystems,
  listPhiInventory,
  listPhiSystemReviews,
  softDeletePhiSystem,
  submitPhiSystemReview,
  syncPhiInventoryFromScanner,
  updatePhiSystemsBulk,
  updatePhiSystem,
} from "./services/phi-inventory.js";
import {
  createDeidCheck,
  exportDeidAssessmentCsv,
  getDeidCheck,
  getDeidHistory,
  getDeidJob,
  recheckDeid,
  runDeidentifier,
  submitExpertReview,
} from "./services/deid.js";
import { buildDeidAssessmentReport } from "./services/deid-pdf.js";
import {
  buildAuditPackagePdf,
  buildDecommissionCertificatePdf,
  buildReviewCertificatePdf,
} from "./services/phi-inventory-pdf.js";
import {
  createPhiScanSchedule,
  getPhiScanOverview,
  patchPhiFinding,
  runPhiScan,
} from "./services/phi-scan.js";
import {
  acceptInvites,
  getMyRole,
  inviteMember,
  listChangelog,
  listInvitations,
  listMembers,
  removeMember,
  updateMember,
} from "./services/roles.js";
import { listAuditEvents } from "./services/audit-events.js";
import {
  createSubcontractor,
  listSubcontractors,
  updateSubcontractor,
} from "./services/subcontractors.js";
import {
  listVendorRiskPortfolio,
  recalculateVendorRiskScores,
} from "./services/vendor-risk-scores.js";
import {
  createVendor,
  getVendorMouSignedUrl,
  listVendors,
  updateVendor,
  uploadVendorMou,
} from "./services/vendors.js";
import { requirePermission } from "./services/rbac.js";
import { createScan, getScan, listScans } from "./services/scans.js";
import { requireAuth } from "./supabase.js";

const app = express();

app.use(
  cors({
    origin: [env.frontendOrigin, "http://localhost:3000", "http://localhost:3005"],
    credentials: false,
  }),
);
app.use(express.json({ limit: "10mb" }));

function asyncHandler(
  handler: (request: Request, response: Response) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

function navPageFromModule(value: unknown): NavPage {
  if (typeof value !== "string") {
    throw new HttpError(400, "invalid_request", "module is required");
  }
  const normalized = value.startsWith("/dashboard") ? value : `/dashboard/${value}`;
  const page = pageForRoute(normalized);
  if (!page) {
    throw new HttpError(400, "invalid_module", "Module does not map to a dashboard page.");
  }
  return page;
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get(
  "/api/access-review/overview",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await getAccessReviewOverview(context));
  }),
);

app.post(
  "/api/access-review/campaigns",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.status(201).json(await createAccessReviewCampaign(context, request.body as Record<string, unknown>));
  }),
);

app.patch(
  "/api/access-review/items/:itemId",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { itemId } = request.params;
    if (typeof itemId !== "string") {
      throw new HttpError(400, "invalid_request", "itemId is required");
    }
    response.json(await updateAccessReviewItem(context, itemId, request.body as Record<string, unknown>));
  }),
);

app.post(
  "/api/roles/accept-invite",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await acceptInvites(context));
  }),
);

app.get(
  "/api/roles/me",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await getMyRole(context));
  }),
);

app.post(
  "/api/roles/invite",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.status(201).json(await inviteMember(context, request.body as Record<string, unknown>));
  }),
);

app.get(
  "/api/roles/members",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listMembers(context));
  }),
);

app.get(
  "/api/roles/invitations",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listInvitations(context));
  }),
);

app.get(
  "/api/roles/changelog",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const page = typeof request.query.page === "string" ? Number.parseInt(request.query.page, 10) : 1;
    const limit = typeof request.query.limit === "string" ? Number.parseInt(request.query.limit, 10) : 20;
    response.json(await listChangelog(context, page, limit));
  }),
);

app.patch(
  "/api/roles/members/:membershipId",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { membershipId } = request.params;
    if (typeof membershipId !== "string") {
      throw new HttpError(400, "invalid_request", "membershipId is required");
    }
    response.json(await updateMember(context, membershipId, request.body as Record<string, unknown>));
  }),
);

app.delete(
  "/api/roles/members/:membershipId",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { membershipId } = request.params;
    if (typeof membershipId !== "string") {
      throw new HttpError(400, "invalid_request", "membershipId is required");
    }
    await removeMember(context, membershipId);
    response.status(204).send();
  }),
);

app.get(
  "/api/audit/events",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const q = request.query;
    const source =
      q.source === "app" || q.source === "platform" || q.source === "all"
        ? q.source
        : undefined;
    const severity =
      q.severity === "critical" ||
      q.severity === "high" ||
      q.severity === "medium" ||
      q.severity === "low" ||
      q.severity === "info"
        ? q.severity
        : undefined;
    response.json(
      await listAuditEvents(context, {
        source,
        severity,
        actor: typeof q.actor === "string" ? q.actor : undefined,
        module: typeof q.module === "string" ? q.module : undefined,
        action: typeof q.action === "string" ? q.action : undefined,
        search: typeof q.search === "string" ? q.search : undefined,
        from: typeof q.from === "string" ? q.from : undefined,
        to: typeof q.to === "string" ? q.to : undefined,
        since: typeof q.since === "string" ? q.since : undefined,
        page: typeof q.page === "string" ? Number.parseInt(q.page, 10) : undefined,
        limit: typeof q.limit === "string" ? Number.parseInt(q.limit, 10) : undefined,
      }),
    );
  }),
);

app.get(
  "/api/vendors",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listVendors(context));
  }),
);

app.post(
  "/api/vendors",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.status(201).json(await createVendor(context, request.body as Record<string, unknown>));
  }),
);

app.patch(
  "/api/vendors/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await updateVendor(context, id, request.body as Record<string, unknown>));
  }),
);

app.post(
  "/api/vendors/:id/mou",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await uploadVendorMou(context, id, request.body as Record<string, unknown>));
  }),
);

app.get(
  "/api/vendors/:id/mou/signed-url",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    const q = request.query as Record<string, string | undefined>;
    const expires =
      typeof q.expires === "string" ? Number.parseInt(q.expires, 10) : Number.NaN;
    const expiresSeconds = Number.isFinite(expires) ? expires : 3600;
    response.json(await getVendorMouSignedUrl(context, id, expiresSeconds));
  }),
);

app.get(
  "/api/vendor-risk-scores",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listVendorRiskPortfolio(context));
  }),
);

app.post(
  "/api/vendor-risk-scores/recalculate",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await recalculateVendorRiskScores(context));
  }),
);

app.get(
  "/api/subcontractors",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listSubcontractors(context));
  }),
);

app.post(
  "/api/subcontractors",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.status(201).json(await createSubcontractor(context, request.body as Record<string, unknown>));
  }),
);

app.patch(
  "/api/subcontractors/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await updateSubcontractor(context, id, request.body as Record<string, unknown>));
  }),
);

app.get(
  "/api/repos",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "read_only");
    response.json(await listRepos(context));
  }),
);

app.delete(
  "/api/repos/connection",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "integrations", "full");
    await disconnectGitHub(context);
    response.status(204).send();
  }),
);

app.get(
  "/api/scans",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "read_only");
    response.json(await listScans(context));
  }),
);

app.get(
  "/api/scans/:scanId",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "read_only");
    const { scanId } = request.params;
    if (typeof scanId !== "string") {
      throw new HttpError(400, "invalid_request", "scanId is required");
    }
    response.json(await getScan(context, scanId));
  }),
);

app.post(
  "/api/scans",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "full");
    response.json(await createScan(context, request.body));
  }),
);

app.get(
  "/api/module-records",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const module = request.query.module;
    if (typeof module !== "string") {
      throw new HttpError(400, "invalid_request", "module query is required");
    }
    await requirePermission(context, navPageFromModule(module), "read_only");
    response.json(await listModuleRecords(context, module));
  }),
);

app.post(
  "/api/module-records",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, navPageFromModule((request.body as { module?: unknown })?.module), "full");
    response.json(await createModuleRecord(context, request.body));
  }),
);

app.patch(
  "/api/module-records/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") {
      throw new HttpError(400, "invalid_request", "id is required");
    }
    if ((request.body as { module?: unknown })?.module) {
      await requirePermission(context, navPageFromModule((request.body as { module?: unknown }).module), "full");
    } else {
      await requirePermission(context, "dashboard", "full");
    }
    response.json(await updateModuleRecord(context, id, request.body));
  }),
);

app.delete(
  "/api/module-records/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    const { id } = request.params;
    if (typeof id !== "string") {
      throw new HttpError(400, "invalid_request", "id is required");
    }
    await requirePermission(context, "dashboard", "full");
    await deleteModuleRecord(context, id);
    response.status(204).send();
  }),
);

app.post(
  "/api/deid/check",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "full");
    response.json(
      await createDeidCheck(context, request.body as {
        dataset_label?: string;
        standard?: "safe_harbor" | "expert_determination";
        data?: string;
        column_hints?: unknown;
      }),
    );
  }),
);

app.get(
  "/api/deid/check/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await getDeidCheck(context, id));
  }),
);

app.post(
  "/api/deid/check/:id/recheck",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await recheckDeid(context, id, request.body as { data?: string; dataset_label?: string }));
  }),
);

app.post(
  "/api/deid/check/:id/expert-review",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(
      await submitExpertReview(context, id, request.body as {
        expert_reviewer_id?: string;
        expert_credentials?: string;
        expert_notes?: string;
        approved?: boolean;
      }),
    );
  }),
);

app.get(
  "/api/deid/check/:id/report",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    const out = await buildDeidAssessmentReport(context, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(Buffer.from(out.bytes));
  }),
);

app.get(
  "/api/deid/check/:id/export.csv",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    const out = await exportDeidAssessmentCsv(context, id);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(out.csv);
  }),
);

app.post(
  "/api/deid/run",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "full");
    response.json(
      await runDeidentifier(context, request.body as {
        dataset_label?: string;
        assessment_id?: string;
        data?: string;
        column_mapping?: Array<{
          column_name: string;
          phi_type?: string | null;
          action: string;
          custom_value?: string | null;
        }>;
      }),
    );
  }),
);

app.get(
  "/api/deid/run/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await getDeidJob(context, id));
  }),
);

app.get(
  "/api/deid/history",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "de_identification_checker", "read_only");
    const q = request.query;
    response.json(
      await getDeidHistory(context, {
        tool:
          typeof q.tool === "string" && (q.tool === "checker" || q.tool === "deidentifier" || q.tool === "all")
            ? q.tool
            : "all",
        status: typeof q.status === "string" ? q.status : undefined,
        page: typeof q.page === "string" ? Number.parseInt(q.page, 10) : undefined,
        limit: typeof q.limit === "string" ? Number.parseInt(q.limit, 10) : undefined,
      }),
    );
  }),
);

app.post(
  "/api/phi-scan",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "full");
    response.json(await runPhiScan(context, request.body));
  }),
);

app.get(
  "/api/phi-scan",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "read_only");
    response.json(
      await getPhiScanOverview(context, {
        scan_id: typeof request.query.scan_id === "string" ? request.query.scan_id : undefined,
        severity: typeof request.query.severity === "string" ? request.query.severity : undefined,
        phi_type: typeof request.query.phi_type === "string" ? request.query.phi_type : undefined,
        status: typeof request.query.status === "string" ? request.query.status : undefined,
        source: typeof request.query.source === "string" ? request.query.source : undefined,
      }),
    );
  }),
);

app.patch(
  "/api/phi-scan/findings/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "full");
    const { id } = request.params;
    if (typeof id !== "string") {
      throw new HttpError(400, "invalid_request", "id is required");
    }
    await patchPhiFinding(context, id, request.body);
    response.status(204).send();
  }),
);

app.post(
  "/api/phi-scan/schedule",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_leakage_scanner", "full");
    await createPhiScanSchedule(context, request.body);
    response.status(201).json({ ok: true });
  }),
);

app.get(
  "/api/phi-inventory",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const q = request.query;
    response.json(
      await listPhiInventory(context, {
        search: typeof q.search === "string" ? q.search : undefined,
        classification: typeof q.classification === "string" ? q.classification : undefined,
        department: typeof q.department === "string" ? q.department : undefined,
        retention_status: typeof q.retention_status === "string" ? q.retention_status : undefined,
        owner_status: typeof q.owner_status === "string" ? q.owner_status : undefined,
        status: typeof q.status === "string" ? q.status : undefined,
        source: typeof q.source === "string" ? q.source : undefined,
        page: typeof q.page === "string" ? Number.parseInt(q.page, 10) : undefined,
        limit: typeof q.limit === "string" ? Number.parseInt(q.limit, 10) : undefined,
      }),
    );
  }),
);

app.get(
  "/api/phi-inventory/coverage",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    response.json(await getPhiInventoryCoverage(context));
  }),
);

app.get(
  "/api/phi-inventory/risk-summary",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    response.json(await getPhiInventoryRiskSummary(context));
  }),
);

app.post(
  "/api/phi-inventory/import",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    response.json(await importPhiSystems(context, request.body as { rows?: Array<Record<string, unknown>> }));
  }),
);

app.patch(
  "/api/phi-inventory/bulk",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    response.json(
      await updatePhiSystemsBulk(context, request.body as { ids?: string[]; updates?: Record<string, unknown> }),
    );
  }),
);

app.post(
  "/api/phi-inventory/export/csv",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const q = request.body as Record<string, string>;
    const out = await exportPhiInventoryCsv(context, {
      search: q.search,
      classification: q.classification,
      department: q.department,
      retention_status: q.retention_status,
      owner_status: q.owner_status,
      status: q.status,
      source: q.source,
    });
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(out.content);
  }),
);

app.post(
  "/api/phi-inventory/export/audit-package",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const body = request.body as { include_decommissioned?: boolean; system_ids?: string[] };
    const out = await buildAuditPackagePdf(context, body);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(Buffer.from(out.bytes));
  }),
);

app.get(
  "/api/phi-inventory/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    const row = await getPhiSystemById(context, id);
    if (!row) throw new HttpError(404, "not_found", "System not found");
    response.json(row);
  }),
);

app.get(
  "/api/phi-inventory/:id/audit-log",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await getPhiSystemAuditLog(context, id));
  }),
);

app.get(
  "/api/phi-inventory/:id/reviews",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await listPhiSystemReviews(context, id));
  }),
);

app.get(
  "/api/phi-inventory/:id/review/:review_id/certificate",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const { id, review_id } = request.params;
    if (typeof id !== "string" || typeof review_id !== "string") {
      throw new HttpError(400, "invalid_request", "id and review_id are required");
    }
    const out = await buildReviewCertificatePdf(context, id, review_id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(Buffer.from(out.bytes));
  }),
);

app.post(
  "/api/phi-inventory",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    response.status(201).json(await createPhiSystem(context, request.body as Record<string, unknown>));
  }),
);

app.patch(
  "/api/phi-inventory/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(await updatePhiSystem(context, id, request.body as Record<string, unknown>));
  }),
);

app.delete(
  "/api/phi-inventory/:id",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    await softDeletePhiSystem(context, id);
    response.status(204).send();
  }),
);

app.post(
  "/api/phi-inventory/:id/review",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(
      await submitPhiSystemReview(context, id, request.body as {
        changes_made?: string;
        reviewer_role?: string;
        cosigner_id?: string | null;
        cosigner_role?: string | null;
        checklist_confirmed?: boolean;
      }),
    );
  }),
);

app.post(
  "/api/phi-inventory/:id/decommission",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    response.json(
      await decommissionPhiSystem(context, id, request.body as {
        method?: string;
        date?: string;
        authorized_by?: string;
        successor_system?: string;
        legal_hold_ref?: string;
        notes?: string;
      }),
    );
  }),
);

app.get(
  "/api/phi-inventory/:id/decommission/certificate",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "read_only");
    const { id } = request.params;
    if (typeof id !== "string") throw new HttpError(400, "invalid_request", "id is required");
    const out = await buildDecommissionCertificatePdf(context, id);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    response.send(Buffer.from(out.bytes));
  }),
);

app.post(
  "/api/phi-inventory/sync-from-scanner",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    await requirePermission(context, "phi_inventory", "full");
    const scanId = (request.body as { scan_id?: string })?.scan_id;
    if (typeof scanId !== "string" || !scanId.trim()) {
      throw new HttpError(400, "invalid_request", "scan_id is required");
    }
    response.json(await syncPhiInventoryFromScanner(context, scanId.trim()));
  }),
);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "internal_server_error" });
});

app.listen(env.port, () => {
  console.log(`Backend API listening on http://localhost:${env.port}`);
});
