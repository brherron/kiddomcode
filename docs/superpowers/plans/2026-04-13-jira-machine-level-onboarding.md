# Jira Machine-Level Onboarding Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repo-file Jira setup with a machine-level Jira connection, add a chat-triggered onboarding modal, and make `Settings > Connections` the management surface for saved Jira credentials and defaults.

**Architecture:** Extend the shared contracts and server settings model with a machine-level Jira connection shape, then add server-side Jira connection status/test/save operations that power both chat onboarding and settings management. On the web, route the chat header, Jira panel, and connections settings UI through one shared Jira status/query/mutation layer so setup and recovery behavior stays consistent.

**Tech Stack:** TypeScript, React, TanStack Query, Effect Schema/RPC, Bun, Vitest

---

## Chunk 1: Contracts and Persistence Model

### Task 1: Add failing contract tests and Jira connection schemas

**Files:**

- Modify: `packages/contracts/src/settings.ts`
- Modify: `packages/contracts/src/jira.ts`
- Modify: `packages/contracts/src/rpc.ts`
- Modify: `packages/contracts/src/ipc.ts`
- Modify: `packages/contracts/src/settings.test.ts` or nearest existing schema test file
- Modify: `packages/contracts/src/jira.test.ts` if Jira contract coverage belongs there

- [ ] **Step 1: Write the failing schema tests**

Add coverage for:

- a machine-level Jira settings block under server settings
- a masked Jira connection status result that never includes the raw token
- new RPC input/output schemas for get status, save connection, test connection, and disconnect

- [ ] **Step 2: Run the targeted contract tests to verify they fail**

Run: `bun run test packages/contracts/src/settings.test.ts packages/contracts/src/jira.test.ts`

Expected: FAIL because the Jira machine-level schemas and RPC contracts do not exist yet.

- [ ] **Step 3: Write the minimal schema and RPC implementation**

Add:

- a `jira` block to `ServerSettings`
- Jira connection/defaults schemas
- masked Jira connection status/result schemas
- RPC definitions for:
  - `jira.getConnectionStatus`
  - `jira.saveConnection`
  - `jira.testConnection`
  - `jira.disconnect`

- [ ] **Step 4: Run the targeted contract tests to verify they pass**

Run: `bun run test packages/contracts/src/settings.test.ts packages/contracts/src/jira.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the contract work**

```bash
git add packages/contracts/src/settings.ts packages/contracts/src/jira.ts packages/contracts/src/rpc.ts packages/contracts/src/ipc.ts packages/contracts/src/settings.test.ts packages/contracts/src/jira.test.ts
git commit -m "feat: add jira machine-level connection contracts"
```

### Task 2: Add failing server settings tests for Jira persistence

**Files:**

- Modify: `apps/server/src/serverSettings.test.ts`
- Modify: `apps/server/src/serverSettings.ts`

- [ ] **Step 1: Write the failing persistence test**

Cover:

- reading default settings with Jira missing
- patching Jira settings into server settings
- preserving masking boundaries by ensuring server settings persistence can store the token but downstream status serializers must not expose it

- [ ] **Step 2: Run the targeted settings test to verify it fails**

Run: `bun run test apps/server/src/serverSettings.test.ts`

Expected: FAIL because `ServerSettings` does not accept the new Jira block yet.

- [ ] **Step 3: Update server settings persistence support**

Implement the smallest changes needed so the Jira settings patch persists cleanly through the existing server settings service.

- [ ] **Step 4: Run the targeted settings test to verify it passes**

Run: `bun run test apps/server/src/serverSettings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the persistence work**

```bash
git add apps/server/src/serverSettings.ts apps/server/src/serverSettings.test.ts
git commit -m "feat: persist jira machine settings"
```

## Chunk 2: Server Jira Connection Service

### Task 3: Add failing tests for Jira connection status and save/test/disconnect operations

**Files:**

- Create: `apps/server/src/jira/Layers/JiraConnectionService.test.ts`
- Create: `apps/server/src/jira/Services/JiraConnectionService.ts`
- Create: `apps/server/src/jira/Layers/JiraConnectionService.ts`

- [ ] **Step 1: Write the failing service tests**

Cover:

- `getConnectionStatus` returns `missing` when no Jira config is saved
- `testConnection` maps auth failures to `invalid_auth`
- `testConnection` maps timeouts/network failures to `unreachable`
- `saveConnection` stores credentials and defaults
- `disconnect` clears the saved Jira connection

