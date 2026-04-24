export interface ToolsPanelRouteState {
  diffOpen: boolean;
  jiraOpen: boolean;
  toolsTab: "git" | "jira";
}

export function openToolsPanelTarget(
  _state: ToolsPanelRouteState,
  target: "git" | "jira",
): ToolsPanelRouteState {
  return target === "git"
    ? {
        diffOpen: true,
        jiraOpen: false,
        toolsTab: "git",
      }
    : {
        diffOpen: false,
        jiraOpen: true,
        toolsTab: "jira",
      };
}

export function toggleToolsPanelTarget(
  state: ToolsPanelRouteState,
  target: "git" | "jira",
): ToolsPanelRouteState {
  if (target === "git") {
    if (state.diffOpen && state.toolsTab === "git") {
      return {
        diffOpen: false,
        jiraOpen: false,
        toolsTab: "git",
      };
    }

    return openToolsPanelTarget(state, "git");
  }

  if (state.jiraOpen && state.toolsTab === "jira") {
    return {
      diffOpen: false,
      jiraOpen: false,
      toolsTab: "jira",
    };
  }

  return openToolsPanelTarget(state, "jira");
}

export function closeToolsPanel(state: ToolsPanelRouteState): ToolsPanelRouteState {
  return {
    diffOpen: false,
    jiraOpen: false,
    toolsTab: state.toolsTab,
  };
}
