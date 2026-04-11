import type { GitBranch, GitRunStackedActionResult } from "@t3tools/contracts";

const JIRA_ISSUE_KEY_REGEX = /([A-Z][A-Z0-9]+-\d+)/i;
const MAX_JIRA_BRANCH_NAME_LENGTH = 64;

function slugifySummary(summary: string): string {
  return summary
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function extractJiraIssueKey(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const match = JIRA_ISSUE_KEY_REGEX.exec(value);
  return match?.[1] ? match[1].toUpperCase() : null;
}

export function buildJiraWorktreeBranchName(issueKey: string, summary: string): string {
  const normalizedKey = issueKey.trim().toLowerCase();
  const summarySlug = slugifySummary(summary);
  const maxSlugLength = Math.max(0, MAX_JIRA_BRANCH_NAME_LENGTH - normalizedKey.length - 1);
  const truncatedSlug = summarySlug.slice(0, maxSlugLength).replace(/-+$/g, "");
  return truncatedSlug.length > 0 ? `${normalizedKey}-${truncatedSlug}` : normalizedKey;
}

export function resolveBaseBranchForJiraStartWork(
  branches: ReadonlyArray<Pick<GitBranch, "name" | "isDefault">>,
  fallbackBranch: string | null,
): string | null {
  return branches.find((branch) => branch.isDefault)?.name ?? fallbackBranch;
}

export function buildJiraStartWorkPrompt(input: {
  key: string;
  summary: string;
  descriptionMarkdown: string;
}): string {
  const description = input.descriptionMarkdown.trim();
  return [
    `Jira key: ${input.key}`,
    `Summary: ${input.summary}`,
    "",
    "Description:",
    description.length > 0 ? description : "_No Jira description provided._",
    "",
    "Please stay scoped to this ticket and call out any missing or ambiguous requirements before implementation.",
  ].join("\n");
}

export function resolveJiraIssueKeyForPrAutomation(input: {
  currentBranch: string | null | undefined;
  result: Pick<GitRunStackedActionResult, "pr">;
}): string | null {
  const prStatus = input.result.pr.status;
  if (prStatus !== "created" && prStatus !== "opened_existing") {
    return null;
  }
  if (!input.result.pr.url) {
    return null;
  }

  return (
    extractJiraIssueKey(input.currentBranch) ??
    extractJiraIssueKey(input.result.pr.headBranch ?? null)
  );
}
