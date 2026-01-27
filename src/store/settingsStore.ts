import { create } from "zustand";
import { appDataDir } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile, exists } from "@tauri-apps/plugin-fs";

interface SavedFolder {
  path: string;
  name: string;
  imageCount: number;
  addedAt: number;
}

interface AppSettings {
  timerDuration: number;
  breakDuration: number;
  lastSelectedFolder: string | null;
  maxImages: number | null;
  imageOpacity: number;
  imageZoom: number;
  eraserDisabled: boolean;
  timerHidden: boolean;
}

interface SettingsState {
  // Saved folders
  savedFolders: SavedFolder[];
  
  // Settings
  settings: AppSettings;
  
  // Loading state
  isLoaded: boolean;
  
  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  addFolder: (folder: SavedFolder) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setLastSelectedFolder: (path: string | null) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  timerDuration: 30,
  breakDuration: 3,
  lastSelectedFolder: null,
  maxImages: 10,
  imageOpacity: 100,
  imageZoom: 100,
  eraserDisabled: false,
  timerHidden: false,
};

const SETTINGS_FILE = "settings.json";

async function getSettingsPath(): Promise<string> {
  const dataDir = await appDataDir();
  return `${dataDir}${SETTINGS_FILE}`;
}

async function ensureDataDir(): Promise<void> {
  try {
    const dataDir = await appDataDir();
    const dirExists = await exists(dataDir);
    if (!dirExists) {
      await mkdir(dataDir, { recursive: true });
    }
  } catch (err) {
    console.error("Error creating data dir:", err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedFolders: [],
  settings: { ...DEFAULT_SETTINGS },
  isLoaded: false,

  loadSettings: async () => {
    try {
      await ensureDataDir();
      const settingsPath = await getSettingsPath();
      const fileExists = await exists(settingsPath);
      
      if (fileExists) {
        const content = await readTextFile(settingsPath);
        const data = JSON.parse(content);
        
        set({
          savedFolders: data.savedFolders || [],
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
          isLoaded: true,
        });
      } else {
        set({ isLoaded: true });
      }
    } catch (err) {
      console.error("Error loading settings:", err);
      set({ isLoaded: true });
    }
  },

  saveSettings: async () => {
    try {
      await ensureDataDir();
      const settingsPath = await getSettingsPath();
      const state = get();
      
      const data = {
        savedFolders: state.savedFolders,
        settings: state.settings,
      };
      
      await writeTextFile(settingsPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Error saving settings:", err);
    }
  },

  addFolder: async (folder) => {
    const state = get();
    // Check if folder already exists
    const exists = state.savedFolders.some(f => f.path === folder.path);
    if (exists) {
      // Update existing folder
      set({
        savedFolders: state.savedFolders.map(f => 
          f.path === folder.path ? folder : f
        ),
      });
    } else {
      set({
        savedFolders: [...state.savedFolders, folder],
      });
    }
    await get().saveSettings();
  },

  removeFolder: async (path) => {
    set((state) => ({
      savedFolders: state.savedFolders.filter(f => f.path !== path),
      settings: state.settings.lastSelectedFolder === path 
        ? { ...state.settings, lastSelectedFolder: null }
        : state.settings,
    }));
    await get().saveSettings();
  },

  updateSettings: async (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    await get().saveSettings();
  },

  setLastSelectedFolder: async (path) => {
    set((state) => ({
      settings: { ...state.settings, lastSelectedFolder: path },
    }));
    await get().saveSettings();
  },
}));
