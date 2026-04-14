import { Buffer } from "node:buffer";

import { Effect, Layer } from "effect";

import { JiraError, type JiraConnectionDefaults } from "@t3tools/contracts";
import { JiraConnectionService, type ResolvedJiraConnection } from "../Services/JiraConnectionService";
import { ServerSettingsService } from "../../serverSettings";

type JiraFetchImplementation = (input: string | URL, init?: RequestInit) => Promise<Response>;

function normalizeBaseUrl(input: string): string {
  const url = new URL(input);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/+$/g, "");
}

function buildAuthHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

function mapStatusFromSettings(input: {
  baseUrl: string;
  email: string;
  token: string;
  defaults: JiraConnectionDefaults;
}) {
  const hasToken = input.token.trim().length > 0;
  if (!input.baseUrl.trim() && !input.email.trim() && !hasToken) {
    return {
      status: "missing" as const,
      hasToken: false,
      defaults: input.defaults,
    };
  }

  if (!input.baseUrl.trim() || !input.email.trim() || !hasToken) {
    return {
      status: "invalid_config" as const,
      hasToken,
      ...(input.baseUrl.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
      ...(input.email.trim() ? { email: input.email.trim() } : {}),
      defaults: input.defaults,
      error: "Saved Jira settings are incomplete.",
    };
  }

  return {
    status: "ready" as const,
    hasToken: true,
    baseUrl: input.baseUrl.trim(),
    email: input.email.trim(),
    defaults: input.defaults,
  };
}

export const makeJiraConnectionService = (options?: {
  readonly fetchImplementation?: JiraFetchImplementation;
}) =>
  Layer.effect(
    JiraConnectionService,
    Effect.gen(function* () {
      const serverSettings = yield* ServerSettingsService;
      const fetchImplementation: JiraFetchImplementation =
        options?.fetchImplementation ?? ((input, init) => globalThis.fetch(input, init));

      const toResolvedConnection = (
        input: Awaited<ReturnType<typeof serverSettings.getSettings>>["jira"],
      ): ResolvedJiraConnection => {
        const normalized = mapStatusFromSettings(input);
        if (normalized.status !== "ready") {
          throw new JiraError({
            kind: "config",
            operation: "jira.connection.resolve",
            message:
              normalized.status === "missing"
                ? "Jira is not connected."
                : normalized.error ?? "Saved Jira settings are invalid.",
          });
        }

        return {
          baseUrl: normalizeBaseUrl(input.baseUrl),
          email: input.email.trim(),
          token: input.token.trim(),
          defaults: input.defaults,
        };
      };

      const testResolvedConnection = Effect.fn("JiraConnectionService.testResolvedConnection")(
        function* (connection: ResolvedJiraConnection) {
          const url = new URL("/rest/api/3/myself", `${connection.baseUrl}/`);

          const response = yield* Effect.tryPromise({
            try: () =>
              fetchImplementation(url.toString(), {
                headers: {
                  authorization: buildAuthHeader(connection.email, connection.token),
                  accept: "application/json",
                },
              }),
            catch: (cause) =>
              new JiraError({
                kind: "fetch",
                operation: "jira.connection.test",
                message: cause instanceof Error ? cause.message : "Failed to reach Jira.",
                cause,
              }),
          }).pipe(
            Effect.catchTag("JiraError", () =>
              Effect.succeed({
                status: "unreachable" as const,
                hasToken: true,
                baseUrl: connection.baseUrl,
                email: connection.email,
                defaults: connection.defaults,
                error: "Failed to reach Jira.",
              }),
            ),
          );

          if (!(response instanceof Response)) {
            return response;
          }

          if (response.status === 401 || response.status === 403) {
            return {
              status: "invalid_auth" as const,
              hasToken: true,
              baseUrl: connection.baseUrl,
              email: connection.email,
              defaults: connection.defaults,
              error: "Jira rejected the saved credentials.",
            };
          }

          if (!response.ok) {
            return {
              status: "unreachable" as const,
              hasToken: true,
              baseUrl: connection.baseUrl,
              email: connection.email,
              defaults: connection.defaults,
              error: `Jira request failed with status ${response.status}.`,
            };
          }

          return {
            status: "ready" as const,
            hasToken: true,
            baseUrl: connection.baseUrl,
            email: connection.email,
            defaults: connection.defaults,
          };
        },
      );

      return {
        getConnectionStatus: () =>
          serverSettings.getSettings.pipe(
            Effect.map((settings) => mapStatusFromSettings(settings.jira)),
          ),
        getResolvedConnection: () =>
          serverSettings.getSettings.pipe(
            Effect.map((settings) => settings.jira),
            Effect.map(toResolvedConnection),
          ),
        testConnection: (input) =>
          Effect.try({
            try: () => ({
              baseUrl: normalizeBaseUrl(input.baseUrl),
              email: input.email.trim(),
              token: input.token.trim(),
              defaults: input.defaults ?? {},
            }),
            catch: (cause) =>
              new JiraError({
                kind: "config",
                operation: "jira.connection.test",
                message: "Invalid Jira base URL.",
                cause,
              }),
          }).pipe(
            Effect.catchTag("JiraError", (error) =>
              Effect.succeed({
                status: "invalid_config" as const,
                hasToken: input.token.trim().length > 0,
                ...(input.baseUrl.trim() ? { baseUrl: input.baseUrl.trim() } : {}),
                ...(input.email.trim() ? { email: input.email.trim() } : {}),
                defaults: input.defaults ?? {},
                error: error.message,
              }),
            ),
            Effect.flatMap(testResolvedConnection),
          ),
        saveConnection: (input) =>
          Effect.gen(function* () {
            const tested = yield* testResolvedConnection({
              baseUrl: normalizeBaseUrl(input.baseUrl),
              email: input.email.trim(),
              token: input.token.trim(),
              defaults: input.defaults ?? {},
            });

            yield* serverSettings.updateSettings({
              jira: {
                baseUrl: normalizeBaseUrl(input.baseUrl),
                email: input.email.trim(),
                token: input.token.trim(),
                defaults: input.defaults ?? {},
              },
            });

            return tested;
          }),
        disconnect: () =>
          serverSettings.updateSettings({
            jira: {
              baseUrl: "",
              email: "",
              token: "",
              defaults: {},
            },
          }).pipe(Effect.as({ disconnected: true as const })),
      };
    }),
  );

export const JiraConnectionServiceLive = makeJiraConnectionService();
