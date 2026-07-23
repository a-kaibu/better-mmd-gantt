import type {
  Task,
  ParseResult,
  ParseWarning,
  TaskStatus,
  TaskClickAction,
  ExcludeOption,
  TodayMarkerOption,
} from "./types";

const DURATION_RE = /^(\d+)(d|w|m)$/;

function parseDate(s: string): Date | null {
  const clean = s.trim();
  let y: number, m: number, d: number;

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const m1 = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m1) {
    y = parseInt(m1[1], 10);
    m = parseInt(m1[2], 10) - 1;
    d = parseInt(m1[3], 10);
  } else {
    // 2. YYYYMMDD
    const m2 = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m2) {
      y = parseInt(m2[1], 10);
      m = parseInt(m2[2], 10) - 1;
      d = parseInt(m2[3], 10);
    } else {
      // 3. YY-MM-DD or YY/MM/DD
      const m3 = clean.match(/^(\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (m3) {
        const yy = parseInt(m3[1], 10);
        y = yy < 70 ? 2000 + yy : 1900 + yy;
        m = parseInt(m3[2], 10) - 1;
        d = parseInt(m3[3], 10);
      } else {
        // 4. YYMMDD
        const m4 = clean.match(/^(\d{2})(\d{2})(\d{2})$/);
        if (m4) {
          const yy = parseInt(m4[1], 10);
          y = yy < 70 ? 2000 + yy : 1900 + yy;
          m = parseInt(m4[2], 10) - 1;
          d = parseInt(m4[3], 10);
        } else {
          return null;
        }
      }
    }
  }

  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dateObj = new Date(y, m, d);
  if (isNaN(dateObj.getTime())) return null;
  return dateObj;
}

export function isDateExcluded(d: Date, excludes?: ExcludeOption): boolean {
  if (!excludes) return false;
  if (excludes.daysOfWeek.has(d.getDay())) return true;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (excludes.dates.has(`${yyyy}-${mm}-${dd}`)) return true;
  return false;
}

function addDuration(start: Date, dur: string, excludes?: ExcludeOption): Date | null {
  const m = dur.match(DURATION_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const result = new Date(start);

  if (unit === "d") {
    if (excludes && (excludes.weekends || excludes.daysOfWeek.size > 0 || excludes.dates.size > 0)) {
      let added = 0;
      while (added < n) {
        result.setDate(result.getDate() + 1);
        if (!isDateExcluded(result, excludes)) {
          added++;
        }
      }
    } else {
      result.setDate(result.getDate() + n);
    }
  } else if (unit === "w") {
    result.setDate(result.getDate() + n * 7);
  } else if (unit === "m") {
    result.setMonth(result.getMonth() + n);
  }
  return result;
}

function parseWeekday(str: string): number | undefined {
  const s = str.trim().toLowerCase();
  if (s === "sunday" || s === "sun" || s === "0") return 0;
  if (s === "monday" || s === "mon" || s === "1") return 1;
  if (s === "tuesday" || s === "tue" || s === "2") return 2;
  if (s === "wednesday" || s === "wed" || s === "3") return 3;
  if (s === "thursday" || s === "thu" || s === "4") return 4;
  if (s === "friday" || s === "fri" || s === "5") return 5;
  if (s === "saturday" || s === "sat" || s === "6") return 6;
  return undefined;
}

function parseTickInterval(str: string): { count: number; unit: "day" | "week" | "month" } | undefined {
  const m = str.trim().match(/^(\d+)?\s*(day|days|week|weeks|month|months)$/i);
  if (!m) return undefined;
  const count = parseInt(m[1] || "1", 10);
  const rawUnit = m[2].toLowerCase();
  let unit: "day" | "week" | "month" = "day";
  if (rawUnit.startsWith("week")) unit = "week";
  else if (rawUnit.startsWith("month")) unit = "month";
  return { count: Math.max(1, count), unit };
}

function parseTodayMarker(str: string): TodayMarkerOption {
  const trimmed = str.trim();
  if (trimmed.toLowerCase() === "off") {
    return { show: false };
  }
  if (!trimmed) {
    return { show: true };
  }
  let strokeWidth: string | undefined;
  let stroke: string | undefined;
  let opacity: string | undefined;
  const pairs = trimmed.split(/[,;]/);
  for (const pair of pairs) {
    const [k, v] = pair.split(":").map((s) => s.trim());
    if (!k || !v) continue;
    if (k === "stroke-width") strokeWidth = v;
    else if (k === "stroke") stroke = v;
    else if (k === "opacity") opacity = v;
  }
  return { show: true, strokeWidth, stroke, opacity, rawStyle: trimmed };
}

function parseExcludes(str: string): ExcludeOption {
  const res: ExcludeOption = {
    weekends: false,
    daysOfWeek: new Set<number>(),
    dates: new Set<string>(),
  };
  const tokens = str.split(/[\s,]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const tok of tokens) {
    if (tok === "weekends") {
      res.weekends = true;
      res.daysOfWeek.add(0);
      res.daysOfWeek.add(6);
    } else {
      const wd = parseWeekday(tok);
      if (wd !== undefined) {
        res.daysOfWeek.add(wd);
      } else {
        const dateClean = tok.replace(/\//g, "-");
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateClean)) {
          res.dates.add(dateClean);
        }
      }
    }
  }
  return res;
}

