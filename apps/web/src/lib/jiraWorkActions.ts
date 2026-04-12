import type { GitResolvedPullRequest } from "@t3tools/contracts";

import { extractJiraIssueKey } from "./jira";

export interface JiraWorkActionIssueContext {
  key: string;
  statusName: string;
  statusCategoryName?: string | undefined;
}

export interface JiraWorkActionBranchContext {
  name: string;
  current: boolean;
  worktreePath: string | null;
  hasOpenPullRequest: boolean;
  pullRequest: Pick<
    GitResolvedPullRequest,
    "number" | "title" | "url" | "baseBranch" | "headBranch" | "state"
  > | null;
}

export interface JiraWorkActionOption {
  kind: "start_work" | "continue_work" | "start_review";
  label: string;
  reason: string;
  branchName?: string;
  pullRequest?: JiraWorkActionBranchContext["pullRequest"];
}

export interface JiraWorkActionState {
  primaryAction: JiraWorkActionOption;
  actions: JiraWorkActionOption[];
  matchingBranches: JiraWorkActionBranchContext[];
}

function isCodeReviewStatus(issue: JiraWorkActionIssueContext): boolean {
  return issue.statusName.trim().toLowerCase() === "code review";
}

function buildStartWorkAction(): JiraWorkActionOption {
  return {
    kind: "start_work",
    label: "Start Work",
    reason: "Create a fresh branch and worktree for this ticket.",
  };
}

function buildContinueAction(branch: JiraWorkActionBranchContext): JiraWorkActionOption {
  return buildContinueActionVariant(branch, "specific");
}

function buildContinueActionVariant(
  branch: JiraWorkActionBranchContext,
  variant: "generic" | "specific",
): JiraWorkActionOption {
  const reasons: string[] = [];
  if (branch.current) {
    reasons.push("Current branch");
  }
  if (branch.hasOpenPullRequest) {
    reasons.push("Open PR");
  }
  if (branch.worktreePath) {
    reasons.push("Existing worktree");
  }

  return {
    kind: "continue_work",
    label: variant === "generic" ? "Continue Work" : `Continue on ${branch.name}`,
    reason:
      reasons.length > 0
        ? `${reasons.join(", ")} on ${branch.name}.`
        : `Existing branch already matches this ticket: ${branch.name}.`,
    branchName: branch.name,
    pullRequest: branch.pullRequest,
  };
}

function buildStartReviewAction(input: {
  issue: JiraWorkActionIssueContext;
  branch?: JiraWorkActionBranchContext | null;
}): JiraWorkActionOption {
  const reasons: string[] = [];
  if (isCodeReviewStatus(input.issue)) {
    reasons.push("Ticket is in Code Review");
  }
  if (input.branch?.hasOpenPullRequest) {
    reasons.push("Open PR");
  }

  return {
    kind: "start_review",
    label: "Start Review",
    reason:
      reasons.length > 0
        ? `${reasons.join(", ")}.`
        : "Start a review-focused thread for this ticket.",
    ...(input.branch?.name ? { branchName: input.branch.name } : {}),
    ...(input.branch?.pullRequest ? { pullRequest: input.branch.pullRequest } : {}),
  };
}

function sortMatchingBranches(
  branches: ReadonlyArray<JiraWorkActionBranchContext>,
): JiraWorkActionBranchContext[] {
  return branches.toSorted((left, right) => {
    const leftScore =
      (left.hasOpenPullRequest ? 100 : 0) + (left.current ? 10 : 0) + (left.worktreePath ? 1 : 0);
    const rightScore =
      (right.hasOpenPullRequest ? 100 : 0) +
      (right.current ? 10 : 0) +
      (right.worktreePath ? 1 : 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return left.name.localeCompare(right.name);
  });
}

export function buildJiraWorkActionState(input: {
  issue: JiraWorkActionIssueContext;
  branches: ReadonlyArray<JiraWorkActionBranchContext>;
}): JiraWorkActionState {
  const matchingBranches = sortMatchingBranches(
    input.branches.filter((branch) => extractJiraIssueKey(branch.name) === input.issue.key),
  );
  const topBranch = matchingBranches[0] ?? null;
  const hasReviewAlternative =
    isCodeReviewStatus(input.issue) || matchingBranches.some((branch) => branch.hasOpenPullRequest);

  if (isCodeReviewStatus(input.issue)) {
    const primaryAction = buildStartReviewAction({ issue: input.issue, branch: topBranch });
    const actions = [
      primaryAction,
      ...matchingBranches.map((branch) => buildContinueAction(branch)),
      buildStartWorkAction(),
    ];
    return { primaryAction, actions, matchingBranches };
  }

  if (matchingBranches.length === 1 && topBranch) {
    const primaryAction = buildContinueActionVariant(topBranch, "generic");
    const actions = [primaryAction, buildStartWorkAction()];
    if (hasReviewAlternative) {
      actions.push(buildStartReviewAction({ issue: input.issue, branch: topBranch }));
    }
    return { primaryAction, actions, matchingBranches };
  }

  const primaryAction = buildStartWorkAction();
  const actions = [primaryAction, ...matchingBranches.map((branch) => buildContinueAction(branch))];
  if (hasReviewAlternative) {
    actions.push(buildStartReviewAction({ issue: input.issue, branch: topBranch }));
  }

  return { primaryAction, actions, matchingBranches };
}
