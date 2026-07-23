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

export type ColorMode = "status" | "custom";

export type BackgroundMode = "color" | "transparent";

export type DateFormatMode = "auto" | "YYYY-MM-DD" | "YY/MM/DD" | "YYMMDD" | "MM/DD";

export type DisplaySettings = {
  outputWidth: number;
  labelWidth: number;
  rowHeight: number;
  timeScale: TimeScale;
  dateFormatMode: DateFormatMode;
  sectionDisplay: SectionDisplay;
  colorMode: ColorMode;
  barColor: string;
  background: BackgroundMode;
  bgColor: string;
};

export const DEFAULT_SETTINGS: DisplaySettings = {
  outputWidth: 900,
  labelWidth: 150,
  rowHeight: 32,
  timeScale: "month",
  dateFormatMode: "auto",
  sectionDisplay: "hidden",
  colorMode: "custom",
  barColor: "#4393E4",
  background: "color",
  bgColor: "#FFFFFF",
};
