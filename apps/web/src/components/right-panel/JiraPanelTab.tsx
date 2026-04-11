import type { EnvironmentId, JiraIssueDetail } from "@t3tools/contracts";
import { useQuery } from "@tanstack/react-query";
import { memo, useEffect, useMemo } from "react";
import { AlertCircleIcon, TicketIcon } from "lucide-react";

import { extractJiraIssueKey } from "../../lib/jira";
import {
  jiraActiveTasksQueryOptions,
  jiraConfigStatusQueryOptions,
  jiraIssueDetailQueryOptions,
} from "../../lib/jiraReactQuery";
import ChatMarkdown from "../ChatMarkdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { cn } from "../../lib/utils";

interface JiraPanelTabProps {
  environmentId: EnvironmentId;
  cwd: string | null;
  selectedIssueKey: string | null;
  onSelectIssueKey: (issueKey: string) => void;
  onStartWork: (issue: JiraIssueDetail) => void | Promise<void>;
  currentBranch: string | null;
  hasGitRepo: boolean;
  isWorking: boolean;
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
  onStartWork,
  currentBranch,
  hasGitRepo,
  isWorking,
}: JiraPanelTabProps) {
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

  useEffect(() => {
    if (!jiraReady || selectedIssueKey) {
      return;
    }
    if (pinnedIssueKey) {
      onSelectIssueKey(pinnedIssueKey);
      return;
    }
    const firstIssueKey = activeTasksQuery.data?.issues[0]?.key;
    if (firstIssueKey) {
      onSelectIssueKey(firstIssueKey);
    }
  }, [
    activeTasksQuery.data?.issues,
    jiraReady,
    onSelectIssueKey,
    pinnedIssueKey,
    selectedIssueKey,
  ]);

  const issueDetailQuery = useQuery(
    jiraIssueDetailQueryOptions({
      environmentId,
      cwd,
      issueKey: selectedIssueKey,
      enabled: jiraReady && selectedIssueKey !== null,
    }),
  );

  const pinnedSummary =
    activeTasksQuery.data?.issues.find((issue) => issue.key === pinnedIssueKey) ?? null;
  const currentIssue = issueDetailQuery.data?.issue ?? null;
  const startWorkDisabled =
    !hasGitRepo || !cwd || !currentIssue || (pinnedIssueKey === currentIssue?.key && isWorking);

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
    <div className="space-y-4 p-3">
      {pinnedIssueKey ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                  Active ticket
                </Badge>
                <span className="text-xs font-medium text-foreground">{pinnedIssueKey}</span>
              </div>
              <p className="mt-2 text-sm text-foreground">
                {pinnedSummary?.summary ?? "Current branch maps to a Jira issue."}
              </p>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => onSelectIssueKey(pinnedIssueKey)}
              className="shrink-0"
            >
              View
            </Button>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
              My Active Tasks
            </p>
            <p className="text-xs text-muted-foreground">Open sprint tickets assigned to you.</p>
          </div>
          {activeTasksQuery.isFetching ? (
            <Spinner className="size-4 text-muted-foreground/60" />
          ) : null}
        </div>

        {activeTasksQuery.isPending ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading active tasks…
          </div>
        ) : activeTasksQuery.data?.issues.length ? (
          <div className="space-y-2">
            {activeTasksQuery.data.issues.map((issue) => {
              const active = issue.key === selectedIssueKey;
              return (
                <button
                  key={issue.key}
                  type="button"
                  onClick={() => onSelectIssueKey(issue.key)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-blue-500/50 bg-blue-500/8"
                      : "border-border/70 bg-background hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                      {issue.key}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{issue.statusName}</span>
                  </div>
                  <p className="mt-1 text-sm text-foreground">{issue.summary}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No active Jira tasks"
            description="Nothing matched the current active-task query."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
            Detail
          </p>
          {currentIssue ? (
            <Button
              variant="default"
              size="xs"
              onClick={() => void onStartWork(currentIssue)}
              disabled={startWorkDisabled}
            >
              {pinnedIssueKey === currentIssue.key && isWorking
                ? "Working in thread"
                : "Start Work with Codex"}
            </Button>
          ) : null}
        </div>

        {!hasGitRepo ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-sm text-amber-800">
            <AlertCircleIcon className="size-4 shrink-0" />
            Start Work requires a git-backed project.
          </div>
        ) : null}

        {issueDetailQuery.isPending ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading issue detail…
          </div>
        ) : currentIssue ? (
          <div className="space-y-4 rounded-lg border border-border/70 bg-background p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TicketIcon className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {currentIssue.key}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {currentIssue.statusName}
                </Badge>
              </div>
              <h3 className="text-sm font-medium text-foreground">{currentIssue.summary}</h3>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                Description
              </p>
              {currentIssue.descriptionMarkdown.trim().length > 0 ? (
                <ChatMarkdown
                  text={currentIssue.descriptionMarkdown}
                  cwd={cwd}
                  isStreaming={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No Jira description provided.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                Recent Comments
              </p>
              {currentIssue.comments.length > 0 ? (
                <div className="space-y-3">
                  {currentIssue.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <span>{comment.authorDisplayName}</span>
                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <ChatMarkdown text={comment.bodyMarkdown} cwd={cwd} isStreaming={false} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent comments.</p>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No issue selected"
            description="Choose a Jira issue to inspect its description and comments."
          />
        )}
      </section>
    </div>
  );
});
