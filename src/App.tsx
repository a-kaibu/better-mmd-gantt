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
    title 今後の方針
    dateFormat YYYY-MM-DD

    section 実装
    実装 :impl, 2026-08-01, 2026-10-31

    section 実験
    実験 :exp, 2026-11-01, 2026-12-31

    section 論文
    論文執筆 :paper, 2027-01-01, 2027-02-28`;

const BAR_COLOR_PRESETS = [
  { label: "シティブルー", value: "#4393E4" },
  { label: "エメラルド", value: "#10B981" },
  { label: "バイオレット", value: "#8B5CF6" },
  { label: "ローズ", value: "#F43F5E" },
  { label: "アンバー", value: "#F59E0B" },
];

const BG_COLOR_PRESETS = [
  { label: "ホワイト", value: "#FFFFFF" },
  { label: "ダーク", value: "#0F172A" },
  { label: "ライトグレー", value: "#F8FAFC" },
  { label: "セピア", value: "#FDF6E3" },
];

function loadInput(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_INPUT) || SAMPLE_INPUT;
  } catch {
    return SAMPLE_INPUT;
  }
}

function loadSettings(): DisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
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

  // Persist on change
  useEffect(() => {
    saveInput(input);
  }, [input]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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
  const [svgCopyLabel, setSvgCopyLabel] = useState("📋 SVG コピー");
  const [pngCopyLabel, setPngCopyLabel] = useState("📋 PNG コピー");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDownloadSVG = useCallback(() => {
    downloadSVG(svgString, "gantt-chart.svg");
  }, [svgString]);

  const handleDownloadPNG = useCallback(() => {
    downloadPNG(svgString, "gantt-chart.png", layout.width, layout.height, 2);
  }, [svgString, layout]);

  const handleCopySVG = useCallback(() => {
    navigator.clipboard.writeText(svgString).then(() => {
      setSvgCopyLabel("✅ コピー完了");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setSvgCopyLabel("📋 SVG コピー"), 1500);
    });
  }, [svgString]);

  const handleCopyPNG = useCallback(() => {
    copyPNG(svgString, layout.width, layout.height, 2)
      .then(() => {
        setPngCopyLabel("✅ コピー完了");
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setPngCopyLabel("📋 PNG コピー"), 1500);
      })
      .catch((err) => {
        alert("PNGのコピーに失敗しました: " + (err.message || err));
      });
  }, [svgString, layout]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">G</div>
          <h1 className="app-title">Mermaid Gantt Compact</h1>
        </div>
        <span className="app-subtitle">
          ガント記法 → コンパクトSVG/PNG
        </span>
      </header>

      <main className="app-main">
        {/* Left Panel */}
        <div className="panel-left">
          {/* Input */}
          <div className="panel-section">
            <div className="section-title">Mermaid入力</div>
            <textarea
              id="mermaid-input"
              className="mermaid-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="gantt&#10;    title ...&#10;    section ...&#10;    タスク :id, 2026-08-01, 2026-10-31"
              spellCheck={false}
            />
          </div>

          {/* Settings */}
          <div className="panel-section">
            <div className="section-title">表示設定</div>
            <div className="settings-grid">
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-width">
                  出力幅 (px)
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
                  左ラベル幅 (px)
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
                  行の高さ (px)
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
                  時間軸
                </label>
                <select
                  id="setting-timescale"
                  className="setting-select"
                  value={settings.timeScale}
                  onChange={(e) =>
                    updateSetting("timeScale", e.target.value as TimeScale)
                  }
                >
                  <option value="month">月 (Month)</option>
                  <option value="week">週 (Week)</option>
                  <option value="day">日 (Day)</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-date-format">
                  日付表示フォーマット
                </label>
                <select
                  id="setting-date-format"
                  className="setting-select"
                  value={settings.dateFormatMode}
                  onChange={(e) =>
                    updateSetting("dateFormatMode", e.target.value as DateFormatMode)
                  }
                >
                  <option value="auto">標準 (自動)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="YY/MM/DD">YY/MM/DD</option>
                  <option value="YYMMDD">YYMMDD</option>
                  <option value="MM/DD">MM/DD</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-section">
                  セクション表示
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
                  <option value="hidden">非表示</option>
                  <option value="heading">見出し行</option>
                  <option value="label">左ラベル</option>
                </select>
              </div>

              {/* Color Mode & Color Picker */}
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-color-mode">
                  テーマ色
                </label>
                <select
                  id="setting-color-mode"
                  className="setting-select"
                  value={settings.colorMode}
                  onChange={(e) =>
                    updateSetting("colorMode", e.target.value as ColorMode)
                  }
                >
                  <option value="custom">カスタム色</option>
                  <option value="status">状態別 (Done/Active/Crit)</option>
                </select>
              </div>

              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-bar-color">
                  バーの色
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
                  背景指定
                </label>
                <select
                  id="setting-bg-mode"
                  className="setting-select"
                  value={settings.background}
                  onChange={(e) =>
                    updateSetting("background", e.target.value as BackgroundMode)
                  }
                >
                  <option value="color">背景色あり</option>
                  <option value="transparent">透明</option>
                </select>
              </div>

              {settings.background === "color" && (
                <div className="setting-item">
                  <label className="setting-label" htmlFor="setting-bg-color">
                    背景色
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
                警告 ({parseResult.warnings.length})
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
            <div className="section-title">保存・コピー</div>
            <div className="export-grid">
              <button
                id="btn-download-svg"
                className="btn btn-primary"
                onClick={handleDownloadSVG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 SVG 保存
              </button>
              <button
                id="btn-download-png"
                className="btn btn-primary"
                onClick={handleDownloadPNG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 PNG 保存
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
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="panel-right">
          <div className="preview-header">
            <span className="preview-title">プレビュー</span>
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
                  左のテキストエリアにMermaidガント記法を入力してください
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
