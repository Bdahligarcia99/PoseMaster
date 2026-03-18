import { create } from "zustand";
import { appDataDir } from "@tauri-apps/api/path";
import { mkdir, writeTextFile, readTextFile, exists } from "@tauri-apps/plugin-fs";

export type PresetMode = "image-curator" | "free-draw" | "3d-perspective";

export type ImageCountMode = "all" | "specific";

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  mode: PresetMode;
  settings: {
    // Home screen settings (New Session tab)
    isTimedMode: boolean;
    timerDuration: number;
    breakDuration: number;
    imageCountMode: ImageCountMode;
    maxImages: number | null;

    // Session Setup settings
    imageOpacity: number;
    imageZoom: number;
    eraserDisabled: boolean;
    timerHidden: boolean;
    markupEnabled: boolean;
  };
}

interface PresetsState {
  presets: Preset[];
  isLoaded: boolean;

  loadPresets: () => Promise<void>;
  savePreset: (
    name: string,
    mode: PresetMode,
    settings: Preset["settings"]
  ) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
  renamePreset: (id: string, newName: string) => Promise<void>;
  getPreset: (id: string) => Preset | undefined;
}

const PRESETS_FILE = "presets.json";

async function getPresetsPath(): Promise<string> {
  const dataDir = await appDataDir();
  return `${dataDir}${PRESETS_FILE}`;
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

function generatePresetId(): string {
  return `preset_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

const DEFAULT_PRESET_SETTINGS: Preset["settings"] = {
  isTimedMode: true,
  timerDuration: 30,
  breakDuration: 3,
  imageCountMode: "all",
  maxImages: null,
  imageOpacity: 100,
  imageZoom: 100,
  eraserDisabled: false,
  timerHidden: false,
  markupEnabled: true,
};

export const usePresetsStore = create<PresetsState>((set, get) => ({
  presets: [],
  isLoaded: false,

  loadPresets: async () => {
    try {
      await ensureDataDir();
      const presetsPath = await getPresetsPath();
      const fileExists = await exists(presetsPath);

      if (fileExists) {
        const content = await readTextFile(presetsPath);
        const data = JSON.parse(content);
        const rawPresets = Array.isArray(data.presets) ? data.presets : [];
        // Migrate: "continuous" imageCountMode -> "all"
        const presets = rawPresets.map((p: Preset) =>
          p.settings?.imageCountMode === "continuous"
            ? { ...p, settings: { ...p.settings, imageCountMode: "all" as const } }
            : p
        );
        set({ presets, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (err) {
      console.error("Error loading presets:", err);
      set({ isLoaded: true });
    }
  },

  savePreset: async (name, mode, settings) => {
    const state = get();
    if (!state.isLoaded) {
      await state.loadPresets();
    }
    await ensureDataDir();
    const presetsPath = await getPresetsPath();
    const currentState = get();

    const preset: Preset = {
      id: generatePresetId(),
      name,
      createdAt: Date.now(),
      mode,
      settings: { ...DEFAULT_PRESET_SETTINGS, ...settings },
    };

    const presets = [...currentState.presets, preset];
    set({ presets });

    const data = { presets };
    await writeTextFile(presetsPath, JSON.stringify(data, null, 2));

    return preset;
  },

  deletePreset: async (id) => {
    const state = get();
    if (!state.isLoaded) {
      await state.loadPresets();
    }
    const currentState = get();
    const presets = currentState.presets.filter((p) => p.id !== id);
    set({ presets });

    const presetsPath = await getPresetsPath();
    const data = { presets };
    await writeTextFile(presetsPath, JSON.stringify(data, null, 2));
  },

  renamePreset: async (id, newName) => {
    const state = get();
    if (!state.isLoaded) {
      await state.loadPresets();
    }
    const currentState = get();
    const presets = currentState.presets.map((p) =>
      p.id === id ? { ...p, name: newName } : p
    );
    set({ presets });

    const presetsPath = await getPresetsPath();
    const data = { presets };
    await writeTextFile(presetsPath, JSON.stringify(data, null, 2));
  },

  getPreset: (id) => {
    return get().presets.find((p) => p.id === id);
  },
}));
