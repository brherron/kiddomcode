import { describe, expect, it } from "vitest";

import {
  buildJiraWorkActionState,
  type JiraWorkActionBranchContext,
  type JiraWorkActionIssueContext,
} from "./jiraWorkActions";

function issueContext(
  overrides: Partial<JiraWorkActionIssueContext> = {},
): JiraWorkActionIssueContext {
  return {
    key: "WEB-101",
    statusName: "In Progress",
    statusCategoryName: "In Progress",
    ...overrides,
  };
}

function branchContext(
  name: string,
  overrides: Partial<JiraWorkActionBranchContext> = {},
): JiraWorkActionBranchContext {
  return {
    name,
    current: false,
    worktreePath: null,
    hasOpenPullRequest: false,
    pullRequest: null,
    ...overrides,
  };
}

describe("buildJiraWorkActionState", () => {
  it("always recommends start review when the ticket is in code review", () => {
    const result = buildJiraWorkActionState({
      issue: issueContext({ statusName: "Code Review", statusCategoryName: "In Progress" }),
      branches: [
        branchContext("web-101-fix-panel"),
        branchContext("feature/web-101-cleanup", {
          hasOpenPullRequest: true,
          pullRequest: {
            number: 42,
            title: "Review WEB-101",
            url: "https://github.com/acme/repo/pull/42",
            baseBranch: "main",
            headBranch: "feature/web-101-cleanup",
            state: "open",
          },
        }),
      ],
    });

    expect(result.primaryAction.kind).toBe("start_review");
    expect(result.primaryAction.label).toBe("Start Review");
    expect(result.primaryAction.reason).toContain("Code Review");
  });

  it("recommends continuing when there is exactly one matching branch", () => {
    const result = buildJiraWorkActionState({
      issue: issueContext(),
      branches: [branchContext("feature/web-101-panel", { current: true })],
    });

    expect(result.primaryAction.kind).toBe("continue_work");
    expect(result.primaryAction.branchName).toBe("feature/web-101-panel");
    expect(result.primaryAction.label).toBe("Continue Work");
    expect(result.primaryAction.reason).toContain("Current branch");
    expect(result.primaryAction.reason).toContain("feature/web-101-panel");
  });

  it("recommends start work when multiple matching branches exist", () => {
    const result = buildJiraWorkActionState({
      issue: issueContext(),
      branches: [
        branchContext("feature/web-101-old"),
        branchContext("feature/web-101-current", {
          hasOpenPullRequest: true,
          pullRequest: {
            number: 19,
            title: "WEB-101 in progress",
            url: "https://github.com/acme/repo/pull/19",
            baseBranch: "main",
            headBranch: "feature/web-101-current",
            state: "open",
          },
        }),
      ],
    });

    expect(result.primaryAction.kind).toBe("start_work");
    expect(result.actions.map((action) => action.label)).toEqual([
      "Start Work",
      "Continue on feature/web-101-current",
      "Continue on feature/web-101-old",
      "Start Review",
    ]);
    expect(result.actions[1]?.reason).toContain("Open PR");
  });

  it("ignores non-matching branches and falls back to start work", () => {
    const result = buildJiraWorkActionState({
      issue: issueContext(),
      branches: [branchContext("feature/no-ticket")],
    });

    expect(result.primaryAction.kind).toBe("start_work");
    expect(result.actions.map((action) => action.kind)).toEqual(["start_work"]);
  });
});
