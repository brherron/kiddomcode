import type { EnvironmentId } from "@t3tools/contracts";
import { memo, useCallback } from "react";

import { useJiraToolsStore } from "../../jiraToolsStore";
import { JiraPanelTab } from "../right-panel/JiraPanelTab";
import type { JiraWorkActionOption } from "../../lib/jiraWorkActions";
import type { JiraIssueDetail } from "@t3tools/contracts";

interface ToolsPanelContentProps {
  environmentId: EnvironmentId;
  activeTab: "git" | "jira";
  /** Render slot for the diff panel content (lazy-loaded by the route). */
  diffContent: React.ReactNode;
}

export const ToolsPanelContent = memo(function ToolsPanelContent(props: ToolsPanelContentProps) {
  const selectedIssueKey = useJiraToolsStore((s) => s.selectedIssueKey);
  const setSelectedIssueKey = useJiraToolsStore((s) => s.setSelectedIssueKey);
  const runJiraActionHandler = useJiraToolsStore((s) => s.runJiraActionHandler);
  const jiraCwd = useJiraToolsStore((s) => s.jiraCwd);
  const currentBranch = useJiraToolsStore((s) => s.currentBranch);
  const hasGitRepo = useJiraToolsStore((s) => s.hasGitRepo);
  const isWorking = useJiraToolsStore((s) => s.isWorking);

  const onRunAction = useCallback(
    (issue: JiraIssueDetail, action: JiraWorkActionOption) => {
      if (runJiraActionHandler) {
        void runJiraActionHandler(issue, action);
      }
    },
    [runJiraActionHandler],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        {props.activeTab === "git" ? (
          props.diffContent
        ) : (
          <JiraPanelTab
            environmentId={props.environmentId}
            cwd={jiraCwd}
            selectedIssueKey={selectedIssueKey}
            onSelectIssueKey={setSelectedIssueKey}
            onRunAction={onRunAction}
            currentBranch={currentBranch}
            hasGitRepo={hasGitRepo}
            isWorking={isWorking}
          />
        )}
      </div>
    </div>
  );
});
