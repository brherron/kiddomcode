import type {
  EnvironmentId,
  GitResolvedPullRequest,
  JiraIssueDetail,
  JiraIssueSummary,
} from "@t3tools/contracts";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, ArrowUpDownIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";

import { ensureEnvironmentApi } from "../../environmentApi";
import { extractJiraIssueKey } from "../../lib/jira";
import {
  jiraQueryKeys,
  jiraActiveTasksQueryOptions,
  jiraConfigStatusQueryOptions,
  jiraIssueDetailQueryOptions,
} from "../../lib/jiraReactQuery";
import {
  buildJiraWorkActionState,
  type JiraWorkActionBranchContext,
  type JiraWorkActionOption,
} from "../../lib/jiraWorkActions";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { ScrollArea } from "../ui/scroll-area";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";
import { IssueTypeMark, JiraIssueDetailPane, StatusChip } from "./JiraIssueDetailPane";

// ── Sort logic ──

type SortOption = "updated" | "status" | "key";

const SORT_LABELS: Record<SortOption, string> = {
  updated: "Recently updated",
  status: "Status",
  key: "Key",
};

/** Lower = higher priority (should appear first). */
const STATUS_SORT_PRIORITY: Record<string, number> = {
  "To Do": 0,
  "In Progress": 1,
  "Code Review": 2,
  Backlog: 3,
  Done: 4,
};

function getStatusPriority(issue: JiraIssueSummary): number {
  const byName = STATUS_SORT_PRIORITY[issue.statusName];
  if (byName !== undefined) return byName;
  const byCat = issue.statusCategoryName
    ? STATUS_SORT_PRIORITY[issue.statusCategoryName]
    : undefined;
  if (byCat !== undefined) return byCat;
  return 2; // default to middle
}

function sortIssues(issues: readonly JiraIssueSummary[], sort: SortOption): JiraIssueSummary[] {
  switch (sort) {
    case "updated":
      return [...issues]; // API already returns by updated DESC
    case "status":
      return issues.toSorted((a, b) => getStatusPriority(a) - getStatusPriority(b));
    case "key":
      return issues.toSorted((a, b) => a.key.localeCompare(b.key));
  }
}

// ── Components ──

interface JiraPanelTabProps {
  environmentId: EnvironmentId;
  cwd: string | null;
  selectedIssueKey: string | null;
  onSelectIssueKey: (issueKey: string) => void;
  onRunAction: (issue: JiraIssueDetail, action: JiraWorkActionOption) => void | Promise<void>;
  currentBranch: string | null;
  hasGitRepo: boolean;
  isWorking: boolean;
}

function isActionDisabled(input: {
  action: JiraWorkActionOption;
  hasGitRepo: boolean;
  cwd: string | null;
  currentIssue: JiraIssueDetail | null;
  pinnedIssueKey: string | null;
  isWorking: boolean;
}): boolean {
  if (!input.cwd || !input.currentIssue) {
    return true;
  }
  if (input.pinnedIssueKey === input.currentIssue.key && input.isWorking) {
    return true;
  }
  if (input.action.kind === "start_review") {
    return false;
  }
  return !input.hasGitRepo;
}

function buildActionReasonText(action: JiraWorkActionOption, hasGitRepo: boolean): string {
  if (!hasGitRepo && action.kind !== "start_review") {
    return `${action.reason} Requires a git-backed project.`;
  }
  return action.reason;
}

function EmptyState(props: { title: string; description: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm">
      <p className="font-medium text-foreground">{props.title}</p>
      <p className="mt-1 text-muted-foreground">{props.description}</p>
      {props.detail ? (
        <p className="mt-2 break-all text-xs text-muted-foreground/70">{props.detail}</p>
      ) : null}
    </div>
  );
}