function parseClickLine(str: string): { taskId: string; action: TaskClickAction } | null {
  const trimmed = str.trim();
  const matchCall = trimmed.match(/^click\s+([^\s]+)\s+call\s+(.+)$/i);
  if (matchCall) {
    return { taskId: matchCall[1], action: { type: "call", target: matchCall[2] } };
  }

  const matchHref = trimmed.match(/^click\s+([^\s]+)\s+(?:href\s+)?["']?([^"'\s]+)["']?$/i);
  if (matchHref) {
    return { taskId: matchHref[1], action: { type: "href", target: matchHref[2] } };
  }

  return null;
}

const KNOWN_STATUSES = new Set(["done", "active", "crit", "milestone"]);
const UNSUPPORTED_KEYWORDS = new Set<string>();

export function parseMermaidGantt(input: string): ParseResult {
  const lines = input.split("\n");
  const tasks: Task[] = [];
  const warnings: ParseWarning[] = [];
  let title = "";
  let currentSection = "";
  let axisFormat: string | undefined = undefined;
  let tickInterval: { count: number; unit: "day" | "week" | "month" } | undefined = undefined;
  let weekday: number | undefined = undefined;
  let todayMarker: TodayMarkerOption | undefined = undefined;
  let inclusiveEndDates: boolean | undefined = undefined;
  let excludes: ExcludeOption | undefined = undefined;
  const clicksMap = new Map<string, TaskClickAction>();

  const taskIds = new Set<string>();
  const taskMap = new Map<string, Task>();

  let foundGantt = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith("%%")) continue;

    if (trimmed.startsWith("```")) {
      const rest = trimmed.replace(/^```/, "").trim();
      if (!foundGantt && (rest === "gantt" || rest.startsWith("gantt"))) {
        foundGantt = true;
      }
      continue;
    }

    if (!foundGantt) {
      if (trimmed === "gantt") {
        foundGantt = true;
      }
      continue;
    }

    if (trimmed.startsWith("title ")) {
      title = trimmed.slice(6).trim();
      continue;
    }

    if (trimmed.startsWith("dateFormat ")) {
      continue;
    }

    if (trimmed.startsWith("axisFormat ")) {
      let fmt = trimmed.slice(11).trim();
      if (
        (fmt.startsWith('"') && fmt.endsWith('"')) ||
        (fmt.startsWith("'") && fmt.endsWith("'"))
      ) {
        fmt = fmt.slice(1, -1);
      }
      axisFormat = fmt;
      continue;
    }

    if (trimmed.startsWith("tickInterval ")) {
      tickInterval = parseTickInterval(trimmed.slice(13));
      continue;
    }

    if (trimmed.startsWith("weekday ")) {
      weekday = parseWeekday(trimmed.slice(8));
      continue;
    }

    if (trimmed.startsWith("todayMarker") || trimmed.startsWith("todayMarker ")) {
      todayMarker = parseTodayMarker(trimmed.slice(11));
      continue;
    }

    if (trimmed === "inclusiveEndDates") {
      inclusiveEndDates = true;
      continue;
    }

    if (trimmed.startsWith("excludes ")) {
      excludes = parseExcludes(trimmed.slice(9));
      continue;
    }

    if (trimmed.startsWith("click ")) {
      const parsedClick = parseClickLine(trimmed);
      if (parsedClick) {
        clicksMap.set(parsedClick.taskId, parsedClick.action);
      }
      continue;
    }

    if (trimmed.startsWith("section ")) {
      currentSection = trimmed.slice(8).trim();
      continue;
    }

    // Check unsupported keywords
    const firstWord = trimmed.split(/\s/)[0];
    if (UNSUPPORTED_KEYWORDS.has(firstWord)) {
      warnings.push({ line: lineNum, message: `"${firstWord}" is not supported.` });
      continue;
    }

    // Parse task line
    const taskResult = parseTaskLine(
      trimmed,
      lineNum,
      currentSection,
      taskMap,
      warnings,
      excludes,
      inclusiveEndDates
    );
    if (taskResult) {
      if (taskIds.has(taskResult.id)) {
        warnings.push({ line: lineNum, message: `Duplicate task ID: "${taskResult.id}"` });
      }
      taskIds.add(taskResult.id);
      taskMap.set(taskResult.id, taskResult);
      tasks.push(taskResult);
    }
  }

  // Attach click actions to tasks
  for (const task of tasks) {
    if (clicksMap.has(task.id)) {
      task.click = clicksMap.get(task.id);
    }
  }

  if (!foundGantt && lines.some((l) => l.trim().length > 0)) {
    warnings.push({ line: 1, message: '"gantt" keyword not found.' });
  }

  return {
    title,
    tasks,
    warnings,
    axisFormat,
    tickInterval,
    weekday,
    todayMarker,
    inclusiveEndDates,
    excludes,
  };
}

function parseTaskLine(
  line: string,
  lineNum: number,
  section: string,
  taskMap: Map<string, Task>,
  warnings: ParseWarning[],
  excludes?: ExcludeOption,
  inclusiveEndDates?: boolean
): Task | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) {
    warnings.push({ line: lineNum, message: `Line cannot be parsed: "${line}"` });
    return null;
  }

  const label = line.slice(0, colonIdx).trim();
  const rest = line.slice(colonIdx + 1).trim();
  const parts = rest.split(",").map((p) => p.trim());

  let status: TaskStatus | undefined;
  let id = "";
  let startStr = "";
  let endStr = "";
  let idx = 0;

  // Check for status
  if (parts[idx] && KNOWN_STATUSES.has(parts[idx])) {
    status = parts[idx] as TaskStatus;
    idx++;
  }

  const remaining = parts.slice(idx);

  if (remaining.length === 0) {
    warnings.push({ line: lineNum, message: "Cannot resolve task duration." });
    return null;
  }

  const adjustEndDate = (d: Date): Date => {
    if (inclusiveEndDates) {
      const res = new Date(d);
      res.setDate(res.getDate() + 1);
      return res;
    }
    return d;
  };

  if (remaining.length >= 3) {
    id = remaining[0];
    if (remaining[1].startsWith("after ")) {
      const afterId = remaining[1].slice(6).trim();
      const refTask = taskMap.get(afterId);
      if (!refTask) {
        warnings.push({ line: lineNum, message: `Referenced task "${afterId}" not found.` });
        return null;
      }
      const start = new Date(refTask.end);
      const end = addDuration(start, remaining[2], excludes);
      if (!end) {
        const endDate = parseDate(remaining[2]);
        if (!endDate) {
          warnings.push({ line: lineNum, message: `Invalid duration: "${remaining[2]}"` });
          return null;
        }
        return { id: id || label, label, section, start, end: adjustEndDate(endDate), status, line: lineNum };
      }
      return { id: id || label, label, section, start, end, status, line: lineNum };
    }
    startStr = remaining[1];
    endStr = remaining[2];
  } else if (remaining.length === 2) {
    const firstAsDate = parseDate(remaining[0]);
    if (firstAsDate) {
      startStr = remaining[0];
      endStr = remaining[1];
    } else if (remaining[0].startsWith("after ")) {
      const afterId = remaining[0].slice(6).trim();
      const refTask = taskMap.get(afterId);
      if (!refTask) {
        warnings.push({ line: lineNum, message: `Referenced task "${afterId}" not found.` });
        return null;
      }
      const start = new Date(refTask.end);
      const end = addDuration(start, remaining[1], excludes);
      if (!end) {
        const endDate = parseDate(remaining[1]);
        if (!endDate) {
          warnings.push({ line: lineNum, message: `Invalid duration: "${remaining[1]}"` });
          return null;
        }
        return { id: label, label, section, start, end: adjustEndDate(endDate), status, line: lineNum };
      }
      return { id: label, label, section, start, end, status, line: lineNum };
    } else {
      id = remaining[0];
      startStr = remaining[1];
      endStr = "";
    }
  } else if (remaining.length === 1) {
    startStr = remaining[0];
  }

  // Parse start
  let start: Date | null = null;
  if (startStr) {
    start = parseDate(startStr);
    if (!start) {
      warnings.push({ line: lineNum, message: `Invalid start date: "${startStr}"` });
      return null;
    }
  } else {
    warnings.push({ line: lineNum, message: "Cannot resolve task duration." });
    return null;
  }

  // Parse end
  let end: Date | null = null;
  if (endStr) {
    let parsedExplicitEnd = parseDate(endStr);
    if (parsedExplicitEnd) {
      end = adjustEndDate(parsedExplicitEnd);
    } else {
      end = addDuration(start, endStr, excludes);
      if (!end) {
        warnings.push({ line: lineNum, message: `Invalid end date: "${endStr}"` });
        return null;
      }
    }
  } else {
    warnings.push({ line: lineNum, message: "Cannot resolve task duration." });
    return null;
  }

  if (end < start) {
    warnings.push({ line: lineNum, message: "End date is before start date." });
    return null;
  }

  return { id: id || label, label, section, start, end, status, line: lineNum };
}
