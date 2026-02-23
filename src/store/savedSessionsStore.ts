import { create } from "zustand";
import { appDataDir } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile, exists, readDir, remove } from "@tauri-apps/plugin-fs";
import { DrawingData } from "./sessionStore";

// Drawing data for a specific image
export interface ImageDrawing {
  imagePath: string;
  drawingData: DrawingData;
  savedAt: number;
}

// Saved session structure
export interface SavedSession {
  id: string;
  name: string;
  createdAt: number;
  lastAccessedAt: number;
  
  // Folder info (single folder - kept for backward compatibility)
  folderPath: string;
  folderName: string;
  // Multiple folders support
  folderPaths?: string[];
  folderNames?: string[];
  
  // Session settings
  settings: {
    timerDuration: number;
    breakDuration: number;
    imageOpacity: number;
  };
  
  // Progress
  currentImageIndex: number;
  totalImages: number;
  imageOrder: string[]; // The shuffled order of images
  
  // Drawings keyed by image path
  drawings: Record<string, ImageDrawing>;
}

interface SavedSessionsState {
  sessions: SavedSession[];
  isLoaded: boolean;
  
  // Actions
  loadSessions: () => Promise<void>;
  saveSession: (session: Omit<SavedSession, "id" | "createdAt" | "lastAccessedAt"> & { name?: string }) => Promise<SavedSession>;
  updateSession: (id: string, updates: Partial<SavedSession>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getSession: (id: string) => SavedSession | undefined;
  getNextSessionNumber: () => number;
}

const SESSIONS_DIR = "sessions";

async function getSessionsDir(): Promise<string> {
  const dataDir = await appDataDir();
  return `${dataDir}${SESSIONS_DIR}`;
}

async function ensureSessionsDir(): Promise<void> {
  try {
    const sessionsDir = await getSessionsDir();
    const dirExists = await exists(sessionsDir);
    if (!dirExists) {
      await mkdir(sessionsDir, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating sessions dir:", err);
  }
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatSessionName(sessionNumber: number): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Session #${sessionNumber} - ${dateStr} ${timeStr}`;
}

export const useSavedSessionsStore = create<SavedSessionsState>((set, get) => ({
  sessions: [],
  isLoaded: false,

  loadSessions: async () => {
    try {
      await ensureSessionsDir();
      const sessionsDir = await getSessionsDir();
      
      let entries;
      try {
        entries = await readDir(sessionsDir);
      } catch (err) {
        console.log("Sessions directory empty or not readable:", err);
        set({ sessions: [], isLoaded: true });
        return;
      }
      
      if (!entries || entries.length === 0) {
        set({ sessions: [], isLoaded: true });
        return;
      }
      
      const sessions: SavedSession[] = [];
      
      for (const entry of entries) {
        if (entry.name?.endsWith(".json")) {
          try {
            const content = await readTextFile(`${sessionsDir}/${entry.name}`);
            const session = JSON.parse(content) as SavedSession;
            sessions.push(session);
          } catch (err) {
            console.error(`Error loading session ${entry.name}:`, err);
          }
        }
      }
      
      // Sort by last accessed (most recent first)
      sessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
      
      set({ sessions, isLoaded: true });
    } catch (err) {
      console.error("Error loading sessions:", err);
      set({ sessions: [], isLoaded: true });
    }
  },

  saveSession: async (sessionData) => {
    await ensureSessionsDir();
    const sessionsDir = await getSessionsDir();
    
    const id = generateSessionId();
    const now = Date.now();
    const sessionNumber = get().getNextSessionNumber();
    
    const session: SavedSession = {
      ...sessionData,
      id,
      name: sessionData.name?.trim() || formatSessionName(sessionNumber),
      createdAt: now,
      lastAccessedAt: now,
    };
    
    // Save to file
    const filePath = `${sessionsDir}/${id}.json`;
    await writeTextFile(filePath, JSON.stringify(session, null, 2));
    
    // Update state
    set((state) => ({
      sessions: [session, ...state.sessions],
    }));
    
    return session;
  },

  updateSession: async (id, updates) => {
    const sessionsDir = await getSessionsDir();
    const state = get();
    const sessionIndex = state.sessions.findIndex((s) => s.id === id);
    
    if (sessionIndex === -1) return;
    
    const updatedSession: SavedSession = {
      ...state.sessions[sessionIndex],
      ...updates,
      lastAccessedAt: Date.now(),
    };
    
    // Save to file
    const filePath = `${sessionsDir}/${id}.json`;
    await writeTextFile(filePath, JSON.stringify(updatedSession, null, 2));
    
    // Update state
    const newSessions = [...state.sessions];
    newSessions[sessionIndex] = updatedSession;
    set({ sessions: newSessions });
  },

  deleteSession: async (id) => {
    try {
      const sessionsDir = await getSessionsDir();
      const filePath = `${sessionsDir}/${id}.json`;
      
      await remove(filePath);
      
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
      }));
    } catch (err) {
      console.error("Error deleting session:", err);
    }
  },

  getSession: (id) => {
    return get().sessions.find((s) => s.id === id);
  },

  getNextSessionNumber: () => {
    const sessions = get().sessions;
    // Extract session numbers from names like "Session #5 - ..."
    const numbers = sessions
      .map((s) => {
        const match = s.name.match(/Session #(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  },
}));
