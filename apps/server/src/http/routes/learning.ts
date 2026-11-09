import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { NotesConflict } from "../../domain/notes.ts";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";

export const learningRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    type WithId = { Params: { id: string } };
    const n = services.notes;
    const f = services.flashcards;
    const r = services.recordings;

    // --- Notes ------------------------------------------------------------
    app.get<WithId>("/api/courses/:id/notes", async (request) => n.get(who(request).userId, request.params.id));
    app.put<WithId>("/api/courses/:id/notes", async (request, reply) => {
      const body = z.object({ content: z.string(), version: z.number().int().nonnegative() }).parse(request.body);
      try {
        return await n.save(who(request).userId, request.params.id, body.content, body.version);
      } catch (error) {
        // The text someone else saved meanwhile comes with the refusal.
        if (error instanceof NotesConflict) return reply.status(409).send({ code: "notes_conflict", current: error.current });
        throw error;
      }
    });
    app.get<WithId>("/api/courses/:id/private-notes", async (request) => n.getPrivate(who(request).userId, request.params.id));
    app.put<WithId>("/api/courses/:id/private-notes", async (request) => {
      const { content } = z.object({ content: z.string() }).parse(request.body);
      await n.savePrivate(who(request).userId, request.params.id, content);
      return { ok: true };
    });

    // --- Search -------------------------------------------------------------
    app.get<{ Querystring: { q?: string } }>("/api/search", async (request) => services.search.everywhere(who(request).userId, request.query.q ?? ""));
    app.get<WithId & { Querystring: { q?: string } }>("/api/courses/:id/search", async (request) =>
      services.search.search(who(request).userId, request.params.id, request.query.q ?? "", 12),
    );

    // --- Flashcards -----------------------------------------------------------
    app.get<WithId>("/api/courses/:id/decks", async (request) => f.decks(who(request).userId, request.params.id));
    app.post<WithId>("/api/courses/:id/decks", async (request) => {
      const { name } = z.object({ name: z.string() }).parse(request.body);
      return f.createDeck(who(request).userId, request.params.id, name);
    });
    app.patch<WithId>("/api/decks/:id", async (request) => {
      const { name } = z.object({ name: z.string() }).parse(request.body);
      await f.renameDeck(who(request).userId, request.params.id, name);
      return { ok: true };
    });
    app.delete<WithId>("/api/decks/:id", async (request) => {
      await f.deleteDeck(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.get<WithId>("/api/decks/:id/cards", async (request) => f.cards(who(request).userId, request.params.id));
    app.get<WithId>("/api/decks/:id/queue", async (request) => f.queue(who(request).userId, request.params.id));
    const cardBody = z.object({ front: z.string(), back: z.string(), source: z.string().nullable().optional() });
    app.post<WithId>("/api/decks/:id/cards", async (request) => f.addCard(who(request).userId, request.params.id, cardBody.parse(request.body)));
    app.put<WithId>("/api/cards/:id", async (request) => {
      await f.updateCard(who(request).userId, request.params.id, cardBody.parse(request.body));
      return { ok: true };
    });
    app.delete<WithId>("/api/cards/:id", async (request) => {
      await f.deleteCard(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.post<WithId>("/api/cards/:id/review", async (request) => {
      const { rating } = z.object({ rating: z.number().int() }).parse(request.body);
      return f.review(who(request).userId, request.params.id, rating);
    });
    app.get<WithId>("/api/courses/:id/proposals", async (request) => f.proposals(who(request).userId, request.params.id));
    app.post<WithId>("/api/proposals/:id/accept", async (request) =>
      f.accept(who(request).userId, request.params.id, request.body && Object.keys(request.body).length ? cardBody.parse(request.body) : undefined),
    );
    app.delete<WithId>("/api/proposals/:id", async (request) => {
      await f.reject(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.get("/api/due-cards", async (request) => {
      const identity = who(request);
      const courses = await services.courses.list(identity.userId);
      return f.dueCounts(identity.userId, courses.map((c) => c.id));
    });

    // --- Lectures -------------------------------------------------------------
    app.get<WithId>("/api/courses/:id/recordings", async (request) => r.list(who(request).userId, request.params.id));
    app.post<WithId>("/api/courses/:id/recordings", async (request) => ({ id: await r.create(who(request).userId, request.params.id, request.body as never) }));
    app.get<WithId>("/api/recordings/:id", async (request) => {
      const row = await r.get(who(request).userId, request.params.id);
      return { ...row, createdAt: row.createdAt.toISOString(), analysedAt: row.analysedAt?.toISOString() ?? null };
    });
    app.patch<WithId>("/api/recordings/:id", async (request) => {
      const change = z.object({ title: z.string().optional(), date: z.string().optional() }).parse(request.body);
      await r.rename(who(request).userId, request.params.id, change);
      return { ok: true };
    });
    app.delete<WithId>("/api/recordings/:id", async (request) => {
      await r.remove(who(request).userId, request.params.id);
      return { ok: true };
    });

    // --- Work for Claude --------------------------------------------------------
    app.get("/api/inbox", async (request) => services.inbox.items(who(request).userId));
  };
