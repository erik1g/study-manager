import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Services } from "../../services.ts";
import { adminOnly } from "../app.ts";
import { record } from "../../domain/activity.ts";
import { serverStatus } from "../../jobs/status.ts";
import { runBackup } from "../../jobs/backup.ts";

export const adminRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    app.get("/api/admin/users", async (request) => {
      await adminOnly(services, request);
      return services.users.list();
    });

    app.post("/api/admin/users", async (request) => {
      const admin = await adminOnly(services, request);
      const body = z
        .object({ email: z.string(), displayName: z.string().default(""), isAdmin: z.boolean().default(false) })
        .parse(request.body);
      const inviter = await services.users.me(admin.userId);
      const invited = await services.users.invite(body.email, body.displayName, {
        makeAdmin: body.isAdmin,
        byMail: services.mailEnabled,
        locale: inviter.locale,
      });
      await record(services.db, { actorId: admin.userId, action: "user.invited", subjectId: invited.userId, subject: body.displayName || body.email, details: { isAdmin: body.isAdmin } });
      return invited;
    });

    app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (request) => {
      const admin = await adminOnly(services, request);
      const change = z
        .object({
          isAdmin: z.boolean().optional(),
          disabled: z.boolean().optional(),
          quotaBytes: z.number().int().positive().nullable().optional(),
          displayName: z.string().optional(),
          email: z.string().optional(),
        })
        .parse(request.body);
      await services.users.update(admin.userId, request.params.id, change);
      return { ok: true };
    });

    app.post<{ Params: { id: string } }>("/api/admin/users/:id/reset-link", async (request) => {
      await adminOnly(services, request);
      return { link: await services.users.resetLink(request.params.id) };
    });

    app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (request) => {
      const admin = await adminOnly(services, request);
      await services.users.remove(admin.userId, request.params.id);
      return { ok: true };
    });

    app.get<{ Querystring: { actor?: string; before?: string } }>("/api/admin/activity", async (request) => {
      await adminOnly(services, request);
      return services.activity.all({ actorId: request.query.actor || undefined, before: request.query.before || undefined });
    });

    app.get("/api/admin/status", async (request) => {
      await adminOnly(services, request);
      return serverStatus(services);
    });

    app.post("/api/admin/backups", async (request) => {
      await adminOnly(services, request);
      return runBackup();
    });
  };
