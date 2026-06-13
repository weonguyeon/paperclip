// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockUseHelpMode = vi.hoisted(() => vi.fn());
vi.mock("../context/HelpModeContext", () => ({
  useHelpMode: mockUseHelpMode,
}));

import { HelpHint } from "./HelpHint";

describe("HelpHint", () => {
  it("renders nothing when help mode is off", () => {
    mockUseHelpMode.mockReturnValue({ enabled: false });
    const html = renderToStaticMarkup(<HelpHint>이 화면 설명</HelpHint>);
    expect(html).toBe("");
  });

  it("renders blue help text when help mode is on", () => {
    mockUseHelpMode.mockReturnValue({ enabled: true });
    const html = renderToStaticMarkup(<HelpHint>이 화면 설명</HelpHint>);
    expect(html).toContain("이 화면 설명");
    expect(html).toContain("text-blue-600");
    expect(html).toContain('role="note"');
  });
});
