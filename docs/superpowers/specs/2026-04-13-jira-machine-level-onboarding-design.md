# Jira Machine-Level Onboarding Design

## Summary

Replace the current repo-scoped Jira configuration flow with a machine-level Jira connection owned by T3 Code. Keep the Jira button visible in the chat header. If Jira is not connected, clicking the button opens a lightweight onboarding modal. `Settings > Connections` becomes the durable management surface for the saved Jira account.

## Goals

- Let users connect Jira without editing project files or running this repo locally.
- Store Jira credentials on the machine in T3 Code server-managed persistence.
- Keep the Jira header action discoverable even before setup is complete.
- Provide both a fast in-chat onboarding path and a fuller settings management path.
- Allow onboarding to capture both credentials and optional Jira defaults needed for a useful first-run experience.
- Keep Jira status handling explicit and predictable under connection failures and invalid credentials.

## Non-Goals

- Supporting multiple Jira accounts in the initial version.
- Supporting both machine-level credentials and repo-level `.t3-jira-config.json` as first-class long-term flows.
- Exposing the saved API token back to the web client after it has been written.
- Expanding the Jira panel into board browsing, issue search, or broader admin features during this work.

## Current State

Today the Jira panel is gated by project presence, not Jira readiness.

- [ChatHeader.tsx](/Users/beauherron/Documents/Repositories/kiddomcode/apps/web/src/components/chat/ChatHeader.tsx:1) always shows the Jira toggle when a thread has an active project.
- [JiraPanelTab.tsx](/Users/beauherron/Documents/Repositories/kiddomcode/apps/web/src/components/right-panel/JiraPanelTab.tsx:1) already handles `missing` and `invalid` config states.
- [JiraConfig.ts](/Users/beauherron/Documents/Repositories/kiddomcode/apps/server/src/jira/Layers/JiraConfig.ts:1) resolves credentials from `.t3-jira-config.json` in the shared git root.

That repo-file model conflicts with the desired onboarding flow because it assumes local repository access and project-level setup.

## Product Decision

Adopt a single machine-level Jira connection for the app and route all first-run Jira setup through that model.

- The Jira button stays visible.
- Clicking Jira without a valid connection opens onboarding instead of silently failing.
- `Settings > Connections` shows status and management actions for the same saved connection.
- The existing repo-file Jira config path should be removed or treated as deprecated implementation detail during the migration, not kept as a parallel user-facing setup flow.

## Data Model

Add a machine-level Jira connection record persisted by the server. The exact storage file can follow the existing server settings persistence pattern or a dedicated adjacent persistence file, but it must remain server-owned and machine-local.

The persisted record should include:

- `baseUrl`
- `email`
- `token`
- `defaults`
- `updatedAt`
- `lastValidatedAt`

`defaults` should support the initial onboarding fields needed for immediate usefulness:

- optional default project key
- optional default board or filter identifier
- optional default JQL or task source preset, if that is the chosen server query model

The web-facing status contract should not expose the raw token. It should expose:

- connection status: `missing`, `ready`, `invalid_auth`, `unreachable`, `invalid_config`
- whether a token is saved
- masked connection metadata such as `baseUrl`, `email`, and defaults
- last validation timestamp
- human-readable error detail when relevant

## Server Architecture

Introduce a dedicated Jira connection service that owns:

- loading and saving the machine-level Jira connection
- validating field shape
- masking sensitive fields for UI reads
- testing connectivity against Jira before reporting `ready`
- mapping transport and auth failures into stable app-level statuses

`JiraService` should resolve credentials from this service instead of reading `.t3-jira-config.json`.

Recommended responsibilities:

- `JiraConnectionStore`: persistence and retrieval
- `JiraConnectionService`: validation, masking, and status/test operations
- `JiraService`: Jira API operations using resolved machine-level credentials

This keeps persistence and API behavior separate and avoids growing `JiraService` into a mixed configuration/runtime object.

## Web Architecture

