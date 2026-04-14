import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Layer } from "effect";

import { JiraError } from "@t3tools/contracts";
import { JiraConfig } from "../Services/JiraConfig.ts";
import { JiraConnectionService } from "../Services/JiraConnectionService.ts";
import { JiraService } from "../Services/JiraService.ts";
import { JiraConfigLive } from "./JiraConfig.ts";
import { JiraConnectionServiceLive } from "./JiraConnectionService";
import { makeJiraService } from "./JiraService.ts";
import { ServerSettingsService } from "../../serverSettings";

const jiraConfigTestLayer = (overrides?: Parameters<typeof ServerSettingsService.layerTest>[0]) =>
  JiraConfigLive.pipe(
    Layer.provideMerge(
      JiraConnectionServiceLive.pipe(
        Layer.provide(ServerSettingsService.layerTest(overrides)),
        Layer.provide(NodeServices.layer),
      ),
    ),
    Layer.provideMerge(ServerSettingsService.layerTest(overrides)),
    Layer.provideMerge(NodeServices.layer),
  );

const exampleConfig = {
  baseUrl: "https://example.atlassian.net",
  email: "user@example.com",
  token: "jira-token",
  automations: {
    on_branch_created: {
      enabled: true,
      transitionId: "21",
    },
    on_pr_opened: {
      enabled: true,
      transitionId: "31",
    },
  },
};

describe("JiraConfigLive", () => {
  it("returns missing when the machine-level Jira connection has not been saved", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const jiraConfig = yield* JiraConfig;
          return yield* jiraConfig.getConfigStatus("/repo/worktree");
        }).pipe(Effect.provide(jiraConfigTestLayer()));

        expect(result.status).toBe("missing");
        expect(result.configPath).toContain("jira");
      }),
    );
  });

  it("returns ready when the machine-level Jira connection is present", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const jiraConfig = yield* JiraConfig;
          return yield* jiraConfig.getConfigStatus("/repo/worktree");
        }).pipe(
          Effect.provide(
            jiraConfigTestLayer({
              jira: {
                baseUrl: "https://example.atlassian.net",
                email: "user@example.com",
                token: "jira-token",
              },
            }),
          ),
        );

        expect(result.status).toBe("ready");
        expect(result.configPath).toContain("jira");
      }),
    );
  });

  it("returns invalid when the saved machine-level Jira connection is incomplete", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.gen(function* () {
          const jiraConfig = yield* JiraConfig;
          return yield* jiraConfig.getConfigStatus("/repo/worktree");
        }).pipe(
          Effect.provide(
            jiraConfigTestLayer({
              jira: {
                baseUrl: "https://example.atlassian.net",
                email: "",
                token: "jira-token",
              },
            }),
          ),
        );

        expect(result.status).toBe("invalid");
        expect(result.error).toContain("incomplete");
      }),
    );
  });
});

