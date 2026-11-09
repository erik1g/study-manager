import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";
import { receiveUploads } from "../uploads.ts";
import { AppError } from "../../domain/errors.ts";

export const programRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    const p = services.programs;

    app.get("/api/programs", async (request) => p.list(who(request).userId));
    app.post("/api/programs", async (request) => ({ id: await p.create(who(request).userId, request.body as never) }));
    app.put<{ Params: { id: string } }>("/api/programs/:id", async (request) => {
      await p.update(who(request).userId, request.params.id, request.body as never);
      return { ok: true };
    });
    app.delete<{ Params: { id: string } }>("/api/programs/:id", async (request) => {
      await p.remove(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.post<{ Params: { id: string } }>("/api/programs/:id/enrollment", async (request) => {
      const { enrolled } = z.object({ enrolled: z.boolean() }).parse(request.body);
      await p.setEnrolled(who(request).userId, request.params.id, enrolled);
      return { ok: true };
    });
    app.get<{ Params: { id: string }; Querystring: { q?: string } }>("/api/programs/:id/modules", async (request) => {
      who(request);
      return p.modules(request.params.id, request.query.q);
    });
    app.get<{ Params: { id: string } }>("/api/modules/:id", async (request) => {
      who(request);
      return p.module(request.params.id);
    });
    app.delete<{ Params: { id: string } }>("/api/modules/:id", async (request) => {
      await p.removeModule(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.post<{ Params: { id: string } }>("/api/programs/:id/handbook", async (request) => {
      const identity = who(request);
      const [upload] = await receiveUploads(request, services.filesDir);
      if (!upload) throw new AppError(400, "no_file");
      if (!/\.pdf$/i.test(upload.name)) throw new AppError(400, "handbook_not_pdf");
      await p.setHandbook(identity.userId, request.params.id, upload.tempPath);
      return { ok: true };
    });
  };
