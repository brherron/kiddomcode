import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../ChatMarkdown", () => ({
  default: ({ text }: { text: string }) => text,
}));

import { JiraIssueDetailPane } from "./JiraIssueDetailPane";

function buildIssue(overrides: Record<string, unknown> = {}) {
  return {
    key: "WEB-101",
    summary: "Implement Jira panel",
    statusName: "In Progress",
    statusCategoryName: "In Progress",
    issueTypeName: "Task",
    priorityName: undefined,
    labels: [],
    isFlagged: false,
    parentKey: undefined,
    parentSummary: undefined,
    relatedIssues: [],
    storyPoints: undefined,
    acv: undefined,
    descriptionMarkdown: "",
    comments: [],
    url: "https://example.atlassian.net/browse/WEB-101",
    ...overrides,
  } as any;
}

describe("JiraIssueDetailPane", () => {
  it("renders the issue header as a sticky region with the action slot", () => {
    const html = renderToStaticMarkup(
      <JiraIssueDetailPane
        cwd="/repo"
        actionSlot={<button type="button">Start Thread</button>}
        issue={buildIssue()}
      />,
    );

    expect(html).toContain("sticky top-0");
    expect(html).toContain("Start Thread");
    expect(html).toContain("Implement Jira panel");
  });

  it("keeps the detail body in a flexible scroll region below the header", () => {
    const html = renderToStaticMarkup(<JiraIssueDetailPane cwd="/repo" issue={buildIssue()} />);

    expect(html).toMatch(/class="[^"]*flex[^"]*h-full[^"]*min-h-0[^"]*flex-col[^"]*"/);
    expect(html).toMatch(/class="[^"]*size-full[^"]*min-h-0[^"]*flex-1[^"]*"/);
  });

  it("renders labels as detail chips when labels exist", () => {
    const html = renderToStaticMarkup(
      <JiraIssueDetailPane
        cwd="/repo"
        issue={buildIssue({ labels: ["frontend", "customer-facing"] })}
      />,
    );

    expect(html).toContain("Labels");
    expect(html).toContain("frontend");
    expect(html).toContain("customer-facing");
  });

  it("hides the labels row when there are no labels", () => {
    const html = renderToStaticMarkup(<JiraIssueDetailPane cwd="/repo" issue={buildIssue()} />);

    expect(html).not.toContain("Labels");
  });

  it("renders a stacked related issues row with relation labels", () => {
    const html = renderToStaticMarkup(
      <JiraIssueDetailPane
        cwd="/repo"
        issue={buildIssue({
          relatedIssues: [
            {
              key: "WEB-102",
              summary: "Follow-up task",
              issueTypeName: "Sub-task",
              statusName: "In Progress",
              statusCategoryName: "In Progress",
              relationshipLabel: "Sub-task",
            },
            {
              key: "WEB-103",
              summary: "Shared dependency",
              issueTypeName: "Task",
              statusName: "To Do",
              statusCategoryName: "To Do",
              relationshipLabel: "Relates to",
            },
            {
              key: "WEB-104",
              summary: "Legacy duplicate",
              issueTypeName: "Bug",
              statusName: "Done",
              statusCategoryName: "Done",
              relationshipLabel: "Duplicates",
            },
            {
              key: "WEB-105",
              summary: "Canonical tracker",
              issueTypeName: "Story",
              statusName: "In Progress",
              statusCategoryName: "In Progress",
              relationshipLabel: "Is duplicated by",
            },
          ],
        })}
      />,
    );

    expect(html).toContain("Related");
    expect(html).toContain("Sub-task");
    expect(html).toContain("Relates to");
    expect(html).toContain("Duplicates");
    expect(html).toContain("Is duplicated by");
    expect(html).toContain("WEB-102");
    expect(html).toContain("WEB-105");
    expect(html).toContain("Follow-up task");
    expect(html).toContain("Canonical tracker");
  });

  it("hides the related row when there are no related issues", () => {
    const html = renderToStaticMarkup(<JiraIssueDetailPane cwd="/repo" issue={buildIssue()} />);

    expect(html).not.toContain("Related");
  });

  it("defaults missing priority to Medium", () => {
    const html = renderToStaticMarkup(<JiraIssueDetailPane cwd="/repo" issue={buildIssue()} />);

    expect(html).toContain("Medium");
  });

  it("renders the ACV row when the issue has an ACV value", () => {
    const html = renderToStaticMarkup(
      <JiraIssueDetailPane cwd="/repo" issue={buildIssue({ acv: "ACV $1M+" })} />,
    );

    expect(html).toContain("ACV");
    expect(html).toContain("ACV $1M+");
  });

  it("hides the ACV row when the issue does not have an ACV value", () => {
    const html = renderToStaticMarkup(<JiraIssueDetailPane cwd="/repo" issue={buildIssue()} />);

    expect(html).not.toContain(">ACV<");
  });
});
