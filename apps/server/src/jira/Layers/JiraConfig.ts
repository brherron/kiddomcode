import { Effect, Layer } from "effect";

import { JiraConfig, type ResolvedJiraConfig } from "../Services/JiraConfig.ts";
import { JiraConnectionService } from "../Services/JiraConnectionService.ts";

const MACHINE_LEVEL_CONFIG_PATH = "server-settings:jira";

function toResolvedConfig(connection: {
  readonly baseUrl: string;
  readonly email: string;
  readonly token: string;
  readonly defaults: unknown;
}): ResolvedJiraConfig {
  return {
    configPath: MACHINE_LEVEL_CONFIG_PATH,
    baseUrl: connection.baseUrl,
    email: connection.email,
    token: connection.token,
    automations: {},
  };
}

export const makeJiraConfig = () =>
  Layer.effect(
    JiraConfig,
    Effect.gen(function* () {
      const jiraConnectionService = yield* JiraConnectionService;

      return {
        getConfigStatus: (_cwd: string) =>
          jiraConnectionService.getConnectionStatus().pipe(
            Effect.map((status) => {
              if (status.status === "ready") {
                return {
                  status: "ready" as const,
                  configPath: MACHINE_LEVEL_CONFIG_PATH,
                };
              }

              if (status.status === "missing") {
                return {
                  status: "missing" as const,
                  configPath: MACHINE_LEVEL_CONFIG_PATH,
                };
              }

              return {
                status: "invalid" as const,
                configPath: MACHINE_LEVEL_CONFIG_PATH,
                error: status.error ?? "Saved Jira settings are invalid.",
              };
            }),
          ),
        getResolvedConfig: (_cwd: string) =>
          jiraConnectionService.getResolvedConnection().pipe(Effect.map(toResolvedConfig)),
      };
    }),
  );

export const JiraConfigLive = makeJiraConfig();
