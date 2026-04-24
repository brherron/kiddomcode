import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

const {
  queryClientRef,
  branchQueryRef,
  connectionStatusRef,
  activeTasksRef,
  issueEditMetadataRef,
  issueTransitionsRef,
  issueDetailRef,
  pullRequestQueryResultsRef,
  startWorkSpy,
  selectIssueSpy,
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
  connectionStatusRef: {
    current: {
      data: {
        status: "ready",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {},
      } as any,
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
  issueEditMetadataRef: {
    current: {
      data: {
        boardId: "1",
        boardName: "Example board",
        projectKey: "WEB",
        storyPointsFieldId: "customfield_10016",
        estimationFieldId: undefined,
        statuses: [
          {
            id: "1",
            name: "To Do",
          },
          {
            id: "2",
            name: "In Progress",
          },
          {
            id: "3",
            name: "Done",
          },
        ],
      },
      isPending: false,
      isFetching: false,
    },
  },
  issueTransitionsRef: {
    current: {
      data: {
        issueKey: "WEB-101",
        transitions: [],
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
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Looks good.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
          ],
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
  startWorkSpy: vi.fn(),
  selectIssueSpy: vi.fn(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn((options: { queryKey: readonly unknown[] }) => {
      const key = options.queryKey[1];
      if (options.queryKey[0] === "git" && key === "branches") {
        return branchQueryRef.current;
      }
      if (key === "connection-status") {
        return connectionStatusRef.current;
      }
      if (key === "active-tasks") {
        return activeTasksRef.current;
      }
      if (key === "issue-edit-metadata") {
        return issueEditMetadataRef.current;
      }
      if (key === "issue-transitions") {
        return issueTransitionsRef.current;
      }
      return issueDetailRef.current;
    }),
    useQueries: vi.fn(() => pullRequestQueryResultsRef.current),
    useMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useQueryClient: vi.fn(() => queryClientRef.current),
  };
});

vi.mock("../ChatMarkdown", () => ({
  default: ({ text }: { text: string }) => <div>{text}</div>,
}));

import { JiraPanelTab } from "./JiraPanelTab";

describe("JiraPanelTab", () => {
  afterEach(() => {
    selectIssueSpy.mockReset();
    startWorkSpy.mockReset();
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
    connectionStatusRef.current = {
      data: {
        status: "ready",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {},
      } as any,
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
    issueEditMetadataRef.current = {
      data: {
        boardId: "1",
        boardName: "Example board",
        projectKey: "WEB",
        storyPointsFieldId: "customfield_10016",
        estimationFieldId: undefined,
        statuses: [
          {
            id: "1",
            name: "To Do",
          },
          {
            id: "2",
            name: "In Progress",
          },
          {
            id: "3",
            name: "Done",
          },
        ],
      },
      isPending: false,
      isFetching: false,
    };
    issueTransitionsRef.current = {
      data: {
        issueKey: "WEB-101",
        transitions: [],
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
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Looks good.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
          ],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
      },
      isPending: false,
      isFetching: false,
    };
    pullRequestQueryResultsRef.current = [];
  });

  it("renders a recovery state when the Jira connection is missing", async () => {
    connectionStatusRef.current = {
      data: {
        status: "missing",
        hasToken: false,
        defaults: {},
      } as any,
      isPending: false,
      isFetching: false,
    };

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey={null}
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Connect Jira")).toBeInTheDocument();
      await expect
        .element(page.getByText("Connect Jira to load tasks for this project."))
        .toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("renders a recovery state when Jira is unreachable", async () => {
    connectionStatusRef.current = {
      data: {
        status: "unreachable",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {},
        error: "Timed out reaching Jira.",
      } as any,
      isPending: false,
      isFetching: false,
    };

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey={null}
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Jira unreachable")).toBeInTheDocument();
      await expect
        .element(
          page.getByText(
            "T3 Code could not reach your Jira site. Check the site URL or network connection.",
          ),
        )
        .toBeInTheDocument();
      await expect.element(page.getByText("Timed out reaching Jira.")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("renders the dense task list and issue detail", async () => {
    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Implement Jira panel")).toBeInTheDocument();
      await expect.element(page.getByText("Ship the right panel.")).toBeInTheDocument();
      await expect.element(page.getByText("Looks good.")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("refreshes Jira queries when the refresh button is clicked", async () => {
    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      const refreshButton = page.getByRole("button", { name: "Refresh Jira tasks" });
      await expect.element(refreshButton).toBeInTheDocument();

      await refreshButton.click();

      expect(queryClientRef.current.invalidateQueries).toHaveBeenCalledTimes(1);
      expect(queryClientRef.current.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["jira"],
      });
    } finally {
      await screen.unmount();
    }
  });

  it("shows the pinned active-ticket card when the branch contains a Jira key", async () => {
    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch="feature/web-101-jira-panel"
        hasGitRepo
        isWorking
      />,
    );

    try {
      await expect.element(page.getByText("Active")).toBeInTheDocument();
      await expect.element(page.getByText("WEB-101")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("uses continue on branch as the primary action when there is exactly one matching branch", async () => {
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

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect
        .element(page.getByRole("button", { name: "Continue on feature/web-101-jira-panel" }))
        .toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("switches the primary action to start review when the issue is in code review", async () => {
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

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByRole("button", { name: "Start Review" })).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("shows the issue priority, flag, and parent metadata in the detail view", async () => {
    issueDetailRef.current = {
      data: {
        issue: {
          key: "WEB-101",
          summary: "Implement Jira panel",
          statusName: "In Progress",
          issueTypeName: "Task",
          storyPoints: 3,
          descriptionMarkdown: "Ship the right panel.",
          priorityName: "Low",
          isFlagged: true,
          parentKey: "WEB-100",
          parentSummary: "Parent ticket",
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Looks good.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
          ],
          url: "https://example.atlassian.net/browse/WEB-101",
        } as any,
      },
      isPending: false,
      isFetching: false,
    };

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Low")).toBeInTheDocument();
      await expect.element(page.getByText("Parent")).toBeInTheDocument();
      await expect.element(page.getByText("Parent ticket")).toBeInTheDocument();
      await expect.element(page.getByText("Latest update")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("shows the newest comment in the latest update card and leaves older comments below", async () => {
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

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Latest update")).toBeInTheDocument();
      await expect.element(page.getByText("Newest update.")).toBeInTheDocument();
      await expect.element(page.getByText("Reviewer Two")).toBeInTheDocument();
      await expect.element(page.getByText("Older update.")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("shows an empty latest update state when there are no comments", async () => {
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

    const screen = await render(
      <JiraPanelTab
        environmentId={"environment-local" as never}
        cwd="/repo"
        selectedIssueKey="WEB-101"
        onSelectIssueKey={selectIssueSpy}
        onRunAction={startWorkSpy}
        currentBranch={null}
        hasGitRepo
        isWorking={false}
      />,
    );

    try {
      await expect.element(page.getByText("Latest update")).toBeInTheDocument();
      await expect.element(page.getByText("No updates yet.")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });
});
