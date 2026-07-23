import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parseMermaidGantt } from "./parser";
import { computeLayout } from "./layout";
import { renderSVG } from "./renderer";
import { downloadSVG, downloadPNG, copyPNG } from "./export";
import { DEFAULT_SETTINGS } from "./types";
import type {
  DisplaySettings,
  TimeScale,
  DateFormatMode,
  SectionDisplay,
  ColorMode,
  BackgroundMode,
} from "./types";
import "./styles.css";

const STORAGE_KEY_INPUT = "mmd-gantt-input";
const STORAGE_KEY_SETTINGS = "mmd-gantt-settings";

const SAMPLE_INPUT = `gantt
    title Project Roadmap
    dateFormat YYYY-MM-DD

    section Implementation
    Design :design, 2026-08-01, 2026-08-31
    Development :impl, 2026-09-01, 2026-10-31

    section Evaluation
    Testing :test, 2026-11-01, 2026-12-15
    Release :milestone, rel, 2026-12-31, 2026-12-31`;

const BAR_COLOR_PRESETS = [
  { label: "City Blue", value: "#4393E4" },
  { label: "Emerald", value: "#10B981" },
  { label: "Violet", value: "#8B5CF6" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Amber", value: "#F59E0B" },
];

const BG_COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Dark", value: "#0F172A" },
  { label: "Light Gray", value: "#F8FAFC" },
  { label: "Sepia", value: "#FDF6E3" },
];

function loadFromUrl(): { input?: string; settings?: Partial<DisplaySettings> } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length === 0) return null;

    const resInput = params.get("code") || undefined;
    const resSettings: Partial<DisplaySettings> = {};

    if (params.has("w")) resSettings.outputWidth = Number(params.get("w"));
    if (params.has("lw")) resSettings.labelWidth = Number(params.get("lw"));
    if (params.has("rh")) resSettings.rowHeight = Number(params.get("rh"));
    if (params.has("ts")) resSettings.timeScale = params.get("ts") as TimeScale;
    if (params.has("df")) resSettings.dateFormatMode = params.get("df") as DateFormatMode;
    if (params.has("sec")) resSettings.sectionDisplay = params.get("sec") as SectionDisplay;
    if (params.has("cm")) resSettings.colorMode = params.get("cm") as ColorMode;
    if (params.has("bc")) resSettings.barColor = `#${params.get("bc")}`;
    if (params.has("bg")) resSettings.background = params.get("bg") as BackgroundMode;
    if (params.has("bgc")) resSettings.bgColor = `#${params.get("bgc")}`;

    return { input: resInput, settings: resSettings };
  } catch {
    return null;
  }
}

function syncUrlParams(input: string, settings: DisplaySettings) {
  try {
    const params = new URLSearchParams();
    if (input && input !== SAMPLE_INPUT) {
      params.set("code", input);
    }
    if (settings.outputWidth !== DEFAULT_SETTINGS.outputWidth) {
      params.set("w", String(settings.outputWidth));
    }
    if (settings.labelWidth !== DEFAULT_SETTINGS.labelWidth) {
      params.set("lw", String(settings.labelWidth));
    }
    if (settings.rowHeight !== DEFAULT_SETTINGS.rowHeight) {
      params.set("rh", String(settings.rowHeight));
    }
    if (settings.timeScale !== DEFAULT_SETTINGS.timeScale) {
      params.set("ts", settings.timeScale);
    }
    if (settings.dateFormatMode !== DEFAULT_SETTINGS.dateFormatMode) {
      params.set("df", settings.dateFormatMode);
    }
    if (settings.sectionDisplay !== DEFAULT_SETTINGS.sectionDisplay) {
      params.set("sec", settings.sectionDisplay);
    }
    if (settings.colorMode !== DEFAULT_SETTINGS.colorMode) {
      params.set("cm", settings.colorMode);
    }
    if (settings.barColor.toUpperCase() !== DEFAULT_SETTINGS.barColor.toUpperCase()) {
      params.set("bc", settings.barColor.replace("#", ""));
    }
    if (settings.background !== DEFAULT_SETTINGS.background) {
      params.set("bg", settings.background);
    }
    if (settings.bgColor.toUpperCase() !== DEFAULT_SETTINGS.bgColor.toUpperCase()) {
      params.set("bgc", settings.bgColor.replace("#", ""));
    }

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  } catch {
    // ignore
  }
}

