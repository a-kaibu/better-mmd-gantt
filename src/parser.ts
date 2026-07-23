import type { Task, ParseResult, ParseWarning, TaskStatus } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DURATION_RE = /^(\d+)(d|w|m)$/;

function parseDate(s: string): Date | null {
  if (!DATE_RE.test(s)) return null;
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return d;
}

function addDuration(start: Date, dur: string): Date | null {
  const m = dur.match(DURATION_RE);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const result = new Date(start);
  if (unit === "d") {
    result.setDate(result.getDate() + n);
  } else if (unit === "w") {
    result.setDate(result.getDate() + n * 7);
  } else if (unit === "m") {
    result.setMonth(result.getMonth() + n);
  }
  return result;
}

const KNOWN_STATUSES = new Set(["done", "active", "crit", "milestone"]);
const UNSUPPORTED_KEYWORDS = new Set([
  "axisFormat",
  "tickInterval",
  "weekday",
  "todayMarker",
  "inclusiveEndDates",
  "excludes",
  "click",
]);

export function parseMermaidGantt(input: string): ParseResult {
  const lines = input.split("\n");
  const tasks: Task[] = [];
  const warnings: ParseWarning[] = [];
  let title = "";
  let currentSection = "";
  let dateFormat = "YYYY-MM-DD";
  const taskIds = new Set<string>();
  const taskMap = new Map<string, Task>();

  let foundGantt = false;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed || trimmed.startsWith("%%")) continue;

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
      dateFormat = trimmed.slice(11).trim();
      if (dateFormat !== "YYYY-MM-DD") {
        warnings.push({ line: lineNum, message: `dateFormat "${dateFormat}" は未対応です。YYYY-MM-DD として処理します。` });
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
      warnings.push({ line: lineNum, message: `"${firstWord}" は未対応です。` });
      continue;
    }

    // Parse task line
    const taskResult = parseTaskLine(trimmed, lineNum, currentSection, taskMap, warnings);
    if (taskResult) {
      if (taskIds.has(taskResult.id)) {
        warnings.push({ line: lineNum, message: `タスクID "${taskResult.id}" が重複しています。` });
      }
      taskIds.add(taskResult.id);
      taskMap.set(taskResult.id, taskResult);
      tasks.push(taskResult);
    }
  }

  if (!foundGantt && lines.some(l => l.trim().length > 0)) {
    warnings.push({ line: 1, message: '"gantt" キーワードが見つかりません。' });
  }

  return { title, tasks, warnings };
}

function parseTaskLine(
  line: string,
  lineNum: number,
  section: string,
  taskMap: Map<string, Task>,
  warnings: ParseWarning[]
): Task | null {
  // Format: Label :status, id, start, end
  // Or: Label :id, start, end
  // Or: Label :start, end
  // Or: Label :id, after otherId, duration

  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) {
    warnings.push({ line: lineNum, message: `タスク行を解析できません: "${line}"` });
    return null;
  }

  const label = line.slice(0, colonIdx).trim();
  const rest = line.slice(colonIdx + 1).trim();
  const parts = rest.split(",").map(p => p.trim());

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

  // The remaining parts can be:
  // [id, start, end] or [start, end] or [id, after X, duration] or [start, duration]
  const remaining = parts.slice(idx);

  if (remaining.length === 0) {
    warnings.push({ line: lineNum, message: `タスクの期間を解決できません。` });
    return null;
  }

  // Try to figure out what's what
  if (remaining.length >= 3) {
    // Could be [id, start, end] or [id, after X, duration]
    id = remaining[0];
    if (remaining[1].startsWith("after ")) {
      const afterId = remaining[1].slice(6).trim();
      const refTask = taskMap.get(afterId);
      if (!refTask) {
        warnings.push({ line: lineNum, message: `参照タスク "${afterId}" が見つかりません。` });
        return null;
      }
      const start = new Date(refTask.end);
      const end = addDuration(start, remaining[2]);
      if (!end) {
        const endDate = parseDate(remaining[2]);
        if (!endDate) {
          warnings.push({ line: lineNum, message: `期間 "${remaining[2]}" を解析できません。` });
          return null;
        }
        return { id: id || label, label, section, start, end: endDate, status, line: lineNum };
      }
      return { id: id || label, label, section, start, end, status, line: lineNum };
    }
    startStr = remaining[1];
    endStr = remaining[2];
  } else if (remaining.length === 2) {
    // Could be [start, end] or [id, start] (with duration)
    const firstAsDate = parseDate(remaining[0]);
    if (firstAsDate) {
      startStr = remaining[0];
      endStr = remaining[1];
    } else if (remaining[0].startsWith("after ")) {
      // [after X, duration]
      const afterId = remaining[0].slice(6).trim();
      const refTask = taskMap.get(afterId);
      if (!refTask) {
        warnings.push({ line: lineNum, message: `参照タスク "${afterId}" が見つかりません。` });
        return null;
      }
      const start = new Date(refTask.end);
      const end = addDuration(start, remaining[1]);
      if (!end) {
        const endDate = parseDate(remaining[1]);
        if (!endDate) {
          warnings.push({ line: lineNum, message: `期間 "${remaining[1]}" を解析できません。` });
          return null;
        }
        return { id: label, label, section, start, end: endDate, status, line: lineNum };
      }
      return { id: label, label, section, start, end, status, line: lineNum };
    } else {
      // [id, start+duration] => Not standard, treat first as id
      id = remaining[0];
      startStr = remaining[1];
      endStr = "";
    }
  } else if (remaining.length === 1) {
    // Just a date range or duration? This is unusual
    startStr = remaining[0];
  }

  // Parse start
  let start: Date | null = null;
  if (startStr) {
    start = parseDate(startStr);
    if (!start) {
      warnings.push({ line: lineNum, message: `開始日 "${startStr}" の形式が不正です。` });
      return null;
    }
  } else {
    warnings.push({ line: lineNum, message: `タスクの期間を解決できません。` });
    return null;
  }

  // Parse end
  let end: Date | null = null;
  if (endStr) {
    end = parseDate(endStr);
    if (!end) {
      // Try as duration
      end = addDuration(start, endStr);
      if (!end) {
        warnings.push({ line: lineNum, message: `終了日 "${endStr}" の形式が不正です。` });
        return null;
      }
    }
  } else {
    warnings.push({ line: lineNum, message: `タスクの期間を解決できません。` });
    return null;
  }

  if (end < start) {
    warnings.push({ line: lineNum, message: `終了日が開始日より前です。` });
    return null;
  }

  return { id: id || label, label, section, start, end, status, line: lineNum };
}
