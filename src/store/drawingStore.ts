import { create } from "zustand";

// Brush types with their visual properties
export type BrushType = "pen" | "ballpoint" | "pencil" | "brush" | "highlighter" | "eraser";

export interface BrushConfig {
  name: string;
  icon: string; // SVG path or emoji
  tension: number; // Line smoothness (0 = sharp, 1 = smooth)
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
  opacity: number; // 0-1
  widthMultiplier: number; // Multiplies the stroke width
  shadowBlur?: number; // For soft brushes
}

export const BRUSH_CONFIGS: Record<BrushType, BrushConfig> = {
  pen: {
    name: "Pen",
    icon: "pen",
    tension: 0.5,
    lineCap: "round",
    lineJoin: "round",
    opacity: 1,
    widthMultiplier: 1,
  },
  ballpoint: {
    name: "Ballpoint",
    icon: "ballpoint",
    tension: 0.3,
    lineCap: "round",
    lineJoin: "round",
    opacity: 0.9,
    widthMultiplier: 0.7,
  },
  pencil: {
    name: "Pencil",
    icon: "pencil",
    tension: 0.2,
    lineCap: "round",
    lineJoin: "round",
    opacity: 0.7,
    widthMultiplier: 0.8,
  },
  brush: {
    name: "Brush",
    icon: "brush",
    tension: 0.7,
    lineCap: "round",
    lineJoin: "round",
    opacity: 0.85,
    widthMultiplier: 2,
    shadowBlur: 2,
  },
  highlighter: {
    name: "Highlighter",
    icon: "highlighter",
    tension: 0.3,
    lineCap: "square",
    lineJoin: "miter",
    opacity: 0.4,
    widthMultiplier: 3,
  },
  eraser: {
    name: "Eraser",
    icon: "eraser",
    tension: 0.5,
    lineCap: "round",
    lineJoin: "round",
    opacity: 1,
    widthMultiplier: 2,
  },
};

export interface LineData {
  points: number[];
  color: string;
  strokeWidth: number;
  tool: BrushType;
}

export interface HistoryState {
  history: Array<{ lines: LineData[] }>;
  historyIndex: number;
}

interface DrawingState {
  tool: BrushType;
  color: string;
  strokeWidth: number;

  // History for undo (curator / unified canvas)
  history: Array<{
    lines: LineData[];
  }>;
  historyIndex: number;

  /** Separate stack for split free-draw pane so toolbar undo targets the active canvas. */
  freeHistory: Array<{ lines: LineData[] }>;
  freeHistoryIndex: number;

  // Actions
  setTool: (tool: BrushType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;

  pushHistory: (lines: LineData[]) => void;
  pushFreeHistory: (lines: LineData[]) => void;
  undo: () => LineData[] | null;
  redo: () => LineData[] | null;
  undoFree: () => LineData[] | null;
  redoFree: () => LineData[] | null;
  clearHistory: () => void;
  clearFreeHistory: () => void;
  
  // Per-image history management
  getHistoryState: () => HistoryState;
  setHistoryState: (state: HistoryState) => void;
}

const PRESET_COLORS = [
  "#ffffff", // White
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export { PRESET_COLORS };

export const useDrawingStore = create<DrawingState>((set, get) => ({
  tool: "pen",
  color: "#ffffff",
  strokeWidth: 4,
  history: [],
  historyIndex: -1,
  freeHistory: [],
  freeHistoryIndex: -1,
  
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  
  pushHistory: (lines) => {
    const { history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ lines: lines.map((l) => ({ ...l, points: [...l.points] })) });

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  pushFreeHistory: (lines) => {
    const { freeHistory, freeHistoryIndex } = get();
    const newHistory = freeHistory.slice(0, freeHistoryIndex + 1);
    newHistory.push({ lines: lines.map((l) => ({ ...l, points: [...l.points] })) });

    if (newHistory.length > 50) {
      newHistory.shift();
    }

    set({
      freeHistory: newHistory,
      freeHistoryIndex: newHistory.length - 1,
    });
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    // Can't undo if no history or already at -1 (empty state)
    if (history.length === 0 || historyIndex < 0) return null;
    
    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex });
    
    // Return empty array if going to -1 (before first stroke)
    if (newIndex < 0) return [];
    return history[newIndex]?.lines || [];
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return null;

    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex });
    return history[newIndex]?.lines || [];
  },

  undoFree: () => {
    const { freeHistory, freeHistoryIndex } = get();
    if (freeHistory.length === 0 || freeHistoryIndex < 0) return null;

    const newIndex = freeHistoryIndex - 1;
    set({ freeHistoryIndex: newIndex });

    if (newIndex < 0) return [];
    return freeHistory[newIndex]?.lines || [];
  },

  redoFree: () => {
    const { freeHistory, freeHistoryIndex } = get();
    if (freeHistoryIndex >= freeHistory.length - 1) return null;

    const newIndex = freeHistoryIndex + 1;
    set({ freeHistoryIndex: newIndex });
    return freeHistory[newIndex]?.lines || [];
  },

  clearHistory: () => set({ history: [], historyIndex: -1 }),

  clearFreeHistory: () => set({ freeHistory: [], freeHistoryIndex: -1 }),
  
  getHistoryState: () => {
    const { history, historyIndex } = get();
    return { history: [...history], historyIndex };
  },
  
  setHistoryState: (state: HistoryState) => {
    set({ history: state.history, historyIndex: state.historyIndex });
  },
}));
