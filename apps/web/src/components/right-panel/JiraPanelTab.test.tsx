import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  queryClientRef,
  branchQueryRef,
  configStatusRef,
  activeTasksRef,
  issueDetailRef,
  pullRequestQueryResultsRef,
} = vi.hoisted(() => ({
  queryClientRef: {
    current: {
      invalidateQueries: vi.fn(() => Promise.resolve()),
    },
  },
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
            issueTypeName: "Task",
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
          issueTypeName: "Task",
          storyPoints: 3,
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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
    useQueryClient: vi.fn(() => queryClientRef.current),
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
            issueTypeName: "Task",
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
          issueTypeName: "Task",
          storyPoints: 3,
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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
            issueTypeName: "Task",
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
          issueTypeName: "Task",
          storyPoints: 3,
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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

  it("includes a refresh button in the Jira header", () => {
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

    expect(html).toContain('aria-label="Refresh Jira tasks"');
  });

  it("keeps the My Tasks controls in a fixed dark header above the scrollable list", () => {
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

    expect(html).toContain("My Tasks");
    expect(html).toMatch(
      /<div class="[^"]*shrink-0[^"]*border-b[^"]*bg-background\/95[^"]*supports-\[backdrop-filter\]:bg-background\/80[^"]*">[\s\S]*?My Tasks[\s\S]*?Refresh Jira tasks/,
    );
    expect(html).toMatch(
      /My Tasks[\s\S]*?<div role="presentation"[^>]*class="[^"]*size-full[^"]*min-h-0[^"]*flex-1[^"]*"/,
    );
  });

  it("renders high or low priority, flag, and parent metadata in the issue detail", () => {
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          issueTypeName: "Task",
          storyPoints: 3,
          descriptionMarkdown: "Ship the right panel.",
          priorityName: "High",
          isFlagged: true,
          parentKey: "WEB-100",
          parentSummary: "Parent ticket",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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

    expect(html).toContain("High");
    expect(html).toContain("Flagged");
    expect(html).toContain("Parent");
    expect(html).toContain("Parent ticket");
    expect(html).toContain("Latest update");
  });

  it("features the newest comment in the latest update section", () => {
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          issueTypeName: "Task",
          descriptionMarkdown: "Ship the right panel.",
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Older update.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
            {
              id: "10002",
              authorDisplayName: "Reviewer Two",
              bodyMarkdown: "Newest update.",
              createdAt: "2026-04-11T08:00:00.000Z",
            },
          ],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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

    expect(html).toContain("Latest update");
    expect(html.indexOf("Newest update.")).toBeGreaterThan(-1);
    expect(html.indexOf("Older update.")).toBeGreaterThan(html.indexOf("Newest update."));
  });

  it("shows an explicit latest update empty state when comments are absent", () => {
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          issueTypeName: "Task",
          descriptionMarkdown: "Ship the right panel.",
          comments: [],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
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

    expect(html).toContain("Latest update");
    expect(html).toContain("No updates yet.");
  });

  it("colors issue type chips by bug task story and epic", () => {
    const cases = [
      ["Bug", "bg-red-500/12"],
      ["Task", "bg-blue-500/12"],
      ["Story", "bg-green-500/12"],
      ["Epic", "bg-purple-500/12"],
    ] as const;

    for (const [issueTypeName, expectedClass] of cases) {
      issueDetailRef.current = {
        data: {
          issue: {
            key: "WEB-101",
            summary: "Implement Jira panel",
            statusName: "In Progress",
            issueTypeName,
            storyPoints: 3,
            descriptionMarkdown: "Ship the right panel.",
            comments: [],
            url: "https://example.atlassian.net/browse/WEB-101",
          } as any,
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

      expect(html).toContain(issueTypeName);
      expect(html).toContain(expectedClass);
    }
  });
});
