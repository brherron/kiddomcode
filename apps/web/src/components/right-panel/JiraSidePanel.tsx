import type { EnvironmentId, JiraIssueDetail } from "@t3tools/contracts";
import { PanelRightCloseIcon } from "lucide-react";
import { memo, useCallback, useRef, useState } from "react";

import { Button } from "../ui/button";
import { JiraPanelTab } from "./JiraPanelTab";
import type { JiraWorkActionOption } from "../../lib/jiraWorkActions";

const JIRA_PANEL_MIN_WIDTH = 280;
const JIRA_PANEL_MAX_WIDTH = 600;
const JIRA_PANEL_DEFAULT_WIDTH = 450;
const JIRA_PANEL_WIDTH_STORAGE_KEY = "jira_panel_width";

function getStoredWidth(): number {
  try {
    const stored = localStorage.getItem(JIRA_PANEL_WIDTH_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (parsed >= JIRA_PANEL_MIN_WIDTH && parsed <= JIRA_PANEL_MAX_WIDTH) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return JIRA_PANEL_DEFAULT_WIDTH;
}

interface JiraSidePanelProps {
  environmentId: EnvironmentId;
  cwd: string | null;
  selectedIssueKey: string | null;
  onSelectIssueKey: (issueKey: string) => void;
  onClose: () => void;
  onRunAction: (issue: JiraIssueDetail, action: JiraWorkActionOption) => void | Promise<void>;
  currentBranch: string | null;
  hasGitRepo: boolean;
  isWorking: boolean;
}

export const JiraSidePanel = memo(function JiraSidePanel(props: JiraSidePanelProps) {
  const [width, setWidth] = useState(getStoredWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        // Dragging left edge: moving left = wider
        const delta = startX.current - ev.clientX;
        const next = Math.min(
          JIRA_PANEL_MAX_WIDTH,
          Math.max(JIRA_PANEL_MIN_WIDTH, startWidth.current + delta),
        );
        setWidth(next);
      };

      const onPointerUp = () => {
        dragging.current = false;
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        // Persist
        try {
          localStorage.setItem(JIRA_PANEL_WIDTH_STORAGE_KEY, String(width));
        } catch {
          // ignore
        }
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [width],
  );

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-border/70 bg-card/50"
      style={{ width }}
    >
      {/* Resize handle */}
      <div
        className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50"
        onPointerDown={onPointerDown}
      />

      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Jira
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={props.onClose}
          aria-label="Close Jira panel"
          className="text-muted-foreground/50 hover:text-foreground/70"
        >
          <PanelRightCloseIcon className="size-3.5" />
        </Button>
      </div>

      {/* Content */}
      <JiraPanelTab
        environmentId={props.environmentId}
        cwd={props.cwd}
        selectedIssueKey={props.selectedIssueKey}
        onSelectIssueKey={props.onSelectIssueKey}
        onRunAction={props.onRunAction}
        currentBranch={props.currentBranch}
        hasGitRepo={props.hasGitRepo}
        isWorking={props.isWorking}
      />
    </div>
  );
});
