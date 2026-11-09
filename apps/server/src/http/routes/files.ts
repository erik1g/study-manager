import { createReadStream } from "node:fs";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Services } from "../../services.ts";
import { who } from "../app.ts";
import { receiveUploads } from "../uploads.ts";
import { AppError } from "../../domain/errors.ts";

export const fileRoutes =
  (services: Services): FastifyPluginAsync =>
  async (app) => {
    const f = services.files;
    type WithId = { Params: { id: string } };

    app.get<WithId>("/api/courses/:id/files", async (request) => f.list(who(request).userId, request.params.id));

    app.post<WithId & { Querystring: { folder?: string } }>("/api/courses/:id/files", async (request) => {
      const identity = who(request);
      const uploads = await receiveUploads(request, services.filesDir);
      if (uploads.length === 0) throw new AppError(400, "no_file");
      const saved = [];
      for (const upload of uploads) {
        const file = await f.upload(identity.userId, request.params.id, request.query.folder ?? "skripte", upload);
        services.indexLater(file.id);
        saved.push(file);
      }
      return saved;
    });

    /** The content, with byte ranges so that PDFs open before they are fully loaded. */
    app.get<WithId & { Querystring: { download?: string } }>("/api/files/:id/content", async (request, reply) => {
      const file = await f.open(who(request).userId, request.params.id);
      // Anything a browser would run as a page (HTML, SVG, XML, scripts) is only ever downloaded.
      const active = /html|xml|svg|javascript|ecmascript/i.test(file.mime) || /\.(html?|xhtml|svg|xml|js|mjs)$/i.test(file.name);
      const disposition = request.query.download || active ? "attachment" : "inline";
      reply
        .header("Accept-Ranges", "bytes")
        .header("Content-Type", active ? "application/octet-stream" : file.mime)
        .header("X-Content-Type-Options", "nosniff")
        .header("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'")
        .header("Cache-Control", "private, max-age=300")
        .header("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
      if (range && file.size > 0) {
        const start = range[1] ? Number(range[1]) : Math.max(0, file.size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), file.size - 1) : file.size - 1;
        if (start > end || start >= file.size) {
          return reply.status(416).header("Content-Range", `bytes */${file.size}`).send();
        }
        reply.status(206).header("Content-Range", `bytes ${start}-${end}/${file.size}`).header("Content-Length", end - start + 1);
        return reply.send(createReadStream(file.path, { start, end }));
      }
      reply.header("Content-Length", file.size);
      return reply.send(createReadStream(file.path));
    });

    app.patch<WithId>("/api/files/:id", async (request) => {
      const change = z.object({ name: z.string().optional(), folder: z.string().optional() }).parse(request.body);
      return f.update(who(request).userId, request.params.id, change);
    });
    app.delete<WithId>("/api/files/:id", async (request) => {
      await f.trash(who(request).userId, request.params.id);
      return { ok: true };
    });
    app.get<WithId>("/api/courses/:id/trash", async (request) => f.trashList(who(request).userId, request.params.id));
    app.post<WithId>("/api/files/:id/restore", async (request) => {
      const file = await f.restore(who(request).userId, request.params.id);
      services.indexLater(file.id);
      return file;
    });
  };
