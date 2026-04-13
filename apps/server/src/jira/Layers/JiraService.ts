import { Buffer } from "node:buffer";

import { Effect, Layer } from "effect";

import {
  JiraError,
  type JiraGetIssueDetailResult,
  type JiraIssueComment,
  type JiraIssueDetail,
  type JiraIssueSummary,
  type JiraListActiveTasksResult,
  type JiraRunAutomationInput,
  type JiraRunAutomationResult,
} from "@t3tools/contracts";
import { adfToMarkdown } from "../adfToMarkdown.ts";
import { JiraConfig } from "../Services/JiraConfig.ts";
import { JiraService } from "../Services/JiraService.ts";

const ACTIVE_TASK_JQL = "assignee = currentUser() AND status != Done ORDER BY updated DESC";
const ACTIVE_TASK_MAX_RESULTS = 25;
const RECENT_COMMENT_LIMIT = 10;

function toErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message.length > 0 ? cause.message : fallback;
}

function buildAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

function mapIssueSummary(issue: any): JiraIssueSummary {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    statusName: issue.fields.status.name,
    ...(issue.fields.status.statusCategory?.name
      ? { statusCategoryName: issue.fields.status.statusCategory.name }
      : {}),
  };
}

function mapIssueDetail(issue: any, baseUrl: string): JiraIssueDetail {
  const comments: JiraIssueComment[] = Array.isArray(issue.fields.comment?.comments)
    ? [...issue.fields.comment.comments]
        .toSorted((left, right) => String(right.created).localeCompare(String(left.created)))
        .slice(0, RECENT_COMMENT_LIMIT)
        .map((comment) => ({
          id: String(comment.id),
          authorDisplayName: comment.author?.displayName ?? "Unknown user",
          bodyMarkdown: adfToMarkdown(comment.body),
          createdAt: String(comment.created),
        }))
    : [];
  const priorityName =
    issue.fields.priority?.name === "High" || issue.fields.priority?.name === "Low"
      ? issue.fields.priority.name
      : undefined;
  const parent = issue.fields.parent;
  const storyPointsFieldId = Object.entries(issue.names ?? {}).find(
    ([, name]) =>
      typeof name === "string" &&
      /story points?|story point estimate/i.test(name.trim()),
  )?.[0];
  const storyPointsValue =
    storyPointsFieldId && typeof issue.fields[storyPointsFieldId] === "number"
      ? issue.fields[storyPointsFieldId]
      : undefined;

  return {
    key: issue.key,
    summary: issue.fields.summary,
    statusName: issue.fields.status.name,
    ...(issue.fields.status.statusCategory?.name
      ? { statusCategoryName: issue.fields.status.statusCategory.name }
      : {}),
    issueTypeName: issue.fields.issuetype?.name ?? "Issue",
    ...(priorityName ? { priorityName } : {}),
    isFlagged: Boolean(issue.fields.flagged),
    ...(parent?.key ? { parentKey: String(parent.key) } : {}),
    ...(parent?.fields?.summary ? { parentSummary: String(parent.fields.summary) } : {}),
    ...(typeof storyPointsValue === "number" ? { storyPoints: storyPointsValue } : {}),
    descriptionMarkdown: adfToMarkdown(issue.fields.description),
    comments,
    url: `${baseUrl}/browse/${issue.key}`,
  };
}

function decodeSearchResponse(payload: any): JiraListActiveTasksResult {
  return {
    issues: Array.isArray(payload?.issues) ? payload.issues.map(mapIssueSummary) : [],
  };
}

function decodeIssueResponse(payload: any, baseUrl: string): JiraGetIssueDetailResult {
  return {
    issue: mapIssueDetail(payload, baseUrl),
  };
}

interface JiraRequestOptions {
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  readonly errorKind?: "fetch" | "automation";
}

type JiraFetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

