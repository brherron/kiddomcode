import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it, vi } from "vitest";
import { Cause, Effect, Layer } from "effect";

import { JiraError } from "@t3tools/contracts";
import { JiraConfig } from "../Services/JiraConfig.ts";
import { JiraService } from "../Services/JiraService.ts";
import { JiraConfigLive } from "./JiraConfig.ts";
import { makeJiraService } from "./JiraService.ts";

const jiraConfigTestLayer = Layer.mergeAll(JiraConfigLive, NodeServices.layer);

function runGit(cwd: string, args: readonly string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
}

function createCommittedRepo(prefix: string) {
  const repoRoot = mkdtempSync(path.join(tmpdir(), prefix));
  runGit(repoRoot, ["init", "--initial-branch=main"]);
  runGit(repoRoot, ["config", "user.email", "test@example.com"]);
  runGit(repoRoot, ["config", "user.name", "Test User"]);
  writeFileSync(path.join(repoRoot, "README.md"), "hello\n");
  runGit(repoRoot, ["add", "README.md"]);
  runGit(repoRoot, ["commit", "-m", "Initial commit"]);
  return repoRoot;
}

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
  it("resolves the shared repo config path from a worktree cwd", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const repoRoot = createCommittedRepo("t3-jira-config-repo-");
        const worktreePath = path.join(tmpdir(), `t3-jira-worktree-${Date.now()}`);

        try {
          runGit(repoRoot, ["worktree", "add", worktreePath, "-b", "feature/jira-demo"]);
          writeFileSync(
            path.join(repoRoot, ".t3-jira-config.json"),
            JSON.stringify(exampleConfig, null, 2),
          );

          const result = yield* Effect.gen(function* () {
            const jiraConfig = yield* JiraConfig;
            return yield* jiraConfig.getConfigStatus(worktreePath);
          }).pipe(Effect.provide(jiraConfigTestLayer));

          expect(result.status).toBe("ready");
          expect(result.configPath).toMatch(/\.t3-jira-config\.json$/);
        } finally {
          rmSync(worktreePath, { recursive: true, force: true });
          rmSync(repoRoot, { recursive: true, force: true });
        }
      }),
    );
  });

  it("returns missing when the repo-local config file does not exist", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const repoRoot = createCommittedRepo("t3-jira-config-missing-");

        try {
          const result = yield* Effect.gen(function* () {
            const jiraConfig = yield* JiraConfig;
            return yield* jiraConfig.getConfigStatus(repoRoot);
          }).pipe(Effect.provide(jiraConfigTestLayer));

          expect(result).toEqual({
            status: "missing",
            configPath: path.join(repoRoot, ".t3-jira-config.json"),
          });
        } finally {
          rmSync(repoRoot, { recursive: true, force: true });
        }
      }),
    );
  });

  it("returns invalid with a parse message when the config file is malformed", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const repoRoot = createCommittedRepo("t3-jira-config-invalid-");

        try {
          writeFileSync(path.join(repoRoot, ".t3-jira-config.json"), "{not-json");

          const result = yield* Effect.gen(function* () {
            const jiraConfig = yield* JiraConfig;
            return yield* jiraConfig.getConfigStatus(repoRoot);
          }).pipe(Effect.provide(jiraConfigTestLayer));

          expect(result.status).toBe("invalid");
          expect(result.configPath).toBe(path.join(repoRoot, ".t3-jira-config.json"));
          expect(result.error).toContain("config");
        } finally {
          rmSync(repoRoot, { recursive: true, force: true });
        }
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
      Layer.provide(NodeServices.layer),
    );
  }

  it("lists active tasks with the expected JQL and minimal fields", async () => {
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
          expect(body.fields).toEqual(["summary", "status"]);

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
              },
              names: {
                customfield_12345: "Story Points",
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
          priorityName: "High",
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

  it("omits medium priority from issue detail", async () => {
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

        expect(result.issue.priorityName).toBeUndefined();
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
