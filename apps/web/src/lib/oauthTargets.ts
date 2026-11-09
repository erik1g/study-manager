// Where an app may send someone back after they allowed it access to the
// Study Manager: Claude on the web, and Claude Code on the user's own machine.
// A look-alike app with another target is turned away before anyone can allow it.

const HOSTS = ["claude.ai", "claude.com"];
const LOOPBACK = ["localhost", "127.0.0.1", "[::1]"];

export function isAllowedRedirect(target: string | undefined): boolean {
  if (!target) return false;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === "https:" && HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return true;
  return url.protocol === "http:" && LOOPBACK.includes(url.hostname);
}
