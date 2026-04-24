import type {
  EnvironmentId,
  JiraDisconnectResult,
  JiraSaveConnectionInput,
  JiraConnectionStatusResult,
  JiraUpdateIssueStatusInput,
  JiraUpdateIssueStatusResult,
  JiraUpdateIssueStoryPointsInput,
  JiraUpdateIssueStoryPointsResult,
  JiraTestConnectionInput,
} from "@t3tools/contracts";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { ensureEnvironmentApi } from "../environmentApi";
import { ensureLocalApi } from "../localApi";

export const jiraQueryKeys = {
  all: ["jira"] as const,
  connectionStatus: () => ["jira", "connection-status"] as const,
  configStatus: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["jira", "config-status", environmentId ?? null, cwd] as const,
  activeTasks: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["jira", "active-tasks", environmentId ?? null, cwd] as const,
  issueEditMetadata: (
    environmentId: EnvironmentId | null,
    cwd: string | null,
    issueKey: string | null,
  ) => ["jira", "issue-edit-metadata", environmentId ?? null, cwd, issueKey] as const,
  issueTransitions: (
    environmentId: EnvironmentId | null,
    cwd: string | null,
    issueKey: string | null,
  ) => ["jira", "issue-transitions", environmentId ?? null, cwd, issueKey] as const,
  issueDetail: (environmentId: EnvironmentId | null, cwd: string | null, issueKey: string | null) =>
    ["jira", "issue-detail", environmentId ?? null, cwd, issueKey] as const,
};

export function invalidateJiraQueries(
  queryClient: QueryClient,
  input?: {
    environmentId?: EnvironmentId | null;
    cwd?: string | null;
    issueKey?: string | null;
  },
) {
  if (input?.issueKey && input.cwd != null) {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: jiraQueryKeys.issueDetail(input.environmentId ?? null, input.cwd, input.issueKey),
      }),
      queryClient.invalidateQueries({
        queryKey: jiraQueryKeys.issueEditMetadata(
          input.environmentId ?? null,
          input.cwd,
          input.issueKey,
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: jiraQueryKeys.issueTransitions(
          input.environmentId ?? null,
          input.cwd,
          input.issueKey,
        ),
      }),
      queryClient.invalidateQueries({
        queryKey: jiraQueryKeys.activeTasks(input.environmentId ?? null, input.cwd),
      }),
    ]).then(() => undefined);
  }

  if (input?.cwd != null) {
    return queryClient.invalidateQueries({
      queryKey: jiraQueryKeys.activeTasks(input.environmentId ?? null, input.cwd),
    });
  }

  return queryClient.invalidateQueries({ queryKey: jiraQueryKeys.all });
}

export function jiraConnectionStatusQueryOptions() {
  return queryOptions({
    queryKey: jiraQueryKeys.connectionStatus(),
    queryFn: () => ensureLocalApi().server.getJiraConnectionStatus(),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

function requireJiraServerApi() {
  const localApi = ensureLocalApi();
  return localApi.server;
}

export async function saveJiraConnection(
  queryClient: QueryClient,
  input: JiraSaveConnectionInput,
): Promise<JiraConnectionStatusResult> {
  const result = await requireJiraServerApi().saveJiraConnection(input);
  await invalidateJiraQueries(queryClient);
  return result;
}

export function testJiraConnection(
  input: JiraTestConnectionInput,
): Promise<JiraConnectionStatusResult> {
  return requireJiraServerApi().testJiraConnection(input);
}

export async function disconnectJiraConnection(
  queryClient: QueryClient,
): Promise<JiraDisconnectResult> {
  const result = await requireJiraServerApi().disconnectJira({});
  await invalidateJiraQueries(queryClient);
  return result;
}

export function jiraConfigStatusQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
}) {
  return queryOptions({
    queryKey: jiraQueryKeys.configStatus(input.environmentId, input.cwd),
    queryFn: async () => {
      if (!input.environmentId || !input.cwd) {
        throw new Error("Jira config is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.jira.getConfigStatus({ cwd: input.cwd });
    },
    enabled: input.environmentId !== null && input.cwd !== null,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function jiraActiveTasksQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: jiraQueryKeys.activeTasks(input.environmentId, input.cwd),
    queryFn: async () => {
      if (!input.environmentId || !input.cwd) {
        throw new Error("Jira tasks are unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.jira.listActiveTasks({ cwd: input.cwd });
    },
    enabled: input.environmentId !== null && input.cwd !== null && (input.enabled ?? true),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export function jiraIssueEditMetadataQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  issueKey: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: jiraQueryKeys.issueEditMetadata(input.environmentId, input.cwd, input.issueKey),
    queryFn: async () => {
      if (!input.environmentId || !input.cwd || !input.issueKey) {
        throw new Error("Jira issue edit metadata is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      const data = api.jira.getIssueEditMetadata({ cwd: input.cwd, issueKey: input.issueKey });
      console.log(data);
      return data;
    },
    enabled:
      input.environmentId !== null &&
      input.cwd !== null &&
      input.issueKey !== null &&
      (input.enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function jiraIssueTransitionsQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  issueKey: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: jiraQueryKeys.issueTransitions(input.environmentId, input.cwd, input.issueKey),
    queryFn: async () => {
      if (!input.environmentId || !input.cwd || !input.issueKey) {
        throw new Error("Jira issue transitions are unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.jira.getIssueTransitions({ cwd: input.cwd, issueKey: input.issueKey });
    },
    enabled:
      input.environmentId !== null &&
      input.cwd !== null &&
      input.issueKey !== null &&
      (input.enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function jiraIssueDetailQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  issueKey: string | null;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: jiraQueryKeys.issueDetail(input.environmentId, input.cwd, input.issueKey),
    queryFn: async () => {
      if (!input.environmentId || !input.cwd || !input.issueKey) {
        throw new Error("Jira issue detail is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.jira.getIssueDetail({ cwd: input.cwd, issueKey: input.issueKey });
    },
    enabled:
      input.environmentId !== null &&
      input.cwd !== null &&
      input.issueKey !== null &&
      (input.enabled ?? true),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}

export async function updateJiraIssueStatus(
  queryClient: QueryClient,
  input: JiraUpdateIssueStatusInput & { environmentId: EnvironmentId | null },
): Promise<JiraUpdateIssueStatusResult> {
  if (!input.environmentId) {
    throw new Error("Jira issue status update is unavailable.");
  }
  const api = ensureEnvironmentApi(input.environmentId);
  const result = await api.jira.updateIssueStatus({
    cwd: input.cwd,
    issueKey: input.issueKey,
    transitionId: input.transitionId,
  });
  await invalidateJiraQueries(queryClient, {
    environmentId: input.environmentId,
    cwd: input.cwd,
    issueKey: input.issueKey,
  });
  return result;
}

export async function updateJiraIssueStoryPoints(
  queryClient: QueryClient,
  input: JiraUpdateIssueStoryPointsInput & { environmentId: EnvironmentId | null },
): Promise<JiraUpdateIssueStoryPointsResult> {
  if (!input.environmentId) {
    throw new Error("Jira issue story point update is unavailable.");
  }
  const api = ensureEnvironmentApi(input.environmentId);
  const result = await api.jira.updateIssueStoryPoints({
    cwd: input.cwd,
    issueKey: input.issueKey,
    storyPoints: input.storyPoints,
  });
  await invalidateJiraQueries(queryClient, {
    environmentId: input.environmentId,
    cwd: input.cwd,
    issueKey: input.issueKey,
  });
  return result;
}
