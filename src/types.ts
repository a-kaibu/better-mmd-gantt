export type TaskStatus = "done" | "active" | "crit" | "milestone";

export type Task = {
  id: string;
  label: string;
  section: string;
  start: Date;
  end: Date;
  status?: TaskStatus;
  line: number;
};

export type ParseResult = {
  title: string;
  tasks: Task[];
  warnings: ParseWarning[];
};

export type ParseWarning = {
  line: number;
  message: string;
};

export type TimeScale = "day" | "week" | "month";

export type SectionDisplay = "heading" | "label" | "hidden";

export type ColorMode = "status" | "blue";

export type BackgroundMode = "white" | "transparent";

export type DisplaySettings = {
  outputWidth: number;
  labelWidth: number;
  rowHeight: number;
  timeScale: TimeScale;
  sectionDisplay: SectionDisplay;
  colorMode: ColorMode;
  background: BackgroundMode;
};

export const DEFAULT_SETTINGS: DisplaySettings = {
  outputWidth: 900,
  labelWidth: 150,
  rowHeight: 32,
  timeScale: "month",
  sectionDisplay: "hidden",
  colorMode: "blue",
  background: "white",
};
