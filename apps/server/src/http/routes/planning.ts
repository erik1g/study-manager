import type { FastifyPluginAsync } from "fastify";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";

const date = (value?: string) => (value ? new Date(value) : undefined);

export const planningRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    const p = services.planning;
    type WithId = { Params: { id: string } };

    app.get<{ Querystring: { courseId?: string; from?: string; to?: string } }>("/api/deadlines", async (request) =>
      p.deadlines(who(request).userId, { courseId: request.query.courseId, from: date(request.query.from), to: date(request.query.to) }),
    );
    app.post("/api/deadlines", async (request) => p.createDeadline(who(request).userId, request.body as never));
    app.put<WithId>("/api/deadlines/:id", async (request) => p.updateDeadline(who(request).userId, request.params.id, request.body as never));
    app.put<WithId & { Body: { done?: unknown } }>("/api/deadlines/:id/done", async (request) =>
      p.setDeadlineDone(who(request).userId, request.params.id, request.body?.done === true),
    );
    app.delete<WithId>("/api/deadlines/:id", async (request) => {
      await p.deleteDeadline(who(request).userId, request.params.id);
      return { ok: true };
    });

    app.get<{ Querystring: { courseId?: string; open?: string } }>("/api/tasks", async (request) =>
      p.tasks(who(request).userId, { courseId: request.query.courseId, open: request.query.open === "1" }),
    );
    app.post("/api/tasks", async (request) => p.createTask(who(request).userId, request.body as never));
    app.patch<WithId>("/api/tasks/:id", async (request) => p.updateTask(who(request).userId, request.params.id, request.body as never));
    app.delete<WithId>("/api/tasks/:id", async (request) => {
      await p.deleteTask(who(request).userId, request.params.id);
      return { ok: true };
    });
  };
