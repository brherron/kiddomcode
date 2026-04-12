# Jira State-Aware Work Actions Design

## Goal

Replace the Jira panel's single `Start Work` action with a split-button that recommends a workflow action based on Jira status and local dev context, while always letting the user override that recommendation from a dropdown.

## Scope

This v1 design covers:

- Jira ticket status awareness
- Exact Jira-key local branch matching
- Lightweight branch ranking using existing signals
- New-thread-only action execution
- Distinct prompt templates for `Start Work`, `Continue on <branch>`, and `Start Review`

This v1 explicitly does not cover:

- Reusing existing chat threads
- Fuzzy branch matching
- Hidden automation that auto-selects between multiple plausible branches
- Full workflow orchestration across comments, assignee changes, or richer Jira metadata

## Product Behavior

The Jira detail panel shows a split-button:

- Primary button runs the recommended action
- Dropdown shows all valid actions
- Recommendation reasons appear only inside the dropdown

Supported actions:

- `Start Work`
- `Continue on <branch>` for each plausible Jira-key branch match
- `Start Review`

All actions create a new thread.

## Recommendation Rules

Hard rule:

- If the Jira status is `Code Review`, recommend `Start Review`

Otherwise:

- No exact Jira-key branch matches: recommend `Start Work`
- Exactly one plausible branch match: recommend `Continue on <branch>`
- Multiple plausible branch matches: recommend `Start Work`, but list each continuation option in the dropdown

Branch ranking signals for menu order and reasons:

- Current checked-out branch
- Existing worktree path
- Open pull request for that branch
- Branch list order from Git, which already prefers current/default and then recent commit activity

## Action Semantics

### Start Work

- Resolve the base branch
- Create a new branch/worktree
- Create a new thread bound to that worktree
- Seed the thread with a start-work prompt built from Jira issue data

### Continue on Branch

- Reuse the selected branch
- If the branch already has a worktree, bind the new thread to it
- If it does not, materialize a worktree for that existing branch
- Create a new thread bound to that branch/worktree
- Seed the thread with a continuation prompt that includes ticket, branch, and PR context

### Start Review

- Create a new review-oriented thread
- Use local branch/worktree or PR context when available
- If PR context is missing, instruct the agent to resolve the PR from GitHub first
- Seed the thread with a review prompt focused on bugs, regressions, missing tests, and risks

## Implementation Shape

- Keep recommendation logic in a pure web helper module with direct tests
- Keep prompt builders in shared Jira web helpers
- Extend the Jira tools store from a single start-work handler to a generic work-action handler
- Update the Jira panel UI to render a split-button with menu reasons
- Extend `ChatView` with action handlers for start, continue, and review thread creation

## Risks

- Existing Jira panel files are already in active development, so edits must preserve in-flight behavior
- `Continue on <branch>` needs a worktree path; when one is not present the flow must materialize it without changing the main checkout
- PR lookup by branch can fail; the UI should degrade gracefully and still allow the action
