import { Buffer } from "node:buffer";

import { Effect, Layer } from "effect";

import {
  JiraError,
  type JiraGetIssueEditMetadataInput,
  type JiraIssueEditMetadataResult,
  type JiraIssueEditStatus,
  type JiraGetIssueDetailResult,
  type JiraIssueTransition,
  type JiraIssueTransitionsResult,
  type JiraIssueComment,
  type JiraIssueDetail,
  type JiraRelatedIssue,
  type JiraIssueSummary,
  type JiraListActiveTasksResult,
  type JiraRunAutomationInput,
  type JiraRunAutomationResult,
  type JiraUpdateIssueStatusInput,
  type JiraUpdateIssueStatusResult,
  type JiraUpdateIssueStoryPointsInput,
  type JiraUpdateIssueStoryPointsResult,
} from "@t3tools/contracts";
import { adfToMarkdown } from "../adfToMarkdown.ts";
import { JiraConfig } from "../Services/JiraConfig.ts";
import { JiraConnectionService } from "../Services/JiraConnectionService.ts";
import { JiraService } from "../Services/JiraService.ts";

const ACTIVE_TASK_JQL = "assignee = currentUser() AND status != Done ORDER BY updated DESC";
const ACTIVE_TASK_MAX_RESULTS = 25;
const RECENT_COMMENT_LIMIT = 10;
const ACV_FIELD_ID = "customfield_10040";

type JiraBoardConfiguration = {
  readonly id?: string | number;
  readonly name?: string;
  readonly columnConfig?: {
    readonly columns?: ReadonlyArray<{
      readonly name?: string;
      readonly statuses?: ReadonlyArray<{
        readonly id?: string | number;
      }>;
    }>;
  };
  readonly estimation?: {
    readonly type?: string;
    readonly field?: {
      readonly fieldId?: string;
    };
  };
  readonly location?: {
    readonly key?: string;
  };
};

type JiraProjectStatusesResponse = ReadonlyArray<{
  readonly id?: string | number;
  readonly name?: string;
  readonly statuses?: ReadonlyArray<{
    readonly id?: string | number;
    readonly name?: string;
    readonly statusCategory?:
      | string
      | {
          readonly name?: string;
        };
  }>;
}>;

type JiraIssueTransitionsResponse = {
  readonly transitions?: ReadonlyArray<{
    readonly id?: string | number;
    readonly name?: string;
    readonly to?: {
      readonly id?: string | number;
      readonly name?: string;
      readonly statusCategory?:
        | string
        | {
            readonly name?: string;
          };
    };
  }>;
};

type JiraIssueEditMetadataResponse = {
  readonly fields?: Record<
    string,
    {
      readonly name?: string;
      readonly schema?: {
        readonly type?: string;
        readonly custom?: string;
      };
    }
  >;
};

type JiraIssueNamesResponse = {
  readonly names?: Record<string, string>;
};

type JiraBoardsResponse = {
  readonly values?: ReadonlyArray<{
    readonly id?: string | number;
    readonly name?: string;
    readonly type?: string;
  }>;
};

const STORY_POINTS_FIELD_NAME_PATTERN = /story points?|story point estimate/i;

function getProjectKeyFromIssueKey(issueKey: string): string | undefined {
  const normalized = issueKey.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  const projectKey = normalized.split("-", 1)[0]?.trim();
  return projectKey && projectKey.length > 0 ? projectKey : undefined;
}

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
    issueTypeName: issue.fields.issuetype?.name ?? "Issue",
  };
}

function mapRelatedIssue(issue: any, relationshipLabel: string): JiraRelatedIssue | undefined {
  const key = typeof issue?.key === "string" ? issue.key : undefined;
  const summary = typeof issue?.fields?.summary === "string" ? issue.fields.summary : undefined;
  const statusName =
    typeof issue?.fields?.status?.name === "string" ? issue.fields.status.name : undefined;

  if (!key || !summary || !statusName || relationshipLabel.trim().length === 0) {
    return undefined;
  }

  return {
    key,
    summary,
    statusName,
    ...(typeof issue.fields.status.statusCategory?.name === "string"
      ? { statusCategoryName: issue.fields.status.statusCategory.name }
      : {}),
    issueTypeName:
      typeof issue?.fields?.issuetype?.name === "string" ? issue.fields.issuetype.name : "Issue",
    relationshipLabel,
  };
}

function formatRelationshipLabel(label: string): string {
  const trimmedLabel = label.trim();
  if (trimmedLabel.length === 0) {
    return trimmedLabel;
  }

  return trimmedLabel.charAt(0).toUpperCase() + trimmedLabel.slice(1);
}

