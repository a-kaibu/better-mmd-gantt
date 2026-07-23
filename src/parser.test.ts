import { describe, it, expect } from "vitest";
import { parseMermaidGantt } from "./parser";

describe("parseMermaidGantt", () => {
  it("parses a basic gantt chart", () => {
    const input = `gantt
    title Test Project
    dateFormat YYYY-MM-DD

    section Development
    Design :design, 2026-01-01, 2026-01-31
    Impl :impl, 2026-02-01, 2026-03-31`;

    const result = parseMermaidGantt(input);
    expect(result.title).toBe("Test Project");
    expect(result.tasks).toHaveLength(2);
    expect(result.warnings).toHaveLength(0);

    expect(result.tasks[0].id).toBe("design");
    expect(result.tasks[0].label).toBe("Design");
    expect(result.tasks[0].section).toBe("Development");
    expect(result.tasks[0].start).toEqual(new Date("2026-01-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-01-31T00:00:00"));

    expect(result.tasks[1].id).toBe("impl");
    expect(result.tasks[1].label).toBe("Impl");
  });

  it("parses YYMMDD format", () => {
    const input = `gantt
    dateFormat YYMMDD
    Task1 :260801, 261031`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].start).toEqual(new Date("2026-08-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-10-31T00:00:00"));
  });

  it("parses YYYY/MM/DD format", () => {
    const input = `gantt
    Task1 :2026/08/01, 2026/10/31`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].start).toEqual(new Date("2026-08-01T00:00:00"));
    expect(result.tasks[0].end).toEqual(new Date("2026-10-31T00:00:00"));
  });

  it("parses tasks without explicit id", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    TaskA :2026-01-01, 2026-01-15`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("TaskA");
    expect(result.tasks[0].label).toBe("TaskA");
  });

  it("parses task statuses: done, active, crit, milestone", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    Done Task :done, t1, 2026-01-01, 2026-01-10
    Active Task :active, t2, 2026-01-11, 2026-01-20
    Crit Task :crit, t3, 2026-01-21, 2026-01-31
    Milestone :milestone, t4, 2026-02-01, 2026-02-01`;

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
    3 Days :d1, 2026-06-01, 3d
    2 Weeks :w1, 2026-06-01, 2w
    1 Month :m1, 2026-06-01, 1m`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0].end).toEqual(new Date("2026-06-04T00:00:00"));
    expect(result.tasks[1].end).toEqual(new Date("2026-06-15T00:00:00"));
    expect(result.tasks[2].end).toEqual(new Date("2026-07-01T00:00:00"));
  });

  it("parses after dependency", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    TaskA :a1, 2026-01-01, 2026-01-10
    TaskB :b1, after a1, 5d`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[1].start).toEqual(new Date("2026-01-10T00:00:00"));
    expect(result.tasks[1].end).toEqual(new Date("2026-01-15T00:00:00"));
  });

  it("warns on duplicate task ID", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    Task1 :dup, 2026-01-01, 2026-01-10
    Task2 :dup, 2026-01-11, 2026-01-20`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    const dupWarning = result.warnings.find(w => w.message.includes("Duplicate"));
    expect(dupWarning).toBeDefined();
  });

  it("warns on invalid date format", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    Task :t1, not-a-date, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const dateWarning = result.warnings.find(w => w.message.includes("Invalid"));
    expect(dateWarning).toBeDefined();
  });

  it("warns on end date before start date", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    Task :t1, 2026-03-01, 2026-01-01`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("End date is before start date"));
    expect(warn).toBeDefined();
  });

  it("warns on missing gantt keyword", () => {
    const input = `title Test
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("gantt"));
    expect(warn).toBeDefined();
  });

  it("handles unknown/arbitrary keywords gracefully without crash", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    someUnknownDirective value
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
  });

  it("parses axisFormat directive", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    axisFormat %m/%d
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.axisFormat).toBe("%m/%d");
    expect(result.warnings).toHaveLength(0);
  });

  it("parses axisFormat directive with quotes", () => {
    const input = `gantt
    axisFormat "%Y-%m-%d"
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.axisFormat).toBe("%Y-%m-%d");
    expect(result.warnings).toHaveLength(0);
  });

  it("parses gantt enclosed in ```mermaid code block", () => {
    const input = `\`\`\`mermaid
gantt
    title Roadmap
    Task :t1, 2026-01-01, 2026-01-10
\`\`\``;

    const result = parseMermaidGantt(input);
    expect(result.title).toBe("Roadmap");
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses gantt enclosed in ```gantt code block", () => {
    const input = `\`\`\`gantt
title Roadmap
Task :t1, 2026-01-01, 2026-01-10
\`\`\``;

    const result = parseMermaidGantt(input);
    expect(result.title).toBe("Roadmap");
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("skips comments and empty lines", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    %% Comment here

    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles multiple sections", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    section Phase 1
    TaskA :a1, 2026-01-01, 2026-01-15
    section Phase 2
    TaskB :b1, 2026-02-01, 2026-02-28`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].section).toBe("Phase 1");
    expect(result.tasks[1].section).toBe("Phase 2");
  });

  it("warns on missing after reference", () => {
    const input = `gantt
    dateFormat YYYY-MM-DD
    TaskB :b1, after nonexistent, 5d`;

    const result = parseMermaidGantt(input);
    expect(result.tasks).toHaveLength(0);
    const warn = result.warnings.find(w => w.message.includes("nonexistent"));
    expect(warn).toBeDefined();
  });

  it("parses tickInterval directive", () => {
    const input = `gantt
    tickInterval 2weeks
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.tickInterval).toEqual({ count: 2, unit: "week" });
  });

  it("parses weekday directive", () => {
    const input = `gantt
    weekday monday
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.weekday).toBe(1);
  });

  it("parses todayMarker directive", () => {
    const input = `gantt
    todayMarker stroke-width:5px,stroke:#0f0
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.todayMarker).toBeDefined();
    expect(result.todayMarker?.show).toBe(true);
    expect(result.todayMarker?.stroke).toBe("#0f0");
  });

  it("parses inclusiveEndDates directive", () => {
    const input = `gantt
    inclusiveEndDates
    Task :t1, 2026-01-01, 2026-01-10`;

    const result = parseMermaidGantt(input);
    expect(result.inclusiveEndDates).toBe(true);
    // End date is inclusive (Jan 10 end -> Jan 11 00:00:00)
    expect(result.tasks[0].end).toEqual(new Date("2026-01-11T00:00:00"));
  });

  it("parses excludes directive and skips excluded days in duration", () => {
    const input = `gantt
    excludes weekends
    Task :t1, 2026-01-02, 3d`; // 2026-01-02 is Friday. 3d duration skipping Sat/Sun -> Wed 2026-01-07

    const result = parseMermaidGantt(input);
    expect(result.excludes?.weekends).toBe(true);
    expect(result.tasks[0].end).toEqual(new Date("2026-01-07T00:00:00"));
  });

  it("parses click directive and attaches to task", () => {
    const input = `gantt
    Task :t1, 2026-01-01, 2026-01-10
    click t1 href "https://example.com"`;

    const result = parseMermaidGantt(input);
    expect(result.tasks[0].click).toEqual({
      type: "href",
      target: "https://example.com",
    });
  });
});
