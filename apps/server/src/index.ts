import { gotrueAccounts } from "./auth/accounts.ts";
import { tokenAuthenticator } from "./auth/identity.ts";
import { loadConfig } from "./config.ts";
import { createDb, migrateDb } from "./db/client.ts";
import { buildApp } from "./http/app.ts";
import { startScheduler } from "./jobs/scheduler.ts";
import { mountMcp } from "./mcp/server.ts";
import { buildServices } from "./services.ts";

const config = loadConfig();
process.env.TZ = config.TZ;

await migrateDb(config.DATABASE_URL);
const { db } = createDb(config.DATABASE_URL);
const accounts = gotrueAccounts({ url: config.AUTH_URL, serviceKey: config.SERVICE_ROLE_KEY, siteUrl: config.SITE_URL });
const services = buildServices({
  db,
  accounts,
  authenticator: tokenAuthenticator({ db, jwksUrl: `${config.AUTH_URL}/.well-known/jwks.json`, issuer: config.API_EXTERNAL_URL }),
  filesDir: config.FILES_DIR,
  siteUrl: config.SITE_URL,
  anonKey: config.ANON_KEY,
  mailEnabled: !!config.SMTP_HOST,
});

const app = await buildApp(services, { extend: (instance) => mountMcp(instance, services) });

// The very first start: the admin gets a link to set up their account.
if ((await services.users.adminCount()) === 0) {
  const { link } = await services.users.invite(config.ADMIN_EMAIL, "Admin", { makeAdmin: true });
  app.log.warn(`No admin yet. Set up ${config.ADMIN_EMAIL} with: ${link}`);
}

await startScheduler(config.DATABASE_URL, services, app.log);
await app.listen({ host: "0.0.0.0", port: config.PORT });
