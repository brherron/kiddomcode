# Jira Ticket Detail Pane Redesign

## Goal

Replace the current Jira issue detail pane with a denser, more structured layout that matches the requested design direction while preserving the existing list-then-detail split in the Jira side panel.

## Scope

This redesign applies only to the Jira ticket detail view in `apps/web/src/components/right-panel/JiraPanelTab.tsx`.

In scope:

- Keep the existing ticket list above the detail pane.
- Keep existing Jira data-fetching and selection behavior.
- Keep existing work-action controls.
- Replace the detail content layout with a dedicated Jira-only component.
- Show the ticket-type icon above the summary using the existing issue-type color scheme.
- Add a labeled `Parent` row that shows the parent ticket summary.
- Place the ticket description directly below the summary.
- Add a `Latest update` card sourced only from Jira comments.

Out of scope:

- Redesigning the right-panel shell.
- Changing Plan panel layouts.
- Adding new update sources beyond Jira comments.
- Reworking Jira data contracts unless the current detail contract is missing a field needed by the approved layout.

## UX Structure

The Jira side panel remains split into two areas:

1. Ticket list
2. Selected ticket detail

The selected ticket detail is reorganized into four stacked sections:

### 1. Header

- Show the issue-type icon as a small leading symbol above the text block.
- Reuse the established issue-type color mapping for bug/task/story/epic.
- Render the ticket summary as the primary heading.
- Render the issue description immediately below the summary.

### 2. Property Rows

Render metadata as labeled rows instead of a loose chip cloud.

Planned rows:

- `Properties`: status, priority, story points, flagged state, and issue key
- `Parent`: parent ticket summary when available

Rows should collapse when data is absent rather than showing empty placeholders.

### 3. Latest Update

- Render a dedicated `Latest update` card after the property rows.
- Source it only from Jira comments.
- When comments exist, show the newest comment with author and timestamp metadata.
- When comments do not exist, show an explicit empty state such as `No updates yet.`

### 4. Remaining Comment History

Keep older comments below the latest-update card in a simpler stacked format so existing access to comment history is preserved without competing with the new featured update block.

## Architecture

Introduce a focused presentational component, tentatively `JiraIssueDetailPane`, and keep `JiraPanelTab` responsible for:

- data loading
- action-state derivation
- selection state
- empty/loading/error handling for the tab as a whole

The new detail component should receive already-resolved issue and action props and own only rendering concerns. This keeps the large container component from absorbing more layout-specific logic.

Small local subcomponents inside the detail-pane file are acceptable for repeated row/card patterns if they reduce duplication without over-fragmenting the feature.

## Data Mapping

- Issue type icon: derived from `issueTypeName`
- Summary: `summary`
- Description: `descriptionMarkdown`
- Status: `statusName` and `statusCategoryName`
- Priority: `priorityName` when currently supported by the UI
- Story points: `storyPoints`
- Flagged: `isFlagged`
- Parent row: `parentSummary`
- Latest update: most recent entry in `comments`

If Jira comments are not already ordered newest-first, the detail component must explicitly derive the latest comment by timestamp instead of relying on array order.

## Error Handling

- Preserve the existing tab-level empty, loading, missing-config, and invalid-config states.
- Preserve the existing no-selection state.
- When description is empty, show `No description.`
- When there are no comments, keep the `Latest update` card visible with an empty state instead of removing the section.

## Testing

Add focused component/browser tests around the new detail rendering:

- issue-type icon and color treatment render for a selected issue
- description appears directly below the summary
- `Parent` row renders only when parent data exists
- latest update prefers the newest comment
- latest update empty state renders when comments are absent
- older comments still render outside the featured latest-update card

The list/detail split and existing Jira actions should remain covered by current tests unless the refactor requires targeted updates.
