import type { JiraIssueEditStatus, JiraIssueTransition } from "@t3tools/contracts";

export interface JiraStatusEditOption {
  readonly id: string;
  readonly name: string;
  readonly statusCategoryName?: string;
  readonly transitionId?: string;
  readonly selected: boolean;
  readonly actionable: boolean;
}

export interface JiraIssueEditControls {
  readonly statusOptions: readonly JiraStatusEditOption[];
  readonly storyPointOptions: readonly number[];
  readonly onSelectStatus: (transitionId: string) => void | Promise<void>;
  readonly onSelectStoryPoints: (storyPoints: number) => void | Promise<void>;
  readonly statusBusy?: boolean;
  readonly storyPointsBusy?: boolean;
}

const DEFAULT_STORY_POINT_OPTIONS = [0, 1, 2, 3, 5, 8, 13, 21];

export function buildJiraStoryPointOptions(currentValue?: number): number[] {
  const values = new Set<number>(DEFAULT_STORY_POINT_OPTIONS);
  if (typeof currentValue === "number") {
    values.add(currentValue);
  }
  return [...values].toSorted((left, right) => left - right);
}

export function buildJiraStatusEditOptions(input: {
  statuses: readonly JiraIssueEditStatus[];
  transitions: readonly JiraIssueTransition[];
  currentStatusName: string;
}): JiraStatusEditOption[] {
  const transitionsByStatus = new Map<string, string>();
  for (const transition of input.transitions) {
    if (transition.toStatusId) {
      transitionsByStatus.set(transition.toStatusId, transition.id);
    }
    if (transition.toStatusName) {
      transitionsByStatus.set(transition.toStatusName, transition.id);
    }
  }

  return input.statuses.map((status) => {
    const transitionId = transitionsByStatus.get(status.id) ?? transitionsByStatus.get(status.name);
    const selected = status.name === input.currentStatusName;
    return {
      id: status.id,
      name: status.name,
      ...(status.statusCategoryName ? { statusCategoryName: status.statusCategoryName } : {}),
      ...(transitionId ? { transitionId } : {}),
      selected,
      actionable: Boolean(transitionId) && !selected,
    };
  });
}
