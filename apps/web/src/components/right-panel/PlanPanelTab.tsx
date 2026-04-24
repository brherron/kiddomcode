import { memo, useCallback, useState } from "react";
import type { EnvironmentId } from "@t3tools/contracts";
import { type TimestampFormat } from "@t3tools/contracts/settings";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  LoaderIcon,
} from "lucide-react";

import type { ActivePlanState, LatestProposedPlanState } from "../../session-logic";
import {
  buildProposedPlanMarkdownFilename,
  downloadPlanAsTextFile,
  normalizePlanMarkdownForExport,
  proposedPlanTitle,
  stripDisplayedPlanMarkdown,
} from "../../proposedPlan";
import { formatTimestamp } from "../../timestampFormat";
import { readEnvironmentApi } from "../../environmentApi";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { cn } from "../../lib/utils";
import ChatMarkdown from "../ChatMarkdown";
import { Button } from "../ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { toastManager } from "../ui/toast";

function stepStatusIcon(status: string) {
  if (status === "completed") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  if (status === "inProgress") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
        <LoaderIcon className="size-3 animate-spin" />
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/30">
      <span className="size-1.5 rounded-full bg-muted-foreground/30" />
    </span>
  );
}

interface PlanPanelTabProps {
  activePlan: ActivePlanState | null;
  activeProposedPlan: LatestProposedPlanState | null;
  environmentId: EnvironmentId;
  markdownCwd: string | undefined;
  workspaceRoot: string | undefined;
  timestampFormat: TimestampFormat;
}

export const PlanPanelTab = memo(function PlanPanelTab({
  activePlan,
  activeProposedPlan,
  environmentId,
  markdownCwd,
  workspaceRoot,
  timestampFormat,
}: PlanPanelTabProps) {
  const [proposedPlanExpanded, setProposedPlanExpanded] = useState(false);
  const [isSavingToWorkspace, setIsSavingToWorkspace] = useState(false);
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const planMarkdown = activeProposedPlan?.planMarkdown ?? null;
  const displayedPlanMarkdown = planMarkdown ? stripDisplayedPlanMarkdown(planMarkdown) : null;
  const planTitle = planMarkdown ? proposedPlanTitle(planMarkdown) : null;

  const handleCopyPlan = useCallback(() => {
    if (!planMarkdown) {
      return;
    }
    copyToClipboard(planMarkdown);
  }, [copyToClipboard, planMarkdown]);

  const handleDownload = useCallback(() => {
    if (!planMarkdown) {
      return;
    }
    const filename = buildProposedPlanMarkdownFilename(planMarkdown);
    downloadPlanAsTextFile(filename, normalizePlanMarkdownForExport(planMarkdown));
  }, [planMarkdown]);

  const handleSaveToWorkspace = useCallback(() => {
    const api = readEnvironmentApi(environmentId);
    if (!api || !workspaceRoot || !planMarkdown) {
      return;
    }

    const filename = buildProposedPlanMarkdownFilename(planMarkdown);
    setIsSavingToWorkspace(true);
    void api.projects
      .writeFile({
        cwd: workspaceRoot,
        relativePath: filename,
        contents: normalizePlanMarkdownForExport(planMarkdown),
      })
      .then((result) => {
        toastManager.add({
          type: "success",
          title: "Plan saved",
          description: result.relativePath,
        });
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Could not save plan",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      })
      .finally(() => {
        setIsSavingToWorkspace(false);
      });
  }, [environmentId, planMarkdown, workspaceRoot]);

  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground/60">
          {activePlan ? formatTimestamp(activePlan.createdAt, timestampFormat) : "No active plan"}
        </div>
        {planMarkdown ? (
          <Menu>
            <MenuTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  className="text-muted-foreground/50 hover:text-foreground/70"
                  aria-label="Plan actions"
                />
              }
            >
              <EllipsisIcon className="size-3.5" />
            </MenuTrigger>
            <MenuPopup align="end">
              <MenuItem onClick={handleCopyPlan}>
                {isCopied ? "Copied!" : "Copy to clipboard"}
              </MenuItem>
              <MenuItem onClick={handleDownload}>Download as markdown</MenuItem>
              <MenuItem
                onClick={handleSaveToWorkspace}
                disabled={!workspaceRoot || isSavingToWorkspace}
              >
                Save to workspace
              </MenuItem>
            </MenuPopup>
          </Menu>
        ) : null}
      </div>

      {activePlan?.explanation ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground/80">
          {activePlan.explanation}
        </p>
      ) : null}

      {activePlan && activePlan.steps.length > 0 ? (
        <div className="space-y-1">
          <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase">
            Steps
          </p>
          {activePlan.steps.map((step) => (
            <div
              key={`${step.status}:${step.step}`}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-200",
                step.status === "inProgress" && "bg-blue-500/5",
                step.status === "completed" && "bg-emerald-500/5",
              )}
            >
              <div className="mt-0.5">{stepStatusIcon(step.status)}</div>
              <p
                className={cn(
                  "text-[13px] leading-snug",
                  step.status === "completed"
                    ? "text-muted-foreground/50 line-through decoration-muted-foreground/20"
                    : step.status === "inProgress"
                      ? "text-foreground/90"
                      : "text-muted-foreground/70",
                )}
              >
                {step.step}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {planMarkdown ? (
        <div className="space-y-2">
          <button
            type="button"
            className="group flex w-full items-center gap-1.5 text-left"
            onClick={() => setProposedPlanExpanded((value) => !value)}
          >
            {proposedPlanExpanded ? (
              <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
            ) : (
              <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
            )}
            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase group-hover:text-muted-foreground/60">
              {planTitle ?? "Full Plan"}
            </span>
          </button>
          {proposedPlanExpanded ? (
            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
              <ChatMarkdown
                text={displayedPlanMarkdown ?? ""}
                cwd={markdownCwd}
                isStreaming={false}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!activePlan && !planMarkdown ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-[13px] text-muted-foreground/40">No active plan yet.</p>
          <p className="mt-1 text-[11px] text-muted-foreground/30">
            Plans will appear here when generated.
          </p>
        </div>
      ) : null}
    </div>
  );
});