Replace the current repo-oriented `jiraConfigStatus` query with a machine-level Jira connection status query in [jiraReactQuery.ts](/Users/beauherron/Documents/Repositories/kiddomcode/apps/web/src/lib/jiraReactQuery.ts:1).

Add two shared mutation paths:

- `saveJiraConnection`
- `testJiraConnection`

Both the chat onboarding modal and `Settings > Connections` must use the same query and mutation layer so the app has one connection workflow and one status source of truth.

## UI Flow

### Chat Header

The Jira button remains in the chat header when the thread has an active project.

- If Jira connection status is `ready`, the button toggles the Jira panel as it does now.
- If Jira connection status is not ready, clicking the button opens a `Connect Jira` modal instead of the panel.
- The tooltip should explain why the panel cannot open yet, for example `Connect Jira to load tasks for this project.`

### Connect Jira Modal

The chat-triggered modal should be optimized for first-run setup, not long-term administration.

Step 1: Credentials

- Jira site URL
- Jira account email
- Jira API token

Step 2: Defaults

- optional project selection or project key
- optional board/filter/task-source default

Step 3: Verify and save

- explicit connection test
- loading and error states
- success closes the modal and opens the Jira panel in the same interaction

The token field is write-only. After initial save, future edit flows should let the user replace it without ever revealing the stored value.

### Settings > Connections

`Settings > Connections` should gain a Jira section that shows:

- current status
- saved site URL
- saved account email
- whether a token is present
- saved defaults
- last successful validation timestamp

Actions:

- `Connect` when missing
- `Edit`
- `Test connection`
- `Disconnect`

This view is the durable management surface and should remain useful even if the user never enters chat.

### Jira Panel

If the user reaches the Jira panel while Jira status is no longer ready, the panel should render an inline recovery state instead of the current repo-file empty state.

Recovery actions:

- `Connect Jira`
- `Open settings`
- `Retry`

This preserves predictable behavior if the token is revoked or the server cannot reach Jira later.

## Behavior Rules

- Never reveal the saved Jira token to the client after it has been stored.
- Always distinguish between `not configured` and `configured but failing`.
- Prefer explicit recovery actions over silent fallback.
- Do not block the user from discovering Jira exists; block only the data load until connection is valid.
- Keep all Jira auth and validation logic on the server.

## Migration

The existing `.t3-jira-config.json` flow should not remain the primary onboarding path.

Recommended migration approach:

1. Add the new machine-level connection service and status contract.
2. Update the web Jira status query, header behavior, and Jira panel states to use it.
3. Add the onboarding modal and settings management UI.
4. Remove repo-file-based onboarding copy and status handling from the panel.
5. Decide separately whether legacy repo config support should be deleted outright or temporarily supported behind server-side fallback logic during migration.

My recommendation is to remove the repo-file setup path in this feature unless there is a known compatibility requirement.

## Error Handling

Map failures into stable user-facing states:

- `missing`: no saved Jira connection
- `invalid_config`: malformed saved fields
- `invalid_auth`: Jira rejected credentials
- `unreachable`: DNS, timeout, network, or base URL failures

UI guidance:

- Credential validation errors stay inline with their fields.
- Connection-test failures should not dismiss the modal.
- Settings should keep enough detail for the user to recover without opening devtools.
- The Jira panel should never spin forever on a broken connection state.

## Testing

Server tests:

- persistence round-trip for the Jira connection record
- masked reads never return the raw token
- connection test status mapping for success, auth failure, and unreachable Jira
- Jira API operations fail cleanly when the machine-level connection is missing or invalid

Web tests:

- chat header opens onboarding instead of the Jira panel when Jira is not connected
- successful modal completion opens the Jira panel
- settings connection row renders missing, ready, and failing states
- edit and disconnect actions invalidate and refresh the shared Jira status query
- Jira panel renders inline recovery states for non-ready Jira status

## Verification

Before completion, run:

- `bun fmt`
- `bun lint`
- `bun typecheck`
