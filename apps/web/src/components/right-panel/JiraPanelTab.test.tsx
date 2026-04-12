import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  branchQueryRef,
  configStatusRef,
  activeTasksRef,
  issueDetailRef,
  pullRequestQueryResultsRef,
} = vi.hoisted(() => ({
  branchQueryRef: {
    current: {
      data: {
        branches: [] as Array<{
          name: string;
          current: boolean;
          isDefault: boolean;
          worktreePath: string | null;
        }>,
        isRepo: true,
        hasOriginRemote: true,
        nextCursor: null,
      },
      isPending: false,
      isFetching: false,
    },
  },
  configStatusRef: {
    current: {
      data: {
        status: "ready",
        configPath: "/repo/.t3-jira-config.json",
      },
      isPending: false,
      isFetching: false,
    },
  },
  activeTasksRef: {
    current: {
      data: {
        issues: [
          {
            key: "WEB-101",
            summary: "Implement Jira panel",
            statusName: "In Progress",
          },
        ],
      },
      isPending: false,
      isFetching: false,
    },
  },
  issueDetailRef: {
    current: {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        },
      },
      isPending: false,
      isFetching: false,
    },
  },
  pullRequestQueryResultsRef: {
    current: [] as Array<{ data: unknown; isPending: boolean; isFetching: boolean }>,
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn((options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === "git" && options.queryKey[1] === "branches") {
        return branchQueryRef.current;
      }
      if (options.queryKey[1] === "config-status") {
        return configStatusRef.current;
      }
      if (options.queryKey[1] === "active-tasks") {
        return activeTasksRef.current;
      }
      return issueDetailRef.current;
    }),
    useQueries: vi.fn(() => pullRequestQueryResultsRef.current),
  };
});

vi.mock("../ChatMarkdown", () => ({
  default: ({ text }: { text: string }) => text,
}));

import { JiraPanelTab } from "./JiraPanelTab";

describe("JiraPanelTab", () => {
  afterEach(() => {
    branchQueryRef.current = {
      data: {
        branches: [],
        isRepo: true,
        hasOriginRemote: true,
        nextCursor: null,
      },
      isPending: false,
      isFetching: false,
    };
    activeTasksRef.current = {
      data: {
        issues: [
          {
            key: "WEB-101",
            summary: "Implement Jira panel",
            statusName: "In Progress",
          },
        ],
      },
      isPending: false,
      isFetching: false,
    };
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        },
      },
      isPending: false,
      isFetching: false,
    };
    pullRequestQueryResultsRef.current = [];
  });

  it("renders continue on branch as the primary action when there is exactly one matching branch", () => {
    branchQueryRef.current = {
      data: {
        branches: [
          {
            name: "feature/web-101-jira-panel",
            current: true,
            isDefault: false,
            worktreePath: "/repo/.worktrees/web-101",
          },
        ],
        isRepo: true,
        hasOriginRemote: true,
        nextCursor: null,
      },
      isPending: false,
      isFetching: false,
    };

    const html = renderToStaticMarkup(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={vi.fn()}
        onRunAction={vi.fn()}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    expect(html).toContain("Continue Work");
    expect(html).not.toContain("Continue on feature/web-101-jira-panel</button>");
  });

  it("renders start review as the primary action for code review tickets", () => {
    activeTasksRef.current = {
      data: {
        issues: [
          {
            key: "WEB-101",
            summary: "Implement Jira panel",
            statusName: "Code Review",
          },
        ],
      },
      isPending: false,
      isFetching: false,
    };
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "Code Review",
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        },
      },
      isPending: false,
      isFetching: false,
    };

    const html = renderToStaticMarkup(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={vi.fn()}
        onRunAction={vi.fn()}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    expect(html).toContain("Start Review");
  });
});