- [ ] **Step 2: Run the targeted service tests to verify they fail**

Run: `bun run test apps/server/src/jira/Layers/JiraConnectionService.test.ts`

Expected: FAIL because the Jira connection service does not exist yet.

- [ ] **Step 3: Implement the minimal Jira connection service**

Use the existing server settings service as the source of persisted machine-level Jira data. Keep token masking and status mapping in this service, not in the web layer.

- [ ] **Step 4: Run the targeted service tests to verify they pass**

Run: `bun run test apps/server/src/jira/Layers/JiraConnectionService.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the Jira connection service**

```bash
git add apps/server/src/jira/Services/JiraConnectionService.ts apps/server/src/jira/Layers/JiraConnectionService.ts apps/server/src/jira/Layers/JiraConnectionService.test.ts
git commit -m "feat: add jira connection service"
```

### Task 4: Replace repo-file Jira config usage with machine-level connection resolution

**Files:**

- Modify: `apps/server/src/jira/Services/JiraConfig.ts`
- Modify: `apps/server/src/jira/Layers/JiraConfig.ts`
- Modify: `apps/server/src/jira/Services/JiraService.ts`
- Modify: `apps/server/src/jira/Layers/JiraService.ts`
- Modify: `apps/server/src/jira/Layers/JiraService.test.ts`
- Modify: `apps/server/src/ws.ts` or the actual Jira RPC registration file if different

- [ ] **Step 1: Write the failing Jira service tests**

Add or update tests to prove:

- Jira task/detail calls use machine-level credentials
- Jira API calls fail with clear config/auth errors when connection status is not ready
- old `.t3-jira-config.json`-specific expectations are removed or updated

- [ ] **Step 2: Run the targeted Jira server tests to verify they fail**

Run: `bun run test apps/server/src/jira/Layers/JiraService.test.ts`

Expected: FAIL because the Jira service still resolves repo-file config.

- [ ] **Step 3: Implement server Jira config migration**

Refactor:

- `JiraConfig` into a machine-level connection/status adapter or remove it if `JiraConnectionService` fully replaces it
- `JiraService` to request resolved credentials from the new machine-level service
- Jira RPC handlers to expose the new connection status/test/save/disconnect methods

- [ ] **Step 4: Run the targeted Jira server tests to verify they pass**

Run: `bun run test apps/server/src/jira/Layers/JiraService.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the Jira service integration**

```bash
git add apps/server/src/jira/Services/JiraConfig.ts apps/server/src/jira/Layers/JiraConfig.ts apps/server/src/jira/Services/JiraService.ts apps/server/src/jira/Layers/JiraService.ts apps/server/src/jira/Layers/JiraService.test.ts apps/server/src/ws.ts
git commit -m "feat: resolve jira through machine connection"
```

## Chunk 3: Web Data Layer and Shared Connection UI

### Task 5: Add failing web data-layer tests for machine-level Jira queries and mutations

**Files:**

- Modify: `apps/web/src/lib/jiraReactQuery.ts`
- Create: `apps/web/src/lib/jiraConnectionReactQuery.test.ts` if a new test file is cleaner
- Modify: `apps/web/src/rpc/wsRpcClient.ts`
- Modify: `apps/web/src/rpc/wsRpcClient.test.ts`
- Modify: `apps/web/src/environmentApi.ts`

- [ ] **Step 1: Write the failing data-layer tests**

Cover:

- Jira status query uses machine-level status RPCs instead of repo `cwd` config status
- save/test/disconnect mutations call the expected RPC methods
- Jira task/detail queries remain `cwd`-scoped but are enabled only when machine-level Jira is ready

- [ ] **Step 2: Run the targeted web data-layer tests to verify they fail**

Run: `bun run test apps/web/src/rpc/wsRpcClient.test.ts apps/web/src/lib/jiraConnectionReactQuery.test.ts`

Expected: FAIL because the new client methods and query helpers do not exist yet.

- [ ] **Step 3: Implement the minimal web RPC/query layer**

Add:

- Jira client methods for get status, save, test, disconnect
- shared query keys and helpers for connection status
- mutation helpers shared by chat onboarding and settings

- [ ] **Step 4: Run the targeted web data-layer tests to verify they pass**

