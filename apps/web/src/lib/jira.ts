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
  const ticketContext = buildJiraTicketPromptContext(input);
  return [
    ...ticketContext,
    "",
    "Please stay scoped to this ticket and call out any missing or ambiguous requirements before implementation.",
  ].join("\n");
}

function buildJiraTicketPromptContext(input: {
  key: string;
  summary: string;
  descriptionMarkdown: string;
}): string[] {
  const description = input.descriptionMarkdown.trim();
  return [
    `Jira key: ${input.key}`,
    `Summary: ${input.summary}`,
    "",
    "Description:",
    description.length > 0 ? description : "_No Jira description provided._",
  ];
}

export function buildJiraContinueWorkPrompt(input: {
  key: string;
  summary: string;
  descriptionMarkdown: string;
  branchName: string;
  pullRequest: {
    number: number;
    title: string;
    url: string;
  } | null;
}): string {
  const pullRequestContext = input.pullRequest
    ? [
        `Pull request: #${input.pullRequest.number} ${input.pullRequest.title}`,
        `Pull request URL: ${input.pullRequest.url}`,
      ]
    : ["Pull request: _No open pull request detected._"];

  return [
    ...buildJiraTicketPromptContext(input),
    "",
    `Current branch: ${input.branchName}`,
    ...pullRequestContext,
    "",
    "Inspect the current branch, code, and pull request context first, then summarize the current implementation state before making changes.",
    "Continue the work from that state, and ask me what to tackle next if the next step is unclear.",
  ].join("\n");
}

export function buildJiraStartReviewPrompt(input: {
  key: string;
  summary: string;
  descriptionMarkdown: string;
  branchName: string | null;
  pullRequest: {
    number: number;
    title: string;
    url: string;
  } | null;
}): string {
  const branchContext = input.branchName
    ? [`Relevant branch: ${input.branchName}`]
    : ["Relevant branch: _Resolve from the relevant pull request if needed._"];
  const pullRequestContext = input.pullRequest
    ? [
        `Pull request: #${input.pullRequest.number} ${input.pullRequest.title}`,
        `Pull request URL: ${input.pullRequest.url}`,
      ]
    : [
        "If pull request context is missing, resolve the relevant pull request from GitHub before reviewing.",
      ];

  return [
    ...buildJiraTicketPromptContext(input),
    "",
    ...branchContext,
    ...pullRequestContext,
    "",
    "Please perform a PR/code review for this ticket.",
    "Focus on bugs, regressions, missing tests, and risks.",
    "Do not start implementing fixes unless I ask for changes.",
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
