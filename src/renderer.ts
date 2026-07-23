import type { DisplaySettings } from "./types";
import type { ChartLayout, BarLayout } from "./layout";

const BLUE_PALETTE = {
  bar: "#4393E4",
  barStroke: "#2B6CB0",
  done: "#94A3B8",
  doneStroke: "#64748B",
  active: "#4393E4",
  activeStroke: "#2B6CB0",
  crit: "#EF4444",
  critStroke: "#B91C1C",
  milestone: "#F59E0B",
  milestoneStroke: "#D97706",
};

const STATUS_PALETTE = {
  bar: "#4393E4",
  barStroke: "#2B6CB0",
  done: "#94A3B8",
  doneStroke: "#64748B",
  active: "#22C55E",
  activeStroke: "#16A34A",
  crit: "#EF4444",
  critStroke: "#B91C1C",
  milestone: "#F59E0B",
  milestoneStroke: "#D97706",
};

function getBarColors(bar: BarLayout, colorMode: string) {
  const palette = colorMode === "status" ? STATUS_PALETTE : BLUE_PALETTE;

  if (bar.isMilestone) {
    return { fill: palette.milestone, stroke: palette.milestoneStroke };
  }

  if (colorMode === "blue") {
    if (bar.status === "done") {
      return { fill: palette.done, stroke: palette.doneStroke };
    }
    if (bar.status === "crit") {
      return { fill: palette.crit, stroke: palette.critStroke };
    }
    return { fill: palette.bar, stroke: palette.barStroke };
  }

  // status mode
  switch (bar.status) {
    case "done":
      return { fill: palette.done, stroke: palette.doneStroke };
    case "active":
      return { fill: palette.active, stroke: palette.activeStroke };
    case "crit":
      return { fill: palette.crit, stroke: palette.critStroke };
    default:
      return { fill: palette.bar, stroke: palette.barStroke };
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSVG(
  layout: ChartLayout,
  settings: DisplaySettings
): string {
  const { width, height, chartX, bars, ticks, sections, title, headerHeight } = layout;
  const { background, colorMode, rowHeight } = settings;

  const bgColor = background === "white" ? "#FFFFFF" : "none";
  const textColor = "#1E293B";
  const gridColor = "#E2E8F0";
  const sectionBg = "#F1F5F9";
  const sectionTextColor = "#475569";
  const tickTextColor = "#64748B";

  const parts: string[] = [];

  // SVG header
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="font-family: 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif;">`
  );

  // Defs for styles
  parts.push(`<defs>`);
  parts.push(`<style>`);
  parts.push(`text { font-family: 'Segoe UI', 'Hiragino Sans', 'Noto Sans JP', sans-serif; }`);
  parts.push(`</style>`);
  parts.push(`</defs>`);

  // Background
  if (bgColor !== "none") {
    parts.push(`<rect width="${width}" height="${height}" fill="${bgColor}"/>`);
  }

  // Title
  if (title) {
    parts.push(
      `<text x="${width / 2}" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="${textColor}">${escapeXml(title)}</text>`
    );
  }

  const titleHeight = title ? 36 : 0;

  // Section backgrounds
  for (const sec of sections) {
    parts.push(
      `<rect x="0" y="${sec.y}" width="${width}" height="${sec.height}" fill="${sectionBg}" />`
    );
    parts.push(
      `<text x="8" y="${sec.y + rowHeight / 2 + 5}" font-size="12" font-weight="600" fill="${sectionTextColor}">${escapeXml(sec.label)}</text>`
    );
  }

  // Grid lines (vertical)
  for (const tick of ticks) {
    const strokeW = tick.isMajor ? 1 : 0.5;
    const opacity = tick.isMajor ? 0.6 : 0.3;
    parts.push(
      `<line x1="${tick.x}" y1="${headerHeight}" x2="${tick.x}" y2="${height}" stroke="${gridColor}" stroke-width="${strokeW}" opacity="${opacity}"/>`
    );
  }

  // Tick labels
  for (const tick of ticks) {
    if (tick.label) {
      parts.push(
        `<text x="${tick.x + 4}" y="${titleHeight + 18}" font-size="11" fill="${tickTextColor}">${escapeXml(tick.label)}</text>`
      );
    }
  }

  // Horizontal separator
  parts.push(
    `<line x1="0" y1="${headerHeight}" x2="${width}" y2="${headerHeight}" stroke="${gridColor}" stroke-width="1"/>`
  );

  // Bars and labels
  for (const bar of bars) {
    const { fill, stroke } = getBarColors(bar, colorMode);

    if (bar.isMilestone) {
      // Diamond shape
      const cx = bar.x;
      const cy = bar.y + bar.height / 2;
      const r = bar.height / 2.5;
      parts.push(
        `<polygon points="${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
      );
    } else {
      // Rounded rect bar
      const radius = Math.min(4, bar.height / 2, bar.width / 2);
      parts.push(
        `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1" opacity="0.9"/>`
      );
    }

    // Label on the left
    const labelX = chartX - 8;
    const labelY = bar.y + bar.height / 2 + 4;
    parts.push(
      `<text x="${labelX}" y="${labelY}" text-anchor="end" font-size="12" fill="${textColor}">${escapeXml(bar.label)}</text>`
    );
  }

  // Left border
  parts.push(
    `<line x1="${chartX}" y1="${headerHeight}" x2="${chartX}" y2="${height}" stroke="${gridColor}" stroke-width="1"/>`
  );

  parts.push(`</svg>`);

  return parts.join("\n");
}
