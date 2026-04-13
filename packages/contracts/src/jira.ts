import { Schema } from "effect";

import { PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

export const JiraAutomationKind = Schema.Literals(["on_branch_created", "on_pr_opened"]);
export type JiraAutomationKind = typeof JiraAutomationKind.Type;

export const JiraConfigStatusResult = Schema.Struct({
  status: Schema.Literals(["ready", "missing", "invalid"]),
  configPath: TrimmedNonEmptyString,
  error: Schema.optional(TrimmedNonEmptyString),
});
export type JiraConfigStatusResult = typeof JiraConfigStatusResult.Type;

export const JiraIssueSummary = Schema.Struct({
  key: TrimmedNonEmptyString,
  summary: Schema.String,
  statusName: Schema.String,
  statusCategoryName: Schema.optional(Schema.String),
  issueTypeName: Schema.String,
});
export type JiraIssueSummary = typeof JiraIssueSummary.Type;

export const JiraIssueComment = Schema.Struct({
  id: TrimmedNonEmptyString,
  authorDisplayName: Schema.String,
  bodyMarkdown: Schema.String,
  createdAt: Schema.String,
});
export type JiraIssueComment = typeof JiraIssueComment.Type;

export const JiraRelatedIssue = Schema.Struct({
  key: TrimmedNonEmptyString,
  summary: Schema.String,
  statusName: Schema.String,
  statusCategoryName: Schema.optional(Schema.String),
  issueTypeName: Schema.String,
  relationshipLabel: TrimmedNonEmptyString,
});
export type JiraRelatedIssue = typeof JiraRelatedIssue.Type;

export const JiraIssueDetail = Schema.Struct({
  key: TrimmedNonEmptyString,
  summary: Schema.String,
  statusName: Schema.String,
  statusCategoryName: Schema.optional(Schema.String),
  issueTypeName: Schema.String,
  priorityName: Schema.optional(Schema.String),
  labels: Schema.Array(Schema.String),
  isFlagged: Schema.Boolean,
  parentKey: Schema.optional(Schema.String),
  parentSummary: Schema.optional(Schema.String),
  relatedIssues: Schema.Array(JiraRelatedIssue),
  storyPoints: Schema.optional(Schema.Number),
  acv: Schema.optional(Schema.String),
  descriptionMarkdown: Schema.String,
  comments: Schema.Array(JiraIssueComment),
  url: Schema.String,
});
export type JiraIssueDetail = typeof JiraIssueDetail.Type;

export const JiraGetConfigStatusInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type JiraGetConfigStatusInput = typeof JiraGetConfigStatusInput.Type;

export const JiraListActiveTasksInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type JiraListActiveTasksInput = typeof JiraListActiveTasksInput.Type;

export const JiraListActiveTasksResult = Schema.Struct({
  issues: Schema.Array(JiraIssueSummary),
});
export type JiraListActiveTasksResult = typeof JiraListActiveTasksResult.Type;

export const JiraGetIssueDetailInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  issueKey: TrimmedNonEmptyString,
});
export type JiraGetIssueDetailInput = typeof JiraGetIssueDetailInput.Type;

export const JiraGetIssueDetailResult = Schema.Struct({
  issue: JiraIssueDetail,
});
export type JiraGetIssueDetailResult = typeof JiraGetIssueDetailResult.Type;

export const JiraRunAutomationInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  issueKey: TrimmedNonEmptyString,
  automation: JiraAutomationKind,
  commentText: Schema.optional(TrimmedNonEmptyString),
});
export type JiraRunAutomationInput = typeof JiraRunAutomationInput.Type;

export const JiraRunAutomationResult = Schema.Struct({
  issueKey: TrimmedNonEmptyString,
  automation: JiraAutomationKind,
  transitionAttempted: Schema.Boolean,
  transitionApplied: Schema.Boolean,
  commentAdded: Schema.Boolean,
});
export type JiraRunAutomationResult = typeof JiraRunAutomationResult.Type;

export class JiraError extends Schema.TaggedErrorClass<JiraError>()("JiraError", {
  kind: Schema.Literals(["config", "auth", "fetch", "decode", "automation"]),
  operation: TrimmedNonEmptyString,
  message: TrimmedNonEmptyString,
  statusCode: Schema.optional(PositiveInt),
  cause: Schema.optional(Schema.Defect),
}) {}
