import { describe, expect, it } from "vite-plus/test";

import { buildAgentTaskPrompt } from "./dashboardStore";

describe("buildAgentTaskPrompt", () => {
  it("builds a bounded implementation prompt with project context", () => {
    const prompt = buildAgentTaskPrompt({
      projectTitle: "Recount",
      projectDescription: "Tools for reviewing election recount data.",
      task: {
        title: "Export filtered results",
        details: "Add CSV export and preserve the currently displayed columns.",
        category: "feature",
      },
    });

    expect(prompt).toContain("Work on this feature for Recount:");
    expect(prompt).toContain("## Task\nExport filtered results");
    expect(prompt).toContain(
      "## Details\nAdd CSV export and preserve the currently displayed columns.",
    );
    expect(prompt).toContain("## Project context\nTools for reviewing election recount data.");
    expect(prompt).toContain("run the smallest relevant checks");
  });

  it("omits empty optional sections", () => {
    const prompt = buildAgentTaskPrompt({
      projectTitle: "Scratch",
      projectDescription: "   ",
      task: {
        title: "Fix the build",
        details: "",
        category: "fix",
      },
    });

    expect(prompt).not.toContain("## Details");
    expect(prompt).not.toContain("## Project context");
  });
});
