import type { JiraIssueComment, JiraIssueDetail } from "@t3tools/contracts";
import { Badge } from "../ui/badge";
import ChatMarkdown from "../ChatMarkdown";
import { cn } from "../../lib/utils";
import {
  BugIcon,
  ListTodoIcon,
  ChevronDown,
  ChevronUp,
  SquareCheck,
  Bookmark,
  SquareStack,
  Zap,
  Flag,
  ExternalLink,
} from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "../ui/scroll-area";

const MediumIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 -3 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    className="lucide lucide-menu-icon lucide-menu"
  >
    <path d="M4 5h16" />
    <path d="M4 12h16" />
  </svg>
);

type StatusStyle = { bg: string; text: string; dot: string };

const STATUS_CATEGORY_STYLES: Record<string, StatusStyle> = {
  "To Do": { bg: "bg-slate-500/15", text: "text-slate-400", dot: "bg-slate-400" },
  "In Progress": { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
  Done: { bg: "bg-green-500/15", text: "text-green-400", dot: "bg-green-400" },
};

const STATUS_NAME_STYLES: Record<string, StatusStyle> = {
  "Code Review": { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
  Backlog: { bg: "bg-zinc-500/15", text: "text-zinc-500", dot: "bg-zinc-500" },
};

function getStatusStyle(statusName: string, statusCategoryName?: string): StatusStyle {
  const byName = STATUS_NAME_STYLES[statusName];
  if (byName) return byName;
  if (statusCategoryName) {
    const byCat = STATUS_CATEGORY_STYLES[statusCategoryName];
    if (byCat) return byCat;
  }
  return { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" };
}

type IssueTypePresentation = {
  accentClassName: string;
  pillClassName: string;
  icon: typeof ListTodoIcon;
};

function getIssueTypePresentation(issueTypeName: string): IssueTypePresentation {
  const normalizedIssueType = issueTypeName.trim().toLowerCase();

  return (
    {
      bug: {
        accentClassName: "bg-red-500/12 text-red-300",
        pillClassName: "border-red-500/20 bg-red-500/12 text-red-600",
        icon: BugIcon,
      },
      task: {
        accentClassName: "bg-blue-500/12 text-blue-300",
        pillClassName: "border-blue-500/20 bg-blue-500/12 text-blue-600",
        icon: SquareCheck,
      },
      "sub-task": {
        accentClassName: "bg-teal-500/12 text-teal-200",
        pillClassName: "border-teal-500/20 bg-teal-500/12 text-teal-600",
        icon: SquareStack,
      },
      story: {
        accentClassName: "bg-lime-500/12 text-lime-400",
        pillClassName: "border-lime-500/20 bg-lime-500/12 text-lime-600",
        icon: Bookmark,
      },
      epic: {
        accentClassName: "bg-purple-500/12 text-purple-300",
        pillClassName: "border-purple-500/20 bg-purple-500/12 text-purple-600",
        icon: Zap,
      },
    }[normalizedIssueType] ?? {
      accentClassName: "bg-muted/50 text-muted-foreground",
      pillClassName: "border-border/70 bg-muted/20 text-muted-foreground",
      icon: ListTodoIcon,
    }
  );
}

export function IssueTypeMark(props: { issueTypeName: string; size?: string }) {
  const presentation = getIssueTypePresentation(props.issueTypeName);
  const Icon = presentation.icon;

  return (
    <div
      aria-label={`${props.issueTypeName} issue type`}
      className={cn(
        "flex size-8 items-center justify-center rounded-md",
        presentation.accentClassName,
        props.size === "small" ? "size-3" : "",
      )}
    >
      <Icon className="size-4" />
    </div>
  );
}

export function StatusChip(props: {
  statusName: string;
  statusCategoryName?: string | undefined;
  size?: "large" | "small";
}) {
  const style = getStatusStyle(props.statusName, props.statusCategoryName);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
        style.bg,
        props.size === "large" ? "px-2 py-0.5" : "",
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      <span
        className={cn(
          "text-[9px] font-medium leading-none",
          style.text,
          props.size === "large" ? "text-[10px]" : "",
        )}
      >
        {props.statusName}
      </span>
    </span>
  );
}

function PriorityChip(props: { priorityName: string | undefined }) {
  if (!props.priorityName) return null;

  const variant = props.priorityName === "High" ? "destructive" : "outline";

  const Icon =
    props.priorityName === "Low" ? (
      <ChevronDown />
    ) : props.priorityName === "High" ? (
      <ChevronUp />
    ) : (
      <MediumIcon />
    );

  return (
    <Badge variant={variant} size="sm" className="pl-1 pr-1.5 text-[8px]">
      {Icon}
      {props.priorityName}
    </Badge>
  );
}

function StoryPointsChip(props: { storyPoints: number }) {
  return (
    <Badge variant="outline" size="sm" className="px-1.5 text-[9px]">
      {props.storyPoints} pts
    </Badge>
  );
}

function FlagChip() {
  return (
    <Badge variant="warning" size="sm" className="px-1.5 text-[9px] font-semibold uppercase">
      <Flag />
    </Badge>
  );
}

function LabelChip(props: { label: string }) {
  return (
    <Badge variant="outline" size="sm" className="px-1.5 text-[9px]">
      {props.label}
    </Badge>
  );
}

function DetailRow(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-20 shrink-0 pt-0.5 text-[11px] font-medium text-muted-foreground">
        {props.label}
      </div>
      <div className="min-w-0 flex-1">{props.children}</div>
    </div>
  );
}

function sortCommentsNewestFirst(comments: readonly JiraIssueComment[]): JiraIssueComment[] {
  return comments.toSorted(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function CommentCard(props: { comment: JiraIssueComment; featured?: boolean; cwd: string | null }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/20 p-3",
        props.featured ? "bg-card/70 shadow-sm" : "",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{props.comment.authorDisplayName}</span>
        <span>{new Date(props.comment.createdAt).toLocaleString()}</span>
      </div>
      <div className="text-xs leading-6">
        <ChatMarkdown
          text={props.comment.bodyMarkdown}
          cwd={props.cwd ?? undefined}
          isStreaming={false}
        />
      </div>
    </div>
  );
}

interface JiraIssueDetailPaneProps {
  issue: JiraIssueDetail;
  cwd: string | null;
  actionSlot?: ReactNode;
}

export function JiraIssueDetailPane(props: JiraIssueDetailPaneProps) {
  const comments = props.issue.comments ?? [];
  const descriptionMarkdown = props.issue.descriptionMarkdown ?? "";
  const labels = props.issue.labels ?? [];
  const relatedIssues = props.issue.relatedIssues ?? [];
  const priorityName = props.issue.priorityName ?? "Medium";
  const sortedComments = sortCommentsNewestFirst(comments);
  const latestComment = sortedComments[0] ?? null;
  const previousComments = latestComment ? sortedComments.slice(1) : [];
  console.log(props.issue.relatedIssues);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 border-b border-border/60 bg-background/95 px-3 pt-3 pb-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1 w-full">
            <div className="w-full flex items-center gap-2">
              <IssueTypeMark issueTypeName={props.issue.issueTypeName} />
              <p className="text-l text-white/30 uppercase">{props.issue.key}</p>
              <a href={props.issue.url} target="blank" className="p-0.75 rounded hover:bg-white/5"><ExternalLink className="size-4 text-white/30" /></a>
              {props.actionSlot ? <div className="shrink-0 ml-auto">{props.actionSlot}</div> : null}
            </div>
            <h3 className="text-xl font-semibold text-foreground">{props.issue.summary}</h3>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3 pt-2">
          <section className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </div>
            {descriptionMarkdown.trim().length > 0 ? (
              <div className="text-sm leading-6 text-muted-foreground">
                <ChatMarkdown
                  text={descriptionMarkdown}
                  cwd={props.cwd ?? undefined}
                  isStreaming={false}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50">No description.</p>
            )}
          </section>

          <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 px-3 py-3">
            <DetailRow label="Properties">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusChip
                  size="large"
                  statusName={props.issue.statusName}
                  statusCategoryName={props.issue.statusCategoryName}
                />
                {typeof props.issue.storyPoints === "number" ? (
                  <StoryPointsChip storyPoints={props.issue.storyPoints} />
                ) : null}
                <PriorityChip priorityName={priorityName} />
                {props.issue.isFlagged ? <FlagChip /> : null}
                {props.issue.acv ? (
                  <Badge variant="outline" size="sm">
                    {props.issue.acv}
                  </Badge>
                ) : null}
              </div>
            </DetailRow>

            {props.issue.parentSummary ? (
              <DetailRow label="Parent">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {props.issue.parentKey ? (
                    <Badge
                      variant="outline"
                      size="sm"
                      className="pl-1 pr-1.5 text-[9px] uppercase border-purple-500/40 text-purple-300"
                    >
                      <Zap />
                      {props.issue.parentKey}
                    </Badge>
                  ) : null}
                  <span className="min-w-0 text-xs text-foreground">
                    {props.issue.parentSummary}
                  </span>
                </div>
              </DetailRow>
            ) : null}

            {relatedIssues.length > 0 ? (
              <DetailRow label="Related">
                <div className="space-y-2">
                  {relatedIssues.map((relatedIssue) => (
                    <div
                      key={`${relatedIssue.relationshipLabel}-${relatedIssue.key}`}
                      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/50 bg-muted/15 px-2 py-2"
                    >
                      <Badge
                        variant="outline"
                        size="sm"
                        className="px-1.5 text-[9px] uppercase text-muted-foreground"
                      >
                        {relatedIssue.relationshipLabel}
                      </Badge>
                      <Badge variant="outline" size="sm" className="px-1.5 text-[9px] uppercase">
                        {relatedIssue.key}
                      </Badge>
                      <span className="min-w-0 flex-1 text-xs text-foreground">
                        {relatedIssue.summary}
                      </span>
                      <StatusChip
                        statusName={relatedIssue.statusName}
                        statusCategoryName={relatedIssue.statusCategoryName}
                      />
                    </div>
                  ))}
                </div>
              </DetailRow>
            ) : null}

            {labels.length > 0 ? (
              <DetailRow label="Labels">
                <div className="flex flex-wrap items-center gap-1.5">
                  {labels.map((label) => (
                    <LabelChip key={label} label={label} />
                  ))}
                </div>
              </DetailRow>
            ) : null}
          </div>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
              Latest update
            </div>
            {latestComment ? (
              <CommentCard comment={latestComment} featured cwd={props.cwd} />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                No updates yet.
              </div>
            )}
          </section>

          {previousComments.length > 0 ? (
            <section className="space-y-2">
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                Previous comments
              </div>
              <div className="space-y-2">
                {previousComments.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} cwd={props.cwd} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
