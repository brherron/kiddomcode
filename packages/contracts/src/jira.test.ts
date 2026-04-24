import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  JiraConnectionStatusResult,
  JiraSaveConnectionInput,
  JiraTestConnectionInput,
} from "./jira";

const decodeJiraConnectionStatusResult = Schema.decodeUnknownSync(JiraConnectionStatusResult);
const decodeJiraSaveConnectionInput = Schema.decodeUnknownSync(JiraSaveConnectionInput);
const decodeJiraTestConnectionInput = Schema.decodeUnknownSync(JiraTestConnectionInput);

describe("JiraConnectionStatusResult", () => {
  it("decodes masked machine-level Jira status without exposing the raw token", () => {
    const parsed = decodeJiraConnectionStatusResult({
      status: "ready",
      hasToken: true,
      baseUrl: "https://example.atlassian.net",
      email: "user@example.com",
      defaults: {
        projectKey: "WEB",
        filterId: "10010",
      },
      lastValidatedAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
      token: "should-not-be-present",
    });

    expect(parsed.status).toBe("ready");
    expect(parsed.hasToken).toBe(true);
    expect(parsed.defaults.projectKey).toBe("WEB");
    expect("token" in parsed).toBe(false);
  });
});

describe("JiraSaveConnectionInput", () => {
  it("accepts credentials and optional onboarding defaults", () => {
    const parsed = decodeJiraSaveConnectionInput({
      baseUrl: "https://example.atlassian.net",
      email: "user@example.com",
      token: "jira-token",
      defaults: {
        projectKey: "WEB",
        boardId: "23",
        jql: "assignee = currentUser() ORDER BY updated DESC",
      },
    });

    expect(parsed.baseUrl).toBe("https://example.atlassian.net");
    expect(parsed.defaults?.boardId).toBe("23");
  });
});

describe("JiraTestConnectionInput", () => {
  it("accepts the same payload as save without requiring persistence", () => {
    const parsed = decodeJiraTestConnectionInput({
      baseUrl: "https://example.atlassian.net",
      email: "user@example.com",
      token: "jira-token",
    });

    expect(parsed.email).toBe("user@example.com");
    expect(parsed.token).toBe("jira-token");
  });
});