const initialUrlData = loadFromUrl();

function loadInput(): string {
  if (initialUrlData?.input) return initialUrlData.input;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_INPUT);
    if (!saved || saved.includes("今後の方針") || saved.includes("論文執筆")) {
      return SAMPLE_INPUT;
    }
    return saved;
  } catch {
    return SAMPLE_INPUT;
  }
}

function loadSettings(): DisplaySettings {
  let base = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      base = { ...base, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  if (initialUrlData?.settings) {
    base = { ...base, ...initialUrlData.settings };
  }
  return base;
}

function saveInput(input: string) {
  try {
    localStorage.setItem(STORAGE_KEY_INPUT, input);
  } catch {
    // ignore
  }
}

function saveSettings(settings: DisplaySettings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export default function App() {
  const [input, setInput] = useState(loadInput);
  const [settings, setSettings] = useState<DisplaySettings>(loadSettings);

  // Persist input/settings & sync to URL
  useEffect(() => {
    saveInput(input);
    syncUrlParams(input, settings);
  }, [input, settings]);

  useEffect(() => {
    saveSettings(settings);
    syncUrlParams(input, settings);
  }, [input, settings]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      saveInput(input);
      saveSettings(settings);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [input, settings]);

  // Parse and render
  const parseResult = useMemo(() => parseMermaidGantt(input), [input]);

  const layout = useMemo(
    () => computeLayout(parseResult.tasks, parseResult.title, settings),
    [parseResult, settings]
  );

  const svgString = useMemo(
    () => renderSVG(layout, settings),
    [layout, settings]
  );

  const updateSetting = useCallback(
    <K extends keyof DisplaySettings>(key: K, value: DisplaySettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Export & Copy Handlers
  const [svgCopyLabel, setSvgCopyLabel] = useState("📋 SVG Copy");
  const [pngCopyLabel, setPngCopyLabel] = useState("📋 PNG Copy");
  const [shareLinkLabel, setShareLinkLabel] = useState("🔗 Share Link");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDownloadSVG = useCallback(() => {
    downloadSVG(svgString, "gantt-chart.svg");
  }, [svgString]);

  const handleDownloadPNG = useCallback(() => {
    downloadPNG(svgString, "gantt-chart.png", layout.width, layout.height, 2);
  }, [svgString, layout]);

  const handleCopySVG = useCallback(() => {
    navigator.clipboard.writeText(svgString).then(() => {
      setSvgCopyLabel("✅ Copied!");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setSvgCopyLabel("📋 SVG Copy"), 1500);
    });
  }, [svgString]);

  const handleCopyPNG = useCallback(() => {
    copyPNG(svgString, layout.width, layout.height, 2)
      .then(() => {
        setPngCopyLabel("✅ Copied!");
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setPngCopyLabel("📋 PNG Copy"), 1500);
      })
      .catch((err) => {
        alert("Failed to copy PNG: " + (err.message || err));
      });
  }, [svgString, layout]);

  const handleShareLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setShareLinkLabel("✅ Link Copied!");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setShareLinkLabel("🔗 Share Link"), 1500);
    });
  }, []);

  const handleLoadTemplate = useCallback(() => {
    setInput(SAMPLE_INPUT);
  }, []);

  const handleClearInput = useCallback(() => {
    setInput("");
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">G</div>
          <h1 className="app-title">Mermaid Gantt Compact</h1>
        </div>
        <span className="app-subtitle">
          Convert Mermaid gantt charts into compact SVG / PNG
        </span>
      </header>

      <main className="app-main">
        {/* Left Panel */}
        <div className="panel-left">
          {/* Input */}
          <div className="panel-section">
            <div className="section-header">
              <span className="section-title">Mermaid Input</span>
              <div className="section-actions">
                <button
                  type="button"
                  className="btn-sm"
                  onClick={handleLoadTemplate}
                  title="Reset input to sample English template"
                >
                  📄 Sample Template
                </button>
                <button
                  type="button"
                  className="btn-sm"
                  onClick={handleClearInput}
                  title="Clear input text"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>
            <textarea
              id="mermaid-input"
              className="mermaid-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="gantt&#10;    title Project Roadmap&#10;    dateFormat YYYY-MM-DD&#10;&#10;    section Phase 1&#10;    Task 1 :t1, 2026-08-01, 2026-10-31"
              spellCheck={false}
            />
          </div>

          {/* Settings */}
          <div className="panel-section">
            <div className="section-title">Display Settings</div>
            <div className="settings-grid">
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-width">
                  Output Width (px)
                </label>
                <input
                  id="setting-width"
                  className="setting-input"
                  type="number"
                  min={300}
                  max={2000}
                  step={50}
                  value={settings.outputWidth}
                  onChange={(e) =>
                    updateSetting("outputWidth", Number(e.target.value))
                  }
                />
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-label-width">
                  Label Width (px)
                </label>
                <input
                  id="setting-label-width"
                  className="setting-input"
                  type="number"
                  min={60}
                  max={400}
                  step={10}
                  value={settings.labelWidth}
                  onChange={(e) =>
                    updateSetting("labelWidth", Number(e.target.value))
                  }
                />
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-row-height">
                  Row Height (px)
                </label>
                <input
                  id="setting-row-height"
                  className="setting-input"
                  type="number"
                  min={20}
                  max={60}
                  step={2}
                  value={settings.rowHeight}
                  onChange={(e) =>
                    updateSetting("rowHeight", Number(e.target.value))
                  }
                />
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-timescale">
                  Time Scale
                </label>
                <select
                  id="setting-timescale"
                  className="setting-select"
                  value={settings.timeScale}
                  onChange={(e) =>
                    updateSetting("timeScale", e.target.value as TimeScale)
                  }
                >
                  <option value="month">Month</option>
                  <option value="week">Week</option>
                  <option value="day">Day</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-date-format">
                  Date Format
                </label>
                <select
                  id="setting-date-format"
                  className="setting-select"
                  value={settings.dateFormatMode}
                  onChange={(e) =>
                    updateSetting("dateFormatMode", e.target.value as DateFormatMode)
                  }
                >
                  <option value="auto">Auto (Default)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="YY/MM/DD">YY/MM/DD</option>
                  <option value="YYMMDD">YYMMDD</option>
                  <option value="YY/MM">YY/MM</option>
                  <option value="MM/DD">MM/DD</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-section">
                  Sections
                </label>
                <select
                  id="setting-section"
                  className="setting-select"
                  value={settings.sectionDisplay}
                  onChange={(e) =>
                    updateSetting(
                      "sectionDisplay",
                      e.target.value as SectionDisplay
                    )
                  }
                >
                  <option value="hidden">Hidden</option>
                  <option value="heading">Heading Row</option>
                  <option value="label">Left Label</option>
                </select>
              </div>

              {/* Color Mode & Color Picker */}
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-color-mode">
                  Color Mode
                </label>
                <select
                  id="setting-color-mode"
                  className="setting-select"
                  value={settings.colorMode}
                  onChange={(e) =>
                    updateSetting("colorMode", e.target.value as ColorMode)
                  }
                >
                  <option value="custom">Custom Color</option>
                  <option value="status">By Status (Done/Active/Crit)</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-bar-color">
                  Bar Color
                </label>
                <div className="color-picker-wrapper">
                  <input
                    id="setting-bar-color"
                    type="color"
                    className="color-picker-input"
                    value={settings.barColor}
                    onChange={(e) => updateSetting("barColor", e.target.value)}
                  />
                  <span className="color-hex-text">{settings.barColor}</span>
                </div>
                <div className="palette-presets">
                  {BAR_COLOR_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      className={`preset-dot ${settings.barColor.toUpperCase() === p.value.toUpperCase() ? "active" : ""}`}
                      style={{ backgroundColor: p.value }}
                      title={p.label}
                      onClick={() => updateSetting("barColor", p.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Background Mode & Color Picker */}
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-bg-mode">
                  Background
                </label>
                <select
                  id="setting-bg-mode"
                  className="setting-select"
                  value={settings.background}
                  onChange={(e) =>
                    updateSetting("background", e.target.value as BackgroundMode)
                  }
                >
                  <option value="color">Solid Color</option>
                  <option value="transparent">Transparent</option>
                </select>
              </div>

              {settings.background === "color" && (
                <div className="setting-item">
                  <label className="setting-label" htmlFor="setting-bg-color">
                    Background Color
                  </label>
                  <div className="color-picker-wrapper">
                    <input
                      id="setting-bg-color"
                      type="color"
                      className="color-picker-input"
                      value={settings.bgColor}
                      onChange={(e) => updateSetting("bgColor", e.target.value)}
                    />
                    <span className="color-hex-text">{settings.bgColor}</span>
                  </div>
                  <div className="palette-presets">
                    {BG_COLOR_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        className={`preset-dot ${settings.bgColor.toUpperCase() === p.value.toUpperCase() ? "active" : ""}`}
                        style={{ backgroundColor: p.value }}
                        title={p.label}
                        onClick={() => updateSetting("bgColor", p.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warnings */}
          {parseResult.warnings.length > 0 && (
            <div className="panel-section">
              <div className="section-title">
                Warnings ({parseResult.warnings.length})
              </div>
              <div className="warnings">
                {parseResult.warnings.map((w, i) => (
                  <div className="warning-item" key={i}>
                    <span className="warning-line">L{w.line}</span>
                    <span className="warning-message">{w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export & Copy Actions */}
          <div className="panel-section">
            <div className="section-title">Export & Share</div>
            <div className="export-grid">
              <button
                id="btn-download-svg"
                className="btn btn-primary"
                onClick={handleDownloadSVG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 SVG Export
              </button>
              <button
                id="btn-download-png"
                className="btn btn-primary"
                onClick={handleDownloadPNG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 PNG Export
              </button>
              <button
                id="btn-copy-svg"
                className="btn btn-secondary"
                onClick={handleCopySVG}
                disabled={parseResult.tasks.length === 0}
              >
                {svgCopyLabel}
              </button>
              <button
                id="btn-copy-png"
                className="btn btn-secondary"
                onClick={handleCopyPNG}
                disabled={parseResult.tasks.length === 0}
              >
                {pngCopyLabel}
              </button>
              <button
                id="btn-share-link"
                className="btn btn-secondary"
                style={{ gridColumn: "1 / -1" }}
                onClick={handleShareLink}
              >
                {shareLinkLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="panel-right">
          <div className="preview-header">
            <span className="preview-title">Preview</span>
            <span className="preview-title" style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {layout.width} × {layout.height}px
            </span>
          </div>
          <div className="preview-container">
            {parseResult.tasks.length > 0 ? (
              <div
                className={`preview-svg-wrapper ${settings.background === "color" ? "bg-color" : ""}`}
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            ) : (
              <div className="preview-empty">
                <div className="preview-empty-icon">📊</div>
                <div className="preview-empty-text">
                  Enter Mermaid gantt syntax in the left panel to render preview
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
