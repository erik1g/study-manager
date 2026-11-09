import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";
import { AppError } from "../../domain/errors.ts";

export const calendarRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    const c = services.calendar;
    type WithId = { Params: { id: string } };

    app.get<{ Querystring: { from: string; to: string } }>("/api/calendar", async (request) => {
      const from = new Date(request.query.from);
      const to = new Date(request.query.to);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw new AppError(400, "invalid_range");
      return c.items(who(request).userId, from, to);
    });

    app.get("/api/progress", async (request) => c.progress(who(request).userId));

    app.get("/api/feeds", async (request) => c.feeds(who(request).userId));
    app.post("/api/feeds", async (request) => c.addFeed(who(request).userId, request.body as never));
    app.patch<WithId>("/api/feeds/:id", async (request) => {
      const change = z.object({ name: z.string().optional(), color: z.string().nullable().optional() }).parse(request.body);
      await c.updateFeed(who(request).userId, request.params.id, change);
      return { ok: true };
    });
    app.delete<WithId>("/api/feeds/:id", async (request) => {
      await c.removeFeed(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.post<WithId>("/api/feeds/:id/refresh", async (request) => {
      const feeds = await c.feeds(who(request).userId);
      if (!feeds.some((f) => f.id === request.params.id)) throw new AppError(404, "unknown_feed");
      await c.refresh(request.params.id);
      return { ok: true };
    });

    app.get<WithId>("/api/courses/:id/sessions", async (request) => c.sessions(who(request).userId, request.params.id));

    app.get("/api/series", async (request) => c.series(who(request).userId));
    app.put("/api/series", async (request) => {
      const body = z.object({ feedId: z.string().uuid(), title: z.string(), courseId: z.string().uuid().nullable() }).parse(request.body);
      await c.assign(who(request).userId, body.feedId, body.title, body.courseId);
      return { ok: true };
    });

    /** The subscription link for calendar apps; the token is the only key. */
    app.get<{ Params: { file: string } }>("/ical/:file", async (request, reply) => {
      const token = request.params.file.replace(/\.ics$/, "");
      const text = await c.ics(token);
      if (!text) throw new AppError(404, "unknown_calendar");
      return reply.header("Content-Type", "text/calendar; charset=utf-8").header("Cache-Control", "no-cache").send(text);
    });
  };
