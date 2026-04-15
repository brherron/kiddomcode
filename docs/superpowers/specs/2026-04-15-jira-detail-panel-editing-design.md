# Jira Detail Panel Editing

## Goal

Let users edit two Jira fields directly from the issue detail panel in the Jira side panel:

- issue status
- story points

The current chips in `JiraIssueDetailPane` should become dropdown controls rather than read-only badges.

## Scope

This change applies to the Jira issue detail experience in the web app and the supporting Jira server layer.

In scope:

- Replace the status chip with a dropdown that lists the board’s statuses.
- Replace the story points chip with a dropdown for numeric point values.
- Fetch board configuration so the status menu can be based on the ticket’s board.
- Use the board’s estimation field metadata so story points edits target the correct Jira field.
- Persist edits back to Jira and refresh the current ticket view afterward.

Out of scope:

- Redesigning the rest of the Jira panel.
- Adding a generic inline editing system for other fields.
- Introducing freeform story-point text entry.
- Changing Jira work-action behavior.

## User Experience

The `Properties` row in `JiraIssueDetailPane` stays compact, but the status and points chips become clickable dropdowns.

### Status

- The dropdown label shows the ticket’s current status.
- The menu is populated from the board’s configured statuses.
- The current status remains selected in the menu.
- If a board status cannot actually be reached from the current issue, it should appear disabled rather than silently omitted.
- Choosing an enabled status updates the issue in Jira and then refreshes the issue detail and active task list.

### Story Points

- The dropdown label shows the current points value, or an unset state when the issue has no points yet.
- The menu should offer a small numeric set suitable for the board, not an arbitrary text input.
- The board’s estimation field determines which Jira custom field is updated.
- Choosing a value updates the issue in Jira and then refreshes the issue detail and active task list.

If editing is unavailable, the chips should fall back to plain read-only badges instead of breaking the panel.

## Data Model

The current contract already exposes issue detail, but it does not expose the metadata needed to edit status and points safely.

Add a small Jira metadata response that can answer:

- which board a project uses
- what statuses that board exposes
- which field Jira uses for board estimation

Proposed normalized data:

- board id
- board name
- board column list
- flattened status list with stable Jira status ids and names
- estimation field id when the board uses field-based estimation

The issue detail response should continue to expose the current issue’s rendered fields, including the current status name and the current story points value when available.

## Server Design

Extend `apps/server/src/jira/Layers/JiraService.ts` with three new capabilities:

1. Fetch board configuration for the configured Jira board.
2. Fetch the available transitions for a specific issue.
3. Update an issue’s status or points.

### Board metadata

Use the saved Jira `boardId` from machine-level connection defaults.

Fetch:

- `GET /rest/agile/1.0/board/{boardId}/configuration`

From that response, normalize:

- the board’s statuses from `columnConfig.columns[].statuses[]`
- the estimation field id from `estimation.field.fieldId` when estimation type is `field`

### Status updates

Status changes should still be executed through Jira’s issue transition API:

- `GET /rest/api/3/issue/{issueIdOrKey}/transitions`
- `POST /rest/api/3/issue/{issueIdOrKey}/transitions`

The server should fetch transitions for the current issue and build a lookup from board status id to transition id.

The UI will show every board status, but a status is actionable only when the server can resolve a transition to it from the current issue.

### Story point updates

Story points should be written through the issue update API using the board’s estimation field id:

- `PUT /rest/api/3/issue/{issueIdOrKey}`

The server should update the resolved estimation field to the selected numeric value.

If the board does not use field-based estimation, or the field id cannot be resolved, the server should reject the edit with a Jira error that the client can convert into a read-only fallback.

## Client Design

Keep `JiraPanelTab` responsible for loading and orchestration. Keep `JiraIssueDetailPane` focused on rendering and local menu state.

### Query layer

Extend `apps/web/src/lib/jiraReactQuery.ts` with query helpers for board metadata and issue transitions, plus mutation helpers for:

- changing issue status
- changing story points

After a successful mutation, invalidate:

- the current issue detail query
- the active tasks query for the current cwd

### Detail pane

Update `apps/web/src/components/right-panel/JiraIssueDetailPane.tsx` so:

- the status chip renders as a menu trigger
- the story points chip renders as a menu trigger
- the menu data is passed in as resolved props rather than fetched directly in the leaf component
- the existing visual style of the chips is preserved as much as practical

The panel should not own Jira fetch logic. It can own tiny interaction state, such as an open/closed menu state, but not request orchestration.

### Panel tab

Update `apps/web/src/components/right-panel/JiraPanelTab.tsx` to:

- load board metadata when the Jira connection is ready and a ticket is selected
- load issue transitions for the selected issue
- derive menu options from those queries
- pass mutation callbacks into `JiraIssueDetailPane`

The selection and action-state logic for work actions should remain unchanged.

## Error Handling

The feature must degrade cleanly.

### Missing board settings

If the saved Jira connection does not include a `boardId`, the issue detail should remain readable, but the editing controls should render as non-interactive badges.

### Board or transition fetch failure

If board metadata or transitions fail to load:

- keep the issue detail visible
- keep the existing work actions visible
- disable editing controls rather than preventing the panel from rendering

### Mutation failure

If a status or story-point update fails:

- surface the Jira error from the mutation
- do not optimistically rewrite the issue detail in client state
- refetch the detail after success, not after failure

This keeps behavior predictable when Jira rejects a transition or a field update.

## Testing

Add focused tests for:

- server normalization of board configuration into a flattened status list
- server resolution of board estimation field id
- status update request shape and transition mapping
- story points update request shape
- pane rendering of dropdown triggers for status and points
- disabled fallback when editing metadata is unavailable
- invalid status selection and invalid point selection handling

Update existing detail-pane tests to account for the new dropdown behavior, and keep the current read-only rendering path covered when metadata is missing.

## Verification

Before completion, run:

- `bun fmt`
- `bun lint`
- `bun typecheck`

