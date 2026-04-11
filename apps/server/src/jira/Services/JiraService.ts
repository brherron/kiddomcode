import { Context } from "effect";
import type { Effect } from "effect";

import type {
  JiraConfigStatusResult,
  JiraError,
  JiraGetIssueDetailResult,
  JiraListActiveTasksResult,
  JiraRunAutomationInput,
  JiraRunAutomationResult,
} from "@t3tools/contracts";

export interface JiraServiceShape {
  readonly getConfigStatus: (cwd: string) => Effect.Effect<JiraConfigStatusResult, JiraError>;
  readonly listActiveTasks: (cwd: string) => Effect.Effect<JiraListActiveTasksResult, JiraError>;
  readonly getIssueDetail: (
    cwd: string,
    issueKey: string,
  ) => Effect.Effect<JiraGetIssueDetailResult, JiraError>;
  readonly runAutomation: (
    input: JiraRunAutomationInput,
  ) => Effect.Effect<JiraRunAutomationResult, JiraError>;
}

export class JiraService extends Context.Service<JiraService, JiraServiceShape>()(
  "t3/jira/Services/JiraService",
) {}
