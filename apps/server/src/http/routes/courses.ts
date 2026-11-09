import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { COURSE_ROLES } from "@study/shared";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";

export const courseRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    const c = services.courses;
    type WithId = { Params: { id: string } };

    app.get("/api/courses", async (request) => c.list(who(request).userId));
    app.post("/api/courses", async (request) => c.create(who(request).userId, request.body as never));
    app.get<WithId>("/api/courses/:id", async (request) => c.get(who(request).userId, request.params.id));
    app.patch<WithId>("/api/courses/:id", async (request) => {
      const change = z
        .object({ title: z.string().optional(), semester: z.string().optional(), credits: z.number().nullable().optional() })
        .parse(request.body);
      await c.update(who(request).userId, request.params.id, change);
      return { ok: true };
    });
    app.delete<WithId>("/api/courses/:id", async (request) => {
      await c.remove(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.put<WithId>("/api/courses/:id/color", async (request) => {
      const { color } = z.object({ color: z.string().nullable() }).parse(request.body);
      await c.setColor(who(request).userId, request.params.id, color);
      return { ok: true };
    });

    app.get<WithId & { Querystring: { before?: string } }>("/api/courses/:id/activity", async (request) =>
      services.activity.ofCourse(who(request).userId, request.params.id, { before: request.query.before || undefined }),
    );
    app.get<WithId>("/api/courses/:id/members", async (request) => c.members(who(request).userId, request.params.id));
    app.put<{ Params: { id: string; userId: string } }>("/api/courses/:id/members/:userId", async (request) => {
      const { role } = z.object({ role: z.enum(COURSE_ROLES) }).parse(request.body);
      await c.setRole(who(request).userId, request.params.id, request.params.userId, role);
      return { ok: true };
    });
    app.delete<{ Params: { id: string; userId: string } }>("/api/courses/:id/members/:userId", async (request) => {
      await c.removeMember(who(request).userId, request.params.id, request.params.userId);
      return { ok: true };
    });

    app.post<WithId>("/api/courses/:id/invites", async (request) => {
      const { role } = z.object({ role: z.enum(COURSE_ROLES).default("editor") }).parse(request.body ?? {});
      const invite = await c.createInvite(who(request).userId, request.params.id, role);
      return { ...invite, url: `${services.siteUrl}/beitreten/${invite.token}` };
    });
    app.get<{ Params: { token: string } }>("/api/invitations/:token", async (request) => {
      who(request);
      return c.invitation(request.params.token);
    });
    app.post<{ Params: { token: string } }>("/api/invitations/:token/accept", async (request) =>
      c.acceptInvite(who(request).userId, request.params.token),
    );

    // Inviting people who already have an account, and their answer.
    const inv = services.invitations;
    app.get<WithId & { Querystring: { q?: string } }>("/api/courses/:id/people", async (request) =>
      inv.findPeople(who(request).userId, request.params.id, request.query.q ?? ""),
    );
    app.get<WithId>("/api/courses/:id/invitations", async (request) => inv.pending(who(request).userId, request.params.id));
    app.post<WithId>("/api/courses/:id/invitations", async (request) => {
      const { userId, role } = z.object({ userId: z.string().uuid(), role: z.enum(COURSE_ROLES).default("editor") }).parse(request.body);
      await inv.invite(who(request).userId, request.params.id, userId, role);
      return { ok: true };
    });
    app.delete<{ Params: { id: string; userId: string } }>("/api/courses/:id/invitations/:userId", async (request) => {
      await inv.withdraw(who(request).userId, request.params.id, request.params.userId);
      return { ok: true };
    });
    app.post<WithId>("/api/course-invitations/:id/accept", async (request) => inv.respond(who(request).userId, request.params.id, true));
    app.post<WithId>("/api/course-invitations/:id/decline", async (request) => inv.respond(who(request).userId, request.params.id, false));
    app.get("/api/notifications", async (request) => inv.notifications(who(request).userId));
    app.get("/api/notifications/unread", async (request) => ({ count: await inv.unread(who(request).userId) }));
    app.post("/api/notifications/read", async (request) => {
      const { ids } = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(request.body ?? {});
      await inv.markRead(who(request).userId, ids);
      return { ok: true };
    });

  };
