import { useEffect } from "react";
import { useDrawingStore, PRESET_COLORS, BrushType, BRUSH_CONFIGS } from "../store/drawingStore";
import { useSessionStore } from "../store/sessionStore";

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

export default function Toolbar() {
  const { tool, color, strokeWidth, setTool, setColor, setStrokeWidth, undo, redo, clearHistory } =
    useDrawingStore();
  const { clearCurrentDrawing, updateCurrentDrawing, currentDrawingData, eraserDisabled } = useSessionStore();

  // Switch to pen if eraser is disabled while selected
  useEffect(() => {
    if (eraserDisabled && tool === "eraser") {
      setTool("pen");
    }
  }, [eraserDisabled, tool, setTool]);

  const handleUndo = () => {
    const lines = undo();
    if (lines !== null) {
      updateCurrentDrawing({ lines });
    }
  };

  const handleRedo = () => {
    const lines = redo();
    if (lines !== null) {
      updateCurrentDrawing({ lines });
    }
  };

  const handleClear = () => {
    clearCurrentDrawing();
    clearHistory();
  };

  return (
    <div className="flex items-center justify-center gap-4 px-4 py-3 bg-dark-surface overflow-x-auto">
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
            title={BRUSH_CONFIGS[brushType].name}
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
            title="Eraser"
          >
            {BrushIcons.eraser}
          </button>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Color palette */}
      <div className="flex items-center gap-1">
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
            title={presetColor}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Stroke width */}
      <div className="flex items-center gap-2">
        <span className="text-dark-muted text-xs">Size:</span>
        <input
          type="range"
          min="1"
          max="20"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          className="w-20 accent-blue-500"
        />
        <span className="text-dark-text text-xs w-5">{strokeWidth}</span>
      </div>

      {/* Separator */}
      <div className="w-px h-8 bg-dark-accent flex-shrink-0" />

      {/* Undo / Redo / Clear */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleUndo}
          className="p-2 rounded-lg bg-dark-bg text-dark-muted hover:bg-dark-accent 
                     hover:text-dark-text transition-colors"
          title="Undo"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
          </svg>
        </button>
        <button
          onClick={handleRedo}
          className="p-2 rounded-lg bg-dark-bg text-dark-muted hover:bg-dark-accent 
                     hover:text-dark-text transition-colors"
          title="Redo"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
          </svg>
        </button>
        <button
          onClick={handleClear}
          disabled={currentDrawingData.lines.length === 0}
          className="p-2 rounded-lg bg-dark-bg text-dark-muted hover:bg-red-600/50 
                     hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed 
                     transition-colors"
          title="Clear drawing"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
