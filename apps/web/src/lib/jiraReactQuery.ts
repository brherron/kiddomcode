import type { EnvironmentId } from "@t3tools/contracts";
import { queryOptions, type QueryClient } from "@tanstack/react-query";

import { ensureEnvironmentApi } from "../environmentApi";

export const jiraQueryKeys = {
  all: ["jira"] as const,
  configStatus: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["jira", "config-status", environmentId ?? null, cwd] as const,
  activeTasks: (environmentId: EnvironmentId | null, cwd: string | null) =>
    ["jira", "active-tasks", environmentId ?? null, cwd] as const,
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
  if (input?.issueKey && input.cwd !== undefined) {
    return queryClient.invalidateQueries({
      queryKey: jiraQueryKeys.issueDetail(
        input.environmentId ?? null,
        input.cwd ?? null,
        input.issueKey,
      ),
    });
  }

  if (input?.cwd !== undefined) {
    return queryClient.invalidateQueries({
      queryKey: jiraQueryKeys.activeTasks(input.environmentId ?? null, input.cwd ?? null),
    });
  }

  return queryClient.invalidateQueries({ queryKey: jiraQueryKeys.all });
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