function mapIssueLinksToRelatedIssues(issueLinks: unknown): JiraRelatedIssue[] {
  if (!Array.isArray(issueLinks)) {
    return [];
  }

  return issueLinks.flatMap((issueLink) => {
    const linkTypeName =
      typeof issueLink?.type?.name === "string" ? issueLink.type.name.trim() : "";
    const outwardLabel =
      typeof issueLink?.type?.outward === "string"
        ? issueLink.type.outward.trim()
        : linkTypeName === "Relates"
          ? "Relates to"
          : linkTypeName === "Duplicate"
            ? "Duplicates"
            : "";
    const inwardLabel =
      typeof issueLink?.type?.inward === "string"
        ? issueLink.type.inward.trim()
        : linkTypeName === "Relates"
          ? "Relates to"
          : linkTypeName === "Duplicate"
            ? "Is duplicated by"
            : "";

    if (issueLink?.outwardIssue) {
      const relatedIssue = mapRelatedIssue(
        issueLink.outwardIssue,
        formatRelationshipLabel(outwardLabel),
      );
      return relatedIssue ? [relatedIssue] : [];
    }

    if (issueLink?.inwardIssue) {
      const relatedIssue = mapRelatedIssue(
        issueLink.inwardIssue,
        formatRelationshipLabel(inwardLabel),
      );
      return relatedIssue ? [relatedIssue] : [];
    }

    return [];
  });
}

function mapDirectRelatedIssues(issue: any): JiraRelatedIssue[] {
  const subtasks = Array.isArray(issue.fields.subtasks)
    ? issue.fields.subtasks.flatMap((subtask: unknown) => {
        const relatedIssue = mapRelatedIssue(subtask, "Sub-task");
        return relatedIssue ? [relatedIssue] : [];
      })
    : [];

  return [...subtasks, ...mapIssueLinksToRelatedIssues(issue.fields.issuelinks)];
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
  const priorityName = issue.fields.priority?.name ? String(issue.fields.priority.name) : "Medium";
  const parent = issue.fields.parent;
  const labels = Array.isArray(issue.fields.labels)
    ? issue.fields.labels.map((label: unknown) => String(label))
    : [];
  const storyPointsFieldId = mapStoryPointsFieldIdFromIssue(issue);
  const storyPointsValue =
    storyPointsFieldId && typeof issue.fields[storyPointsFieldId] === "number"
      ? issue.fields[storyPointsFieldId]
      : undefined;
  const acvValue =
    typeof issue.fields[ACV_FIELD_ID]?.value === "string"
      ? issue.fields[ACV_FIELD_ID].value
      : undefined;
  const relatedIssues = mapDirectRelatedIssues(issue);

  return {
    key: issue.key,
    summary: issue.fields.summary,
    statusName: issue.fields.status.name,
    ...(issue.fields.status.statusCategory?.name
      ? { statusCategoryName: issue.fields.status.statusCategory.name }
      : {}),
    issueTypeName: issue.fields.issuetype?.name ?? "Issue",
    ...(priorityName ? { priorityName } : {}),
    labels,
    isFlagged: Boolean(issue.fields.flagged),
    ...(parent?.key ? { parentKey: String(parent.key) } : {}),
    ...(parent?.fields?.summary ? { parentSummary: String(parent.fields.summary) } : {}),
    relatedIssues,
    ...(typeof storyPointsValue === "number" ? { storyPoints: storyPointsValue } : {}),
    ...(acvValue ? { acv: acvValue } : {}),
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

function findStoryPointsFieldIdFromNames(
  names: Record<string, string> | undefined,
): string | undefined {
  if (!names) {
    return undefined;
  }

  return Object.entries(names).find(([, name]) => STORY_POINTS_FIELD_NAME_PATTERN.test(name))?.[0];
}

function findStoryPointsFieldIdFromEditMetadata(
  payload: JiraIssueEditMetadataResponse,
): string | undefined {
  return Object.entries(payload.fields ?? {}).find(
    ([, field]) =>
      typeof field?.name === "string" && STORY_POINTS_FIELD_NAME_PATTERN.test(field.name.trim()),
  )?.[0];
}

function mapStoryPointsFieldIdFromIssue(issue: any): string | undefined {
  return findStoryPointsFieldIdFromNames(
    issue?.names && typeof issue.names === "object"
      ? (issue.names as Record<string, string>)
      : undefined,
  );
}

function firstBoardIdFromResponse(payload: JiraBoardsResponse): string | undefined {
  const boardId = payload.values?.find(
    (board) => typeof board.id === "string" || typeof board.id === "number",
  )?.id;
  return typeof boardId === "string"
    ? toTrimmedString(boardId)
    : typeof boardId === "number"
      ? String(boardId)
      : undefined;
}

function readStatusCategoryName(input: unknown): string | undefined {
  if (typeof input === "string" && input.trim().length > 0) {
    return input;
  }
  if (typeof input === "object" && input !== null && "name" in input) {
    const name = (input as { readonly name?: unknown }).name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name;
    }
  }
  return undefined;
}

function uniqueById<T extends { readonly id: string }>(values: readonly T[]): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value.id)) {
      return false;
    }
    seen.add(value.id);
    return true;
  });
}

function toTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function mapBoardStatuses(
  boardConfig: JiraBoardConfiguration,
  projectStatuses: JiraProjectStatusesResponse,
): JiraIssueEditStatus[] {
  const statusLookup = new Map<
    string,
    {
      readonly name: string;
      readonly statusCategoryName?: string | undefined;
    }
  >();

  for (const issueType of projectStatuses) {
    for (const status of issueType.statuses ?? []) {
      const id = toTrimmedString(status.id);
      const name = toTrimmedString(status.name);
      if (!id || !name) {
        continue;
      }

      statusLookup.set(id, {
        name,
        ...(readStatusCategoryName(status.statusCategory)
          ? { statusCategoryName: readStatusCategoryName(status.statusCategory) }
          : {}),
      });
    }
  }

  const flattenedStatuses = uniqueById(
    (boardConfig.columnConfig?.columns ?? []).flatMap((column) =>
      (column.statuses ?? []).flatMap((status) => {
        const id = toTrimmedString(status.id);
        if (!id) {
          return [];
        }

        const mapped = statusLookup.get(id);
        return [
          {
            id,
            name: mapped?.name ?? id,
            ...(mapped?.statusCategoryName
              ? { statusCategoryName: mapped.statusCategoryName }
              : {}),
          },
        ];
      }),
    ),
  );

  return flattenedStatuses;
}

function mapIssueTransitions(payload: JiraIssueTransitionsResponse): JiraIssueTransition[] {
  return (payload.transitions ?? []).flatMap((transition) => {
    const id = toTrimmedString(transition.id);
    const name = toTrimmedString(transition.name);
    if (!id || !name) {
      return [];
    }

    const toStatusId = toTrimmedString(transition.to?.id);
    const toStatusName = toTrimmedString(transition.to?.name);
    const toStatusCategoryName = readStatusCategoryName(transition.to?.statusCategory);

    return [
      {
        id,
        name,
        ...(toStatusId ? { toStatusId } : {}),
        ...(toStatusName ? { toStatusName } : {}),
        ...(toStatusCategoryName ? { toStatusCategoryName } : {}),
      },
    ];
  });
}

interface JiraRequestOptions {
  readonly method?: "GET" | "POST" | "PUT";
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
      const jiraConnectionService = yield* JiraConnectionService;
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
          const detail = `Jira request failed with status ${response.status}.`;
          // Read body for server-side diagnostics only — don't surface raw Jira
          // responses to the client (may contain internal paths or auth hints).
          yield* Effect.tryPromise({
            try: () => response.text(),
            catch: () => "",
          }).pipe(
            Effect.orElseSucceed(() => ""),
            Effect.tap((text) =>
              text.trim().length > 0
                ? Effect.log(`[JiraService] ${operation} error body: ${text.trim()}`)
                : Effect.void,
            ),
          );

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

      const resolveStoryPointsFieldId = Effect.fn("JiraService.resolveStoryPointsFieldId")(
        function* (cwd: string, issueKey: string) {
          const editMetaResponse = yield* request(
            cwd,
            `/rest/api/3/issue/${encodeURIComponent(issueKey)}/editmeta`,
            "jira.resolveStoryPointsFieldId.editmeta",
          );
          const editMetaFieldId = findStoryPointsFieldIdFromEditMetadata(
            editMetaResponse.payload as JiraIssueEditMetadataResponse,
          );
          if (editMetaFieldId) {
            return editMetaFieldId;
          }

          const issueResponse = yield* request(
            cwd,
            `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary&expand=names`,
            "jira.resolveStoryPointsFieldId.issue",
          );
          return findStoryPointsFieldIdFromNames(
            ((issueResponse.payload as JiraIssueNamesResponse).names ?? undefined) as
              | Record<string, string>
              | undefined,
          );
        },
      );

