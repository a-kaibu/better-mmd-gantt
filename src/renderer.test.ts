import { describe, it, expect } from "vitest";
import { computeLayout } from "./layout";
import { renderSVG } from "./renderer";
import type { Task, DisplaySettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

function makeTask(overrides: Partial<Task> & { start: Date; end: Date }): Task {
  return {
    id: "t1",
    label: "テスト",
    section: "",
    status: undefined,
    line: 1,
    ...overrides,
  };
}

describe("renderSVG", () => {
  it("returns valid SVG string", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
      }),
    ];
    const layout = computeLayout(tasks, "テストチャート", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes viewBox attribute", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
  });

  it("includes Japanese font families", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("Noto Sans JP");
    expect(svg).toContain("Hiragino Sans");
  });

  it("renders title text", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "プロジェクト計画", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("プロジェクト計画");
  });

  it("renders task labels", () => {
    const tasks = [
      makeTask({
        label: "設計フェーズ",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("設計フェーズ");
  });

  it("renders white background when background is white", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const settings: DisplaySettings = { ...DEFAULT_SETTINGS, background: "white" };
    const layout = computeLayout(tasks, "", settings);
    const svg = renderSVG(layout, settings);

    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("omits background rect when transparent", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const settings: DisplaySettings = {
      ...DEFAULT_SETTINGS,
      background: "transparent",
    };
    const layout = computeLayout(tasks, "", settings);
    const svg = renderSVG(layout, settings);

    // Should not have a full-size white background rect
    expect(svg).not.toContain('fill="#FFFFFF"');
  });

  it("escapes XML special characters", () => {
    const tasks = [
      makeTask({
        label: "A<B&C>D",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("A&lt;B&amp;C&gt;D");
    expect(svg).not.toContain("A<B&C>D");
  });

  it("renders milestone as polygon", () => {
    const tasks = [
      makeTask({
        status: "milestone",
        start: new Date("2026-03-01"),
        end: new Date("2026-03-01"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    expect(svg).toContain("<polygon");
  });

  it("renders normal tasks as rect", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    // Should have rect elements for the bar (plus background)
    const rectMatches = svg.match(/<rect /g);
    expect(rectMatches).not.toBeNull();
    expect(rectMatches!.length).toBeGreaterThanOrEqual(2); // bg + bar
  });

  it("does not depend on external CSS", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);
    const svg = renderSVG(layout, DEFAULT_SETTINGS);

    // Should not reference external stylesheets
    expect(svg).not.toContain("<link");
    expect(svg).not.toMatch(/@import/);
    // Inline font-family should be present
    expect(svg).toContain('font-family:');
  });
});