describe("JiraServiceLive", () => {
  const resolvedConfig = {
    configPath: "/repo/.t3-jira-config.json",
    ...exampleConfig,
  };

  const configLayer = Layer.succeed(JiraConfig, {
    getConfigStatus: () =>
      Effect.succeed({
        status: "ready" as const,
        configPath: resolvedConfig.configPath,
      }),
    getResolvedConfig: () => Effect.succeed(resolvedConfig),
  });

  function provideService(
    fetchImplementation: (input: string | URL, init?: RequestInit) => Promise<Response>,
  ) {
    return makeJiraService({ fetchImplementation }).pipe(
      Layer.provide(configLayer),
      Layer.provide(
        Layer.succeed(JiraConnectionService, {
          getConnectionStatus: () =>
            Effect.succeed({
              status: "ready" as const,
              hasToken: true,
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              defaults: {},
            }),
          saveConnection: () =>
            Effect.succeed({
              status: "ready" as const,
              hasToken: true,
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              defaults: {},
            }),
          testConnection: () =>
            Effect.succeed({
              status: "ready" as const,
              hasToken: true,
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              defaults: {},
            }),
          disconnect: () => Effect.succeed({ disconnected: true as const }),
          getResolvedConnection: () =>
            Effect.succeed({
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              token: resolvedConfig.token,
              defaults: {},
            }),
        }),
      ),
      Layer.provide(NodeServices.layer),
    );
  }

  it("lists active tasks with the expected JQL and issue type field", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          expect(url.pathname).toBe("/rest/api/3/search/jql");
          expect(init?.method).toBe("POST");
          const body = JSON.parse(init?.body as string);
          expect(body.jql).toBe(
            "assignee = currentUser() AND status != Done ORDER BY updated DESC",
          );
          expect(body.fields).toEqual(["summary", "status", "issuetype"]);

          return new Response(
            JSON.stringify({
              issues: [
                {
                  key: "WEB-101",
                  fields: {
                    summary: "Implement Jira panel",
                    status: {
                      name: "In Progress",
                      statusCategory: {
                        name: "In Progress",
                      },
                    },
                    issuetype: {
                      name: "Story",
                    },
                  },
                },
              ],
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.listActiveTasks("/repo/worktree");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          issues: [
            {
              key: "WEB-101",
              summary: "Implement Jira panel",
              statusName: "In Progress",
              statusCategoryName: "In Progress",
              issueTypeName: "Story",
            },
          ],
        });
      }),
    );
  });

  it("converts ADF descriptions and comments to markdown when loading issue detail", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          expect(url.searchParams.get("fields")).toBe("*all");
          expect(url.searchParams.get("expand")).toBe("names");
          return new Response(
            JSON.stringify({
              key: "WEB-101",
              fields: {
                summary: "Implement Jira panel",
                description: {
                  type: "doc",
                  version: 1,
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Ship " },
                        {
                          type: "text",
                          text: "Jira",
                          marks: [{ type: "strong" }],
                        },
                        { type: "text", text: " support" },
                      ],
                    },
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [{ type: "text", text: "Panel UI" }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
                status: {
                  name: "Selected for Development",
                  statusCategory: {
                    name: "To Do",
                  },
                },
                issuetype: {
                  name: "Story",
                },
                priority: {
                  name: "High",
                },
                labels: ["frontend", "customer-facing"],
                flagged: true,
                parent: {
                  key: "WEB-100",
                  fields: {
                    summary: "Parent ticket",
                  },
                },
                comment: {
                  comments: [
                    {
                      id: "10001",
                      created: "2026-04-10T16:00:00.000Z",
                      author: {
                        displayName: "Reviewer One",
                      },
                      body: {
                        type: "doc",
                        version: 1,
                        content: [
                          {
                            type: "paragraph",
                            content: [{ type: "text", text: "Looks good." }],
                          },
                        ],
                      },
                    },
                  ],
                },
                customfield_12345: 5,
                customfield_10040: {
                  self: "https://example.atlassian.net/rest/api/3/customFieldOption/10040",
                  value: "ACV $1M+",
                  id: "10040",
                },
              },
              names: {
                customfield_12345: "Story Points",
                customfield_10040: "ACV",
              },
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueDetail("/repo/worktree", "WEB-101");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.issue).toMatchObject({
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "Selected for Development",
          statusCategoryName: "To Do",
          issueTypeName: "Story",
          acv: "ACV $1M+",
          priorityName: "High",
          labels: ["frontend", "customer-facing"],
          isFlagged: true,
          parentKey: "WEB-100",
          parentSummary: "Parent ticket",
          storyPoints: 5,
          url: "https://example.atlassian.net/browse/WEB-101",
        });
        expect(result.issue.descriptionMarkdown).toContain("**Jira**");
        expect(result.issue.descriptionMarkdown).toContain("- Panel UI");
        expect(result.issue.comments).toEqual([
          {
            id: "10001",
            authorDisplayName: "Reviewer One",
            bodyMarkdown: "Looks good.",
            createdAt: "2026-04-10T16:00:00.000Z",
          },
        ]);
      }),
    );
  });

  it("preserves medium priority in issue detail", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          expect(url.searchParams.get("fields")).toBe("*all");
          expect(url.searchParams.get("expand")).toBe("names");
          return new Response(
            JSON.stringify({
              key: "WEB-101",
              fields: {
                summary: "Implement Jira panel",
                description: null,
                status: {
                  name: "In Progress",
                },
                issuetype: {
                  name: "Task",
                },
                priority: {
                  name: "Medium",
                },
                comment: {
                  comments: [],
                },
                names: {},
              },
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueDetail("/repo/worktree", "WEB-101");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.issue.priorityName).toBe("Medium");
      }),
    );
  });

  it("normalizes direct subtasks and supported issue links into related issues", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async () => {
          return new Response(
            JSON.stringify({
              key: "WEB-101",
              fields: {
                summary: "Implement Jira panel",
                description: null,
                status: {
                  name: "In Progress",
                  statusCategory: {
                    name: "In Progress",
                  },
                },
                issuetype: {
                  name: "Task",
                },
                comment: {
                  comments: [],
                },
                labels: [],
                subtasks: [
                  {
                    key: "WEB-102",
                    fields: {
                      summary: "Follow-up task",
                      status: {
                        name: "In Progress",
                        statusCategory: {
                          name: "In Progress",
                        },
                      },
                      issuetype: {
                        name: "Sub-task",
                      },
                    },
                  },
                ],
                issuelinks: [
                  {
                    type: {
                      name: "Relates",
                    },
                    outwardIssue: {
                      key: "WEB-103",
                      fields: {
                        summary: "Shared dependency",
                        status: {
                          name: "To Do",
                          statusCategory: {
                            name: "To Do",
                          },
                        },
                        issuetype: {
                          name: "Task",
                        },
                      },
                    },
                  },
                  {
                    type: {
                      name: "Duplicate",
                    },
                    outwardIssue: {
                      key: "WEB-104",
                      fields: {
                        summary: "Legacy duplicate",
                        status: {
                          name: "Done",
                          statusCategory: {
                            name: "Done",
                          },
                        },
                        issuetype: {
                          name: "Bug",
                        },
                      },
                    },
                  },
                  {
                    type: {
                      name: "Duplicate",
                    },
                    inwardIssue: {
                      key: "WEB-105",
                      fields: {
                        summary: "Canonical tracker",
                        status: {
                          name: "In Progress",
                          statusCategory: {
                            name: "In Progress",
                          },
                        },
                        issuetype: {
                          name: "Story",
                        },
                      },
                    },
                  },
                ],
              },
              names: {},
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueDetail("/repo/worktree", "WEB-101");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.issue.relatedIssues).toEqual([
          {
            key: "WEB-102",
            summary: "Follow-up task",
            issueTypeName: "Sub-task",
            statusName: "In Progress",
            statusCategoryName: "In Progress",
            relationshipLabel: "Sub-task",
          },
          {
            key: "WEB-103",
            summary: "Shared dependency",
            issueTypeName: "Task",
            statusName: "To Do",
            statusCategoryName: "To Do",
            relationshipLabel: "Relates to",
          },
          {
            key: "WEB-104",
            summary: "Legacy duplicate",
            issueTypeName: "Bug",
            statusName: "Done",
            statusCategoryName: "Done",
            relationshipLabel: "Duplicates",
          },
          {
            key: "WEB-105",
            summary: "Canonical tracker",
            issueTypeName: "Story",
            statusName: "In Progress",
            statusCategoryName: "In Progress",
            relationshipLabel: "Is duplicated by",
          },
        ]);
      }),
    );
  });

  it("preserves custom jira directional link labels in related issues", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async () => {
          return new Response(
            JSON.stringify({
              key: "CURR-3028",
              fields: {
                summary: "Math keyboard updates",
                description: null,
                status: {
                  name: "In Progress",
                  statusCategory: {
                    name: "In Progress",
                  },
                },
                issuetype: {
                  name: "Task",
                },
                comment: {
                  comments: [],
                },
                labels: [],
                subtasks: [],
                issuelinks: [
                  {
                    type: {
                      name: "Polaris datapoint work item link",
                      inward: "added to idea",
                      outward: "is idea for",
                    },
                    outwardIssue: {
                      key: "CURR-3048",
                      fields: {
                        summary: "Testing",
                        status: {
                          name: "To Do",
                          statusCategory: {
                            name: "To Do",
                          },
                        },
                        issuetype: {
                          name: "Task",
                        },
                      },
                    },
                  },
                ],
              },
              names: {},
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueDetail("/repo/worktree", "CURR-3028");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.issue.relatedIssues).toEqual([
          {
            key: "CURR-3048",
            summary: "Testing",
            issueTypeName: "Task",
            statusName: "To Do",
            statusCategoryName: "To Do",
            relationshipLabel: "Is idea for",
          },
        ]);
      }),
    );
  });

  it("defaults missing priority to medium in issue detail", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async () => {
          return new Response(
            JSON.stringify({
              key: "WEB-101",
              fields: {
                summary: "Implement Jira panel",
                description: null,
                status: {
                  name: "In Progress",
                  statusCategory: {
                    name: "In Progress",
                  },
                },
                issuetype: {
                  name: "Task",
                },
                comment: {
                  comments: [],
                },
                labels: [],
              },
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueDetail("/repo/worktree", "WEB-101");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.issue.priorityName).toBe("Medium");
      }),
    );
  });

  it("skips disabled automations without commenting or transitioning", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async () => new Response("{}"));
        const disabledConfigLayer = Layer.succeed(JiraConfig, {
          getConfigStatus: () =>
            Effect.succeed({
              status: "ready" as const,
              configPath: resolvedConfig.configPath,
            }),
          getResolvedConfig: () =>
            Effect.succeed({
              ...resolvedConfig,
              automations: {
                on_branch_created: {
                  enabled: false,
                },
              },
            }),
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.runAutomation({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
            automation: "on_branch_created",
          });
        }).pipe(
          Effect.provide(
            makeJiraService({ fetchImplementation: fetchSpy }).pipe(
              Layer.provide(disabledConfigLayer),
              Layer.provide(
                Layer.succeed(JiraConnectionService, {
                  getConnectionStatus: () =>
                    Effect.succeed({
                      status: "ready" as const,
                      hasToken: true,
                      baseUrl: resolvedConfig.baseUrl,
                      email: resolvedConfig.email,
                      defaults: {},
                    }),
                  saveConnection: () =>
                    Effect.succeed({
                      status: "ready" as const,
                      hasToken: true,
                      baseUrl: resolvedConfig.baseUrl,
                      email: resolvedConfig.email,
                      defaults: {},
                    }),
                  testConnection: () =>
                    Effect.succeed({
                      status: "ready" as const,
                      hasToken: true,
                      baseUrl: resolvedConfig.baseUrl,
                      email: resolvedConfig.email,
                      defaults: {},
                    }),
                  disconnect: () => Effect.succeed({ disconnected: true as const }),
                  getResolvedConnection: () =>
                    Effect.succeed({
                      baseUrl: resolvedConfig.baseUrl,
                      email: resolvedConfig.email,
                      token: resolvedConfig.token,
                      defaults: {},
                    }),
                }),
              ),
              Layer.provide(NodeServices.layer),
            ),
          ),
        );

        expect(result).toEqual({
          issueKey: "WEB-101",
          automation: "on_branch_created",
          transitionAttempted: false,
          transitionApplied: false,
          commentAdded: false,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
      }),
    );
  });

  it("adds a comment and transitions when the automation is enabled", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (_input: string | URL, init?: RequestInit) => {
          if (String(_input).includes("/comment")) {
            expect(init?.method).toBe("POST");
            expect(init?.body).toContain("Opened PR:");
            return new Response(JSON.stringify({ id: "comment-1" }), { status: 201 });
          }
          if (String(_input).includes("/transitions")) {
            expect(init?.method).toBe("POST");
            expect(init?.body).toContain('"id":"31"');
            return new Response(null, { status: 204 });
          }
          throw new Error(`Unexpected URL: ${String(_input)}`);
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.runAutomation({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
            automation: "on_pr_opened",
            commentText: "Opened PR: https://github.com/acme/repo/pull/10",
          });
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          issueKey: "WEB-101",
          automation: "on_pr_opened",
          transitionAttempted: true,
          transitionApplied: true,
          commentAdded: true,
        });
      }),
    );
  });

  it("maps Jira HTTP failures to JiraError", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async () => {
          return new Response(JSON.stringify({ errorMessages: ["Unauthorized"] }), {
            status: 401,
          });
        });

        const exit = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.listActiveTasks("/repo/worktree");
        }).pipe(Effect.provide(provideService(fetchSpy)), Effect.exit);

        expect(exit._tag).toBe("Failure");
        if (exit._tag === "Failure") {
          const failure = Cause.squash(exit.cause);
          expect(failure).toBeInstanceOf(JiraError);
          expect((failure as JiraError).kind).toBe("auth");
        }
      }),
    );
  });
});
