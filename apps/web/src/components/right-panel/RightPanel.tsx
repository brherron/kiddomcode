import type { EnvironmentId } from "@t3tools/contracts";
import { type TimestampFormat } from "@t3tools/contracts/settings";
import { PanelRightCloseIcon } from "lucide-react";
import { memo } from "react";

import type { ActivePlanState, LatestProposedPlanState } from "../../session-logic";
import type { JiraIssueDetail } from "@t3tools/contracts";
import { ScrollArea } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { JiraPanelTab } from "./JiraPanelTab";
import { PlanPanelTab } from "./PlanPanelTab";

interface RightPanelProps {
  tab: "plan" | "jira";
  onTabChange: (tab: "plan" | "jira") => void;
  onClose: () => void;
  environmentId: EnvironmentId;
  markdownCwd: string | undefined;
  workspaceRoot: string | undefined;
  timestampFormat: TimestampFormat;
  activePlan: ActivePlanState | null;
  activeProposedPlan: LatestProposedPlanState | null;
  jiraCwd: string | null;
  selectedIssueKey: string | null;
  onSelectIssueKey: (issueKey: string) => void;
  onStartWork: (issue: JiraIssueDetail) => void | Promise<void>;
  currentBranch: string | null;
  hasGitRepo: boolean;
  isWorking: boolean;
}

export const RightPanel = memo(function RightPanel(props: RightPanelProps) {
  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border-l border-border/70 bg-card/50">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <div className="flex items-center gap-1">
          {(["plan", "jira"] as const).map((tab) => (
            <Button
              key={tab}
              variant="ghost"
              size="sm"
              onClick={() => props.onTabChange(tab)}
              className={cn(
                "h-8 px-2.5 text-xs font-semibold tracking-wide uppercase",
                props.tab === tab
                  ? "bg-blue-500/10 text-blue-500 hover:bg-blue-500/15"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </Button>
          ))}
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={props.onClose}
          aria-label="Close right panel"
          className="text-muted-foreground/50 hover:text-foreground/70"
        >
          <PanelRightCloseIcon className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {props.tab === "plan" ? (
          <PlanPanelTab
            activePlan={props.activePlan}
            activeProposedPlan={props.activeProposedPlan}
            environmentId={props.environmentId}
            markdownCwd={props.markdownCwd}
            workspaceRoot={props.workspaceRoot}
            timestampFormat={props.timestampFormat}
          />
        ) : (
          <JiraPanelTab
            environmentId={props.environmentId}
            cwd={props.jiraCwd}
            selectedIssueKey={props.selectedIssueKey}
            onSelectIssueKey={props.onSelectIssueKey}
            onStartWork={props.onStartWork}
            currentBranch={props.currentBranch}
            hasGitRepo={props.hasGitRepo}
            isWorking={props.isWorking}
          />
        )}
      </ScrollArea>
    </div>
  );
});
