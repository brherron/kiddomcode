import { Context } from "effect";
import type { Effect } from "effect";

import type {
  JiraConnectionStatusResult,
  JiraDisconnectResult,
  JiraError,
  JiraSaveConnectionInput,
  JiraTestConnectionInput,
} from "@t3tools/contracts";
import type { JiraConnectionDefaults } from "@t3tools/contracts";

export interface ResolvedJiraConnection {
  readonly baseUrl: string;
  readonly email: string;
  readonly token: string;
  readonly defaults: JiraConnectionDefaults;
}

export interface JiraConnectionServiceShape {
  readonly getConnectionStatus: () => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly getResolvedConnection: () => Effect.Effect<ResolvedJiraConnection, JiraError>;
  readonly saveConnection: (
    input: JiraSaveConnectionInput,
  ) => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly testConnection: (
    input: JiraTestConnectionInput,
  ) => Effect.Effect<JiraConnectionStatusResult, JiraError>;
  readonly disconnect: () => Effect.Effect<JiraDisconnectResult, JiraError>;
}

export class JiraConnectionService extends Context.Service<
  JiraConnectionService,
  JiraConnectionServiceShape
>()("t3/jira/Services/JiraConnectionService") {}
