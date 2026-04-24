import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as environmentApi from "../environmentApi";
import * as localApi from "../localApi";
import * as jiraReactQuery from "./jiraReactQuery";
import {
  jiraActiveTasksQueryOptions,
  jiraConnectionStatusQueryOptions,
  jiraQueryKeys,
} from "./jiraReactQuery";

vi.mock("../environmentApi", () => ({
  ensureEnvironmentApi: vi.fn(),
}));

vi.mock("../localApi", () => ({
  ensureLocalApi: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("jiraConnectionStatusQueryOptions", () => {
  it("loads machine-level Jira status from the local server api", async () => {
    const getJiraConnectionStatus = vi.fn().mockResolvedValue({
      status: "missing",
      hasToken: false,
      defaults: {},
    });

    vi.spyOn(localApi, "ensureLocalApi").mockReturnValue({
      server: {
        getJiraConnectionStatus,
      },
    } as never);

    const queryClient = new QueryClient();
    const options = jiraConnectionStatusQueryOptions();

    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      status: "missing",
      hasToken: false,
      defaults: {},
    });
    expect(getJiraConnectionStatus).toHaveBeenCalledWith();
    expect(options.queryKey).toEqual(jiraQueryKeys.connectionStatus());
  });
});

describe("jiraActiveTasksQueryOptions", () => {
  it("does not fetch when machine-level Jira is not ready", () => {
    const options = jiraActiveTasksQueryOptions({
      environmentId: "environment-local" as never,
      cwd: "/repo",
      enabled: false,
    });

    expect(options.enabled).toBe(false);
  });

  it("still uses the environment Jira API for task queries", async () => {
    const listActiveTasks = vi.fn().mockResolvedValue({ issues: [] });

    vi.spyOn(environmentApi, "ensureEnvironmentApi").mockReturnValue({
      jira: {
        listActiveTasks,
      },
    } as never);

    const queryClient = new QueryClient();
    const options = jiraActiveTasksQueryOptions({
      environmentId: "environment-local" as never,
      cwd: "/repo",
      enabled: true,
    });

    await queryClient.fetchQuery(options);

    expect(listActiveTasks).toHaveBeenCalledWith({ cwd: "/repo" });
  });
});

describe("jiraIssueEditMetadataQueryOptions", () => {
  it("loads board edit metadata from the environment Jira API", async () => {
    const getIssueEditMetadata = vi.fn().mockResolvedValue({
      boardId: "23",
      boardName: "Board",
      projectKey: "WEB",
      storyPointsFieldId: "customfield_10002",
      statuses: [
        {
          id: "10000",
          name: "In Progress",
          statusCategoryName: "In Progress",
        },
      ],
    });

    vi.spyOn(environmentApi, "ensureEnvironmentApi").mockReturnValue({
      jira: {
        getIssueEditMetadata,
      },
    } as never);

    const queryClient = new QueryClient();
    const options = (jiraReactQuery as any).jiraIssueEditMetadataQueryOptions({
      environmentId: "environment-local" as never,
      cwd: "/repo",
      issueKey: "WEB-101",
    });

    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      boardId: "23",
      boardName: "Board",
      projectKey: "WEB",
      storyPointsFieldId: "customfield_10002",
      statuses: [
        {
          id: "10000",
          name: "In Progress",
          statusCategoryName: "In Progress",
        },
      ],
    });
    expect(getIssueEditMetadata).toHaveBeenCalledWith({
      cwd: "/repo",
      issueKey: "WEB-101",
    });
  });
});

describe("jiraIssueTransitionsQueryOptions", () => {
  it("loads issue transitions from the environment Jira API", async () => {
    const getIssueTransitions = vi.fn().mockResolvedValue({
      issueKey: "WEB-101",
      transitions: [
        {
          id: "11",
          name: "Start Progress",
          toStatusId: "10000",
          toStatusName: "In Progress",
          toStatusCategoryName: "In Progress",
        },
      ],
    });

    vi.spyOn(environmentApi, "ensureEnvironmentApi").mockReturnValue({
      jira: {
        getIssueTransitions,
      },
    } as never);

    const queryClient = new QueryClient();
    const options = (jiraReactQuery as any).jiraIssueTransitionsQueryOptions({
      environmentId: "environment-local" as never,
      cwd: "/repo",
      issueKey: "WEB-101",
    });

    await expect(queryClient.fetchQuery(options)).resolves.toEqual({
      issueKey: "WEB-101",
      transitions: [
        {
          id: "11",
          name: "Start Progress",
          toStatusId: "10000",
          toStatusName: "In Progress",
          toStatusCategoryName: "In Progress",
        },
      ],
    });
    expect(getIssueTransitions).toHaveBeenCalledWith({
      cwd: "/repo",
      issueKey: "WEB-101",
    });
  });
});

describe("jira issue mutations", () => {
  it("invalidates Jira queries after a status update", async () => {
    const updateIssueStatus = vi.fn().mockResolvedValue({
      issueKey: "WEB-101",
      transitionId: "11",
    });

    vi.spyOn(environmentApi, "ensureEnvironmentApi").mockReturnValue({
      jira: {
        updateIssueStatus,
      },
    } as never);

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      (jiraReactQuery as any).updateJiraIssueStatus(queryClient, {
        environmentId: "environment-local" as never,
        cwd: "/repo",
        issueKey: "WEB-101",
        transitionId: "11",
      }),
    ).resolves.toEqual({
      issueKey: "WEB-101",
      transitionId: "11",
    });
    expect(updateIssueStatus).toHaveBeenCalledWith({
      cwd: "/repo",
      issueKey: "WEB-101",
      transitionId: "11",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: jiraQueryKeys.issueDetail("environment-local" as never, "/repo", "WEB-101"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: jiraQueryKeys.activeTasks("environment-local" as never, "/repo"),
    });
  });

  it("invalidates Jira queries after a story point update", async () => {
    const updateIssueStoryPoints = vi.fn().mockResolvedValue({
      issueKey: "WEB-101",
      storyPoints: 8,
    });

    vi.spyOn(environmentApi, "ensureEnvironmentApi").mockReturnValue({
      jira: {
        updateIssueStoryPoints,
      },
    } as never);

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    await expect(
      (jiraReactQuery as any).updateJiraIssueStoryPoints(queryClient, {
        environmentId: "environment-local" as never,
        cwd: "/repo",
        issueKey: "WEB-101",
        storyPoints: 8,
      }),
    ).resolves.toEqual({
      issueKey: "WEB-101",
      storyPoints: 8,
    });
    expect(updateIssueStoryPoints).toHaveBeenCalledWith({
      cwd: "/repo",
      issueKey: "WEB-101",
      storyPoints: 8,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: jiraQueryKeys.issueDetail("environment-local" as never, "/repo", "WEB-101"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: jiraQueryKeys.activeTasks("environment-local" as never, "/repo"),
    });
  });
});
