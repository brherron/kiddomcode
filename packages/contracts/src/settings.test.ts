import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ServerSettings } from "./settings";

const decodeServerSettings = Schema.decodeUnknownSync(ServerSettings);

describe("ServerSettings", () => {
  it("decodes a machine-level Jira settings block", () => {
    const parsed = decodeServerSettings({
      jira: {
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        token: "jira-token",
        defaults: {
          projectKey: "WEB",
          filterId: "10010",
        },
      },
    });

    expect(parsed.jira.baseUrl).toBe("https://example.atlassian.net");
    expect(parsed.jira.defaults.filterId).toBe("10010");
  });

  it("defaults the Jira settings block when missing", () => {
    const parsed = decodeServerSettings({});

    expect(parsed.jira.baseUrl).toBe("");
    expect(parsed.jira.email).toBe("");
    expect(parsed.jira.token).toBe("");
    expect(parsed.jira.defaults).toEqual({});
  });
});
