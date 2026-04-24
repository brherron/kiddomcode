import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../GitActionsControl", () => ({
  default: () => <div data-testid="git-actions-control" />,
}));

vi.mock("../ProjectScriptsControl", () => ({
  default: () => <div data-testid="project-scripts-control" />,
}));

vi.mock("../ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Sidebar</button>,
}));

vi.mock("./OpenInPicker", () => ({
  OpenInPicker: () => <div data-testid="open-in-picker" />,
}));

import { ChatHeader } from "./ChatHeader";

const keybindings = {
  preset: "default",
  bindings: [],
} as const;

describe("ChatHeader", () => {
  it("renders separate Git and Jira labels in the header controls", () => {
    const html = renderToStaticMarkup(
      <ChatHeader
        activeThreadEnvironmentId={"environment-local" as never}
        activeThreadId={"thread-1" as never}
        activeThreadTitle="Thread title"
        activeProjectName="Project"
        isGitRepo
        openInCwd="/repo"
        activeProjectScripts={undefined}
        preferredScriptId={null}
        keybindings={keybindings as never}
        availableEditors={[]}
        terminalAvailable
        terminalOpen={false}
        terminalToggleShortcutLabel={null}
        diffToggleShortcutLabel="Ctrl+D"
        gitCwd="/repo"
        diffOpen={false}
        jiraOpen={false}
        onRunProjectScript={vi.fn()}
        onAddProjectScript={vi.fn()}
        onUpdateProjectScript={vi.fn()}
        onDeleteProjectScript={vi.fn()}
        onToggleTerminal={vi.fn()}
        onToggleGit={vi.fn()}
        onToggleJira={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Git"');
    expect(html).toContain(">Jira<");
  });

  it("keeps the Jira button enabled without an active project", () => {
    const html = renderToStaticMarkup(
      <ChatHeader
        activeThreadEnvironmentId={"environment-local" as never}
        activeThreadId={"thread-1" as never}
        activeThreadTitle="Thread title"
        activeProjectName={undefined}
        isGitRepo
        openInCwd="/repo"
        activeProjectScripts={undefined}
        preferredScriptId={null}
        keybindings={keybindings as never}
        availableEditors={[]}
        terminalAvailable
        terminalOpen={false}
        terminalToggleShortcutLabel={null}
        diffToggleShortcutLabel="Ctrl+D"
        gitCwd="/repo"
        diffOpen={false}
        jiraOpen={false}
        onRunProjectScript={vi.fn()}
        onAddProjectScript={vi.fn()}
        onUpdateProjectScript={vi.fn()}
        onDeleteProjectScript={vi.fn()}
        onToggleTerminal={vi.fn()}
        onToggleGit={vi.fn()}
        onToggleJira={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="Jira"');
  });
});
