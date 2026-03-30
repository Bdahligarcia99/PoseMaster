import { useEffect, useState, useRef } from "react";
import { useDrawingStore, PRESET_COLORS, BrushType } from "../store/drawingStore";
import { useSessionStore } from "../store/sessionStore";
import { useSettingsStore } from "../store/settingsStore";

// Tooltip descriptions for each brush type
const BRUSH_TOOLTIPS: Record<BrushType, string> = {
  pen: "Pen – Smooth, solid lines",
  ballpoint: "Ballpoint – Fine, precise strokes",
  pencil: "Pencil – Light, textured lines",
  brush: "Brush – Soft, painterly strokes",
  highlighter: "Highlighter – Transparent, wide marks",
  eraser: "Eraser – Remove strokes",
};

// Color names for tooltips
const COLOR_NAMES: Record<string, string> = {
  "#ffffff": "White",
  "#ef4444": "Red",
  "#f97316": "Orange",
  "#eab308": "Yellow",
  "#22c55e": "Green",
  "#3b82f6": "Blue",
  "#8b5cf6": "Purple",
  "#ec4899": "Pink",
};

// SVG icons for each brush type
const BrushIcons: Record<BrushType, JSX.Element> = {
  pen: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.71 7.04c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.37-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z" />
    </svg>
  ),
  ballpoint: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19.3 8.93l-1.41-1.41-3.54 3.54 1.41 1.41 3.54-3.54M12 20l-4-4 9.9-9.9c.78-.78 2.05-.78 2.83 0l1.27 1.27c.78.78.78 2.05 0 2.83L12 20M7 17v3h3l-3-3M3 17v4h4l-4-4z" />
    </svg>
  ),
  pencil: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9.75 20.85c1.78-.7 1.39-2.63.49-3.85-.89-1.25-2.12-2.11-3.36-2.94A9.817 9.817 0 014.54 12c-.28-.33-.85-.94-.27-1.06.59-.12 1.61.46 2.13.68.91.38 1.81.82 2.65 1.34l1.01-1.7C8.5 10.23 6.5 9.32 4.64 9.05c-1.06-.16-2.18.06-2.54 1.21-.32.99.19 1.99.77 2.77 1.37 1.83 3.5 2.71 5.09 4.29.34.33.75.72.95 1.18.21.44.16.59-.31.74-.62.19-1.17-.19-1.63-.47-.24-.14-1.31-1.05-1.5-.8l-.97 1.6c1.15.91 2.58 1.88 4.06 1.58.89-.18 1.64-.71 1.19-1.3M9.19 5.5l-2.3 2.3 1.41 1.41 2.3-2.3-1.41-1.41M13 4.83l-2.29 2.29 1.41 1.41L14.41 6.24 13 4.83M18.88 2.29l-1.41 1.41 2.3 2.3 1.41-1.41-2.3-2.3z" />
    </svg>
  ),
  brush: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z" />
    </svg>
  ),
  highlighter: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 14l3 3v5h6v-5l3-3V9H6v5zm5-12h2v3h-2V2zM3.5 5.88l1.41-1.41 2.12 2.12L5.62 8 3.5 5.88zm13.46.71l2.12-2.12 1.41 1.41L18.38 8l-1.42-1.41z" />
    </svg>
  ),
  eraser: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 01-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53-4.95-4.95-4.95 4.95z" />
    </svg>
  ),
};

// Drawing tools (excluding eraser which is separate)
const DRAWING_TOOLS: BrushType[] = ["pen", "ballpoint", "pencil", "brush", "highlighter"];

/**
 * Shared toolbar: brush/color/stroke live in drawingStore and apply to whichever pane is active.
 * In split screen, undo/clear and stroke targets follow sessionStore.activeCanvas; only the
 * active DrawingCanvas accepts pointer input (inactive pane uses pointer-events-none).
 */
