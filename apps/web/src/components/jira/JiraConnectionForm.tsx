import type { JiraSaveConnectionInput, JiraTestConnectionInput } from "@t3tools/contracts";
import { useEffect, useId, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export type JiraConnectionFormValues = {
  baseUrl: string;
  email: string;
  token: string;
  projectKey: string;
  boardId: string;
  filterId: string;
  jql: string;
};

type JiraConnectionFormProps = {
  initialValues?: Partial<JiraConnectionFormValues> | undefined;
  onSubmit: (input: JiraSaveConnectionInput) => Promise<unknown>;
  onTestConnection: (input: JiraTestConnectionInput) => Promise<unknown>;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

function trimOrEmpty(value: string): string {
  return value.trim();
}

function buildPayload(values: JiraConnectionFormValues): JiraSaveConnectionInput {
  const defaults = {
    ...(trimOrEmpty(values.projectKey) ? { projectKey: trimOrEmpty(values.projectKey) } : {}),
    ...(trimOrEmpty(values.boardId) ? { boardId: trimOrEmpty(values.boardId) } : {}),
    ...(trimOrEmpty(values.filterId) ? { filterId: trimOrEmpty(values.filterId) } : {}),
    ...(trimOrEmpty(values.jql) ? { jql: trimOrEmpty(values.jql) } : {}),
  };

  return {
    baseUrl: trimOrEmpty(values.baseUrl),
    email: trimOrEmpty(values.email),
    token: trimOrEmpty(values.token),
    ...(Object.keys(defaults).length > 0 ? { defaults } : {}),
  };
}

export function JiraConnectionForm({
  initialValues,
  onSubmit,
  onTestConnection,
  onSuccess,
  onCancel,
  submitLabel = "Save Jira connection",
}: JiraConnectionFormProps) {
  const [step, setStep] = useState<"credentials" | "defaults">("credentials");
  const [values, setValues] = useState<JiraConnectionFormValues>({
    baseUrl: initialValues?.baseUrl ?? "",
    email: initialValues?.email ?? "",
    token: initialValues?.token ?? "",
    projectKey: initialValues?.projectKey ?? "",
    boardId: initialValues?.boardId ?? "",
    filterId: initialValues?.filterId ?? "",
    jql: initialValues?.jql ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof JiraConnectionFormValues, string>>>({});
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectKeyId = useId();
  const boardIdId = useId();
  const filterIdId = useId();
  const jqlId = useId();
  const baseUrlId = useId();
  const emailId = useId();
  const tokenId = useId();

  useEffect(() => {
    setStep("credentials");
    setValues({
      baseUrl: initialValues?.baseUrl ?? "",
      email: initialValues?.email ?? "",
      token: initialValues?.token ?? "",
      projectKey: initialValues?.projectKey ?? "",
      boardId: initialValues?.boardId ?? "",
      filterId: initialValues?.filterId ?? "",
      jql: initialValues?.jql ?? "",
    });
    setErrors({});
    setStatusError(null);
  }, [
    initialValues?.baseUrl,
    initialValues?.boardId,
    initialValues?.email,
    initialValues?.filterId,
    initialValues?.jql,
    initialValues?.projectKey,
    initialValues?.token,
  ]);

  const setField = (field: keyof JiraConnectionFormValues, nextValue: string) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatusError(null);
  };

  const validateCredentials = () => {
    const nextErrors: Partial<Record<keyof JiraConnectionFormValues, string>> = {};

    if (!trimOrEmpty(values.baseUrl)) {
      nextErrors.baseUrl = "Enter your Jira site URL.";
    }
    if (!trimOrEmpty(values.email)) {
      nextErrors.email = "Enter your Jira account email.";
    }
    if (!trimOrEmpty(values.token)) {
      nextErrors.token = "Enter your Jira API token.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateCredentials()) {
      return;
    }
    setStep("defaults");
  };

  const handleTestConnection = async () => {
    if (!validateCredentials()) {
      setStep("credentials");
      return;
    }

    setIsTesting(true);
    setStatusError(null);
    try {
      await onTestConnection(buildPayload(values));
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Could not test the Jira connection.",
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateCredentials()) {
      setStep("credentials");
      return;
    }

    setIsSubmitting(true);
    setStatusError(null);
    try {
      await onSubmit(buildPayload(values));
      onSuccess?.();
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Could not save the Jira connection.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {step === "credentials" ? (
        <div className="space-y-4">
          <label htmlFor={baseUrlId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Jira site URL</span>
            <Input
              id={baseUrlId}
              value={values.baseUrl}
              onChange={(event) => setField("baseUrl", event.target.value)}
              placeholder="https://example.atlassian.net"
              spellCheck={false}
            />
            {errors.baseUrl ? (
              <span className="text-xs text-destructive">{errors.baseUrl}</span>
            ) : null}
          </label>

          <label htmlFor={emailId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Jira account email</span>
            <Input
              id={emailId}
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              placeholder="user@example.com"
              spellCheck={false}
            />
            {errors.email ? <span className="text-xs text-destructive">{errors.email}</span> : null}
          </label>

          <label htmlFor={tokenId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Jira API token</span>
            <Input
              id={tokenId}
              type="password"
              value={values.token}
              onChange={(event) => setField("token", event.target.value)}
              placeholder="Paste your Jira API token"
              spellCheck={false}
            />
            {errors.token ? <span className="text-xs text-destructive">{errors.token}</span> : null}
          </label>

          <div className="flex justify-end">
            <Button type="button" onClick={handleContinue}>
              Continue
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label htmlFor={projectKeyId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Default project key</span>
            <Input
              id={projectKeyId}
              value={values.projectKey}
              onChange={(event) => setField("projectKey", event.target.value)}
              placeholder="WEB"
              spellCheck={false}
            />
          </label>

          <label htmlFor={boardIdId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Default board ID</span>
            <Input
              id={boardIdId}
              value={values.boardId}
              onChange={(event) => setField("boardId", event.target.value)}
              placeholder="23"
              spellCheck={false}
            />
          </label>

          <label htmlFor={filterIdId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Default filter ID</span>
            <Input
              id={filterIdId}
              value={values.filterId}
              onChange={(event) => setField("filterId", event.target.value)}
              placeholder="10010"
              spellCheck={false}
            />
          </label>

          <label htmlFor={jqlId} className="grid gap-1.5">
            <span className="text-sm font-medium text-foreground">Default JQL</span>
            <Textarea
              id={jqlId}
              value={values.jql}
              onChange={(event) => setField("jql", event.target.value)}
              placeholder="assignee = currentUser() ORDER BY updated DESC"
            />
          </label>

          {statusError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {statusError}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("credentials")}>
                Back
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleTestConnection()}
                disabled={isTesting || isSubmitting}
              >
                {isTesting ? "Testing..." : "Test connection"}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting || isTesting}
              >
                {isSubmitting ? "Saving..." : submitLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