export const makeJiraService = (options?: {
  readonly fetchImplementation?: JiraFetchImplementation;
}) =>
  Layer.effect(
    JiraService,
    Effect.gen(function* () {
      const jiraConfig = yield* JiraConfig;
      const fetchImplementation: JiraFetchImplementation =
        options?.fetchImplementation ?? ((input, init) => globalThis.fetch(input, init));

      const request = Effect.fn("JiraService.request")(function* (
        cwd: string,
        requestPath: string,
        operation: string,
        requestOptions?: JiraRequestOptions,
      ) {
        const config = yield* jiraConfig.getResolvedConfig(cwd);
        const url = new URL(requestPath, `${config.baseUrl}/`);

        const response = yield* Effect.tryPromise({
          try: () =>
            fetchImplementation(url.toString(), {
              method: requestOptions?.method ?? "GET",
              headers: {
                authorization: buildAuthHeader(config.email, config.token),
                accept: "application/json",
                ...(requestOptions?.body ? { "content-type": "application/json" } : {}),
              },
              ...(requestOptions?.body ? { body: JSON.stringify(requestOptions.body) } : {}),
            }),
          catch: (cause) =>
            new JiraError({
              kind: requestOptions?.errorKind ?? "fetch",
              operation,
              message: "Failed to reach Jira.",
              cause,
            }),
        });

        if (!response.ok) {
          let detail = `Jira request failed with status ${response.status}.`;
          const text = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => "",
          }).pipe(Effect.orElseSucceed(() => ""));
          if (text.trim().length > 0) {
            detail = text.trim();
          }

          return yield* new JiraError({
            kind:
              response.status === 401 || response.status === 403
                ? "auth"
                : (requestOptions?.errorKind ?? "fetch"),
            operation,
            message: detail,
            statusCode: response.status,
          });
        }

        if (response.status === 204) {
          return {
            config,
            payload: null,
          };
        }

        const payload = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) =>
            new JiraError({
              kind: "decode",
              operation,
              message: "Failed to decode Jira response JSON.",
              cause,
            }),
        });

        return {
          config,
          payload,
        };
      });

      return {
        getConfigStatus: (cwd: string) => jiraConfig.getConfigStatus(cwd),
        listActiveTasks: (cwd: string) =>
          Effect.gen(function* () {
            const { payload } = yield* request(
              cwd,
              "/rest/api/3/search/jql",
              "jira.listActiveTasks",
              {
                method: "POST",
                body: {
                  jql: ACTIVE_TASK_JQL,
                  fields: ["summary", "status"],
                  maxResults: ACTIVE_TASK_MAX_RESULTS,
                },
              },
            );
            return yield* Effect.try({
              try: () => decodeSearchResponse(payload),
              catch: (cause) =>
                new JiraError({
                  kind: "decode",
                  operation: "jira.listActiveTasks",
                  message: toErrorMessage(cause, "Failed to decode Jira issue search payload."),
                  cause,
                }),
            });
          }),
        getIssueDetail: (cwd: string, issueKey: string) =>
          Effect.gen(function* () {
            const issueUrl = new URL(
              `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
              "https://jira.local",
            );
            issueUrl.searchParams.set(
              "fields",
              "*all",
            );
            issueUrl.searchParams.set("expand", "names");
            const { config, payload } = yield* request(
              cwd,
              issueUrl.pathname + issueUrl.search,
              "jira.getIssueDetail",
            );
            return yield* Effect.try({
              try: () => decodeIssueResponse(payload, config.baseUrl),
              catch: (cause) =>
                new JiraError({
                  kind: "decode",
                  operation: "jira.getIssueDetail",
                  message: toErrorMessage(cause, "Failed to decode Jira issue detail payload."),
                  cause,
                }),
            });
          }),
        runAutomation: (input: JiraRunAutomationInput) =>
          Effect.gen(function* () {
            const config = yield* jiraConfig.getResolvedConfig(input.cwd);
            const automation = config.automations[input.automation];

            if (!automation?.enabled) {
              return {
                issueKey: input.issueKey,
                automation: input.automation,
                transitionAttempted: false,
                transitionApplied: false,
                commentAdded: false,
              } satisfies JiraRunAutomationResult;
            }

            let commentAdded = false;
            if (input.commentText) {
              const commentUrl = `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}/comment`;
              commentAdded = yield* Effect.gen(function* () {
                yield* request(input.cwd, commentUrl, "jira.runAutomation.comment", {
                  method: "POST",
                  body: {
                    body: {
                      type: "doc",
                      version: 1,
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: input.commentText }],
                        },
                      ],
                    },
                  },
                  errorKind: "automation",
                });
                return true;
              }).pipe(Effect.orElseSucceed(() => false));
            }

            const transitionAttempted = typeof automation.transitionId === "string";
            let transitionApplied = false;
            if (transitionAttempted) {
              const transitionUrl = `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}/transitions`;
              transitionApplied = yield* Effect.gen(function* () {
                yield* request(input.cwd, transitionUrl, "jira.runAutomation.transition", {
                  method: "POST",
                  body: {
                    transition: {
                      id: automation.transitionId,
                    },
                  },
                  errorKind: "automation",
                });
                return true;
              }).pipe(Effect.orElseSucceed(() => false));
            }

            return {
              issueKey: input.issueKey,
              automation: input.automation,
              transitionAttempted,
              transitionApplied,
              commentAdded,
            } satisfies JiraRunAutomationResult;
          }),
      };
    }),
  );

export const JiraServiceLive = makeJiraService();
