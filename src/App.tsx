import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parseMermaidGantt } from "./parser";
import { computeLayout } from "./layout";
import { renderSVG } from "./renderer";
import { downloadSVG, downloadPNG } from "./export";
import { DEFAULT_SETTINGS } from "./types";
import type {
  DisplaySettings,
  TimeScale,
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

  const handleDownloadSVG = useCallback(() => {
    downloadSVG(svgString, "gantt-chart.svg");
  }, [svgString]);

  const handleDownloadPNG = useCallback(() => {
    downloadPNG(svgString, "gantt-chart.png", layout.width, layout.height, 2);
  }, [svgString, layout]);

  const [copyLabel, setCopyLabel] = useState("📋 SVGコピー");
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopySVG = useCallback(() => {
    navigator.clipboard.writeText(svgString).then(() => {
      setCopyLabel("✅ コピー済み");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopyLabel("📋 SVGコピー"), 1500);
    });
  }, [svgString]);

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
              placeholder="gantt&#10;    title ...&#10;    section ...&#10;    タスク :id, start, end"
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
                  ラベル幅 (px)
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
                  <option value="month">月</option>
                  <option value="week">週</option>
                  <option value="day">日</option>
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
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-color">
                  色
                </label>
                <select
                  id="setting-color"
                  className="setting-select"
                  value={settings.colorMode}
                  onChange={(e) =>
                    updateSetting("colorMode", e.target.value as ColorMode)
                  }
                >
                  <option value="blue">青固定</option>
                  <option value="status">状態別</option>
                </select>
              </div>
              <div className="setting-item">
                <label className="setting-label" htmlFor="setting-bg">
                  背景
                </label>
                <select
                  id="setting-bg"
                  className="setting-select"
                  value={settings.background}
                  onChange={(e) =>
                    updateSetting("background", e.target.value as BackgroundMode)
                  }
                >
                  <option value="white">白</option>
                  <option value="transparent">透明</option>
                </select>
              </div>
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

          {/* Actions */}
          <div className="panel-section">
            <div className="section-title">保存・コピー</div>
            <div className="button-group">
              <button
                id="btn-download-svg"
                className="btn btn-primary"
                onClick={handleDownloadSVG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 SVG保存
              </button>
              <button
                id="btn-download-png"
                className="btn btn-primary"
                onClick={handleDownloadPNG}
                disabled={parseResult.tasks.length === 0}
              >
                📥 PNG保存
              </button>
              <button
                id="btn-copy-svg"
                className="btn btn-secondary"
                onClick={handleCopySVG}
                disabled={parseResult.tasks.length === 0}
              >
                {copyLabel}
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
                className={`preview-svg-wrapper ${settings.background === "white" ? "bg-white" : ""}`}
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
