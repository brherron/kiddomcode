import { Context } from "effect";
import type { Effect } from "effect";

import type { JiraConfigStatusResult, JiraError } from "@t3tools/contracts";

export interface ResolvedJiraConfig {
  readonly configPath: string;
  readonly baseUrl: string;
  readonly email: string;
  readonly token: string;
  readonly automations: {
    readonly on_branch_created?:
      | {
          readonly enabled: boolean;
          readonly transitionId?: string | undefined;
        }
      | undefined;
    readonly on_pr_opened?:
      | {
          readonly enabled: boolean;
          readonly transitionId?: string | undefined;
        }
      | undefined;
  };
}

export interface JiraConfigShape {
  readonly getConfigStatus: (cwd: string) => Effect.Effect<JiraConfigStatusResult, JiraError>;
  readonly getResolvedConfig: (cwd: string) => Effect.Effect<ResolvedJiraConfig, JiraError>;
}

export class JiraConfig extends Context.Service<JiraConfig, JiraConfigShape>()(
  "t3/jira/Services/JiraConfig",
) {}
