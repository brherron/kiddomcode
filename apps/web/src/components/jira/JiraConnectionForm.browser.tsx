import "../../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { JiraConnectionForm } from "./JiraConnectionForm";

describe("JiraConnectionForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders credentials fields first and advances to onboarding defaults", async () => {
    const screen = await render(
      <JiraConnectionForm onSubmit={vi.fn()} onTestConnection={vi.fn()} />,
    );

    try {
      await expect.element(page.getByLabelText("Jira site URL")).toBeInTheDocument();
      await expect.element(page.getByLabelText("Jira account email")).toBeInTheDocument();
      await expect.element(page.getByLabelText("Jira API token")).toBeInTheDocument();

      await page.getByLabelText("Jira site URL").fill("https://example.atlassian.net");
      await page.getByLabelText("Jira account email").fill("user@example.com");
      await page.getByLabelText("Jira API token").fill("jira-token");
      await page.getByRole("button", { name: "Continue" }).click();

      await expect.element(page.getByLabelText("Default project key")).toBeInTheDocument();
      await expect.element(page.getByLabelText("Default board ID")).toBeInTheDocument();
      await expect.element(page.getByLabelText("Default JQL")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("shows inline validation before leaving the credentials step", async () => {
    const screen = await render(
      <JiraConnectionForm onSubmit={vi.fn()} onTestConnection={vi.fn()} />,
    );

    try {
      await page.getByRole("button", { name: "Continue" }).click();
      await expect.element(page.getByText("Enter your Jira site URL.")).toBeInTheDocument();
      await expect.element(page.getByText("Enter your Jira account email.")).toBeInTheDocument();
      await expect.element(page.getByText("Enter your Jira API token.")).toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });

  it("keeps connection-test errors visible on the defaults step", async () => {
    const onTestConnection = vi.fn(async () => {
      throw new Error("Jira rejected the credentials.");
    });

    const screen = await render(
      <JiraConnectionForm onSubmit={vi.fn()} onTestConnection={onTestConnection} />,
    );

    try {
      await page.getByLabelText("Jira site URL").fill("https://example.atlassian.net");
      await page.getByLabelText("Jira account email").fill("user@example.com");
      await page.getByLabelText("Jira API token").fill("jira-token");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.getByRole("button", { name: "Test connection" }).click();

      await expect.element(page.getByText("Jira rejected the credentials.")).toBeInTheDocument();
      expect(onTestConnection).toHaveBeenCalledTimes(1);
    } finally {
      await screen.unmount();
    }
  });
});
