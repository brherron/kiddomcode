# Jira State-Aware Work Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Jira state-aware split-button actions that recommend `Start Work`, `Continue on <branch>`, or `Start Review` and always create a new thread with the correct prompt/context.

**Architecture:** Keep workflow recommendation and prompt building in pure web helpers, then wire the Jira panel and `ChatView` to use those helpers for UI rendering and new-thread orchestration. Use existing git/Jira RPCs for branch listing, PR lookup, worktree creation, and thread startup.

**Tech Stack:** React, TanStack Query, Zustand, TypeScript, Effect RPC, Bun, Vitest

---

## Chunk 1: Recommendation Logic

### Task 1: Add failing tests for Jira work-action recommendation

**Files:**

- Create: `apps/web/src/lib/jiraWorkActions.test.ts`
- Create: `apps/web/src/lib/jiraWorkActions.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

### Task 2: Add failing tests for continuation and review prompt builders

**Files:**

- Modify: `apps/web/src/lib/jira.test.ts`
- Modify: `apps/web/src/lib/jira.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Write minimal implementation**
- [ ] **Step 4: Run test to verify it passes**

## Chunk 2: UI Wiring

### Task 3: Update Jira tools state and panel action rendering

**Files:**

- Modify: `apps/web/src/jiraToolsStore.ts`
- Modify: `apps/web/src/components/tools-panel/ToolsPanel.tsx`
- Modify: `apps/web/src/components/right-panel/JiraPanelTab.tsx`
- Modify: `apps/web/src/components/right-panel/JiraPanelTab.browser.tsx`

- [ ] **Step 1: Write the failing UI/logic test**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement split-button menu rendering and handler plumbing**
- [ ] **Step 4: Run test to verify it passes**

## Chunk 3: Thread Start Orchestration

### Task 4: Add `ChatView` handlers for start, continue, and review

**Files:**

- Modify: `apps/web/src/components/ChatView.tsx`

- [ ] **Step 1: Write the failing logic test or targeted unit coverage where practical**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement new-thread action flows using existing git/Jira RPCs**
- [ ] **Step 4: Run test to verify it passes**

## Chunk 4: Verification

### Task 5: Run repo verification and fix regressions

**Files:**

- Modify only if required by verification failures

- [ ] **Step 1: Run `bun fmt`**
- [ ] **Step 2: Run `bun lint`**
- [ ] **Step 3: Run `bun typecheck`**
- [ ] **Step 4: Fix failures and re-run until clean**
