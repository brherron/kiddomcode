# Jira Related Issues Detail Row Design

## Summary

Add a new `Related` detail row to the Jira issue detail pane that surfaces all direct, non-parent relationships for the current issue in one place. The existing `Parent` row remains separate. Direct subtasks are included in the `Related` row rather than getting their own row.

## Goals

- Show all direct, non-parent Jira relationships for the current issue in the detail pane.
- Keep Jira-specific response parsing on the server instead of the web client.
- Present relationships in a compact, scan-friendly stacked list.
- Hide the row entirely when no direct related issues exist.

## Non-Goals

- Showing inferred relationships beyond Jira’s direct issue detail payload.
- Replacing or merging the existing `Parent` row.
- Exposing raw Jira REST `issuelinks` payloads to the client.

## Data Model

Extend `JiraIssueDetail` with a normalized `relatedIssues` array. Each related issue entry should include:

- `key`
- `summary`
- `issueTypeName`
- `statusName`
- optional `statusCategoryName`
- `relationship`

The `relationship` field should be normalized into a small enum owned by `packages/contracts`, covering the direct relationships the pane cares about now:

- `subtask`
- `relates_to`
- `duplicates`
- `duplicated_by`

This keeps the contract stable even if Jira’s raw response shape changes or additional link metadata appears.

## Server Mapping

`apps/server/src/jira/Layers/JiraService.ts` should normalize related issues when mapping `getIssueDetail` responses.

- Parent data continues to populate `parentKey` and `parentSummary` only.
- Direct subtasks come from Jira’s `subtasks` field and map to `relationship: "subtask"`.
- Linked issues come from Jira’s `issuelinks` field.
- Only the supported relationship types should be emitted initially.
- Unsupported or malformed links should be ignored rather than passed through partially.

Ordering should be stable and predictable for the UI. The initial order should be:

1. Direct subtasks in payload order
2. Supported issue links in payload order

## UI Behavior

`apps/web/src/components/right-panel/JiraIssueDetailPane.tsx` should render a new `Related` `DetailRow` beneath `Parent` and above `Labels`.

Each stacked item should show:

- a small relationship badge
- the related issue key
- the related issue summary
- a small trailing status chip

The row should be hidden if `relatedIssues` is empty.

## Testing

- Add server tests proving subtasks and supported issue links are normalized into `relatedIssues`.
- Add pane tests proving the `Related` row renders stacked relation labels and hides when no related issues exist.
- Preserve existing `Parent` row behavior.

## Verification

Before completion, run:

- `bun fmt`
- `bun lint`
- `bun typecheck`
