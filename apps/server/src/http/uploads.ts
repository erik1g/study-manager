// Uploads are streamed to a temporary file on the files disk while their
// hash is computed, so that moving them into place is a rename.
import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest } from "fastify";
import type { Upload } from "../domain/files.ts";
import { AppError } from "../domain/errors.ts";

export async function receiveUploads(request: FastifyRequest, filesDir: string): Promise<Upload[]> {
  if (!request.isMultipart()) throw new AppError(400, "not_multipart");
  const tempDir = join(filesDir, ".tmp");
  await mkdir(tempDir, { recursive: true });
  const uploads: Upload[] = [];
  try {
    for await (const part of request.files()) {
      const tempPath = join(tempDir, randomUUID());
      const hash = createHash("sha256");
      let size = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          hash.update(chunk);
          size += chunk.length;
          done(null, chunk);
        },
      });
      await pipeline(part.file, counter, createWriteStream(tempPath));
      if (part.file.truncated) {
        await rm(tempPath, { force: true });
        throw new AppError(413, "file_too_large");
      }
      uploads.push({ tempPath, name: part.filename, size, mime: part.mimetype || "application/octet-stream", sha256: hash.digest("hex") });
    }
  } catch (error) {
    await Promise.all(uploads.map((u) => rm(u.tempPath, { force: true })));
    throw error;
  }
  return uploads;
}
