import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connectionStatusRef, queryClientRef, modalPropsRef } = vi.hoisted(() => ({
  connectionStatusRef: {
    current: {
      data: {
        status: "missing",
        hasToken: false,
        defaults: {},
      } as any,
      isPending: false,
      isFetching: false,
    },
  },
  queryClientRef: {
    current: {
      invalidateQueries: vi.fn(() => Promise.resolve()),
    },
  },
  modalPropsRef: {
    current: null as null | { open: boolean },
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: vi.fn(() => connectionStatusRef.current),
    useQueryClient: vi.fn(() => queryClientRef.current),
  };
});

vi.mock("~/environments/runtime", () => ({
  addSavedEnvironment: vi.fn(),
  getPrimaryEnvironmentConnection: vi.fn(),
  reconnectSavedEnvironment: vi.fn(),
  removeSavedEnvironment: vi.fn(),
  useSavedEnvironmentRegistryStore: (
    selector: (state: { byId: Record<string, never> }) => unknown,
  ) => selector({ byId: {} }),
  useSavedEnvironmentRuntimeStore: (
    selector: (state: { byId: Record<string, never> }) => unknown,
  ) => selector({ byId: {} }),
}));

vi.mock("~/environments/primary", () => ({
  createServerPairingCredential: vi.fn(),
  fetchSessionState: vi.fn(),
  revokeOtherServerClientSessions: vi.fn(),
  revokeServerClientSession: vi.fn(),
  revokeServerPairingLink: vi.fn(),
  isLoopbackHostname: vi.fn(() => true),
}));

vi.mock("../jira/JiraConnectionModal", () => ({
  JiraConnectionModal: (props: { open: boolean }) => {
    modalPropsRef.current = props;
    return <div data-testid="jira-connection-modal">jira-connection-modal</div>;
  },
}));

import { ConnectionsSettings } from "./ConnectionsSettings";

describe("ConnectionsSettings Jira management", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      desktopBridge: undefined,
      nativeApi: undefined,
    });
  });

  afterEach(() => {
    connectionStatusRef.current = {
      data: {
        status: "missing",
        hasToken: false,
        defaults: {},
      } as any,
      isPending: false,
      isFetching: false,
    };
    modalPropsRef.current = null;
    vi.unstubAllGlobals();
  });

  it("renders a connect action when Jira is missing", () => {
    const html = renderToStaticMarkup(<ConnectionsSettings />);

    expect(html).toContain("Jira");
    expect(html).toContain("No Jira connection saved on this machine.");
    expect(html).toContain("Connect");
    expect(html).toContain("jira-connection-modal");
  });

  it("renders management actions when Jira is connected", () => {
    connectionStatusRef.current = {
      data: {
        status: "ready",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {
          projectKey: "WEB",
        },
      } as any,
      isPending: false,
      isFetching: false,
    };

    const html = renderToStaticMarkup(<ConnectionsSettings />);

    expect(html).toContain("Connected to https://example.atlassian.net as user@example.com.");
    expect(html).toContain("Edit");
    expect(html).toContain("Test connection");
    expect(html).toContain("Disconnect");
  });

  it("renders recovery actions when Jira needs to be reconnected", () => {
    connectionStatusRef.current = {
      data: {
        status: "invalid_auth",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {},
        error: "Jira rejected the saved credentials.",
      } as any,
      isPending: false,
      isFetching: false,
    };

    const html = renderToStaticMarkup(<ConnectionsSettings />);

    expect(html).toContain("Reconnect Jira to fix the saved credentials.");
    expect(html).toContain("Jira rejected the saved credentials.");
    expect(html).toContain("Edit");
    expect(html).toContain("Test connection");
    expect(html).toContain("Disconnect");
  });
});