      const getIssueEditMetadata = Effect.fn("JiraService.getIssueEditMetadata")(function* (
        input: JiraGetIssueEditMetadataInput,
      ) {
        const connection = yield* jiraConnectionService.getResolvedConnection();
        const projectKey =
          toTrimmedString(connection.defaults.projectKey) ??
          getProjectKeyFromIssueKey(input.issueKey);
        if (!projectKey) {
          return yield* new JiraError({
            kind: "config",
            operation: "jira.getIssueEditMetadata",
            message: "Jira project key is not configured.",
          });
        }

        const resolvedBoardId =
          toTrimmedString(connection.defaults.boardId) ??
          firstBoardIdFromResponse(
            (yield* request(
              input.cwd,
              `/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`,
              "jira.getIssueEditMetadata.boards",
            )).payload as JiraBoardsResponse,
          );
        if (!resolvedBoardId) {
          return yield* new JiraError({
            kind: "config",
            operation: "jira.getIssueEditMetadata",
            message: "Jira board id is not configured.",
          });
        }

        const boardConfigResponse = yield* request(
          input.cwd,
          `/rest/agile/1.0/board/${encodeURIComponent(resolvedBoardId)}/configuration`,
          "jira.getIssueEditMetadata.board",
        );
        const boardConfig = boardConfigResponse.payload as JiraBoardConfiguration;
        const projectKeyFromBoard = toTrimmedString(boardConfig.location?.key) ?? projectKey;

        const projectStatusesResponse = yield* request(
          input.cwd,
          `/rest/api/3/project/${encodeURIComponent(projectKeyFromBoard)}/statuses`,
          "jira.getIssueEditMetadata.statuses",
        );
        const projectStatuses = projectStatusesResponse.payload as JiraProjectStatusesResponse;
        const storyPointsFieldId = yield* resolveStoryPointsFieldId(input.cwd, input.issueKey);

        return {
          boardId: resolvedBoardId,
          boardName: toTrimmedString(boardConfig.name) ?? "Board",
          projectKey,
          ...(storyPointsFieldId ? { storyPointsFieldId } : {}),
          statuses: mapBoardStatuses(boardConfig, projectStatuses),
        } satisfies JiraIssueEditMetadataResult;
      });

      const getIssueTransitions = Effect.fn("JiraService.getIssueTransitions")(function* (
        cwd: string,
        issueKey: string,
      ) {
        const { payload } = yield* request(
          cwd,
          `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
          "jira.getIssueTransitions",
        );

        return {
          issueKey,
          transitions: mapIssueTransitions(payload as JiraIssueTransitionsResponse),
        } satisfies JiraIssueTransitionsResult;
      });

      const updateIssueStatus = Effect.fn("JiraService.updateIssueStatus")(function* (
        input: JiraUpdateIssueStatusInput,
      ) {
        yield* request(
          input.cwd,
          `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}/transitions`,
          "jira.updateIssueStatus",
          {
            method: "POST",
            body: {
              transition: {
                id: input.transitionId,
              },
            },
          },
        );

        return {
          issueKey: input.issueKey,
          transitionId: input.transitionId,
        } satisfies JiraUpdateIssueStatusResult;
      });

      const updateIssueStoryPoints = Effect.fn("JiraService.updateIssueStoryPoints")(function* (
        input: JiraUpdateIssueStoryPointsInput,
      ) {
        const storyPointsFieldId = yield* resolveStoryPointsFieldId(input.cwd, input.issueKey);
        if (!storyPointsFieldId) {
          return yield* new JiraError({
            kind: "config",
            operation: "jira.updateIssueStoryPoints",
            message: "Jira story points field is not configured.",
          });
        }

        yield* request(
          input.cwd,
          `/rest/api/3/issue/${encodeURIComponent(input.issueKey)}`,
          "jira.updateIssueStoryPoints",
          {
            method: "PUT",
            body: {
              fields: {
                [storyPointsFieldId]: input.storyPoints,
              },
            },
          },
        );

        return {
          issueKey: input.issueKey,
          storyPoints: input.storyPoints,
        } satisfies JiraUpdateIssueStoryPointsResult;
      });

      return {
        getConnectionStatus: () => jiraConnectionService.getConnectionStatus(),
        saveConnection: (input) => jiraConnectionService.saveConnection(input),
        testConnection: (input) => jiraConnectionService.testConnection(input),
        disconnect: () => jiraConnectionService.disconnect(),
        getConfigStatus: (cwd: string) => jiraConfig.getConfigStatus(cwd),
        getIssueEditMetadata: (input: JiraGetIssueEditMetadataInput) => getIssueEditMetadata(input),
        getIssueTransitions: (cwd: string, issueKey: string) => getIssueTransitions(cwd, issueKey),
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
                  fields: ["summary", "status", "issuetype"],
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
            issueUrl.searchParams.set("fields", "*all");
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
        updateIssueStatus: (input: JiraUpdateIssueStatusInput) => updateIssueStatus(input),
        updateIssueStoryPoints: (input: JiraUpdateIssueStoryPointsInput) =>
          updateIssueStoryPoints(input),
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
