// Fetching what a user names by link (calendar subscriptions) without letting
// the link lead into the server's own network: only https, only public
// addresses, every redirect checked again, and a limit on the size.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 5;

export class LinkNotAllowed extends Error {}

/** Whether an address belongs to a private, local or otherwise special network. */
export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]!);
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

/** The link as a URL, if it is https and every address its name stands for is public. */
export async function publicUrl(link: string, resolve = lookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new LinkNotAllowed("Das ist kein gültiger Link.");
  }
  if (url.protocol !== "https:") throw new LinkNotAllowed("Nur https-Links sind erlaubt.");
  if (url.username || url.password) throw new LinkNotAllowed("Links mit Zugangsdaten sind nicht erlaubt.");
  if (url.port && url.port !== "443") throw new LinkNotAllowed("Nur der übliche https-Port ist erlaubt.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await resolve(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new LinkNotAllowed("Die Adresse ist nicht erreichbar.");
  if (addresses.some(isPrivateAddress)) throw new LinkNotAllowed("Links ins lokale Netz sind nicht erlaubt.");
  return url;
}

/** The text behind a public https link, following at most a few checked redirects. */
export async function fetchPublicText(link: string, options: { maxBytes?: number; timeoutMs?: number } = {}): Promise<string> {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 20_000);
  let url = await publicUrl(link);
  for (let hop = 0; ; hop++) {
    const response = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": "Study Manager" } });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next || hop >= MAX_REDIRECTS) throw new Error(`HTTP ${response.status}`);
      url = await publicUrl(new URL(next, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) return "";
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error("Die Antwort ist zu groß.");
      }
      parts.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(parts));
  }
}
