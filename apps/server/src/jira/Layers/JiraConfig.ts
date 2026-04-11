import { readFile } from "node:fs/promises";
import path from "node:path";

import { Effect, Layer, Schema } from "effect";

import { JiraError, TrimmedNonEmptyString } from "@t3tools/contracts";
import { JiraConfig, type ResolvedJiraConfig } from "../Services/JiraConfig.ts";
import { runProcess } from "../../processRunner.ts";

const JiraAutomationConfigSchema = Schema.Struct({
  enabled: Schema.Boolean,
  transitionId: Schema.optional(TrimmedNonEmptyString),
});

const JiraFileConfigSchema = Schema.Struct({
  baseUrl: TrimmedNonEmptyString,
  email: TrimmedNonEmptyString,
  token: TrimmedNonEmptyString,
  automations: Schema.optional(
    Schema.Struct({
      on_branch_created: Schema.optional(JiraAutomationConfigSchema),
      on_pr_opened: Schema.optional(JiraAutomationConfigSchema),
    }),
  ),
});

function normalizeConfig(
  input: typeof JiraFileConfigSchema.Type,
  configPath: string,
): ResolvedJiraConfig {
  let baseUrl: string;
  try {
    const url = new URL(input.baseUrl);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    baseUrl = url.toString().replace(/\/+$/g, "");
  } catch (cause) {
    throw new JiraError({
      kind: "config",
      operation: "jira.config.parse",
      message: "Invalid Jira baseUrl in .t3-jira-config.json.",
      cause,
    });
  }

  return {
    configPath,
    baseUrl,
    email: input.email,
    token: input.token,
    automations: input.automations ?? {},
  };
}

async function resolveConfigPath(cwd: string): Promise<string> {
  const result = await runProcess("git", ["-C", cwd, "rev-parse", "--git-common-dir"], {
    allowNonZeroExit: true,
  });

  if (result.code !== 0) {
    throw new JiraError({
      kind: "config",
      operation: "jira.config.resolvePath",
      message: "Jira config requires a git repository.",
    });
  }

  const rawCommonDir = result.stdout.trim();
  if (rawCommonDir.length === 0) {
    throw new JiraError({
      kind: "config",
      operation: "jira.config.resolvePath",
      message: "Could not resolve the shared git directory.",
    });
  }

  const commonDir = path.resolve(cwd, rawCommonDir);
  const repoRoot = path.basename(commonDir) === ".git" ? path.dirname(commonDir) : commonDir;
  return path.join(repoRoot, ".t3-jira-config.json");
}

const parseJiraFileConfig = Schema.decodeUnknownSync(JiraFileConfigSchema);

async function loadResolvedConfig(cwd: string): Promise<ResolvedJiraConfig> {
  const configPath = await resolveConfigPath(cwd);

  let rawConfig: string;
  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") {
      throw new JiraError({
        kind: "config",
        operation: "jira.config.read",
        message: "Missing .t3-jira-config.json in the shared repository root.",
        cause,
      });
    }

    throw new JiraError({
      kind: "config",
      operation: "jira.config.read",
      message: "Failed to read .t3-jira-config.json.",
      cause,
    });
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawConfig);
  } catch (cause) {
    throw new JiraError({
      kind: "config",
      operation: "jira.config.parse",
      message: "Invalid Jira config JSON.",
      cause,
    });
  }

  try {
    return normalizeConfig(parseJiraFileConfig(decoded), configPath);
  } catch (cause) {
    if (Schema.is(JiraError)(cause)) {
      throw cause;
    }

    throw new JiraError({
      kind: "config",
      operation: "jira.config.parse",
      message: "Invalid Jira config shape.",
      cause,
    });
  }
}

export const makeJiraConfig = () =>
  Layer.effect(
    JiraConfig,
    Effect.succeed({
      getConfigStatus: (cwd: string) =>
        Effect.tryPromise({
          try: async () => {
            let configPath: string;
            try {
              configPath = await resolveConfigPath(cwd);
            } catch (cause) {
              return {
                status: "invalid" as const,
                configPath: path.join(cwd, ".t3-jira-config.json"),
                error:
                  cause instanceof Error ? cause.message : "Failed to resolve Jira config path.",
              };
            }

            try {
              await loadResolvedConfig(cwd);
              return {
                status: "ready" as const,
                configPath,
              };
            } catch (cause) {
              if (Schema.is(JiraError)(cause) && cause.kind === "config") {
                return {
                  status: cause.message.includes("Missing .t3-jira-config.json")
                    ? ("missing" as const)
                    : ("invalid" as const),
                  configPath,
                  ...(cause.message.includes("Missing .t3-jira-config.json")
                    ? {}
                    : { error: cause.message }),
                };
              }

              return {
                status: "invalid" as const,
                configPath,
                error: cause instanceof Error ? cause.message : "Failed to load Jira config.",
              };
            }
          },
          catch: (cause) =>
            new JiraError({
              kind: "config",
              operation: "jira.config.status",
              message: "Failed to inspect Jira config status.",
              cause,
            }),
        }),
      getResolvedConfig: (cwd: string) =>
        Effect.tryPromise({
          try: () => loadResolvedConfig(cwd),
          catch: (cause) =>
            Schema.is(JiraError)(cause)
              ? cause
              : new JiraError({
                  kind: "config",
                  operation: "jira.config.load",
                  message: "Failed to load Jira config.",
                  cause,
                }),
        }),
    }),
  );

export const JiraConfigLive = makeJiraConfig();
