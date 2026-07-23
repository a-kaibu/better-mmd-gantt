import type { DisplaySettings } from "./types";
import type { ChartLayout, BarLayout } from "./layout";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.max(0, Math.min(255, Math.round(c)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function darken(hex: string, factor = 0.7): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

function desaturate(hex: string, amount = 0.5): string {
  const [r, g, b] = hexToRgb(hex);
  const gray = r * 0.299 + g * 0.587 + b * 0.114;
  return rgbToHex(
    r + (gray - r) * amount,
    g + (gray - g) * amount,
    b + (gray - b) * amount
  );
}

const STATUS_COLORS = {
  done: { fill: "#94A3B8", stroke: "#64748B" },
  active: { fill: "#22C55E", stroke: "#16A34A" },
  crit: { fill: "#EF4444", stroke: "#B91C1C" },
  milestone: { fill: "#F59E0B", stroke: "#D97706" },
};

function getBarColors(
  bar: BarLayout,
  colorMode: string,
  barColor: string
) {
  if (bar.isMilestone) {
    return STATUS_COLORS.milestone;
  }

  if (colorMode === "status") {
    switch (bar.status) {
      case "done":
        return STATUS_COLORS.done;
      case "active":
        return STATUS_COLORS.active;
      case "crit":
        return STATUS_COLORS.crit;
      default:
        return { fill: barColor, stroke: darken(barColor) };
    }
  }

  // custom mode — all bars use barColor, done is desaturated, crit stays red
  if (bar.status === "done") {
    const d = desaturate(barColor, 0.7);
    return { fill: d, stroke: darken(d) };
  }
  if (bar.status === "crit") {
    return STATUS_COLORS.crit;
  }
  return { fill: barColor, stroke: darken(barColor) };
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
  const { background, bgColor, colorMode, barColor, rowHeight } = settings;

  const bgFill = background === "color" ? bgColor : "none";
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
  if (bgFill !== "none") {
    parts.push(`<rect width="${width}" height="${height}" fill="${bgFill}"/>`);
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

  // Excluded day bands
  if (layout.excludedBands && layout.excludedBands.length > 0) {
    for (const band of layout.excludedBands) {
      parts.push(
        `<rect x="${band.x}" y="${headerHeight}" width="${band.width}" height="${height - headerHeight}" fill="#CBD5E1" opacity="0.3"/>`
      );
    }
  }

  // Grid lines (vertical)
  for (const tick of ticks) {
    const strokeW = tick.isMajor ? 1 : 0.5;
    const opacity = tick.isMajor ? 0.6 : 0.3;
    parts.push(
      `<line x1="${tick.x}" y1="${headerHeight}" x2="${tick.x}" y2="${height}" stroke="${gridColor}" stroke-width="${strokeW}" opacity="${opacity}"/>`
    );
  }

  // Today marker line
  if (layout.todayX !== undefined) {
    const style = layout.todayStyle;
    const stroke = style?.stroke || "#EF4444";
    const strokeWidth = style?.strokeWidth || "2";
    const opacity = style?.opacity || "0.85";
    parts.push(
      `<line x1="${layout.todayX}" y1="${headerHeight}" x2="${layout.todayX}" y2="${height}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-dasharray="4 4"/>`
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
    const { fill, stroke } = getBarColors(bar, colorMode, barColor);
    const click = bar.click;

    if (click) {
      if (click.type === "href") {
        parts.push(
          `<a href="${escapeXml(click.target)}" target="_blank" rel="noopener noreferrer">`
        );
      } else if (click.type === "call") {
        parts.push(`<g cursor="pointer" onclick="${escapeXml(click.target)}">`);
      }
    }

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

    if (click) {
      if (click.type === "href") {
        parts.push(`</a>`);
      } else if (click.type === "call") {
        parts.push(`</g>`);
      }
    }
  }

  // Left border
  parts.push(
    `<line x1="${chartX}" y1="${headerHeight}" x2="${chartX}" y2="${height}" stroke="${gridColor}" stroke-width="1"/>`
  );

  parts.push(`</svg>`);

  return parts.join("\n");
}
