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
  
  // History for undo
  history: Array<{
    lines: LineData[];
  }>;
  historyIndex: number;
  
  // Actions
  setTool: (tool: BrushType) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  
  pushHistory: (lines: LineData[]) => void;
  undo: () => LineData[] | null;
  redo: () => LineData[] | null;
  clearHistory: () => void;
  
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
  
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  
  pushHistory: (lines) => {
    const { history, historyIndex } = get();
    // Truncate any "future" history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ lines: [...lines] });
    
    // Limit history size
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
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
  
  clearHistory: () => set({ history: [], historyIndex: -1 }),
  
  getHistoryState: () => {
    const { history, historyIndex } = get();
    return { history: [...history], historyIndex };
  },
  
  setHistoryState: (state: HistoryState) => {
    set({ history: state.history, historyIndex: state.historyIndex });
  },
}));
