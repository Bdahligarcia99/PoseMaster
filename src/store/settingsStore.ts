import { create } from "zustand";
import { appDataDir } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile, exists } from "@tauri-apps/plugin-fs";

interface SavedFolder {
  path: string;
  name: string;
  imageCount: number;
  addedAt: number;
}

export type ImageCountMode = "all" | "specific";

interface AppSettings {
  isTimedMode: boolean; // true = Timed, false = Untimed
  timerDuration: number;
  breakDuration: number;
  lastSelectedFolder: string | null; // Deprecated, kept for migration
  lastSelectedFolders: string[]; // Multiple folder selection
  imageCountMode: ImageCountMode; // all | specific
  maxImages: number | null; // Used when imageCountMode is "specific"
  imageOpacity: number;
  imageZoom: number;
  markupEnabled: boolean;
  eraserDisabled: boolean;
  timerHidden: boolean;
  customColors: string[]; // User's custom color swatches
  rememberHomeSettings: boolean; // Include New Session tab settings when creating preset
  rememberSetupSettings: boolean; // Include Session Setup settings when creating preset
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
  setLastSelectedFolder: (path: string | null) => Promise<void>; // Deprecated
  setLastSelectedFolders: (paths: string[]) => Promise<void>;
  toggleFolderSelection: (path: string) => Promise<void>;
  // Custom colors
  addCustomColor: (color: string) => Promise<void>;
  removeCustomColor: (color: string) => Promise<void>;
  resetCustomColors: () => Promise<void>;
  // Remember settings for preset
  setRememberHomeSettings: (value: boolean) => Promise<void>;
  setRememberSetupSettings: (value: boolean) => Promise<void>;
  clearRememberFlags: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  isTimedMode: true,
  timerDuration: 30,
  breakDuration: 3,
  lastSelectedFolder: null,
  lastSelectedFolders: [],
  imageCountMode: "all",
  maxImages: 10,
  imageOpacity: 100,
  imageZoom: 100,
  markupEnabled: true,
  eraserDisabled: false,
  timerHidden: false,
  customColors: [],
  rememberHomeSettings: false,
  rememberSetupSettings: false,
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
        
        // Migrate from single folder to multiple folders if needed
        let loadedSettings = { ...DEFAULT_SETTINGS, ...data.settings };
        if (loadedSettings.lastSelectedFolder && (!loadedSettings.lastSelectedFolders || loadedSettings.lastSelectedFolders.length === 0)) {
          loadedSettings.lastSelectedFolders = [loadedSettings.lastSelectedFolder];
        }
        // Migrate: add imageCountMode if missing (infer from maxImages)
        if (!loadedSettings.imageCountMode) {
          loadedSettings.imageCountMode = loadedSettings.maxImages === null ? "all" : "specific";
        }
        // Migrate: remove "continuous" mode (deprecated) -> default to "all"
        if (loadedSettings.imageCountMode === "continuous") {
          loadedSettings.imageCountMode = "all";
        }
        // Migrate: add isTimedMode if missing
        if (loadedSettings.isTimedMode === undefined) {
          loadedSettings.isTimedMode = true;
        }
        // Migrate: add markupEnabled if missing
        if (loadedSettings.markupEnabled === undefined) {
          loadedSettings.markupEnabled = true;
        }
        // Remember flags always load as false (never persist as checked)
        loadedSettings.rememberHomeSettings = false;
        loadedSettings.rememberSetupSettings = false;

        set({
          savedFolders: data.savedFolders || [],
          settings: loadedSettings,
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
  
  setLastSelectedFolders: async (paths) => {
    set((state) => ({
      settings: { 
        ...state.settings, 
        lastSelectedFolders: paths,
        lastSelectedFolder: paths.length > 0 ? paths[0] : null, // Keep legacy field in sync
      },
    }));
    await get().saveSettings();
  },
  
  toggleFolderSelection: async (path) => {
    const state = get();
    const currentSelected = state.settings.lastSelectedFolders || [];
    
    let newSelected: string[];
    if (currentSelected.includes(path)) {
      // Remove folder from selection
      newSelected = currentSelected.filter(p => p !== path);
    } else {
      // Add folder to selection
      newSelected = [...currentSelected, path];
    }
    
    set((state) => ({
      settings: { 
        ...state.settings, 
        lastSelectedFolders: newSelected,
        lastSelectedFolder: newSelected.length > 0 ? newSelected[0] : null,
      },
    }));
    await get().saveSettings();
  },
  
  addCustomColor: async (color) => {
    const state = get();
    const currentColors = state.settings.customColors || [];
    // Normalize color to lowercase and avoid duplicates
    const normalizedColor = color.toLowerCase();
    if (currentColors.includes(normalizedColor)) return;
    // Limit to 8 custom colors
    const newColors = [...currentColors, normalizedColor].slice(-8);
    set((state) => ({
      settings: { ...state.settings, customColors: newColors },
    }));
    await get().saveSettings();
  },
  
  removeCustomColor: async (color) => {
    const state = get();
    const currentColors = state.settings.customColors || [];
    const normalizedColor = color.toLowerCase();
    set((state) => ({
      settings: { 
        ...state.settings, 
        customColors: currentColors.filter(c => c !== normalizedColor),
      },
    }));
    await get().saveSettings();
  },
  
  resetCustomColors: async () => {
    set((state) => ({
      settings: { ...state.settings, customColors: [] },
    }));
    await get().saveSettings();
  },

  setRememberHomeSettings: async (value) => {
    set((state) => ({
      settings: { ...state.settings, rememberHomeSettings: value },
    }));
    await get().saveSettings();
  },

  setRememberSetupSettings: async (value) => {
    set((state) => ({
      settings: { ...state.settings, rememberSetupSettings: value },
    }));
    await get().saveSettings();
  },

  clearRememberFlags: async () => {
    set((state) => ({
      settings: {
        ...state.settings,
        rememberHomeSettings: false,
        rememberSetupSettings: false,
      },
    }));
    await get().saveSettings();
  },
}));
