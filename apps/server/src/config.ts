import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  /** Where the server reaches the sign-in service inside the stack. */
  AUTH_URL: z.string().url().default("http://auth:9999"),
  /** Where browsers and MCP clients reach it, which is also the token issuer. */
  API_EXTERNAL_URL: z.string().url(),
  SITE_URL: z.string().url(),
  SERVICE_ROLE_KEY: z.string().min(20),
  ANON_KEY: z.string().min(20),
  ADMIN_EMAIL: z.string().email(),
  APP_SECRET: z.string().min(32),
  BACKUP_PASSPHRASE: z.string().min(16).optional(),
  FILES_DIR: z.string().default("/data/files"),
  BACKUP_DIR: z.string().default("/data/backups"),
  PORT: z.coerce.number().default(3000),
  /** Set once mail goes out (Brevo); without it, links are handed to the admin. */
  SMTP_HOST: z.string().optional(),
  /** Tasks are planned in local time. */
  TZ: z.string().default("Europe/Berlin"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(env);
}
