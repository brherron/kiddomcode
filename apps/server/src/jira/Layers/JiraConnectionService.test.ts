import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";

import { ServerSettingsService } from "../../serverSettings";
import { JiraConnectionService } from "../Services/JiraConnectionService";
import { makeJiraConnectionService } from "./JiraConnectionService";

describe("JiraConnectionService", () => {
  function makeLayer(
    fetchImplementation: (input: string | URL, init?: RequestInit) => Promise<Response>,
  ) {
    return makeJiraConnectionService({ fetchImplementation }).pipe(
      Layer.provide(ServerSettingsService.layerTest()),
      Layer.provide(NodeServices.layer),
    );
  }

  it("returns missing when no Jira connection has been saved", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* JiraConnectionService;
        const result = yield* service.getConnectionStatus();

        expect(result).toEqual({
          status: "missing",
          hasToken: false,
          defaults: {},
        });
      }).pipe(
        Effect.provide(
          makeLayer(async () => new Response(JSON.stringify({ accountId: "unused" }))),
        ),
      ),
    );
  });

  it("maps Jira auth failures to invalid_auth during connection tests", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* JiraConnectionService;
        const result = yield* service.testConnection({
          baseUrl: "https://example.atlassian.net",
          email: "user@example.com",
          token: "jira-token",
        });

        expect(result.status).toBe("invalid_auth");
        expect(result.hasToken).toBe(true);
      }).pipe(Effect.provide(makeLayer(async () => new Response("forbidden", { status: 403 })))),
    );
  });

  it("maps network failures to unreachable during connection tests", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* JiraConnectionService;
        const result = yield* service.testConnection({
          baseUrl: "https://example.atlassian.net",
          email: "user@example.com",
          token: "jira-token",
        });

        expect(result.status).toBe("unreachable");
        expect(result.hasToken).toBe(true);
      }).pipe(
        Effect.provide(
          makeLayer(async () => {
            throw new Error("connect ECONNREFUSED");
          }),
        ),
      ),
    );
  });

  it("saves credentials and defaults after a successful connection test", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* JiraConnectionService;
        const saved = yield* service.saveConnection({
          baseUrl: "https://example.atlassian.net",
          email: "user@example.com",
          token: "jira-token",
          defaults: {
            projectKey: "WEB",
            boardId: "23",
          },
        });

        expect(saved.status).toBe("ready");

        const status = yield* service.getConnectionStatus();
        expect(status.status).toBe("ready");
        expect(status.baseUrl).toBe("https://example.atlassian.net");
        expect(status.email).toBe("user@example.com");
        expect(status.hasToken).toBe(true);
        expect(status.defaults.boardId).toBe("23");
      }).pipe(
        Effect.provide(
          makeLayer(async () => new Response(JSON.stringify({ accountId: "abc123" }))),
        ),
      ),
    );
  });

  it("clears the saved Jira connection on disconnect", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ accountId: "abc123" })));

    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* JiraConnectionService;

        yield* service.saveConnection({
          baseUrl: "https://example.atlassian.net",
          email: "user@example.com",
          token: "jira-token",
        });

        const disconnected = yield* service.disconnect();
        expect(disconnected).toEqual({ disconnected: true });

        const status = yield* service.getConnectionStatus();
        expect(status).toEqual({
          status: "missing",
          hasToken: false,
          defaults: {},
        });
      }).pipe(Effect.provide(makeLayer(fetchSpy))),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
