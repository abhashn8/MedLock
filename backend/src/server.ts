import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { env } from "./env.js";
import { HttpError } from "./http-error.js";
import { listRepos } from "./services/github.js";
import {
  createModuleRecord,
  deleteModuleRecord,
  listModuleRecords,
  updateModuleRecord,
} from "./services/module-records.js";
import {
  createPhiScanSchedule,
  getPhiScanOverview,
  patchPhiFinding,
  runPhiScan,
} from "./services/phi-scan.js";
import { createScan, getScan, listScans } from "./services/scans.js";
import { requireAuth } from "./supabase.js";

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
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

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get(
  "/api/repos",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listRepos(context));
  }),
);

app.get(
  "/api/scans",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await listScans(context));
  }),
);

app.get(
  "/api/scans/:scanId",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
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
    response.json(await listModuleRecords(context, module));
  }),
);

app.post(
  "/api/module-records",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
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
    await deleteModuleRecord(context, id);
    response.status(204).send();
  }),
);

app.post(
  "/api/phi-scan",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(await runPhiScan(context, request.body));
  }),
);

app.get(
  "/api/phi-scan",
  asyncHandler(async (request, response) => {
    const context = await requireAuth(request);
    response.json(
      await getPhiScanOverview(context, {
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
    await createPhiScanSchedule(context, request.body);
    response.status(201).json({ ok: true });
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
