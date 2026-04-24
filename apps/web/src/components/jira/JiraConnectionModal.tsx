import type {
  JiraConnectionStatusResult,
  JiraSaveConnectionInput,
  JiraTestConnectionInput,
} from "@t3tools/contracts";

import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { JiraConnectionForm, type JiraConnectionFormValues } from "./JiraConnectionForm";

type JiraConnectionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: Partial<JiraConnectionFormValues> | undefined;
  onSubmit: (input: JiraSaveConnectionInput) => Promise<JiraConnectionStatusResult>;
  onTestConnection: (input: JiraTestConnectionInput) => Promise<JiraConnectionStatusResult>;
  onSuccess?: () => void;
};

export function JiraConnectionModal({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
  onTestConnection,
  onSuccess,
}: JiraConnectionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Jira</DialogTitle>
          <DialogDescription>
            Save your Jira credentials on this machine, then choose optional defaults for the first
            task view.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <JiraConnectionForm
            initialValues={initialValues}
            onSubmit={onSubmit}
            onTestConnection={onTestConnection}
            onCancel={() => onOpenChange(false)}
            onSuccess={() => {
              onSuccess?.();
              onOpenChange(false);
            }}
          />
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