Run: `bun run test apps/web/src/rpc/wsRpcClient.test.ts apps/web/src/lib/jiraConnectionReactQuery.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the web data-layer work**

```bash
git add apps/web/src/lib/jiraReactQuery.ts apps/web/src/lib/jiraConnectionReactQuery.test.ts apps/web/src/rpc/wsRpcClient.ts apps/web/src/rpc/wsRpcClient.test.ts apps/web/src/environmentApi.ts
git commit -m "feat: add jira machine connection web queries"
```

### Task 6: Add a reusable Jira connection form/modal component

**Files:**

- Create: `apps/web/src/components/jira/JiraConnectionForm.tsx`
- Create: `apps/web/src/components/jira/JiraConnectionModal.tsx`
- Create: `apps/web/src/components/jira/JiraConnectionForm.test.tsx`
- Create: `apps/web/src/components/jira/JiraConnectionModal.test.tsx`
- Reuse existing UI primitives from `apps/web/src/components/ui`

- [ ] **Step 1: Write the failing component tests**

Cover:

- credentials fields render
- defaults step renders
- inline validation and connection-test errors remain visible
- success callback fires after a passing test/save flow

- [ ] **Step 2: Run the targeted component tests to verify they fail**

Run: `bun run test apps/web/src/components/jira/JiraConnectionForm.test.tsx apps/web/src/components/jira/JiraConnectionModal.test.tsx`

Expected: FAIL because the Jira connection components do not exist yet.

- [ ] **Step 3: Implement the minimal shared form and modal**

Keep the token field write-only and make the modal reusable from both chat and settings.

- [ ] **Step 4: Run the targeted component tests to verify they pass**

Run: `bun run test apps/web/src/components/jira/JiraConnectionForm.test.tsx apps/web/src/components/jira/JiraConnectionModal.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the shared Jira UI**

```bash
git add apps/web/src/components/jira/JiraConnectionForm.tsx apps/web/src/components/jira/JiraConnectionModal.tsx apps/web/src/components/jira/JiraConnectionForm.test.tsx apps/web/src/components/jira/JiraConnectionModal.test.tsx
git commit -m "feat: add jira connection onboarding ui"
```

## Chunk 4: Chat Header, Jira Panel, and Settings Wiring

### Task 7: Update chat header behavior to open Jira onboarding when not connected

**Files:**

- Modify: `apps/web/src/components/chat/ChatHeader.tsx`
- Modify: `apps/web/src/components/chat/ChatHeader.test.tsx`
- Modify: `apps/web/src/components/ChatView.tsx`

- [ ] **Step 1: Write the failing chat header tests**

Cover:

- Jira button still renders when the thread has an active project
- clicking Jira opens the modal instead of the panel when Jira is missing
- successful connection closes the modal and opens the Jira panel

- [ ] **Step 2: Run the targeted chat tests to verify they fail**

Run: `bun run test apps/web/src/components/chat/ChatHeader.test.tsx`

Expected: FAIL because the header cannot branch on machine-level Jira status yet.

- [ ] **Step 3: Implement the minimal header and chat wiring**

Add the connection status lookup and modal open/close handling in `ChatView`, keeping `ChatHeader` presentational where practical.

- [ ] **Step 4: Run the targeted chat tests to verify they pass**

