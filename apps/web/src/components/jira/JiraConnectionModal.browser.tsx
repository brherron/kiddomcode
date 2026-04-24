import "../../index.css";

import type { JiraConnectionStatusResult } from "@t3tools/contracts";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { JiraConnectionModal } from "./JiraConnectionModal";

describe("JiraConnectionModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls onSuccess after a successful save", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const onSubmit = vi.fn(
      async (): Promise<JiraConnectionStatusResult> => ({
        status: "ready",
        hasToken: true,
        baseUrl: "https://example.atlassian.net",
        email: "user@example.com",
        defaults: {},
      }),
    );

    const screen = await render(
      <JiraConnectionModal
        open
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        onTestConnection={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    try {
      await expect.element(page.getByText("Connect Jira")).toBeInTheDocument();
      await page.getByLabelText("Jira site URL").fill("https://example.atlassian.net");
      await page.getByLabelText("Jira account email").fill("user@example.com");
      await page.getByLabelText("Jira API token").fill("jira-token");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Save Jira connection" }).click();

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    } finally {
      await screen.unmount();
    }
  });
});
