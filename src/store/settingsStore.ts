import { create } from "zustand";
import { appDataDir } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile, exists } from "@tauri-apps/plugin-fs";

interface SavedFolder {
  path: string;
  name: string;
  imageCount: number;
  addedAt: number;
}

export interface UrlCollection {
  id: string;
  name: string;
  urls: string[];
  imageCount: number;
  addedAt: number;
  mode: "stream" | "offline";
  cachePath?: string;
  downloadedAt?: number;
}

export type ImageSourceFilter = "all" | "folders" | "url-lists";

export type ImageCountMode = "all" | "specific";

export interface AppSettings {
  isTimedMode: boolean; // true = Timed, false = Untimed
  timerDuration: number;
  breakDuration: number;
  lastSelectedFolder: string | null; // Deprecated, kept for migration
  lastSelectedFolders: string[]; // Multiple folder selection
  lastSelectedUrlCollectionIds: string[]; // Selected URL collections
  imageCountMode: ImageCountMode; // all | specific
  maxImages: number | null; // Used when imageCountMode is "specific"
  imageOpacity: number;
  imageZoom: number;
  markupEnabled: boolean;
  eraserDisabled: boolean;
  timerHidden: boolean;
  customColors: string[]; // User's custom color swatches
  /** When true, Session Setup restores split screen from the last saved preference. */
  preferSplitScreen: boolean;
  imageSourceFilter: ImageSourceFilter; // all | folders | url-lists
  /** Last preset chosen from the home screen (prebuilt id or saved preset id). */
  lastUsedPresetId: string | null;
}

interface SettingsState {
  // Saved folders
  savedFolders: SavedFolder[];
  // URL collections
  urlCollections: UrlCollection[];

  // Settings
  settings: AppSettings;
  
  // Loading state
  isLoaded: boolean;
  
  // Actions
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  addFolder: (folder: SavedFolder) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  addUrlCollection: (collection: Omit<UrlCollection, "id" | "addedAt">) => Promise<void>;
  removeUrlCollection: (id: string) => Promise<void>;
  updateUrlCollectionMode: (id: string, mode: "stream" | "offline") => Promise<void>;
  setUrlCollectionCachePath: (id: string, cachePath: string) => Promise<void>;
  clearUrlCollectionCache: (id: string) => Promise<void>;
  setImageSourceFilter: (filter: ImageSourceFilter) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  /** Prebuilt id (e.g. quick-gestures) or user preset id (preset_…). */
  setLastUsedPresetId: (id: string | null) => Promise<void>;
  setLastSelectedFolder: (path: string | null) => Promise<void>; // Deprecated
  setLastSelectedFolders: (paths: string[]) => Promise<void>;
  toggleFolderSelection: (path: string) => Promise<void>;
  setLastSelectedUrlCollectionIds: (ids: string[]) => Promise<void>;
  toggleUrlCollectionSelection: (id: string) => Promise<void>;
  // Custom colors
  addCustomColor: (color: string) => Promise<void>;
  removeCustomColor: (color: string) => Promise<void>;
  resetCustomColors: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  isTimedMode: true,
  timerDuration: 30,
  breakDuration: 3,
  lastSelectedFolder: null,
  lastSelectedFolders: [],
  lastSelectedUrlCollectionIds: [],
  imageCountMode: "all",
  maxImages: 10,
  imageOpacity: 100,
  imageZoom: 100,
  markupEnabled: true,
  eraserDisabled: false,
  timerHidden: false,
  customColors: [],
  preferSplitScreen: false,
  imageSourceFilter: "all",
  lastUsedPresetId: null,
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

function generateUrlCollectionId(): string {
  return `url_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  savedFolders: [],
  urlCollections: [],
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
        if (loadedSettings.lastSelectedUrlCollectionIds === undefined) {
          loadedSettings.lastSelectedUrlCollectionIds = [];
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
        if (loadedSettings.imageSourceFilter === undefined) {
          loadedSettings.imageSourceFilter = "all";
        }
        if (loadedSettings.preferSplitScreen === undefined) {
          loadedSettings.preferSplitScreen = false;
        }
        if (loadedSettings.lastUsedPresetId === undefined) {
          loadedSettings.lastUsedPresetId = null;
        }

        // Legacy keys from older settings.json — drop so they are not re-saved
        const raw = loadedSettings as AppSettings & {
          rememberHomeSettings?: boolean;
          rememberSetupSettings?: boolean;
        };
        delete raw.rememberHomeSettings;
        delete raw.rememberSetupSettings;

        set({
          savedFolders: data.savedFolders || [],
          urlCollections: data.urlCollections || [],
          settings: raw as AppSettings,
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
        urlCollections: state.urlCollections,
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

  addUrlCollection: async (collection) => {
    const newCollection: UrlCollection = {
      ...collection,
      id: generateUrlCollectionId(),
      addedAt: Date.now(),
    };
    set((state) => ({
      urlCollections: [...state.urlCollections, newCollection],
    }));
    await get().saveSettings();
  },

  removeUrlCollection: async (id) => {
    set((state) => ({
      urlCollections: state.urlCollections.filter((c) => c.id !== id),
    }));
    await get().saveSettings();
  },

  updateUrlCollectionMode: async (id, mode) => {
    set((state) => ({
      urlCollections: state.urlCollections.map((c) =>
        c.id === id ? { ...c, mode } : c
      ),
    }));
    await get().saveSettings();
  },

  setUrlCollectionCachePath: async (id, cachePath) => {
    set((state) => ({
      urlCollections: state.urlCollections.map((c) =>
        c.id === id
          ? { ...c, cachePath, downloadedAt: Date.now() }
          : c
      ),
    }));
    await get().saveSettings();
  },

  clearUrlCollectionCache: async (id) => {
    set((state) => ({
      urlCollections: state.urlCollections.map((c) =>
        c.id === id ? { ...c, cachePath: undefined, downloadedAt: undefined } : c
      ),
    }));
    await get().saveSettings();
  },

  setImageSourceFilter: async (filter) => {
    set((state) => ({
      settings: { ...state.settings, imageSourceFilter: filter },
    }));
    await get().saveSettings();
  },

  updateSettings: async (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
    await get().saveSettings();
  },

  setLastUsedPresetId: async (id) => {
    set((state) => ({
      settings: { ...state.settings, lastUsedPresetId: id },
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

  setLastSelectedUrlCollectionIds: async (ids) => {
    set((state) => ({
      settings: { ...state.settings, lastSelectedUrlCollectionIds: ids },
    }));
    await get().saveSettings();
  },

  toggleUrlCollectionSelection: async (id) => {
    const state = get();
    const currentSelected = state.settings.lastSelectedUrlCollectionIds || [];
    const newSelected = currentSelected.includes(id)
      ? currentSelected.filter((i) => i !== id)
      : [...currentSelected, id];
    set((state) => ({
      settings: { ...state.settings, lastSelectedUrlCollectionIds: newSelected },
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
}));