Run: `bun run test apps/web/src/components/chat/ChatHeader.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the chat onboarding entrypoint**

```bash
git add apps/web/src/components/chat/ChatHeader.tsx apps/web/src/components/chat/ChatHeader.test.tsx apps/web/src/components/ChatView.tsx
git commit -m "feat: open jira onboarding from chat header"
```

### Task 8: Replace Jira panel repo-config states with machine-level recovery states

**Files:**

- Modify: `apps/web/src/components/right-panel/JiraPanelTab.tsx`
- Modify: `apps/web/src/components/right-panel/JiraPanelTab.test.tsx`
- Modify: `apps/web/src/components/right-panel/JiraPanelTab.browser.tsx`
- Modify: `apps/web/src/lib/jiraReactQuery.ts`

- [ ] **Step 1: Write the failing Jira panel tests**

Cover:

- missing connection shows `Connect Jira`
- invalid/unreachable states show recovery copy and actions
- active tasks query is disabled until Jira status is `ready`

- [ ] **Step 2: Run the targeted Jira panel tests to verify they fail**

Run: `bun run test apps/web/src/components/right-panel/JiraPanelTab.test.tsx apps/web/src/components/right-panel/JiraPanelTab.browser.tsx`

Expected: FAIL because the panel still expects `missing` and `invalid` repo config responses.

- [ ] **Step 3: Implement the minimal Jira panel state migration**

Swap repo-config empty states for machine-level connection states while preserving existing active task/detail behavior for ready connections.

- [ ] **Step 4: Run the targeted Jira panel tests to verify they pass**

Run: `bun run test apps/web/src/components/right-panel/JiraPanelTab.test.tsx apps/web/src/components/right-panel/JiraPanelTab.browser.tsx`

Expected: PASS

- [ ] **Step 5: Commit the Jira panel migration**

```bash
git add apps/web/src/components/right-panel/JiraPanelTab.tsx apps/web/src/components/right-panel/JiraPanelTab.test.tsx apps/web/src/components/right-panel/JiraPanelTab.browser.tsx apps/web/src/lib/jiraReactQuery.ts
git commit -m "feat: make jira panel state machine-level"
```

### Task 9: Add Jira management to Settings > Connections

**Files:**

- Modify: `apps/web/src/components/settings/ConnectionsSettings.tsx`
- Modify: `apps/web/src/routes/settings.connections.tsx` only if route-level loader changes are needed
- Modify: `apps/web/src/components/settings/SettingsPanels.browser.tsx` if browser stories/tests need updates
- Add tests beside existing settings coverage or create `apps/web/src/components/settings/ConnectionsSettings.test.tsx`

- [ ] **Step 1: Write the failing settings tests**

Cover:

- Jira row renders missing, ready, and failing states
- `Connect`, `Edit`, `Test connection`, and `Disconnect` actions are present in the right states
- settings reuses the same Jira connection modal/form behavior as chat

- [ ] **Step 2: Run the targeted settings tests to verify they fail**

Run: `bun run test apps/web/src/components/settings/ConnectionsSettings.test.tsx`

Expected: FAIL because the settings page has no Jira management surface yet.

- [ ] **Step 3: Implement the minimal settings UI**

Add a Jira section to `ConnectionsSettings` that uses the shared Jira connection query and modal, and invalidate shared queries after save/test/disconnect.

- [ ] **Step 4: Run the targeted settings tests to verify they pass**

Run: `bun run test apps/web/src/components/settings/ConnectionsSettings.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit the settings management work**

```bash
git add apps/web/src/components/settings/ConnectionsSettings.tsx apps/web/src/components/settings/ConnectionsSettings.test.tsx apps/web/src/components/settings/SettingsPanels.browser.tsx apps/web/src/routes/settings.connections.tsx
git commit -m "feat: manage jira connection in settings"
```

## Chunk 5: Cleanup and Verification

### Task 10: Remove obsolete repo-file onboarding assumptions

**Files:**

- Modify: `apps/server/src/jira/Layers/JiraConfig.ts`
- Modify: `apps/server/src/jira/Layers/JiraService.test.ts`
- Modify: `apps/web/src/components/right-panel/JiraPanelTab.tsx`
- Modify any stale docs or copy discovered during implementation

- [ ] **Step 1: Write or update the failing cleanup tests**

Cover removal of:

- `.t3-jira-config.json` user-facing guidance in the Jira panel
- repo-path-specific Jira setup wording in server/web tests

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run the nearest affected test targets from previous tasks.

Expected: FAIL until stale repo-based assumptions are removed.

- [ ] **Step 3: Remove obsolete copy and dead branches**

Delete or simplify any now-unused repo-config onboarding paths.

- [ ] **Step 4: Re-run the targeted tests to verify they pass**

Run the same targeted suites used in this task.

Expected: PASS

- [ ] **Step 5: Commit the cleanup**

```bash
git add apps/server/src/jira/Layers/JiraConfig.ts apps/server/src/jira/Layers/JiraService.test.ts apps/web/src/components/right-panel/JiraPanelTab.tsx
git commit -m "refactor: remove repo jira onboarding path"
```

### Task 11: Run full verification and fix regressions

**Files:**

- Modify only if verification failures require fixes

- [ ] **Step 1: Run focused test suites touched by this plan**

Run the targeted `bun run test ...` commands from each chunk before full repo verification.

- [ ] **Step 2: Run formatting**

Run: `bun fmt`

Expected: formatting completes without error.

- [ ] **Step 3: Run linting**

Run: `bun lint`

Expected: PASS

- [ ] **Step 4: Run typechecking**

Run: `bun typecheck`

Expected: PASS

- [ ] **Step 5: Fix failures and re-run until clean**

Re-run any failing command until all three required verification commands are clean.

- [ ] **Step 6: Commit the final verification fixes**

```bash
git add -A
git commit -m "chore: finish jira machine onboarding"
```
