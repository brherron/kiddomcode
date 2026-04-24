import { Context } from "effect";
import type { Effect } from "effect";

import type {
  JiraConfigStatusResult,
  JiraConnectionStatusResult,
  JiraDisconnectResult,
  JiraError,
  JiraGetIssueEditMetadataInput,
  JiraIssueEditMetadataResult,
  JiraGetIssueDetailResult,
  JiraIssueTransitionsResult,
  JiraListActiveTasksResult,
  JiraRunAutomationInput,
  JiraRunAutomationResult,
  JiraUpdateIssueStatusInput,
  JiraUpdateIssueStatusResult,
  JiraUpdateIssueStoryPointsInput,
  JiraUpdateIssueStoryPointsResult,
  JiraSaveConnectionInput,
  JiraTestConnectionInput,
} from "@t3tools/contracts";

export interface JiraServiceShape {
  readonly getConnectionStatus: () => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly saveConnection: (
    input: JiraSaveConnectionInput,
  ) => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly testConnection: (
    input: JiraTestConnectionInput,
  ) => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly disconnect: () => Effect.Effect<JiraDisconnectResult, JiraError>;
  readonly getConfigStatus: (cwd: string) => Effect.Effect<JiraConfigStatusResult, JiraError>;
  readonly listActiveTasks: (cwd: string) => Effect.Effect<JiraListActiveTasksResult, JiraError>;
  readonly getIssueDetail: (
    cwd: string,
    issueKey: string,
  ) => Effect.Effect<JiraGetIssueDetailResult, JiraError>;
  readonly getIssueEditMetadata: (
    input: JiraGetIssueEditMetadataInput,
  ) => Effect.Effect<JiraIssueEditMetadataResult, JiraError>;
  readonly getIssueTransitions: (
    cwd: string,
    issueKey: string,
  ) => Effect.Effect<JiraIssueTransitionsResult, JiraError>;
  readonly updateIssueStatus: (
    input: JiraUpdateIssueStatusInput,
  ) => Effect.Effect<JiraUpdateIssueStatusResult, JiraError>;
  readonly updateIssueStoryPoints: (
    input: JiraUpdateIssueStoryPointsInput,
  ) => Effect.Effect<JiraUpdateIssueStoryPointsResult, JiraError>;
  readonly runAutomation: (
    input: JiraRunAutomationInput,
  ) => Effect.Effect<JiraRunAutomationResult, JiraError>;
}

export class JiraService extends Context.Service<JiraService, JiraServiceShape>()(
  "t3/jira/Services/JiraService",
) {}