export const JiraPanelTab = memo(function JiraPanelTab({
  environmentId,
  cwd,
  selectedIssueKey,
  onSelectIssueKey,
  onRunAction,
  currentBranch,
  hasGitRepo,
  isWorking,
}: JiraPanelTabProps) {
  const [sort, setSort] = useState<SortOption>("status");
  const queryClient = useQueryClient();

  const cycleSort = useCallback(() => {
    setSort((current) => {
      const options: SortOption[] = ["status", "updated", "key"];
      const idx = options.indexOf(current);
      return options[(idx + 1) % options.length]!;
    });
  }, []);

  const pinnedIssueKey = useMemo(
    () => (isWorking ? extractJiraIssueKey(currentBranch) : null),
    [currentBranch, isWorking],
  );
  const configStatusQuery = useQuery(jiraConfigStatusQueryOptions({ environmentId, cwd }));
  const configStatus = configStatusQuery.data;
  const jiraReady = configStatus?.status === "ready";
  const activeTasksQuery = useQuery(
    jiraActiveTasksQueryOptions({
      environmentId,
      cwd,
      enabled: jiraReady,
    }),
  );

  const sortedIssues = useMemo(
    () => (activeTasksQuery.data?.issues ? sortIssues(activeTasksQuery.data.issues, sort) : []),
    [activeTasksQuery.data?.issues, sort],
  );

  useEffect(() => {
    if (!jiraReady || selectedIssueKey) {
      return;
    }
    if (pinnedIssueKey) {
      onSelectIssueKey(pinnedIssueKey);
      return;
    }
    const firstIssueKey = sortedIssues[0]?.key;
    if (firstIssueKey) {
      onSelectIssueKey(firstIssueKey);
    }
  }, [sortedIssues, jiraReady, onSelectIssueKey, pinnedIssueKey, selectedIssueKey]);

  const issueDetailQuery = useQuery(
    jiraIssueDetailQueryOptions({
      environmentId,
      cwd,
      issueKey: selectedIssueKey,
      enabled: jiraReady && selectedIssueKey !== null,
    }),
  );

  const currentIssue = issueDetailQuery.data?.issue ?? null;
  const branchQuery = useQuery({
    queryKey: ["git", "branches", environmentId ?? null, cwd ?? null, "jira-work-actions"] as const,
    queryFn: async () => {
      if (!environmentId || !cwd) {
        throw new Error("Git branches are unavailable.");
      }
      return ensureEnvironmentApi(environmentId).git.listBranches({
        cwd,
        limit: 100,
      });
    },
    enabled: jiraReady && environmentId !== null && cwd !== null && hasGitRepo,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const matchingBranches = useMemo(() => {
    if (!currentIssue?.key) {
      return [] as JiraWorkActionBranchContext[];
    }
    return (branchQuery.data?.branches ?? [])
      .filter((branch) => !branch.isRemote && extractJiraIssueKey(branch.name) === currentIssue.key)
      .map((branch) => ({
        name: branch.name,
        current: branch.current,
        worktreePath: branch.worktreePath ?? null,
        hasOpenPullRequest: false,
        pullRequest: null,
      }));
  }, [branchQuery.data?.branches, currentIssue?.key]);
  const pullRequestQueries = useQueries({
    queries: matchingBranches.map((branch) => ({
      queryKey: [
        "git",
        "pull-request",
        environmentId ?? null,
        cwd ?? null,
        branch.name,
        "jira-work-actions",
      ] as const,
      queryFn: async (): Promise<GitResolvedPullRequest | null> => {
        if (!environmentId || !cwd) {
          return null;
        }
        try {
          const result = await ensureEnvironmentApi(environmentId).git.resolvePullRequest({
            cwd,
            reference: branch.name,
          });
          return result.pullRequest;
        } catch {
          return null;
        }
      },
      enabled: jiraReady && environmentId !== null && cwd !== null && hasGitRepo,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    })),
  });
  const actionBranches = useMemo(
    () =>
      matchingBranches.map((branch, index) => {
        const pullRequest =
          (pullRequestQueries[index]?.data as GitResolvedPullRequest | null) ?? null;
        return {
          ...branch,
          hasOpenPullRequest: pullRequest?.state === "open",
          pullRequest,
        };
      }),
    [matchingBranches, pullRequestQueries],
  );
  const actionState = useMemo(
    () =>
      currentIssue
        ? buildJiraWorkActionState({
            issue: {
              key: currentIssue.key,
              statusName: currentIssue.statusName,
              statusCategoryName: currentIssue.statusCategoryName,
            },
            branches: actionBranches,
          })
        : null,
    [actionBranches, currentIssue],
  );
  const primaryAction = actionState?.primaryAction ?? null;
  const menuActions = actionState?.actions ?? [];
  const primaryActionDisabled = primaryAction
    ? isActionDisabled({
        action: primaryAction,
        hasGitRepo,
        cwd,
        currentIssue,
        pinnedIssueKey,
        isWorking,
      })
    : true;

  if (!cwd) {
    return (
      <div className="p-3">
        <EmptyState
          title="Jira unavailable"
          description="Select a project-backed thread to load Jira tasks."
        />
      </div>
    );
  }

  if (configStatusQuery.isPending) {
    return (
      <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading Jira configuration…
      </div>
    );
  }

  if (configStatus?.status === "missing") {
    return (
      <div className="p-3">
        <EmptyState
          title="Jira config missing"
          description="Create `.t3-jira-config.json` in the shared repository root to enable Jira."
          detail={configStatus.configPath}
        />
      </div>
    );
  }

  if (configStatus?.status === "invalid") {
    return (
      <div className="p-3">
        <EmptyState
          title="Jira config invalid"
          description={configStatus.error ?? "The Jira config could not be loaded."}
          detail={configStatus.configPath}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* ── Ticket list (scrollable, fills remaining space) ── */}
      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                  My Tasks
                </p>
                {activeTasksQuery.isFetching ? (
                  <Spinner className="size-2.5 text-muted-foreground/60" />
                ) : null}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: jiraQueryKeys.all })
                  }
                  aria-label="Refresh Jira tasks"
                  title="Refresh Jira tasks"
                  className="text-muted-foreground/70 hover:text-foreground"
                >
                  <RefreshCwIcon className="size-3" />
                </Button>
                <button
                  type="button"
                  onClick={cycleSort}
                  className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  title={`Sort: ${SORT_LABELS[sort]}`}
                >
                  <ArrowUpDownIcon className="size-2.5" />
                  <span>{SORT_LABELS[sort]}</span>
                </button>
              </div>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2">
              {pinnedIssueKey ? (
                <button
                  type="button"
                  onClick={() => onSelectIssueKey(pinnedIssueKey)}
                  className="flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1 text-left"
                >
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/40 px-1 py-0 text-[9px] text-amber-700"
                  >
                    Active
                  </Badge>
                  <span className="truncate text-xs text-foreground">{pinnedIssueKey}</span>
                </button>
              ) : null}
              {activeTasksQuery.isPending ? (
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Spinner className="size-3" />
                  Loading…
                </div>
              ) : sortedIssues.length ? (
                sortedIssues.map((issue) => {
                  const active = issue.key === selectedIssueKey;
                  return (
                    <button
                      key={issue.key}
                      type="button"
                      onClick={() => onSelectIssueKey(issue.key)}
                      className={cn(
                        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition-colors",
                        active
                          ? "bg-blue-500/10 text-foreground"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                    >
                      <IssueTypeMark issueTypeName={issue.issueTypeName} size="small" />
                      <span className="shrink-0 text-[10px] font-medium tabular-nums">
                        {issue.key}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs">{issue.summary}</span>
                      <StatusChip
                        statusName={issue.statusName}
                        statusCategoryName={issue.statusCategoryName}
                      />
                    </button>
                  );
                })
              ) : (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No active tasks found.</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ── Detail pane (fixed 66vh) ── */}
      <div className="flex h-[66vh] shrink-0 flex-col border-t border-border/60">
        <div className="min-h-0 flex-1">
          {!hasGitRepo ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1.5 text-xs text-amber-800">
              <AlertCircleIcon className="size-3 shrink-0" />
              Start Thread and Continue Work require a git-backed project.
            </div>
          ) : null}

          {selectedIssueKey && issueDetailQuery.isFetching && !currentIssue ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Spinner className="size-3" />
              Loading…
            </div>
          ) : currentIssue ? (
            <JiraIssueDetailPane
              issue={currentIssue}
              cwd={cwd}
              actionSlot={
                primaryAction ? (
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={() => void onRunAction(currentIssue, primaryAction)}
                      disabled={primaryActionDisabled}
                      className="rounded-r-none text-[10px]"
                    >
                      {primaryAction.label}
                    </Button>
                    <Menu>
                      <MenuTrigger
                        render={
                          <Button
                            variant="default"
                            size="xs"
                            className="rounded-l-none border-l-white/12 px-1.5"
                            aria-label="Jira work actions"
                            disabled={menuActions.length <= 1}
                          />
                        }
                      >
                        <ChevronDownIcon className="size-3.5" />
                      </MenuTrigger>
                      <MenuPopup align="end" className="w-80">
                        {menuActions.map((action, index) => {
                          const disabled = isActionDisabled({
                            action,
                            hasGitRepo,
                            cwd,
                            currentIssue,
                            pinnedIssueKey,
                            isWorking,
                          });
                          return (
                            <MenuItem
                              key={`${action.kind}-${action.branchName ?? "default"}`}
                              disabled={disabled}
                              onClick={() => void onRunAction(currentIssue, action)}
                              className="items-start"
                            >
                              <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium">{action.label}</span>
                                  {index === 0 ? (
                                    <span className="rounded-full bg-blue-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-500">
                                      Recommended
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-xs leading-snug text-muted-foreground">
                                  {buildActionReasonText(action, hasGitRepo)}
                                </span>
                              </div>
                            </MenuItem>
                          );
                        })}
                      </MenuPopup>
                    </Menu>
                  </div>
                ) : null
              }
            />
          ) : (
            <p className="py-2 text-xs text-muted-foreground">Select a ticket above.</p>
          )}
        </div>
      </div>
    </div>
  );
});
