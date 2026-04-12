import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../right-panel/JiraPanelTab", () => ({
  JiraPanelTab: () => <div>Jira panel body</div>,
}));

import { ToolsPanelContent } from "./ToolsPanel";

describe("ToolsPanelContent", () => {
  it("renders the active Git content without a redundant tab strip", () => {
    const html = renderToStaticMarkup(
      <ToolsPanelContent
        environmentId={"environment-local" as never}
        activeTab="git"
        diffContent={<div>Git panel body</div>}
      />,
    );

    expect(html).toContain("Git panel body");
    expect(html).not.toContain(">Git<");
    expect(html).not.toContain(">Jira<");
  });

  it("renders the Jira panel when Jira is the active content", () => {
    const html = renderToStaticMarkup(
      <ToolsPanelContent
        environmentId={"environment-local" as never}
        activeTab="jira"
        diffContent={<div>Git panel body</div>}
      />,
    );

    expect(html).toContain("Jira panel body");
    expect(html).not.toContain("Git panel body");
  });
});
