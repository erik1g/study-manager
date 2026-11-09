import { createReadStream } from "node:fs";
import { rm } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { recentlyAuthenticated, strongEnoughForAdmin } from "../../auth/identity.ts";
import { AppError } from "../../domain/errors.ts";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";
import { receiveUploads } from "../uploads.ts";
import { MAILS, mailPage } from "../mails.ts";

export const meRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    /** What the web app needs before anyone signs in. */
    app.get("/api/config", async () => ({ anonKey: services.anonKey, mail: services.mailEnabled }));

    /**
     * The mails the sign-in service sends, in German. It fetches them from
     * here inside the stack and fills in the links ({{ .ConfirmationURL }}).
     */
    app.get<{ Params: { kind: string } }>("/api/mail/:kind", async (request, reply) => {
      const mail = MAILS[request.params.kind];
      if (!mail) throw new AppError(404, "unknown_mail");
      return reply.type("text/html; charset=utf-8").send(mailPage(mail));
    });

    app.get("/api/me", async (request) => {
      const identity = who(request);
      let profile = await services.users.me(identity.userId);
      // A changed address was confirmed in the sign-in service; the profile follows.
      if (identity.email && identity.email !== profile.email) {
        await services.users.syncEmail(identity.userId, identity.email);
        profile = await services.users.me(identity.userId);
      }
      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        studies: profile.studies,
        semester: profile.semester,
        avatarVersion: profile.avatarPath ? profile.avatarVersion : null,
        isAdmin: profile.isAdmin,
        /** Whether this session may use the admin area. */
        adminReady: profile.isAdmin && strongEnoughForAdmin(identity),
        icalUrl: `${services.siteUrl}/ical/${profile.icalToken}.ics`,
        mcpUrl: `${services.siteUrl}/mcp`,
      };
    });

    app.patch("/api/me", async (request) => {
      const change = z
        .object({
          displayName: z.string().max(80).optional(),
          studies: z.string().max(120).nullable().optional(),
          semester: z.number().int().nullable().optional(),
        })
        .parse(request.body);
      await services.users.updateProfile(who(request).userId, change);
      return { ok: true };
    });

    app.put("/api/me/avatar", async (request) => {
      const identity = who(request);
      const [upload, ...rest] = await receiveUploads(request, services.filesDir);
      if (!upload) throw new AppError(400, "no_file");
      for (const extra of rest) await rm(extra.tempPath, { force: true });
      await services.users.setAvatar(identity.userId, upload);
      return { ok: true };
    });

    app.delete("/api/me/avatar", async (request) => {
      await services.users.removeAvatar(who(request).userId);
      return { ok: true };
    });

    /**
     * Profile pictures load as plain images, which carry no token; the id is
     * not guessable and the picture is all there is to see.
     */
    app.get<{ Params: { id: string } }>("/api/avatars/:id", async (request, reply) => {
      if (!/^[0-9a-f-]{36}$/.test(request.params.id)) throw new AppError(404, "unknown_user");
      const avatar = await services.users.avatar(request.params.id);
      if (!avatar) throw new AppError(404, "no_avatar");
      const etag = `"${avatar.version}"`;
      reply
        .header("ETag", etag)
        .header("Cache-Control", "private, max-age=86400")
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox; default-src 'none'");
      if (request.headers["if-none-match"] === etag) return reply.status(304).send();
      return reply.type(avatar.mime).send(createReadStream(avatar.path));
    });

    app.get("/api/people", async (request) => services.users.people(who(request).userId));

    app.get("/api/me/deletion", async (request) => services.users.deletionCheck(who(request).userId));

    app.delete("/api/me", async (request) => {
      const identity = who(request);
      // A stolen session alone must not be enough to delete the account.
      if (!recentlyAuthenticated(identity)) throw new AppError(403, "sign_in_again");
      const { email } = z.object({ email: z.string() }).parse(request.body);
      await services.users.deleteSelf(identity.userId, email);
      return { ok: true };
    });

    app.post("/api/me/ical-token", async (request) => {
      const token = await services.users.renewIcalToken(who(request).userId);
      return { icalUrl: `${services.siteUrl}/ical/${token}.ics` };
    });

    app.get("/api/keys", async (request) => services.keys.list(who(request).userId));
    app.post("/api/keys", async (request) => {
      const { name } = z.object({ name: z.string() }).parse(request.body);
      return services.keys.create(who(request).userId, name);
    });
    app.post<{ Params: { id: string } }>("/api/keys/:id/extend", async (request) => services.keys.extend(who(request).userId, request.params.id));

    app.get("/api/connected-apps", async (request) => services.connectedApps.list(who(request).userId));
    app.delete<{ Params: { id: string } }>("/api/connected-apps/:id", async (request) => {
      if (!/^[0-9a-f-]{36}$/.test(request.params.id)) throw new AppError(404, "unknown_app");
      await services.connectedApps.disconnect(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.delete<{ Params: { id: string } }>("/api/keys/:id", async (request) => {
      await services.keys.revoke(who(request).userId, request.params.id);
      return { ok: true };
    });
  };
