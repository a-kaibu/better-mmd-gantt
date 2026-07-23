import type { Task, DisplaySettings, TimeScale, DateFormatMode } from "./types";

export type TickMark = {
  x: number;
  label: string;
  isMajor: boolean;
};

export type BarLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  section: string;
  status?: string;
  isMilestone: boolean;
};

export type SectionLayout = {
  label: string;
  y: number;
  height: number;
};

export type ChartLayout = {
  width: number;
  height: number;
  chartX: number;
  chartWidth: number;
  bars: BarLayout[];
  ticks: TickMark[];
  sections: SectionLayout[];
  title: string;
  headerHeight: number;
};

function monthDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1)); // Monday
  return r;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function formatTickDate(d: Date, scale: TimeScale, mode: DateFormatMode): string {
  const yyyy = String(d.getFullYear());
  const yy = yyyy.slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  if (mode === "YYYY-MM-DD") return `${yyyy}-${mm}-${dd}`;
  if (mode === "YY/MM/DD") return `${yy}/${mm}/${dd}`;
  if (mode === "YYMMDD") return `${yy}${mm}${dd}`;
  if (mode === "MM/DD") return `${mm}/${dd}`;

  // auto mode
  if (scale === "month") return `${yyyy}/${mm}`;
  return `${mm}/${dd}`;
}

export function computeLayout(
  tasks: Task[],
  title: string,
  settings: DisplaySettings
): ChartLayout {
  const { outputWidth, labelWidth, rowHeight, timeScale, dateFormatMode, sectionDisplay } = settings;
  const chartX = labelWidth;
  const chartWidth = outputWidth - labelWidth;

  if (tasks.length === 0) {
    return {
      width: outputWidth,
      height: 80,
      chartX,
      chartWidth,
      bars: [],
      ticks: [],
      sections: [],
      title,
      headerHeight: 60,
    };
  }

  // Compute date range
  let minDate = new Date(tasks[0].start);
  let maxDate = new Date(tasks[0].end);
  for (const t of tasks) {
    if (t.start < minDate) minDate = new Date(t.start);
    if (t.end > maxDate) maxDate = new Date(t.end);
  }

  // Expand to align with time scale boundaries
  if (timeScale === "month") {
    minDate = startOfMonth(minDate);
    const endMonth = startOfMonth(maxDate);
    if (endMonth.getTime() < maxDate.getTime()) {
      maxDate = addMonths(endMonth, 1);
    } else {
      maxDate = endMonth;
    }
    if (minDate.getTime() === maxDate.getTime()) {
      maxDate = addMonths(minDate, 1);
    }
  } else if (timeScale === "week") {
    minDate = startOfWeek(minDate);
    const endWeek = startOfWeek(maxDate);
    if (endWeek.getTime() < maxDate.getTime()) {
      maxDate = new Date(endWeek);
      maxDate.setDate(maxDate.getDate() + 7);
    } else {
      maxDate = endWeek;
    }
  }

  // Compute x-position converter
  let dateToX: (d: Date) => number;
  let ticks: TickMark[] = [];

  if (timeScale === "month") {
    const totalMonths = monthDiff(minDate, maxDate);
    const monthWidth = chartWidth / totalMonths;

    dateToX = (d: Date) => {
      const wholeMonths = monthDiff(minDate, startOfMonth(d));
      const monthStart = addMonths(minDate, wholeMonths);
      const monthEnd = addMonths(minDate, wholeMonths + 1);
      const daysInMonth = daysBetween(monthStart, monthEnd);
      const dayOffset = daysBetween(monthStart, d);
      const frac = daysInMonth > 0 ? dayOffset / daysInMonth : 0;
      return chartX + (wholeMonths + frac) * monthWidth;
    };

    for (let i = 0; i <= totalMonths; i++) {
      const d = addMonths(minDate, i);
      ticks.push({
        x: chartX + i * monthWidth,
        label: i < totalMonths ? formatTickDate(d, timeScale, dateFormatMode) : "",
        isMajor: d.getMonth() === 0,
      });
    }
  } else if (timeScale === "week") {
    const totalDays = daysBetween(minDate, maxDate);
    dateToX = (d: Date) => {
      const days = daysBetween(minDate, d);
      return chartX + (days / totalDays) * chartWidth;
    };

    let cur = new Date(minDate);
    while (cur <= maxDate) {
      ticks.push({
        x: dateToX(cur),
        label: formatTickDate(cur, timeScale, dateFormatMode),
        isMajor: cur.getDate() <= 7,
      });
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    // day
    const totalDays = daysBetween(minDate, maxDate);
    dateToX = (d: Date) => {
      const days = daysBetween(minDate, d);
      return chartX + (days / totalDays) * chartWidth;
    };

    let cur = new Date(minDate);
    while (cur <= maxDate) {
      ticks.push({
        x: dateToX(cur),
        label: formatTickDate(cur, timeScale, dateFormatMode),
        isMajor: cur.getDate() === 1,
      });
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Title area
  const titleHeight = title ? 36 : 0;
  const tickLabelHeight = 24;
  const headerHeight = titleHeight + tickLabelHeight;

  // Compute rows
  const sections: SectionLayout[] = [];
  const bars: BarLayout[] = [];

  const sectionOrder: string[] = [];
  const sectionTasks = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!sectionTasks.has(t.section)) {
      sectionOrder.push(t.section);
      sectionTasks.set(t.section, []);
    }
    sectionTasks.get(t.section)!.push(t);
  }

  let currentY = headerHeight;
  const barPadding = 4;
  const barHeight = rowHeight - barPadding * 2;

  for (const sec of sectionOrder) {
    const secTasks = sectionTasks.get(sec)!;
    const sectionStartY = currentY;

    if (sectionDisplay === "heading" && sec) {
      sections.push({ label: sec, y: currentY, height: rowHeight });
      currentY += rowHeight;
    }

    for (const t of secTasks) {
      const isMilestone = t.status === "milestone";
      const x1 = dateToX(t.start);
      const x2 = dateToX(t.end);

      let displayLabel = t.label;
      if (sectionDisplay === "label" && t.section) {
        displayLabel = `${t.section} / ${t.label}`;
      }

      if (isMilestone) {
        const radius = barHeight / 2.5;
        const minCx = chartX + radius;
        const maxCx = chartX + chartWidth - radius;
        const clampedX = Math.max(minCx, Math.min(maxCx, x1));

        bars.push({
          x: clampedX,
          y: currentY + barPadding,
          width: barHeight,
          height: barHeight,
          label: displayLabel,
          section: t.section,
          status: t.status,
          isMilestone: true,
        });
      } else {
        bars.push({
          x: x1,
          y: currentY + barPadding,
          width: Math.max(x2 - x1, 2),
          height: barHeight,
          label: displayLabel,
          section: t.section,
          status: t.status,
          isMilestone: false,
        });
      }
      currentY += rowHeight;
    }

    if (sectionDisplay === "heading" && sec) {
      sections[sections.length - 1].height = currentY - sectionStartY;
    }
  }

  const totalHeight = currentY + 8;

  return {
    width: outputWidth,
    height: totalHeight,
    chartX,
    chartWidth,
    bars,
    ticks,
    sections,
    title,
    headerHeight,
  };
}
