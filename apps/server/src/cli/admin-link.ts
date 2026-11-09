// Prints a link to set up (or recover) the admin account named in the
// configuration: `pnpm admin:link` on the server.
import { gotrueAccounts } from "../auth/accounts.ts";
import { loadConfig } from "../config.ts";
import { createDb } from "../db/client.ts";
import { users } from "../domain/users.ts";

const config = loadConfig();
const { db, client } = createDb(config.DATABASE_URL);
const accounts = gotrueAccounts({ url: config.AUTH_URL, serviceKey: config.SERVICE_ROLE_KEY, siteUrl: config.SITE_URL });
const email = process.argv[2] ?? config.ADMIN_EMAIL;
const { link } = await users(db, accounts, config.FILES_DIR).invite(email, "Admin", true);
console.log(`\nEinrichtungslink für ${email}:\n${link}\n`);
await client.end();
