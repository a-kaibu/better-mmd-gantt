import { describe, it, expect } from "vitest";
import { computeLayout } from "./layout";
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

describe("computeLayout", () => {
  it("returns empty layout for no tasks", () => {
    const layout = computeLayout([], "タイトル", DEFAULT_SETTINGS);
    expect(layout.bars).toHaveLength(0);
    expect(layout.ticks).toHaveLength(0);
    expect(layout.width).toBe(DEFAULT_SETTINGS.outputWidth);
  });

  it("computes correct dimensions for single task", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-03-31"),
      }),
    ];
    const layout = computeLayout(tasks, "テスト", DEFAULT_SETTINGS);

    expect(layout.bars).toHaveLength(1);
    expect(layout.width).toBe(DEFAULT_SETTINGS.outputWidth);
    expect(layout.chartX).toBe(DEFAULT_SETTINGS.labelWidth);
    expect(layout.chartWidth).toBe(
      DEFAULT_SETTINGS.outputWidth - DEFAULT_SETTINGS.labelWidth
    );
  });

  it("generates monthly ticks for month scale", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-15"),
        end: new Date("2026-04-15"),
      }),
    ];
    const settings: DisplaySettings = { ...DEFAULT_SETTINGS, timeScale: "month" };
    const layout = computeLayout(tasks, "", settings);

    // Should span Jan..May (expanded to month boundaries)
    expect(layout.ticks.length).toBeGreaterThanOrEqual(4);
    // All ticks should have labels except possibly the last
    const labeledTicks = layout.ticks.filter(t => t.label !== "");
    expect(labeledTicks.length).toBeGreaterThanOrEqual(4);
  });

  it("respects outputWidth setting", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-06-30"),
      }),
    ];
    const settings: DisplaySettings = { ...DEFAULT_SETTINGS, outputWidth: 600 };
    const layout = computeLayout(tasks, "", settings);

    expect(layout.width).toBe(600);
    expect(layout.chartWidth).toBe(600 - DEFAULT_SETTINGS.labelWidth);
  });

  it("positions bars within chart area", () => {
    const tasks = [
      makeTask({
        id: "t1",
        start: new Date("2026-02-01"),
        end: new Date("2026-04-30"),
      }),
      makeTask({
        id: "t2",
        label: "タスク2",
        start: new Date("2026-03-01"),
        end: new Date("2026-05-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);

    expect(layout.bars).toHaveLength(2);
    for (const bar of layout.bars) {
      expect(bar.x).toBeGreaterThanOrEqual(layout.chartX);
      expect(bar.x + bar.width).toBeLessThanOrEqual(
        layout.chartX + layout.chartWidth + 1
      );
      expect(bar.width).toBeGreaterThan(0);
    }
  });

  it("handles section heading display mode", () => {
    const tasks = [
      makeTask({
        section: "セクションA",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const settings: DisplaySettings = {
      ...DEFAULT_SETTINGS,
      sectionDisplay: "heading",
    };
    const layout = computeLayout(tasks, "", settings);

    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0].label).toBe("セクションA");
  });

  it("hides sections in hidden mode", () => {
    const tasks = [
      makeTask({
        section: "セクション",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const settings: DisplaySettings = {
      ...DEFAULT_SETTINGS,
      sectionDisplay: "hidden",
    };
    const layout = computeLayout(tasks, "", settings);

    expect(layout.sections).toHaveLength(0);
  });

  it("prepends section name to label in label mode", () => {
    const tasks = [
      makeTask({
        section: "開発",
        label: "設計",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const settings: DisplaySettings = {
      ...DEFAULT_SETTINGS,
      sectionDisplay: "label",
    };
    const layout = computeLayout(tasks, "", settings);

    expect(layout.bars[0].label).toBe("開発 / 設計");
  });

  it("handles milestone tasks", () => {
    const tasks = [
      makeTask({
        status: "milestone",
        start: new Date("2026-03-01"),
        end: new Date("2026-03-01"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);

    expect(layout.bars).toHaveLength(1);
    expect(layout.bars[0].isMilestone).toBe(true);
  });

  it("ensures milestone diamond bounds do not overflow chart area at boundaries", () => {
    const tasks = [
      makeTask({
        id: "m_start",
        status: "milestone",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-01"),
      }),
      makeTask({
        id: "m_end",
        status: "milestone",
        start: new Date("2026-12-31"),
        end: new Date("2026-12-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);

    for (const bar of layout.bars) {
      if (bar.isMilestone) {
        const radius = bar.height / 2.5;
        const leftEdge = bar.x - radius;
        const rightEdge = bar.x + radius;

        // Must stay within chart area [chartX, chartX + chartWidth]
        expect(leftEdge).toBeGreaterThanOrEqual(layout.chartX - 0.001);
        expect(rightEdge).toBeLessThanOrEqual(layout.chartX + layout.chartWidth + 0.001);
      }
    }
  });

  it("includes title height when title is present", () => {
    const tasks = [
      makeTask({
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
    ];
    const withTitle = computeLayout(tasks, "タイトル", DEFAULT_SETTINGS);
    const withoutTitle = computeLayout(tasks, "", DEFAULT_SETTINGS);

    expect(withTitle.headerHeight).toBeGreaterThan(withoutTitle.headerHeight);
  });

  it("stacks multiple tasks vertically", () => {
    const tasks = [
      makeTask({
        id: "t1",
        start: new Date("2026-01-01"),
        end: new Date("2026-01-31"),
      }),
      makeTask({
        id: "t2",
        start: new Date("2026-02-01"),
        end: new Date("2026-02-28"),
      }),
      makeTask({
        id: "t3",
        start: new Date("2026-03-01"),
        end: new Date("2026-03-31"),
      }),
    ];
    const layout = computeLayout(tasks, "", DEFAULT_SETTINGS);

    expect(layout.bars).toHaveLength(3);
    // Each bar should be below the previous one
    for (let i = 1; i < layout.bars.length; i++) {
      expect(layout.bars[i].y).toBeGreaterThan(layout.bars[i - 1].y);
    }
  });
});
