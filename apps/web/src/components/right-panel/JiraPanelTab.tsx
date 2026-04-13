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
import ChatMarkdown from "../ChatMarkdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { ScrollArea } from "../ui/scroll-area";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";
import { BookOpenIcon, BugIcon, ListTodoIcon, SparklesIcon } from "lucide-react";

// ── Status color mapping ──

type StatusStyle = { bg: string; text: string; dot: string };

const STATUS_CATEGORY_STYLES: Record<string, StatusStyle> = {
  "To Do": { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-400" },
  "In Progress": { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
  Done: { bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-400" },
};

const STATUS_NAME_STYLES: Record<string, StatusStyle> = {
  "Code Review": { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
  Backlog: { bg: "bg-zinc-500/15", text: "text-zinc-500", dot: "bg-zinc-500" },
};

function getStatusStyle(statusName: string, statusCategoryName?: string): StatusStyle {
  const byName = STATUS_NAME_STYLES[statusName];
  if (byName) return byName;
  if (statusCategoryName) {
    const byCat = STATUS_CATEGORY_STYLES[statusCategoryName];
    if (byCat) return byCat;
  }
  return { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

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

function StatusChip(props: {
  statusName: string;
  statusCategoryName?: string | undefined;
  size?: "large" | "small";
}) {
  const style = getStatusStyle(props.statusName, props.statusCategoryName);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
        style.bg,
        props.size === "large" ? "px-2 py-0.5" : "",
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      <span
        className={cn(
          "text-[9px] font-medium leading-none",
          style.text,
          props.size === "large" ? "text-[10px]" : "",
        )}
      >
        {props.statusName}
      </span>
    </span>
  );
}

function PriorityChip(props: { priorityName: "High" | "Low" }) {
  const variant = props.priorityName === "High" ? "destructive" : "outline";

  return (
    <Badge variant={variant} size="sm" className="px-1.5 text-[9px] font-semibold uppercase">
      {props.priorityName}
    </Badge>
  );
}

function isVisiblePriorityName(priorityName: string | undefined): priorityName is "High" | "Low" {
  return priorityName === "High" || priorityName === "Low";
}

function IssueTypeChip(props: { issueTypeName: string }) {
  const normalizedIssueType = props.issueTypeName.trim().toLowerCase();
  const chipConfig = {
    bug: {
      className: "border-red-500/20 bg-red-500/12 text-red-600",
      icon: BugIcon,
    },
    task: {
      className: "border-blue-500/20 bg-blue-500/12 text-blue-600",
      icon: ListTodoIcon,
    },
    story: {
      className: "border-green-500/20 bg-green-500/12 text-green-600",
      icon: BookOpenIcon,
    },
    epic: {
      className: "border-pink-500/20 bg-pink-500/12 text-pink-600",
      icon: SparklesIcon,
    },
  }[normalizedIssueType];

  const Icon = chipConfig?.icon ?? ListTodoIcon;
  const className =
    chipConfig?.className ?? "border-border/70 bg-muted/20 text-muted-foreground";

  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn("px-1.5 text-[9px] font-semibold uppercase", className)}
    >
      <Icon className="size-3" />
      {props.issueTypeName}
    </Badge>
  );
}

function StoryPointsChip(props: { storyPoints: number }) {
  return (
    <Badge variant="outline" size="sm" className="px-1.5 text-[9px] font-semibold uppercase">
      {props.storyPoints} pts
    </Badge>
  );
}

function FlagChip() {
  return (
    <Badge variant="warning" size="sm" className="px-1.5 text-[9px] font-semibold uppercase">
      Flagged
    </Badge>
  );
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
        <ScrollArea className="h-full">
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

            <div className="flex items-center justify-between px-1 py-1">
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

      {/* ── Detail pane (fixed 66vh) ── */}
      <div className="flex h-[66vh] shrink-0 flex-col border-t border-border/60">
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2">
          <div className="min-w-0 space-y-1">
            {currentIssue ? (
              <>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="text-[14px] text-muted-foreground">{currentIssue.key}</span>
                  <StatusChip
                    size="large"
                    statusName={currentIssue.statusName}
                    statusCategoryName={currentIssue.statusCategoryName}
                  />
                </div>
              </>
            ) : (
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                Detail
              </span>
            )}
          </div>
          {currentIssue && primaryAction ? (
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
          ) : null}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="px-3 pb-3">
            {!hasGitRepo ? (
              <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-2 py-1.5 text-xs text-amber-800">
                <AlertCircleIcon className="size-3 shrink-0" />
                Start Work and Continue Work require a git-backed project.
              </div>
            ) : null}

            {selectedIssueKey && issueDetailQuery.isFetching && !currentIssue ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                Loading…
              </div>
            ) : currentIssue ? (
              <div className="space-y-3">
                <h3 className="text-l font-bold text-foreground">{currentIssue.summary}</h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <IssueTypeChip issueTypeName={currentIssue.issueTypeName} />
                  {typeof currentIssue.storyPoints === "number" ? (
                    <StoryPointsChip storyPoints={currentIssue.storyPoints} />
                  ) : null}
                  {isVisiblePriorityName(currentIssue.priorityName) ? (
                    <PriorityChip priorityName={currentIssue.priorityName} />
                  ) : null}
                  {currentIssue.isFlagged ? <FlagChip /> : null}
                  {currentIssue.parentSummary ? (
                    <Badge
                      variant="outline"
                      size="sm"
                      className="max-w-full truncate px-1.5 text-[9px] font-semibold"
                    >
                      {currentIssue.parentSummary}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                  Description
                </p>
                {currentIssue.descriptionMarkdown.trim().length > 0 ? (
                  <div className="text-xs">
                    <ChatMarkdown
                      text={currentIssue.descriptionMarkdown}
                      cwd={cwd}
                      isStreaming={false}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No description.</p>
                )}

                {currentIssue.comments.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                      Comments
                    </p>
                    {currentIssue.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-md border border-border/60 bg-muted/20 p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                          <span>{comment.authorDisplayName}</span>
                          <span>{new Date(comment.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text-xs">
                          <ChatMarkdown text={comment.bodyMarkdown} cwd={cwd} isStreaming={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="py-2 text-xs text-muted-foreground">Select a ticket above.</p>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
});
