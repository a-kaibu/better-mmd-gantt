import { describe, it, expect } from "vitest";
import { parseMermaidGantt } from "./parser";

describe("parseMermaidGantt", () => {
  it("parses a basic gantt chart", () => {
    const input = `gantt
    title テストプロジェクト
    dateFormat YYYY-MM-DD

    section 開発
    設計 :design, 2026-01-01, 2026-01-31
    実装 :impl, 2026-02-01, 2026-03-31`;

    const result = parseMermaidGantt(input);
    expect(result.title).toBe("テストプロジェクト");
    expect(result.tasks).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    expect(result.tasks[0].id).toBe("design");
    expect(result.tasks[0].label).toBe("設計");
    expect(result.tasks[0].section).toBe("開発");
    expect(result.tasks[0].start).toEqual(new Date("2026-01-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-01-31T00:00:00"));

    expect(result.tasks[1].id).toBe("impl");
    expect(result.tasks[1].label).toBe("実装");
  });

  it("parses YYMMDD format", () => {
    const input = `gantt
    dateFormat YYMMDD
    タスク1 :260801, 261031`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].start).toEqual(new Date("2026-08-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-10-31T00:00:00"));
  });

  it("parses YYYY/MM/DD format", () => {
    const input = `gantt
    タスク1 :2026/08/01, 2026/10/31`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].start).toEqual(new Date("2026-08-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-10-31T00:00:00"));
  });

  it("parses tasks without explicit id", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスクA :2026-01-01, 2026-01-15`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("タスクA");
    expect(result.tasks[0].label).toBe("タスクA");
  });

  it("parses task statuses: done, active, crit, milestone", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    完了タスク :done, t1, 2026-01-01, 2026-01-10
    進行中タスク :active, t2, 2026-01-11, 2026-01-20
    重要タスク :crit, t3, 2026-01-21, 2026-01-31
    マイルストーン :milestone, t4, 2026-02-01, 2026-02-01`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(4);
    expect(result.tasks[0].status).toBe("done");
    expect(result.tasks[1].status).toBe("active");
    expect(result.tasks[2].status).toBe("crit");
    expect(result.tasks[3].status).toBe("milestone");
  });

  it("parses duration notation", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    3日間 :d1, 2026-06-01, 3d
    2週間 :w1, 2026-06-01, 2w
    1ヶ月 :m1, 2026-06-01, 1m`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].end).toEqual(new Date("2026-06-04T00:00:00"));
    expect(result.tasks[1].end).toEqual(new Date("2026-06-15T00:00:00"));
    expect(result.tasks[2].end).toEqual(new Date("2026-07-01T00:00:00"));
  });

  it("parses after dependency", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスクA :a1, 2026-01-01, 2026-01-10
    タスクB :b1, after a1, 5d`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1].start).toEqual(new Date("2026-01-10T00:00:00"));
    expect(result.tasks[1].end).toEqual(new Date("2026-01-15T00:00:00"));
  });

  it("warns on duplicate task ID", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスク1 :dup, 2026-01-01, 2026-01-10
    タスク2 :dup, 2026-01-11, 2026-01-20`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    const dupWarning = result.warnings.find(w => w.message.includes("重複"));
    expect(dupWarning).toBeDefined();
  });

  it("warns on invalid date format", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスク :t1, not-a-date, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const dateWarning = result.warnings.find(w => w.message.includes("不正"));
    expect(dateWarning).toBeDefined();
  });

  it("warns on end date before start date", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスク :t1, 2026-03-01, 2026-01-01`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("終了日が開始日より前"));
    expect(warn).toBeDefined();
  });

  it("warns on missing gantt keyword", () => {
    const input = `title テスト
    タスク :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("gantt"));
    expect(warn).toBeDefined();
  });

  it("warns on unsupported keywords", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    axisFormat %Y-%m
    excludes weekends
    タスク :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("skips comments and empty lines", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    %% これはコメント

    タスク :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles multiple sections", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    section フェーズ1
    タスクA :a1, 2026-01-01, 2026-01-15
    section フェーズ2
    タスクB :b1, 2026-02-01, 2026-02-28`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].section).toBe("フェーズ1");
    expect(result.tasks[1].section).toBe("フェーズ2");
  });

  it("warns on missing after reference", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    タスクB :b1, after nonexistent, 5d`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("nonexistent"));
    expect(warn).toBeDefined();
  });
});
