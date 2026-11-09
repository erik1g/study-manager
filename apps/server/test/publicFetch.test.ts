import { describe, expect, it } from "vitest";
import { isPrivateAddress, LinkNotAllowed, publicUrl } from "../src/text/publicFetch.ts";

const resolver = (map: Record<string, string[]>) =>
  (async (host: string) => (map[host] ?? []).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))) as never;

describe("links the server fetches for users", () => {
  it("knows private and special addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "192.168.1.1", "172.18.0.4", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ["1.1.1.1", "141.58.1.1", "2606:4700::1111", "172.32.0.1"]) expect(isPrivateAddress(ip)).toBe(false);
  });

  it("accepts https links to public addresses only", async () => {
    const dns = resolver({ "campus.example.org": ["141.58.1.1"], "router.example.org": ["192.168.1.1"], "auth": ["172.18.0.3"], "mixed.example.org": ["141.58.1.1", "10.0.0.1"] });
    await expect(publicUrl("https://campus.example.org/cal.ics", dns)).resolves.toBeInstanceOf(URL);
    for (const link of [
      "http://campus.example.org/cal.ics",
      "https://router.example.org/",
      "https://auth/",
      "https://mixed.example.org/",
      "https://192.168.1.1/",
      "https://[::1]/",
      "https://user:pw@campus.example.org/",
      "https://campus.example.org:8443/",
      "file:///etc/passwd",
      "https://unknown.example.org/",
    ]) {
      await expect(publicUrl(link, dns), link).rejects.toBeInstanceOf(LinkNotAllowed);
    }
  });
});
