// Creates .env with fresh secrets. Run once:
//   ADMIN_EMAIL=you@example.org DOMAIN=study.example.org node infra/scripts/setup.mjs
// or without a clone, from the server image (prints the file instead of writing it):
//   docker run --rm -e ADMIN_EMAIL=you@example.org -e DOMAIN=study.example.org \
//     docker.io/erik1g/study-manager-server node /app/infra/scripts/setup.mjs --stdout > .env
// An existing .env is never overwritten; secrets in it would be lost.
// ENV_FILE, SITE_URL, DATA_DIR and DB_DIR write another one, e.g. the test
// stack's .env.test with secrets of its own (see infra/test/stack.sh).
import { generateKeyPairSync, createHmac, randomBytes, randomUUID } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const target = join(root, process.env.ENV_FILE ?? ".env");
const toStdout = process.argv.includes("--stdout");
if (!toStdout && existsSync(target)) {
  console.error(`${target} exists already; delete it first if you really want new secrets.`);
  process.exit(1);
}

// The admin is who you are: the first sign-in link goes to this address.
const adminEmail = process.env.ADMIN_EMAIL;
if (!adminEmail || !adminEmail.includes("@")) {
  console.error("Set ADMIN_EMAIL to your address, e.g.  ADMIN_EMAIL=you@example.org DOMAIN=study.example.org pnpm setup");
  process.exit(1);
}

const secret = (bytes = 32) => randomBytes(bytes).toString("base64url");
const domain = process.env.DOMAIN ?? "study.example.org";
const jwtSecret = secret(48);

// Auth signs user tokens with an EC key, so that the MCP server and others
// can check them against the public JWKS; the symmetric key stays for the
// service role the backend uses.
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const kid = randomUUID();
const jwtKeys = [
  { kty: "EC", kid, use: "sig", key_ops: ["sign", "verify"], alg: "ES256", ext: true, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d },
  { kty: "oct", k: Buffer.from(jwtSecret).toString("base64url"), alg: "HS256" },
];

function hs256(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  return `${data}.${createHmac("sha256", jwtSecret).update(data).digest("base64url")}`;
}
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600;

const values = {
  DOMAIN: domain,
  SITE_URL: process.env.SITE_URL ?? `https://${domain}`,
  API_EXTERNAL_URL: `${process.env.SITE_URL ?? `https://${domain}`}/auth/v1`,
  ADMIN_EMAIL: adminEmail,
  POSTGRES_PASSWORD: secret(24),
  POSTGRES_DB: "postgres",
  POSTGRES_PORT: "5432",
  JWT_SECRET: jwtSecret,
  JWT_EXPIRY: "900",
  JWT_KEYS: JSON.stringify(jwtKeys),
  ANON_KEY: hs256({ role: "anon", iss: "supabase", iat, exp }),
  SERVICE_ROLE_KEY: hs256({ role: "service_role", iss: "supabase", iat, exp }),
  // Encrypts what the app stores on behalf of users, such as API keys.
  APP_SECRET: secret(32),
  BACKUP_PASSPHRASE: secret(32),
  TZ: process.env.TZ ?? "Europe/Berlin",
  // Optional folders on the host for uploads and backups and for the database; without them
  // Docker keeps both in named volumes.
  ...(process.env.DATA_DIR ? { DATA_DIR: process.env.DATA_DIR } : {}),
  ...(process.env.DB_DIR ? { DB_DIR: process.env.DB_DIR } : {}),
  STUDIO_USERNAME: "admin",
  STUDIO_PASSWORD: secret(18),
};

const text =
  Object.entries(values)
    .map(([key, value]) => `${key}=${key === "JWT_KEYS" ? `'${value}'` : value}`)
    .join("\n") + "\n";
if (toStdout) {
  process.stdout.write(text);
} else {
  writeFileSync(target, text, { mode: 0o600 });
  console.log(`Wrote ${target}`);
}
