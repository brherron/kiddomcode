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
    const defaults = {
      boardId: "23",
      projectKey: "WEB",
    };

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
              defaults,
            }),
          saveConnection: () =>
            Effect.succeed({
              status: "ready" as const,
              hasToken: true,
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              defaults,
            }),
          testConnection: () =>
            Effect.succeed({
              status: "ready" as const,
              hasToken: true,
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              defaults,
            }),
          disconnect: () => Effect.succeed({ disconnected: true as const }),
          getResolvedConnection: () =>
            Effect.succeed({
              baseUrl: resolvedConfig.baseUrl,
              email: resolvedConfig.email,
              token: resolvedConfig.token,
              defaults,
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

  it("loads board edit metadata from the board config, project statuses, and issue edit meta", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          if (url.pathname === "/rest/agile/1.0/board/23/configuration") {
            return new Response(
              JSON.stringify({
                id: 23,
                name: "Board",
                columnConfig: {
                  columns: [
                    {
                      name: "In Progress",
                      statuses: [
                        {
                          id: "10000",
                          self: "https://example.atlassian.net/rest/api/3/status/10000",
                        },
                      ],
                    },
                    {
                      name: "Done",
                      statuses: [
                        { id: "5", self: "https://example.atlassian.net/rest/api/3/status/5" },
                      ],
                    },
                  ],
                },
                estimation: {
                  type: "field",
                  field: {
                    displayName: "Story Points",
                    fieldId: "customfield_10002",
                  },
                },
                location: {
                  key: "WEB",
                },
              }),
            );
          }

          if (url.pathname === "/rest/api/3/project/WEB/statuses") {
            return new Response(
              JSON.stringify([
                {
                  id: "3",
                  name: "Task",
                  statuses: [
                    {
                      id: "10000",
                      name: "In Progress",
                      statusCategory: "IN_PROGRESS",
                    },
                    {
                      id: "5",
                      name: "Done",
                      statusCategory: "DONE",
                    },
                  ],
                },
              ]),
            );
          }

          if (url.pathname === "/rest/api/3/issue/WEB-101/editmeta") {
            return new Response(
              JSON.stringify({
                fields: {
                  customfield_10002: {
                    name: "Story Points",
                  },
                },
              }),
            );
          }

          throw new Error(`Unexpected URL: ${url.pathname}`);
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueEditMetadata({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
          });
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          boardId: "23",
          boardName: "Board",
          projectKey: "WEB",
          storyPointsFieldId: "customfield_10002",
          statuses: [
            {
              id: "10000",
              name: "In Progress",
              statusCategoryName: "IN_PROGRESS",
            },
            {
              id: "5",
              name: "Done",
              statusCategoryName: "DONE",
            },
          ],
        });
      }),
    );
  });

  it("falls back to issue names when edit meta omits the story points field name", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          if (url.pathname === "/rest/agile/1.0/board/23/configuration") {
            return new Response(
              JSON.stringify({
                id: 23,
                name: "Board",
                columnConfig: {
                  columns: [],
                },
                location: {
                  key: "WEB",
                },
              }),
            );
          }

          if (url.pathname === "/rest/api/3/project/WEB/statuses") {
            return new Response(JSON.stringify([]));
          }

          if (url.pathname === "/rest/api/3/issue/WEB-101/editmeta") {
            return new Response(
              JSON.stringify({
                fields: {
                  customfield_10002: {},
                },
              }),
            );
          }

          if (url.pathname === "/rest/api/3/issue/WEB-101") {
            expect(url.searchParams.get("fields")).toBe("summary");
            expect(url.searchParams.get("expand")).toBe("names");
            return new Response(
              JSON.stringify({
                names: {
                  customfield_10002: "Story Points",
                },
              }),
            );
          }

          throw new Error(`Unexpected URL: ${url.pathname}`);
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueEditMetadata({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
          });
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result.storyPointsFieldId).toBe("customfield_10002");
      }),
    );
  });

  it("loads issue transitions for the selected ticket", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          expect(url.pathname).toBe("/rest/api/3/issue/WEB-101/transitions");
          return new Response(
            JSON.stringify({
              transitions: [
                {
                  id: "11",
                  name: "Start Progress",
                  to: {
                    id: "10000",
                    name: "In Progress",
                    statusCategory: {
                      name: "In Progress",
                    },
                  },
                },
                {
                  id: "21",
                  name: "Finish",
                  to: {
                    id: "5",
                    name: "Done",
                    statusCategory: {
                      name: "Done",
                    },
                  },
                },
              ],
            }),
          );
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.getIssueTransitions("/repo/worktree", "WEB-101");
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          issueKey: "WEB-101",
          transitions: [
            {
              id: "11",
              name: "Start Progress",
              toStatusId: "10000",
              toStatusName: "In Progress",
              toStatusCategoryName: "In Progress",
            },
            {
              id: "21",
              name: "Finish",
              toStatusId: "5",
              toStatusName: "Done",
              toStatusCategoryName: "Done",
            },
          ],
        });
      }),
    );
  });

  it("updates issue status through a transition id", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          expect(url.pathname).toBe("/rest/api/3/issue/WEB-101/transitions");
          expect(init?.method).toBe("POST");
          expect(init?.body).toContain('"id":"11"');
          return new Response(null, { status: 204 });
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.updateIssueStatus({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
            transitionId: "11",
          });
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          issueKey: "WEB-101",
          transitionId: "11",
        });
      }),
    );
  });

  it("updates issue story points through the board estimation field", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const fetchSpy = vi.fn(async (input: string | URL, init?: RequestInit) => {
          const url = new URL(typeof input === "string" ? input : input.toString());
          if (url.pathname === "/rest/api/3/issue/WEB-101/editmeta") {
            return new Response(
              JSON.stringify({
                fields: {
                  customfield_10002: {
                    name: "Story Points",
                  },
                },
              }),
            );
          }

          expect(url.pathname).toBe("/rest/api/3/issue/WEB-101");
          expect(init?.method).toBe("PUT");
          expect(init?.body).toContain('"customfield_10002":8');
          return new Response(null, { status: 204 });
        });

        const result = yield* Effect.gen(function* () {
          const jiraService = yield* JiraService;
          return yield* jiraService.updateIssueStoryPoints({
            cwd: "/repo/worktree",
            issueKey: "WEB-101",
            storyPoints: 8,
          });
        }).pipe(Effect.provide(provideService(fetchSpy)));

        expect(result).toEqual({
          issueKey: "WEB-101",
          storyPoints: 8,
        });
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