export default function Toolbar() {
  const {
    tool,
    color,
    strokeWidth,
    setTool,
    setColor,
    setStrokeWidth,
    undo,
    redo,
    undoFree,
    redoFree,
    clearHistory,
    clearFreeHistory,
  } = useDrawingStore();
  const {
    clearCurrentDrawing,
    updateCurrentDrawing,
    updateFreeDrawDrawing,
    currentDrawingData,
    eraserDisabled,
    activeCanvas,
    isSplitScreen,
  } = useSessionStore();
  const { settings, addCustomColor, removeCustomColor, resetCustomColors } = useSettingsStore();
  
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [pickerColor, setPickerColor] = useState(color);
  const colorMenuRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Switch to pen if eraser is disabled while selected
  useEffect(() => {
    if (eraserDisabled && tool === "eraser") {
      setTool("pen");
    }
  }, [eraserDisabled, tool, setTool]);
  
  // Close color menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as Node)) {
        setShowColorMenu(false);
      }
    };
    if (showColorMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColorMenu]);
  
  // Update picker color when main color changes
  useEffect(() => {
    setPickerColor(color);
  }, [color]);
  
  const customColors = settings.customColors || [];
  const isCustomColor = !PRESET_COLORS.includes(color) && !customColors.includes(color.toLowerCase());

  const handleUndo = () => {
    if (isSplitScreen && activeCanvas === "freeDraw") {
      const s = useSessionStore.getState();
      const path = s.isSessionActive
        ? s.images[s.currentImageIndex]?.path
        : s.setupPreviewImagePath;
      if (!path) return;
      const lines = undoFree();
      if (lines !== null) {
        const prev = s.freeDrawDrawings[path] ?? { lines: [] };
        updateFreeDrawDrawing(path, { ...prev, lines });
      }
      return;
    }
    const lines = undo();
    if (lines !== null) {
      updateCurrentDrawing({ lines });
    }
  };

  const handleRedo = () => {
    if (isSplitScreen && activeCanvas === "freeDraw") {
      const s = useSessionStore.getState();
      const path = s.isSessionActive
        ? s.images[s.currentImageIndex]?.path
        : s.setupPreviewImagePath;
      if (!path) return;
      const lines = redoFree();
      if (lines !== null) {
        const prev = s.freeDrawDrawings[path] ?? { lines: [] };
        updateFreeDrawDrawing(path, { ...prev, lines });
      }
      return;
    }
    const lines = redo();
    if (lines !== null) {
      updateCurrentDrawing({ lines });
    }
  };

  const handleClear = () => {
    clearCurrentDrawing();
    if (isSplitScreen && activeCanvas === "freeDraw") {
      clearFreeHistory();
    } else {
      clearHistory();
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-3 bg-dark-surface overflow-x-auto">
      {isSplitScreen && (
        <span
          className="shrink-0 rounded-md border border-dark-accent/60 bg-dark-bg px-2 py-1 text-[11px] font-medium text-dark-muted"
          title="Tools apply to this pane — click a canvas to switch"
        >
          {activeCanvas === "curator" ? "Image" : "Practice"}
        </span>
      )}
      {/* Brush selection */}
      <div className="flex items-center gap-1">
        {DRAWING_TOOLS.map((brushType) => (
          <button
            key={brushType}
            onClick={() => setTool(brushType)}
            className={`p-2 rounded-lg transition-colors ${
              tool === brushType
                ? "bg-blue-600 text-white"
                : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
            }`}
            title={BRUSH_TOOLTIPS[brushType]}
          >
            {BrushIcons[brushType]}
          </button>
        ))}
        {/* Eraser - separate from drawing tools */}
        {!eraserDisabled && (
          <button
            onClick={() => setTool("eraser")}
            className={`p-2 rounded-lg transition-colors ml-1 ${
              tool === "eraser"
                ? "bg-blue-600 text-white"
                : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
            }`}
            title={BRUSH_TOOLTIPS.eraser}
          >
            {BrushIcons.eraser}
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Color palette */}
      <div className="flex items-center gap-1">
        {/* Default colors */}
        {PRESET_COLORS.map((presetColor) => (
          <button
            key={presetColor}
            onClick={() => setColor(presetColor)}
            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
              color === presetColor
                ? "border-blue-400 scale-110"
                : "border-transparent"
            }`}
            style={{ backgroundColor: presetColor }}
            title={COLOR_NAMES[presetColor] || presetColor}
          />
        ))}
        
        {/* Custom colors */}
        {customColors.length > 0 && (
          <>
            <div className="w-px h-5 bg-dark-accent/50 mx-0.5" />
            {customColors.map((customColor) => (
              <button
                key={customColor}
                onClick={() => setColor(customColor)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  removeCustomColor(customColor);
                }}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 group relative ${
                  color.toLowerCase() === customColor
                    ? "border-blue-400 scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: customColor }}
                title={`${customColor} (right-click to remove)`}
              />
            ))}
          </>
        )}
        
        {/* Color picker button */}
        <div className="relative" ref={colorMenuRef}>
          <button
            onClick={() => setShowColorMenu(!showColorMenu)}
            className={`w-6 h-6 rounded-full border-2 border-dashed transition-all hover:scale-110 flex items-center justify-center
              ${showColorMenu ? "border-blue-400" : "border-dark-muted hover:border-dark-text"}`}
            style={{ 
              background: isCustomColor 
                ? `linear-gradient(135deg, ${color} 50%, transparent 50%)` 
                : undefined 
            }}
            title="Color picker – Add custom colors"
          >
            <svg className="w-3.5 h-3.5 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          
          {/* Color picker dropdown */}
          {showColorMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-dark-surface rounded-lg shadow-xl border border-dark-accent z-50 min-w-[200px]">
              {/* Color picker input */}
              <div className="flex items-center gap-2 mb-3">
                <input
                  ref={colorInputRef}
                  type="color"
                  value={pickerColor}
                  onChange={(e) => {
                    setPickerColor(e.target.value);
                    setColor(e.target.value);
                  }}
                  className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
                  title="Pick a color"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={pickerColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPickerColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        setColor(val);
                      }
                    }}
                    className="w-full px-2 py-1 bg-dark-bg rounded text-dark-text text-sm font-mono"
                    placeholder="#000000"
                  />
                </div>
              </div>
              
              {/* Add to swatches button */}
              <button
                onClick={() => {
                  addCustomColor(pickerColor);
                  setShowColorMenu(false);
                }}
                disabled={PRESET_COLORS.includes(pickerColor.toLowerCase()) || customColors.includes(pickerColor.toLowerCase())}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-accent disabled:text-dark-muted
                           rounded text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
              >
                {customColors.includes(pickerColor.toLowerCase()) 
                  ? "Already saved" 
                  : PRESET_COLORS.includes(pickerColor.toLowerCase())
                    ? "Default color"
                    : "Add to swatches"}
              </button>
              
              {/* Reset custom colors */}
              {customColors.length > 0 && (
                <button
                  onClick={() => {
                    resetCustomColors();
                    setShowColorMenu(false);
                  }}
                  className="w-full mt-2 px-3 py-1.5 text-dark-muted hover:text-red-400 
                             text-xs transition-colors"
                >
                  Clear custom colors ({customColors.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Stroke width */}
      <div className="flex items-center gap-2" title="Stroke Size – Adjust line thickness">
        <span className="text-dark-muted text-xs">Size:</span>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          className="w-20 accent-blue-500"
          title={`Stroke size: ${strokeWidth}px`}
        />
        <span className="text-dark-text text-xs w-5">{strokeWidth}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Undo / Redo / Clear - disabled when eraser is disabled (practice mode) */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          disabled={eraserDisabled}
          className={`p-2 rounded-lg bg-dark-bg transition-colors
            ${eraserDisabled 
              ? "text-dark-muted/30 cursor-not-allowed" 
              : "text-dark-muted hover:bg-dark-accent hover:text-dark-text"
            }`}
          title={eraserDisabled ? "Undo disabled (practice mode)" : "Undo – Revert last stroke (⌘Z)"}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
          </svg>
        </button>
        <button
          onClick={handleRedo}
          disabled={eraserDisabled}
          className={`p-2 rounded-lg bg-dark-bg transition-colors
            ${eraserDisabled 
              ? "text-dark-muted/30 cursor-not-allowed" 
              : "text-dark-muted hover:bg-dark-accent hover:text-dark-text"
            }`}
          title={eraserDisabled ? "Redo disabled (practice mode)" : "Redo – Restore undone stroke (⌘⇧Z)"}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
          </svg>
        </button>
        <button
          onClick={handleClear}
          disabled={currentDrawingData.lines.length === 0 || eraserDisabled}
          className={`p-2 rounded-lg bg-dark-bg transition-colors
            ${eraserDisabled 
              ? "text-dark-muted/30 cursor-not-allowed" 
              : "text-dark-muted hover:bg-red-600/50 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          title={eraserDisabled ? "Clear disabled (practice mode)" : "Clear – Delete all strokes"}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
