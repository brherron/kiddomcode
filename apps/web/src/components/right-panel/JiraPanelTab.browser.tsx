import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

const {
  branchQueryRef,
  configStatusRef,
  activeTasksRef,
  issueDetailRef,
  pullRequestQueryResultsRef,
  startWorkSpy,
  selectIssueSpy,
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
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Looks good.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
          ],
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
  startWorkSpy: vi.fn(),
  selectIssueSpy: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: { queryKey: readonly unknown[] }) => {
    const key = options.queryKey[1];
    if (options.queryKey[0] === "git" && key === "branches") {
      return branchQueryRef.current;
    }
    if (key === "config-status") {
      return configStatusRef.current;
    }
    if (key === "active-tasks") {
      return activeTasksRef.current;
    }
    return issueDetailRef.current;
  }),
  useQueries: vi.fn(() => pullRequestQueryResultsRef.current),
}));

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
    configStatusRef.current = {
      data: {
        status: "ready",
        configPath: "/repo/.t3-jira-config.json",
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
          comments: [
            {
              id: "10001",
              authorDisplayName: "Reviewer One",
              bodyMarkdown: "Looks good.",
              createdAt: "2026-04-10T16:00:00.000Z",
            },
          ],
          url: "https://example.atlassian.net/browse/WEB-101",
        },
      },
      isPending: false,
      isFetching: false,
    };
    pullRequestQueryResultsRef.current = [];
  });

  it("renders config empty state when Jira config is missing", async () => {
    configStatusRef.current = {
      data: {
        status: "missing",
        configPath: "/repo/.t3-jira-config.json",
      },
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
      await expect.element(page.getByText("Jira config missing")).toBeInTheDocument();
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
});
