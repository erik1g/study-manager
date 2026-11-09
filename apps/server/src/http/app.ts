import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { strongEnoughForAdmin, type Identity } from "../auth/identity.ts";
import { actingVia } from "../domain/activity.ts";
import { AppError } from "../domain/errors.ts";
import type { Services } from "../services.ts";
import { adminRoutes } from "./routes/admin.ts";
import { calendarRoutes } from "./routes/calendar.ts";
import { courseRoutes } from "./routes/courses.ts";
import { fileRoutes } from "./routes/files.ts";
import { learningRoutes } from "./routes/learning.ts";
import { meRoutes } from "./routes/me.ts";
import { planningRoutes } from "./routes/planning.ts";
import { programRoutes } from "./routes/programs.ts";

declare module "fastify" {
  interface FastifyRequest {
    identity: Identity | null;
  }
}

/** The signed-in user of a request; 401 without one. */
export function who(request: FastifyRequest): Identity {
  if (!request.identity) throw new AppError(401, "not_signed_in");
  return request.identity;
}

/** Admins only, and only with a second factor or a passkey. */
export async function adminOnly(services: Services, request: FastifyRequest): Promise<Identity> {
  const identity = who(request);
  const profile = await services.users.me(identity.userId);
  if (!profile.isAdmin) throw new AppError(403, "admins_only");
  if (!strongEnoughForAdmin(identity)) throw new AppError(403, "admin_needs_second_factor");
  return identity;
}

/** Proxies in front often pass at most 100 MB per request; a little room for the form around the file. */
export const MAX_UPLOAD_BYTES = 95 * 1024 * 1024;

/**
 * Who a request counts against: the signed-in user, else the visitor's
 * address as Caddy determined it (it sets X-Real-IP itself and trusts the
 * forwarded address only from the proxy in front of it).
 */
const limitKey = (request: FastifyRequest) =>
  request.identity ? `user:${request.identity.userId}` : `ip:${String(request.headers["x-real-ip"] ?? request.ip)}`;

/** Requests per minute, by kind. */
/**
 * Requests per minute and visitor. RATE_LIMIT_SCALE multiplies them, for the
 * test stack, where every test comes from the same address.
 */
const SCALE = Math.max(1, Number(process.env.RATE_LIMIT_SCALE) || 1);
export const LIMITS = { default: 600 * SCALE, mcp: 120 * SCALE, upload: 30 * SCALE, calendar: 60 * SCALE } as const;

export interface AppExtras {
  /** Mounts more routes, such as the MCP endpoint. */
  extend?: (app: ReturnType<typeof Fastify>) => void | Promise<void>;
}

export async function buildApp(services: Services, extras: AppExtras = {}) {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    // Transcripts and notes come as JSON.
    bodyLimit: 10 * 1024 * 1024,
    // The visitor's address comes from Caddy as X-Real-IP, not from forwarded headers anyone can send.
    trustProxy: false,
  });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 20 } });

  app.decorateRequest("identity", null);
  app.addHook("onRequest", async (request) => {
    request.identity = await services.authenticator.identify(request.headers.authorization);
  });
  await app.register(rateLimit, {
    max: (request) => {
      const path = request.url;
      if (path.startsWith("/mcp")) return LIMITS.mcp;
      if (path.startsWith("/ical/")) return LIMITS.calendar;
      if (request.method !== "GET" && /\/(files|avatar|handbook)\b/.test(path)) return LIMITS.upload;
      return LIMITS.default;
    },
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const path = request.url;
      const kind = path.startsWith("/mcp") ? "mcp" : request.method !== "GET" && /\/(files|avatar|handbook)\b/.test(path) ? "upload" : "api";
      return `${kind}:${limitKey(request)}`;
    },
    allowList: (request) => request.url === "/api/health",
    errorResponseBuilder: () => ({ statusCode: 429, code: "rate_limited", message: "Zu viele Anfragen – bitte kurz warten." }),
  });
  // What is recorded during the request is marked as Claude's when it came
  // through OAuth or a personal key, which only MCP clients use.
  app.addHook("preHandler", (request, _reply, done) => {
    actingVia(request.identity && request.identity.via !== "session" ? "claude" : "app", done);
  });

  app.setErrorHandler((error, request, reply: FastifyReply) => {
    if ((error as { statusCode?: number }).statusCode === 429) {
      return reply.status(429).send({ code: "rate_limited", message: "Zu viele Anfragen – bitte kurz warten." });
    }
    if ((error as { code?: string }).code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({ code: "file_too_large", message: "Die Datei ist größer als 95 MB." });
    }
    if (error instanceof AppError) {
      return reply.status(error.status).send({ code: error.code, message: error.message });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "invalid",
        message: error.issues.map((i) => `${i.path.join(".") || "Eingabe"}: ${i.message}`).join("; "),
      });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      return reply.status(status).send({ code: (error as { code?: string }).code ?? "invalid", message: (error as Error).message });
    }
    request.log.error(error);
    return reply.status(500).send({ code: "server_error", message: "Interner Fehler" });
  });

  app.get("/api/health", async () => ({ ok: true }));

  await app.register(meRoutes(services));
  await app.register(adminRoutes(services));
  await app.register(programRoutes(services));
  await app.register(courseRoutes(services));
  await app.register(fileRoutes(services));
  await app.register(planningRoutes(services));
  await app.register(calendarRoutes(services));
  await app.register(learningRoutes(services));
  await extras.extend?.(app);
  return app;
}
