import { describe, expect, it } from "vitest";

import {
  closeToolsPanel,
  openToolsPanelTarget,
  toggleToolsPanelTarget,
  type ToolsPanelRouteState,
} from "./toolsPanelState";

function state(overrides: Partial<ToolsPanelRouteState> = {}): ToolsPanelRouteState {
  return {
    diffOpen: false,
    jiraOpen: false,
    toolsTab: "jira",
    ...overrides,
  };
}

describe("toggleToolsPanelTarget", () => {
  it("opens Git and clears Jira when switching from Jira", () => {
    expect(toggleToolsPanelTarget(state({ jiraOpen: true, toolsTab: "jira" }), "git")).toEqual({
      diffOpen: true,
      jiraOpen: false,
      toolsTab: "git",
    });
  });

  it("opens Jira and clears Git when switching from Git", () => {
    expect(toggleToolsPanelTarget(state({ diffOpen: true, toolsTab: "git" }), "jira")).toEqual({
      diffOpen: false,
      jiraOpen: true,
      toolsTab: "jira",
    });
  });

  it("closes Git when Git is already the active source", () => {
    expect(toggleToolsPanelTarget(state({ diffOpen: true, toolsTab: "git" }), "git")).toEqual({
      diffOpen: false,
      jiraOpen: false,
      toolsTab: "git",
    });
  });

  it("closes Jira when Jira is already the active source", () => {
    expect(toggleToolsPanelTarget(state({ jiraOpen: true, toolsTab: "jira" }), "jira")).toEqual({
      diffOpen: false,
      jiraOpen: false,
      toolsTab: "jira",
    });
  });
});

describe("openToolsPanelTarget", () => {
  it("switches the shared panel to Jira without closing first", () => {
    expect(openToolsPanelTarget(state({ diffOpen: true, toolsTab: "git" }), "jira")).toEqual({
      diffOpen: false,
      jiraOpen: true,
      toolsTab: "jira",
    });
  });
});

describe("closeToolsPanel", () => {
  it("clears both panel sources and keeps the last selected tab", () => {
    expect(closeToolsPanel(state({ diffOpen: true, jiraOpen: true, toolsTab: "git" }))).toEqual({
      diffOpen: false,
      jiraOpen: false,
      toolsTab: "git",
    });
  });
});
