import { describe, expect, it } from "vitest";

import {
  buildJiraContinueWorkPrompt,
  buildJiraStartReviewPrompt,
  buildJiraStartWorkPrompt,
  buildJiraWorktreeBranchName,
  extractJiraIssueKey,
  resolveBaseBranchForJiraStartWork,
  resolveJiraIssueKeyForPrAutomation,
} from "./jira";

describe("extractJiraIssueKey", () => {
  it("reads Jira keys from mixed-case branch names", () => {
    expect(extractJiraIssueKey("feature/web-101-jira-panel")).toBe("WEB-101");
  });

  it("returns null when the branch does not contain a Jira key", () => {
    expect(extractJiraIssueKey("feature/no-ticket")).toBeNull();
  });
});

describe("buildJiraWorktreeBranchName", () => {
  it("builds a lower-case branch name under the length cap", () => {
    const branch = buildJiraWorktreeBranchName(
      "WEB-101",
      "Implement Jira active tasks right panel with automation hooks",
    );

    expect(branch.startsWith("web-101-")).toBe(true);
    expect(branch.length).toBeLessThanOrEqual(64);
    expect(branch).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("resolveBaseBranchForJiraStartWork", () => {
  it("prefers the repository default branch", () => {
    expect(
      resolveBaseBranchForJiraStartWork(
        [
          { name: "feature/demo", isDefault: false },
          { name: "main", isDefault: true },
        ],
        "feature/demo",
      ),
    ).toBe("main");
  });

  it("falls back to the current git status branch", () => {
    expect(resolveBaseBranchForJiraStartWork([], "release/next")).toBe("release/next");
  });
});

describe("buildJiraStartWorkPrompt", () => {
  it("includes the issue key, summary, description, and scope instruction", () => {
    const prompt = buildJiraStartWorkPrompt({
      key: "WEB-101",
      summary: "Implement Jira panel",
      descriptionMarkdown: "Ship the right panel.",
    });

    expect(prompt).toContain("Jira key: WEB-101");
    expect(prompt).toContain("Summary: Implement Jira panel");
    expect(prompt).toContain("Ship the right panel.");
    expect(prompt).toContain("stay scoped to this ticket");
  });
});

describe("buildJiraContinueWorkPrompt", () => {
  it("includes ticket, branch, and PR context and asks the agent to summarize current state first", () => {
    const prompt = buildJiraContinueWorkPrompt({
      key: "WEB-101",
      summary: "Implement Jira panel",
      descriptionMarkdown: "Ship the right panel.",
      branchName: "feature/web-101-jira-panel",
      pullRequest: {
        number: 18,
        title: "WEB-101 Jira panel",
        url: "https://github.com/acme/repo/pull/18",
      },
    });

    expect(prompt).toContain("Jira key: WEB-101");
    expect(prompt).toContain("Current branch: feature/web-101-jira-panel");
    expect(prompt).toContain("Pull request: #18 WEB-101 Jira panel");
    expect(prompt).toContain("summarize the current implementation state");
    expect(prompt).toContain("ask me what to tackle next");
  });
});

describe("buildJiraStartReviewPrompt", () => {
  it("frames the thread as a review and instructs the agent to resolve the PR if needed", () => {
    const prompt = buildJiraStartReviewPrompt({
      key: "WEB-101",
      summary: "Implement Jira panel",
      descriptionMarkdown: "Ship the right panel.",
      branchName: null,
      pullRequest: null,
    });

    expect(prompt).toContain("Jira key: WEB-101");
    expect(prompt).toContain("perform a PR/code review");
    expect(prompt).toContain("resolve the relevant pull request from GitHub");
    expect(prompt).toContain("bugs, regressions, missing tests, and risks");
  });
});

describe("resolveJiraIssueKeyForPrAutomation", () => {
  it("uses the current branch first and then falls back to the PR head branch", () => {
    expect(
      resolveJiraIssueKeyForPrAutomation({
        currentBranch: "feature/no-ticket",
        result: {
          pr: {
            status: "created",
            url: "https://github.com/acme/repo/pull/12",
            headBranch: "web-101-jira-panel",
          },
        },
      }),
    ).toBe("WEB-101");
  });

  it("returns null when no qualifying PR result is present", () => {
    expect(
      resolveJiraIssueKeyForPrAutomation({
        currentBranch: "web-101-jira-panel",
        result: {
          pr: {
            status: "skipped_not_requested",
          },
        },
      }),
    ).toBeNull();
  });
});
