// Invites someone from the command line and prints their link:
// `pnpm --filter @study/server invite <email> [name]`.
import { gotrueAccounts } from "../auth/accounts.ts";
import { loadConfig } from "../config.ts";
import { createDb } from "../db/client.ts";
import { users } from "../domain/users.ts";

const [email, name = ""] = process.argv.slice(2);
if (!email) {
  console.error("Usage: invite <email> [name]");
  process.exit(1);
}
const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const accounts = gotrueAccounts({ url: config.AUTH_URL, serviceKey: config.SERVICE_ROLE_KEY, siteUrl: config.SITE_URL });
const { link } = await users(db, accounts, config.FILES_DIR).invite(email, name);
console.log(link);
await client.end();
