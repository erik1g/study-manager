import { describe, expect, it } from "vitest";
import { isAllowedRedirect } from "./oauthTargets";

describe("where an app may send someone back", () => {
  it("allows Claude on the web and Claude Code on the own machine", () => {
    for (const ok of ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback", "https://app.claude.ai/x", "http://localhost:54123/callback", "http://127.0.0.1:3000/cb"]) {
      expect(isAllowedRedirect(ok), ok).toBe(true);
    }
  });
  it("refuses everything else", () => {
    for (const bad of [undefined, "", "http://claude.ai/cb", "https://claude.ai.evil.example/cb", "https://evilclaude.ai/cb", "https://user@claude.ai/cb", "https://example.org/cb", "javascript:alert(1)", "http://localhost.evil.example/cb", "http://192.168.1.1/cb"]) {
      expect(isAllowedRedirect(bad), String(bad)).toBe(false);
    }
  });
});
