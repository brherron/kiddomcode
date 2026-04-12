import type { JiraIssueDetail } from "@t3tools/contracts";
import { create } from "zustand";

import type { JiraWorkActionOption } from "./lib/jiraWorkActions";

type ToolsTab = "git" | "jira";

interface JiraToolsState {
  /** Which tab is active in the Tools panel. */
  toolsTab: ToolsTab;
  /** Whether the Jira tab triggered the panel open (vs diff URL param). */
  jiraOpen: boolean;
  /** Currently selected Jira issue key (persists across thread switches). */
  selectedIssueKey: string | null;

  // ── Values published by ChatView so the route-level panel can read them ──
  jiraCwd: string | null;
  currentBranch: string | null;
  hasGitRepo: boolean;
  isWorking: boolean;
  /** Registered Jira work-action callback from ChatView. */
  runJiraActionHandler:
    | ((issue: JiraIssueDetail, action: JiraWorkActionOption) => void | Promise<void>)
    | null;
}

interface JiraToolsActions {
  setToolsTab: (tab: ToolsTab) => void;
  setJiraOpen: (open: boolean) => void;
  setSelectedIssueKey: (key: string) => void;
  /** ChatView calls this on every render to push its state into the store. */
  publishChatViewState: (state: {
    jiraCwd: string | null;
    currentBranch: string | null;
    hasGitRepo: boolean;
    isWorking: boolean;
    runJiraActionHandler:
      | ((issue: JiraIssueDetail, action: JiraWorkActionOption) => void | Promise<void>)
      | null;
  }) => void;
}

export const useJiraToolsStore = create<JiraToolsState & JiraToolsActions>((set) => ({
  toolsTab: "jira",
  jiraOpen: false,
  selectedIssueKey: null,
  jiraCwd: null,
  currentBranch: null,
  hasGitRepo: false,
  isWorking: false,
  runJiraActionHandler: null,

  setToolsTab: (tab) => set({ toolsTab: tab }),
  setJiraOpen: (open) => set({ jiraOpen: open }),
  setSelectedIssueKey: (key) => set({ selectedIssueKey: key }),
  publishChatViewState: (state) => set(state),
}));
