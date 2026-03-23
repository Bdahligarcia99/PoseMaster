import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useSessionStore } from "../store/sessionStore";
import { useSettingsStore, ImageCountMode, ImageSourceFilter, UrlCollection } from "../store/settingsStore";
import type { SessionImage } from "../store/sessionStore";
import DownloadProgressModal from "./DownloadProgressModal";
import { useSavedSessionsStore, SavedSession } from "../store/savedSessionsStore";
import { usePresetsStore, Preset, PresetMode } from "../store/presetsStore";
import TimerPresets from "./TimerPresets";
import PreviousSessions from "./PreviousSessions";
import ModeSelection, { PracticeMode } from "./ModeSelection";
import TabNav from "./TabNav";
import { APP_VERSION } from "../version";
import { parseUrlListFile } from "../utils/urlListParser";

interface ImageInfo {
  path: string;
  name: string;
}

function AppDescription() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-1">
      <p className="text-dark-muted text-sm">
        Practice your drawing skills with timed reference images
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="ml-1 text-blue-400 hover:text-blue-300 underline"
          >
            show more
          </button>
        )}
      </p>
      {isExpanded && (
        <div className="mt-2 text-dark-muted text-sm text-left bg-dark-surface rounded-lg p-3 max-w-xl mx-auto">
          <p className="mb-2">
            Perfect for practicing gesture drawing, figure construction, skeleton studies, 
            cylinders in perspective, and more using timed reference images.
          </p>
          <p className="mb-2">
            Save your sessions with drawings to review later, and export to share with 
            instructors or communities for feedback.
          </p>
          <p className="text-dark-muted/80">
            <span className="text-dark-text">Get reference images from:</span>{" "}
            <a href="https://cubebrush.co" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Cubebrush</a>,{" "}
            <a href="https://www.proko.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Proko</a>,{" "}
            <a href="https://line-of-action.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Line of Action</a>,{" "}
            <a href="https://www.quickposes.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">QuickPoses</a>,{" "}
            <a href="https://www.posemaniacs.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Posemaniacs</a>,{" "}
            <a href="https://www.artstation.com/marketplace" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ArtStation Marketplace</a>,{" "}
            <a href="https://www.deviantart.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DeviantArt</a>,{" "}
            <a href="https://senshistock.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">SenshiStock</a>,{" "}
            and more.
          </p>
          <button
            onClick={() => setIsExpanded(false)}
            className="mt-2 text-blue-400 hover:text-blue-300 underline text-xs"
          >
            show less
          </button>
        </div>
      )}
    </div>
  );
}

interface UrlNameModalProps {
  suggestedName: string;
  urlCount: number;
  isValidating: boolean;
  error: string | null;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

function UrlNameModal({ suggestedName, urlCount, isValidating, error, onConfirm, onCancel }: UrlNameModalProps) {
  const [name, setName] = useState(suggestedName);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-dark-surface rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-dark-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-dark-text font-medium mb-2">Name your URL collection</h3>
        <p className="text-dark-muted text-sm mb-4">{urlCount} URLs found</p>
        
        {error && (
          <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
        
        <input
          type="text"
          placeholder="Collection name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim() && !isValidating) {
              onConfirm(name);
            }
            if (e.key === "Escape") onCancel();
          }}
          className="w-full px-3 py-2 bg-dark-bg border border-dark-accent rounded-lg 
                     text-dark-text placeholder-dark-muted focus:outline-none focus:border-blue-500 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isValidating}
            className="flex-1 px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name)}
            disabled={!name.trim() || isValidating}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isValidating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Validating...
              </>
            ) : (
              "Add Collection"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FolderPicker() {
  const [selectedMode, setSelectedMode] = useState<PracticeMode>("image-curator");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [imageCountMode, setImageCountMode] = useState<ImageCountMode>("all");
  const [selectedSpecificCount, setSelectedSpecificCount] = useState<number>(10);
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([]); // Multiple folder selection
  const [activeTab, setActiveTab] = useState<"new-session" | "previous-sessions" | "presets">("new-session");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [savePresetError, setSavePresetError] = useState<string | null>(null);
  const [presetToRename, setPresetToRename] = useState<Preset | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savePresetName, setSavePresetName] = useState("");
  const [savePresetSuccess, setSavePresetSuccess] = useState<string | null>(null);
  const [loadPresetSuccess, setLoadPresetSuccess] = useState<string | null>(null);
  const [collectionToDownload, setCollectionToDownload] = useState<UrlCollection | null>(null);
  const [showUrlNameModal, setShowUrlNameModal] = useState(false);
  const [pendingUrlList, setPendingUrlList] = useState<{ urls: string[]; suggestedName?: string } | null>(null);
  const [urlImportError, setUrlImportError] = useState<string | null>(null);
  const [isValidatingUrls, setIsValidatingUrls] = useState(false);
  const hasAutoLoaded = useRef(false);

  const { setFolderPath, setFolderPaths, setFolderName, setFolderNames, setImages, enterSetup, startSession, viewSession, enterBrowseMode, timerDuration, breakDuration, setBreakDuration, setMaxImages, setTimerDuration, setTimedMode, isTimedMode, imageOpacity, imageZoom, eraserDisabled, timerHidden, markupEnabled, setImageOpacity, setImageZoom, setMarkupEnabled, setEraserDisabled, setTimerHidden, returnToPreviousSessions, clearReturnToPreviousSessions } = useSessionStore();
  
  // When returning from gallery view, switch to Previous Sessions tab
  useEffect(() => {
    if (returnToPreviousSessions) {
      setActiveTab("previous-sessions");
      clearReturnToPreviousSessions();
    }
  }, [returnToPreviousSessions, clearReturnToPreviousSessions]);
  const { savedFolders, urlCollections, settings, isLoaded, loadSettings, addFolder, removeFolder, addUrlCollection, updateSettings, setLastSelectedFolders, setLastSelectedUrlCollectionIds, toggleUrlCollectionSelection, setRememberHomeSettings, clearRememberFlags, updateUrlCollectionMode, setUrlCollectionCachePath, clearUrlCollectionCache, removeUrlCollection, setImageSourceFilter } = useSettingsStore();
  const { loadSessions } = useSavedSessionsStore();
  const { presets, isLoaded: presetsLoaded, loadPresets, savePreset, deletePreset, renamePreset } = usePresetsStore();

  // Load images from selected folders and URL collections
  const loadImageSources = useCallback(
    async (folderPaths: string[], urlCollectionIds: string[]) => {
      const sessionImages: SessionImage[] = [];

      try {
        setError(null);
        setIsLoading(true);

        if (folderPaths.length > 0) {
          const folderResults = await invoke<ImageInfo[]>("scan_multiple_folders_for_images", {
            folderPaths,
          });
          for (const img of folderResults) {
            sessionImages.push({ path: img.path, sourceType: "local" });
          }
          setFolderPaths(folderPaths);
          const folderNames = folderPaths.map((p) => p.split("/").pop() || p.split("\\").pop() || p);
          setFolderNames(folderNames);
          await setLastSelectedFolders(folderPaths);
        } else {
          setFolderPaths([]);
          setFolderNames([]);
          await setLastSelectedFolders([]); // Clear persisted folders so URL-only selection restores correctly
        }

        const collections = useSettingsStore.getState().urlCollections;
        for (const collId of urlCollectionIds) {
          const coll = collections.find((c) => c.id === collId);
          if (!coll) continue;
          if (coll.mode === "offline" && coll.cachePath) {
            const cached = await invoke<ImageInfo[]>("scan_folder_for_images", {
              folderPath: coll.cachePath,
            });
            const indexRe = /_(\d{4})\.\w+$/i;
            const sorted = [...cached].sort((a, b) => {
              const ma = a.path.match(indexRe);
              const mb = b.path.match(indexRe);
              const ia = ma ? parseInt(ma[1], 10) : 0;
              const ib = mb ? parseInt(mb[1], 10) : 0;
              return ia - ib;
            });
            for (let i = 0; i < sorted.length; i++) {
              sessionImages.push({
                path: sorted[i].path,
                sourceType: "url-cached",
                collectionId: coll.id,
                originalUrl: coll.urls[i],
              });
            }
          } else {
            for (const url of coll.urls) {
              sessionImages.push({
                path: url,
                sourceType: "url-stream",
                collectionId: coll.id,
              });
            }
          }
        }

        if (urlCollectionIds.length > 0) {
          await setLastSelectedUrlCollectionIds(urlCollectionIds);
        }

        if (sessionImages.length === 0) {
          setError(
            folderPaths.length > 0
              ? "No images found in the selected folder(s). Supported formats: JPG, PNG, GIF, WebP, BMP, TIFF"
              : "Select folders or URL collections to get started."
          );
          setImages([]);
          setTotalImages(0);
        } else {
          setImages(sessionImages);
          setTotalImages(sessionImages.length);
        }
      } catch (err) {
        console.error("Error loading images:", err);
        setError(err instanceof Error ? err.message : "Failed to load images");
        setImages([]);
        setTotalImages(0);
      } finally {
        setIsLoading(false);
      }
    },
    [
      setFolderPaths,
      setFolderNames,
      setImages,
      setLastSelectedFolders,
      setLastSelectedUrlCollectionIds,
    ]
  );

  const loadMultipleFolderImages = useCallback(
    (folderPaths: string[]) => {
      loadImageSources(folderPaths, settings.lastSelectedUrlCollectionIds || []);
    },
    [loadImageSources, settings.lastSelectedUrlCollectionIds]
  );

  // Load folder images helper (single folder - for adding new folders)
  const loadFolderImages = useCallback(async (folderPath: string, shouldSave: boolean = true) => {
    try {
      setError(null);
      setIsLoading(true);

      const images = await invoke<ImageInfo[]>("scan_folder_for_images", {
        folderPath,
      });

      if (images.length === 0) {
        setError("No images found in the selected folder. Supported formats: JPG, PNG, GIF, WebP, BMP, TIFF");
        setIsLoading(false);
        return false;
      }

      const imagePaths = images.map((img) => img.path);
      const folderName = folderPath.split("/").pop() || folderPath.split("\\").pop() || folderPath;
      
      if (shouldSave) {
        await addFolder({
          path: folderPath,
          name: folderName,
          imageCount: imagePaths.length,
          addedAt: Date.now(),
        });
      }
      
      // Add to selection and reload
      const newSelection = [...selectedFolderPaths, folderPath];
      setSelectedFolderPaths(newSelection);
      await loadMultipleFolderImages(newSelection);
      setIsLoading(false);

      return true;
    } catch (err) {
      console.error("Error loading folder:", err);
      setError(err instanceof Error ? err.message : "Failed to load images");
      setIsLoading(false);
      return false;
    }
  }, [addFolder, selectedFolderPaths, loadMultipleFolderImages]);

  // Load settings, saved sessions, and presets on mount
  useEffect(() => {
    loadSettings();
    loadSessions();
    loadPresets();
  }, [loadSettings, loadSessions, loadPresets]);

  // Apply saved settings when loaded
  useEffect(() => {
    if (isLoaded) {
      setTimedMode(settings.isTimedMode ?? true);
      setTimerDuration(settings.timerDuration);
      setBreakDuration(settings.breakDuration);
      setImageOpacity(settings.imageOpacity);
      setImageZoom(settings.imageZoom);
      setMarkupEnabled(settings.markupEnabled ?? true);
      setEraserDisabled(settings.eraserDisabled);
      setTimerHidden(settings.timerHidden);
      setImageCountMode(settings.imageCountMode ?? "all");
      if (settings.imageCountMode === "specific" && settings.maxImages !== null) {
        setSelectedSpecificCount(settings.maxImages);
      }
    }
  }, [isLoaded, settings.isTimedMode, settings.timerDuration, settings.breakDuration, settings.imageCountMode, settings.maxImages, settings.imageOpacity, settings.imageZoom, settings.markupEnabled, settings.eraserDisabled, settings.timerHidden, setTimedMode, setTimerDuration, setBreakDuration, setImageOpacity, setImageZoom, setMarkupEnabled, setEraserDisabled, setTimerHidden]);

  // Auto-load last selected folders and URL collections (only once)
  useEffect(() => {
    if (isLoaded && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      const foldersToLoad = settings.lastSelectedFolders || [];
      const urlIdsToLoad = settings.lastSelectedUrlCollectionIds || [];
      if (foldersToLoad.length === 0 && settings.lastSelectedFolder) {
        setSelectedFolderPaths([settings.lastSelectedFolder]);
        loadImageSources([settings.lastSelectedFolder], urlIdsToLoad);
      } else {
        setSelectedFolderPaths(foldersToLoad);
        loadImageSources(foldersToLoad, urlIdsToLoad);
      }
    }
  }, [isLoaded, settings.lastSelectedFolders, settings.lastSelectedFolder, settings.lastSelectedUrlCollectionIds, loadImageSources]);

  // Save settings when going to setup (timer/break/count only - opacity/zoom saved in SessionSetup)
  const saveCurrentSettings = useCallback(() => {
    if (isLoaded) {
      updateSettings({
        isTimedMode,
        timerDuration,
        breakDuration,
        imageCountMode,
        maxImages: imageCountMode === "specific" ? selectedSpecificCount : null,
      });
    }
  }, [isTimedMode, timerDuration, breakDuration, imageCountMode, selectedSpecificCount, isLoaded, updateSettings]);

  // Resolved image count for session
  const sessionImageCount = useMemo(() => {
    if (imageCountMode === "all") return totalImages;
    return Math.min(selectedSpecificCount, totalImages);
  }, [imageCountMode, selectedSpecificCount, totalImages]);

  // Calculate session duration (only for Timed mode)
  const sessionDuration = useMemo(() => {
    if (!isTimedMode || sessionImageCount === 0) return null;
    // Total time = (image time × count) + (break time × (count - 1))
    const totalSeconds = (sessionImageCount * timerDuration) + ((sessionImageCount - 1) * breakDuration);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [isTimedMode, sessionImageCount, timerDuration, breakDuration]);

  const handleSelectNewFolder = async () => {
    // Open folder picker dialog
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select folder with reference images",
    });

    if (!selected) return;

    await loadFolderImages(selected as string, true);
  };

  // Toggle folder selection for multi-select
  const handleToggleFolderSelection = async (folderPath: string) => {
    const newSelection = selectedFolderPaths.includes(folderPath)
      ? selectedFolderPaths.filter(p => p !== folderPath)
      : [...selectedFolderPaths, folderPath];
    
    setSelectedFolderPaths(newSelection);
    await loadMultipleFolderImages(newSelection);
  };

  const handleRemoveFolder = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeFolder(folderPath);
    // Remove from selection if it was selected
    if (selectedFolderPaths.includes(folderPath)) {
      const newSelection = selectedFolderPaths.filter(p => p !== folderPath);
      setSelectedFolderPaths(newSelection);
      await loadMultipleFolderImages(newSelection);
    }
  };

  // URL collection: Switch to Offline (triggers download)
  const handleSwitchToOffline = (collection: UrlCollection) => {
    setCollectionToDownload(collection);
  };

  // URL collection: Switch to Stream (delete cache after confirm)
  const handleSwitchToStream = async (collection: UrlCollection) => {
    if (!collection.cachePath) {
      await updateUrlCollectionMode(collection.id, "stream");
      return;
    }
    if (!confirm("Delete cached images?")) return;
    try {
      await invoke("delete_url_cache", { cacheFolder: collection.cachePath });
      await clearUrlCollectionCache(collection.id);
      await updateUrlCollectionMode(collection.id, "stream");
    } catch (err) {
      console.error("Failed to delete cache:", err);
      setError(err instanceof Error ? err.message : "Failed to delete cache");
    }
  };

  const handleDownloadComplete = async (cachePath: string) => {
    if (!collectionToDownload) return;
    const collId = collectionToDownload.id;
    await setUrlCollectionCachePath(collId, cachePath);
    await updateUrlCollectionMode(collId, "offline");
    setCollectionToDownload(null);
    const ids = selectedUrlCollectionIds.includes(collId)
      ? selectedUrlCollectionIds
      : [...selectedUrlCollectionIds, collId];
    await setLastSelectedUrlCollectionIds(ids);
    await loadImageSources(selectedFolderPaths, ids);
  };

  const handleDownloadCancel = () => {
    setCollectionToDownload(null);
  };

  const handleToggleUrlCollectionSelection = async (collId: string) => {
    await toggleUrlCollectionSelection(collId);
    const current = settings.lastSelectedUrlCollectionIds || [];
    const newIds = current.includes(collId)
      ? current.filter((id) => id !== collId)
      : [...current, collId];
    await loadImageSources(selectedFolderPaths, newIds);
  };

  const selectedUrlCollectionIds = settings.lastSelectedUrlCollectionIds || [];

  // Import URL list file
  const handleImportUrls = async () => {
    setUrlImportError(null);
    
    const selected = await open({
      multiple: false,
      title: "Select URL list file",
      filters: [
        { name: "URL Lists", extensions: ["txt", "json", "csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (!selected || typeof selected !== "string") return;

    try {
      const content = await readTextFile(selected);
      const filename = selected.split("/").pop() || selected.split("\\").pop() || "urls.txt";
      const parsed = parseUrlListFile(content, filename);

      if (parsed.urls.length === 0) {
        setUrlImportError("No valid URLs found in file. URLs must start with http:// or https://");
        return;
      }

      // Suggest name from JSON or filename
      const suggestedName = parsed.name || filename.replace(/\.(txt|json|csv)$/i, "");
      setPendingUrlList({ urls: parsed.urls, suggestedName });
      setShowUrlNameModal(true);
    } catch (err) {
      console.error("Failed to import URL list:", err);
      setUrlImportError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  // Confirm URL collection with name
  const handleConfirmUrlImport = async (name: string) => {
    if (!pendingUrlList) return;

    setIsValidatingUrls(true);
    setUrlImportError(null);

    try {
      // Validate URLs
      const validationResults = await invoke<Array<{ url: string; valid: boolean; error?: string }>>(
        "validate_url_list",
        { urls: pendingUrlList.urls.slice(0, 10) } // Validate first 10 as sample
      );

      const validCount = validationResults.filter((r) => r.valid).length;
      if (validCount === 0) {
        setUrlImportError("None of the URLs appear to be valid images. Please check the file.");
        setIsValidatingUrls(false);
        return;
      }

      // Add the collection
      await addUrlCollection({
        name: name.trim(),
        urls: pendingUrlList.urls,
        imageCount: pendingUrlList.urls.length,
        mode: "stream",
      });

      setShowUrlNameModal(false);
      setPendingUrlList(null);
      setIsValidatingUrls(false);
    } catch (err) {
      console.error("Failed to add URL collection:", err);
      setUrlImportError(err instanceof Error ? err.message : "Failed to add collection");
      setIsValidatingUrls(false);
    }
  };

  // Common setup before starting any session
  const prepareSession = () => {
    // Save current settings only when user has enabled Remember
    if (settings.rememberHomeSettings) {
      saveCurrentSettings();
    }
    
    // Set folder names for potential saving later
    if (selectedFolderPaths.length > 0) {
      const names = selectedFolderPaths.map(p => p.split("/").pop() || p.split("\\").pop() || p);
      setFolderNames(names);
      // Also set legacy single name (combined)
      setFolderName(names.join(", "));
    }
    // Set max images based on image count mode
    if (imageCountMode === "specific") {
      setMaxImages(selectedSpecificCount);
    } else {
      setMaxImages(null); // all
    }
  };

  // Open session setup to adjust display settings
  const handleSessionSetup = () => {
    prepareSession();
    enterSetup();
  };

  // Start session immediately with saved settings
  const handleNewSession = () => {
    prepareSession();
    startSession();
  };

  // Browse gallery without starting a session
  const handleBrowseGallery = () => {
    prepareSession();
    enterBrowseMode();
  };

  const handleViewSession = (session: SavedSession) => {
    // View the session summary without starting the timer
    viewSession({
      id: session.id,
      name: session.name,
      imageOrder: session.imageOrder,
      currentIndex: 0,
      drawings: session.drawings ?? {},
      settings: session.settings,
    });
  };

  // Preset helpers
  const getModeBadgeLabel = (mode: PresetMode) => {
    switch (mode) {
      case "image-curator": return "Image Curator";
      case "free-draw": return "Free Draw";
      case "3d-perspective": return "3D & Perspective";
      default: return mode;
    }
  };

  const handleLoadPreset = async (preset: Preset) => {
    const s = preset.settings;
    const modeMismatch = preset.mode !== selectedMode;
    if (modeMismatch) {
      setSelectedMode(preset.mode);
    }
    setTimedMode(s.isTimedMode);
    setTimerDuration(s.timerDuration);
    setBreakDuration(s.breakDuration);
    setImageOpacity(s.imageOpacity);
    setImageZoom(s.imageZoom);
    setEraserDisabled(s.eraserDisabled);
    setTimerHidden(s.timerHidden);
    setMarkupEnabled(s.markupEnabled);
    setImageCountMode(s.imageCountMode === "continuous" ? "all" : s.imageCountMode);
    setMaxImages(s.maxImages);
    if (s.imageCountMode === "specific" && s.maxImages !== null) {
      setSelectedSpecificCount(s.maxImages);
    }
    await updateSettings({
      isTimedMode: s.isTimedMode,
      timerDuration: s.timerDuration,
      breakDuration: s.breakDuration,
      imageCountMode: s.imageCountMode === "continuous" ? "all" : s.imageCountMode,
      maxImages: s.maxImages,
      imageOpacity: s.imageOpacity,
      imageZoom: s.imageZoom,
      eraserDisabled: s.eraserDisabled,
      timerHidden: s.timerHidden,
      markupEnabled: s.markupEnabled,
    });
    const modeLabel = getModeBadgeLabel(preset.mode);
    setLoadPresetSuccess(
      modeMismatch
        ? `Preset "${preset.name}" loaded (switched to ${modeLabel})`
        : `Preset "${preset.name}" loaded`
    );
    setTimeout(() => setLoadPresetSuccess(null), 3000);
    setActiveTab("new-session");
  };

  const handleSavePresetClick = () => {
    setSavePresetError(null);
    setSavePresetSuccess(null);
    const home = settings.rememberHomeSettings === true;
    const setup = settings.rememberSetupSettings === true;
    if (!home || !setup) {
      setSavePresetError(
        "To save a preset, enable 'Remember current settings' in both:\n• New Session tab\n• Session Setup (click Session Setup button, then Settings)"
      );
      return;
    }
    const defaultName = `Preset #${presets.length + 1}`;
    setSavePresetName(defaultName);
    setShowSavePresetModal(true);
  };

  const handleSavePresetConfirm = async (name: string) => {
    const presetSettings = {
      isTimedMode,
      timerDuration,
      breakDuration,
      imageCountMode,
      maxImages: imageCountMode === "specific" ? selectedSpecificCount : null,
      imageOpacity: imageOpacity ?? 100,
      imageZoom: imageZoom ?? 100,
      eraserDisabled: eraserDisabled ?? false,
      timerHidden: timerHidden ?? false,
      markupEnabled: markupEnabled ?? true,
    };
    await savePreset(name, selectedMode, presetSettings);
    await clearRememberFlags();
    setShowSavePresetModal(false);
    setSavePresetName("");
    setSavePresetSuccess(`Preset "${name}" saved`);
    setTimeout(() => setSavePresetSuccess(null), 3000);
  };

  const handleRenamePresetStart = (preset: Preset) => {
    setPresetToRename(preset);
    setRenameValue(preset.name);
  };

  const handleRenamePresetConfirm = async () => {
    if (presetToRename && renameValue.trim()) {
      await renamePreset(presetToRename.id, renameValue.trim());
      setPresetToRename(null);
      setRenameValue("");
    }
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this preset?")) {
      await deletePreset(id);
    }
  };

  const formatPresetDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-dark-bg overflow-y-auto">
      <div className="flex flex-col items-center p-6">
        <div className="w-full max-w-3xl space-y-6">
          
          {/* Header */}
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-3xl font-bold text-dark-text">PoseMaster</h1>
              <span className="text-xs text-dark-muted bg-dark-surface px-2 py-0.5 rounded-full">
                v{APP_VERSION}
              </span>
              <span className="text-xs font-medium bg-orange-500/80 text-white px-1.5 py-0.5 rounded-full">
                Alpha
              </span>
            </div>
            <AppDescription />
          </div>

          {/* Load preset success message - visible after switching to New Session */}
          {loadPresetSuccess && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-2 text-green-400 text-sm">
              {loadPresetSuccess}
            </div>
          )}

          {/* Tab navigation */}
          <TabNav
            tabs={[
              {
                id: "new-session",
                label: "New Session",
                content: (
                  <div className="space-y-6 bg-dark-surface rounded-b-xl p-4 border-x border-b border-dark-accent">
          {/* 1. Mode Selection Block */}
          <div className="bg-dark-bg rounded-xl p-4">
            <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3">
              Practice Mode
            </h2>
            <ModeSelection value={selectedMode} onChange={setSelectedMode} />
          </div>

          {/* 2. Settings Block — contextual, animates on mode switch */}
          <div
            key={selectedMode}
            className="overflow-hidden settings-block-enter"
          >
            {selectedMode === "image-curator" ? (
              <div className="space-y-4">
                {/* Folder Selection */}
                <div className="bg-dark-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide">Image Sources</h2>
                <select
                  value={settings.imageSourceFilter || "all"}
                  onChange={(e) => setImageSourceFilter(e.target.value as ImageSourceFilter)}
                  className="px-2 py-1 text-xs bg-dark-bg border border-dark-accent rounded-lg text-dark-muted
                             focus:outline-none focus:border-blue-500 cursor-pointer hover:border-dark-text/50"
                >
                  <option value="all">All</option>
                  <option value="folders">Folders</option>
                  <option value="url-lists">URL Lists</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleImportUrls}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-dark-bg hover:bg-dark-accent disabled:opacity-50 
                             rounded-lg text-dark-text text-sm font-medium transition-colors 
                             flex items-center gap-2 border border-dark-accent"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Import URLs
                </button>
                <button
                  onClick={handleSelectNewFolder}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-dark-accent hover:bg-blue-700 disabled:opacity-50 
                             rounded-lg text-dark-text text-sm font-medium transition-colors 
                             flex items-center gap-2"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  Add Folder
                </button>
              </div>
            </div>
            
            {/* URL Import Error */}
            {urlImportError && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                {urlImportError}
              </div>
            )}
            
            {/* Folder Buttons - Multi-select with checkboxes */}
            {(settings.imageSourceFilter === "all" || settings.imageSourceFilter === "folders") && (
            <div className="flex flex-wrap gap-2">
              {savedFolders.length === 0 ? (
                <p className="text-dark-muted text-sm py-2">No folders added yet. Click "Add Folder" to get started.</p>
              ) : (
                savedFolders.map((folder) => {
                  const isSelected = selectedFolderPaths.includes(folder.path);
                  return (
                    <div key={folder.path} className="relative group">
                      <button
                        onClick={() => !isLoading && handleToggleFolderSelection(folder.path)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
                          ${isSelected
                            ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-dark-surface" 
                            : "bg-dark-bg text-dark-text hover:bg-dark-accent"
                          }`}
                      >
                        {/* Checkbox indicator */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                          ${isSelected 
                            ? "bg-white border-white" 
                            : "border-dark-muted"
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>{folder.name}</span>
                        <span className={`text-xs ${isSelected ? "text-blue-200" : "text-dark-muted"}`}>
                          ({folder.imageCount})
                        </span>
                      </button>
                      <button
                        onClick={(e) => handleRemoveFolder(folder.path, e)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full 
                                   text-white opacity-0 group-hover:opacity-100 transition-opacity
                                   flex items-center justify-center"
                        title="Remove folder"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            )}
            
            {/* URL Collections */}
            {(settings.imageSourceFilter === "all" || settings.imageSourceFilter === "url-lists") && urlCollections.length === 0 && settings.imageSourceFilter === "url-lists" && (
              <p className="text-dark-muted text-sm py-2">No URL collections yet. Click "Import URLs" to add a list of image URLs.</p>
            )}
            {(settings.imageSourceFilter === "all" || settings.imageSourceFilter === "url-lists") && urlCollections.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dark-accent">
                <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">URL Collections</h3>
                <div className="flex flex-wrap gap-2">
                  {urlCollections.map((coll) => {
                    const isSelected = selectedUrlCollectionIds.includes(coll.id);
                    return (
                    <div key={coll.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => !isLoading && handleToggleUrlCollectionSelection(coll.id)}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors
                          ${isSelected
                            ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-dark-surface"
                            : "bg-dark-bg text-dark-text border border-dark-accent hover:bg-dark-accent"
                          }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                          ${isSelected ? "bg-white border-white" : "border-dark-muted"}`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span>🔗</span>
                        <span>{coll.name}</span>
                        <span className={`text-xs ${isSelected ? "text-blue-200" : "text-dark-muted"}`}>({coll.imageCount})</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${coll.mode === "offline" ? "bg-green-600/30 text-green-400" : "bg-blue-600/30 text-blue-400"}`}>
                          {coll.mode === "offline" ? "Offline ✓" : "Stream"}
                        </span>
                      </button>
                      <div className="flex gap-1 mt-1">
                        {coll.mode === "stream" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSwitchToOffline(coll); }}
                            className="px-2 py-1 text-xs bg-green-600/80 hover:bg-green-600 rounded text-white"
                          >
                            Switch to Offline
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSwitchToStream(coll); }}
                            className="px-2 py-1 text-xs bg-dark-accent hover:bg-dark-bg rounded text-dark-text"
                          >
                            Switch to Stream
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeUrlCollection(coll.id); }}
                          className="px-2 py-1 text-xs bg-red-600/50 hover:bg-red-600 rounded text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}

            {/* Selection summary */}
            {(selectedFolderPaths.length > 0 || selectedUrlCollectionIds.length > 0) && (
              <div className="mt-3 pt-3 border-t border-dark-accent">
                <p className="text-dark-muted text-sm">
                  {selectedFolderPaths.length > 0 && (
                    <>
                      <span className="text-dark-text font-medium">{selectedFolderPaths.length}</span> folder{selectedFolderPaths.length !== 1 ? "s" : ""} selected
                      {selectedUrlCollectionIds.length > 0 && " • "}
                    </>
                  )}
                  {selectedUrlCollectionIds.length > 0 && (
                    <>
                      <span className="text-dark-text font-medium">{selectedUrlCollectionIds.length}</span> URL collection{selectedUrlCollectionIds.length !== 1 ? "s" : ""} selected
                      {" • "}
                    </>
                  )}
                  <span className="text-dark-text font-medium">{totalImages}</span> images total
                </p>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mt-3 p-2 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Settings Section - Two Column Layout */}
          {totalImages > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Timer Mode + (Timer & Break when Timed) */}
              <div className="bg-dark-surface rounded-xl p-4 space-y-4">
                {/* Timer Mode toggle */}
                <div>
                  <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                    Timer Mode
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTimedMode(true)}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors
                        ${isTimedMode
                          ? "bg-blue-600 text-white"
                          : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                        }`}
                    >
                      Timed
                    </button>
                    <button
                      onClick={() => setTimedMode(false)}
                      className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors
                        ${!isTimedMode
                          ? "bg-blue-600 text-white"
                          : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                        }`}
                    >
                      Untimed
                    </button>
                  </div>
                </div>

                {/* Timer & Break - only when Timed */}
                {isTimedMode && (
                  <>
                    <div className="pt-3 border-t border-dark-accent">
                      <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                        Image Duration
                      </h3>
                      <TimerPresets />
                    </div>

                    <div className="pt-3 border-t border-dark-accent">
                      <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                        Break
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 2, 3, 5, 10].map((seconds) => (
                          <button
                            key={seconds}
                            onClick={() => setBreakDuration(seconds)}
                            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
                              ${breakDuration === seconds
                                ? "bg-blue-600 text-white"
                                : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                              }`}
                          >
                            {seconds === 0 ? "None" : `${seconds}s`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column: Image Count */}
              <div className="bg-dark-surface rounded-xl p-4">
                <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                  Image Count
                </h3>
                <select
                  value={imageCountMode}
                  onChange={(e) => setImageCountMode(e.target.value as ImageCountMode)}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-accent rounded-lg text-dark-text 
                             text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-1 
                             focus:ring-blue-500/50 cursor-pointer hover:border-dark-text/50 transition-colors"
                >
                  <option value="all">All ({totalImages})</option>
                  <option value="specific">Specific number</option>
                </select>
                {imageCountMode === "specific" && (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      type="number"
                      min="1"
                      max={totalImages}
                      value={selectedSpecificCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0 && val <= totalImages) setSelectedSpecificCount(val);
                        else if (e.target.value === "") setSelectedSpecificCount(1);
                      }}
                      className="w-20 px-2 py-1.5 bg-dark-bg border border-dark-accent rounded-lg 
                                 text-dark-text text-center text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-dark-muted text-xs">of {totalImages}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remember settings - subtle footer, only when folders selected */}
          {totalImages > 0 && (
            <div className="pt-2 border-t border-dark-accent/50">
              <label className="flex items-center gap-2 cursor-pointer text-dark-muted text-xs hover:text-dark-text/80 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.rememberHomeSettings === true}
                  onChange={(e) => setRememberHomeSettings(e.target.checked)}
                  className="w-4 h-4 rounded bg-dark-bg border-dark-accent text-blue-600 
                             focus:ring-blue-500 focus:ring-offset-dark-bg"
                />
                <span>Remember current settings</span>
              </label>
            </div>
          )}

                {/* Instructions (only show if no folder selected) */}
                {totalImages === 0 && (
                  <div className="bg-dark-surface rounded-xl p-6 text-center text-dark-muted">
                    <p>Select a folder containing reference images to begin.</p>
                    <p className="text-xs mt-1">Supported: JPG, PNG, GIF, WebP, BMP, TIFF</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-dark-surface rounded-xl p-8 text-center text-dark-muted">
                <p className="text-lg font-medium mb-1">Coming Soon</p>
                <p className="text-sm">Settings for this mode are in development.</p>
              </div>
            )}
          </div>

          {/* 3. Action Block */}
          <div className="bg-dark-surface rounded-xl p-4">
            {selectedMode === "image-curator" && totalImages > 0 ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <p className="text-dark-muted text-sm">
                    {isTimedMode ? "Session duration" : "Session"}
                  </p>
                  <p className="text-dark-text font-bold text-2xl">
                    {isTimedMode ? sessionDuration : `${sessionImageCount} images`}
                  </p>
                  <p className="text-dark-muted text-xs">
                    {isTimedMode
                      ? `${sessionImageCount} images × ${timerDuration}s${breakDuration > 0 ? ` + ${sessionImageCount - 1} breaks × ${breakDuration}s` : ""}`
                      : "Advance manually with arrows"}
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleBrowseGallery}
                    className="px-6 py-4 bg-dark-accent hover:bg-blue-600 rounded-xl 
                               text-dark-text hover:text-white font-semibold text-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Browse
                  </button>
                  <button
                    onClick={handleSessionSetup}
                    className="px-6 py-4 bg-dark-accent hover:bg-blue-600 rounded-xl 
                               text-dark-text hover:text-white font-semibold text-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Session Setup
                  </button>
                  <button
                    onClick={handleNewSession}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 rounded-xl 
                               text-white font-semibold text-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Begin Session
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                {selectedMode === "image-curator" && totalImages === 0 ? (
                  <p className="text-dark-muted text-sm">
                    Add folders above to start a session
                  </p>
                ) : (
                  <p className="text-dark-muted text-sm">
                    Action buttons for this mode are coming soon
                  </p>
                )}
              </div>
            )}
          </div>

                  </div>
                ),
              },
              {
                id: "previous-sessions",
                label: "Previous Sessions",
                content: (
                  <div className="bg-dark-surface rounded-b-xl overflow-hidden">
                    <PreviousSessions
                      onBack={() => setActiveTab("new-session")}
                      onView={handleViewSession}
                      embedded
                    />
                  </div>
                ),
              },
              {
                id: "presets",
                label: "Presets",
                content: (
                  <div className="space-y-6 bg-dark-surface rounded-b-xl p-4 border-x border-b border-dark-accent min-h-[280px]">
                    {/* Save New Preset button - always visible */}
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleSavePresetClick}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white 
                                   font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save New Preset
                      </button>
                      {savePresetError && (
                        <p className="text-red-400 text-sm px-2 whitespace-pre-line">{savePresetError}</p>
                      )}
                      {savePresetSuccess && (
                        <p className="text-green-400 text-sm px-2">{savePresetSuccess}</p>
                      )}
                    </div>

                    {/* Preset list or empty state */}
                    {presets.length === 0 ? (
                      <div className="bg-dark-bg rounded-xl p-8 text-center">
                        <p className="text-dark-text font-medium mb-2">No presets yet</p>
                        <p className="text-dark-muted text-sm">
                          Enable &quot;Remember current settings&quot; in New Session and Session Setup, then return here to save a preset.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {presets.map((preset) => (
                          <div
                            key={preset.id}
                            className="bg-dark-bg rounded-xl p-4 hover:bg-dark-accent/30 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-dark-text font-semibold text-lg truncate">
                                  {preset.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-dark-muted text-sm">
                                  <span className="px-2 py-0.5 bg-dark-surface rounded text-xs font-medium">
                                    {getModeBadgeLabel(preset.mode)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {formatPresetDate(preset.createdAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleLoadPreset(preset)}
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white 
                                             font-medium text-sm transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                  </svg>
                                  Load
                                </button>
                                <button
                                  onClick={() => handleRenamePresetStart(preset)}
                                  className="px-4 py-2 bg-dark-accent hover:bg-dark-surface rounded-lg text-dark-text 
                                             font-medium text-sm transition-colors"
                                >
                                  Rename
                                </button>
                                <button
                                  onClick={(e) => handleDeletePreset(preset.id, e)}
                                  className="px-4 py-2 bg-dark-bg hover:bg-red-600/50 rounded-lg text-dark-muted 
                                             hover:text-red-300 font-medium text-sm transition-colors flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as "new-session" | "previous-sessions" | "presets")}
          />

          {/* Download Progress Modal */}
          {collectionToDownload && (
            <DownloadProgressModal
              collection={collectionToDownload}
              onComplete={handleDownloadComplete}
              onCancel={handleDownloadCancel}
            />
          )}

          {/* Save Preset Modal */}
          {showSavePresetModal && (
            <div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
              onClick={() => setShowSavePresetModal(false)}
            >
              <div
                className="bg-dark-surface rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-dark-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-dark-text font-medium mb-3">Name your preset</h3>
                <input
                  type="text"
                  placeholder="Preset name"
                  value={savePresetName}
                  onChange={(e) => setSavePresetName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const name = savePresetName.trim();
                      if (name) handleSavePresetConfirm(name);
                    }
                    if (e.key === "Escape") setShowSavePresetModal(false);
                  }}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-accent rounded-lg 
                             text-dark-text placeholder-dark-muted focus:outline-none focus:border-blue-500 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSavePresetModal(false)}
                    className="flex-1 px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => savePresetName.trim() && handleSavePresetConfirm(savePresetName.trim())}
                    disabled={!savePresetName.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rename Preset Modal */}
          {presetToRename && (
            <div
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
              onClick={() => { setPresetToRename(null); setRenameValue(""); }}
            >
              <div
                className="bg-dark-surface rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-dark-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-dark-text font-medium mb-3">Rename Preset</h3>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenamePresetConfirm();
                    if (e.key === "Escape") { setPresetToRename(null); setRenameValue(""); }
                  }}
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-accent rounded-lg 
                             text-dark-text placeholder-dark-muted focus:outline-none focus:border-blue-500 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPresetToRename(null); setRenameValue(""); }}
                    className="flex-1 px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRenamePresetConfirm}
                    disabled={!renameValue.trim()}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium disabled:opacity-50"
                  >
                    Rename
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* URL Collection Name Modal */}
          {showUrlNameModal && pendingUrlList && (
            <UrlNameModal
              suggestedName={pendingUrlList.suggestedName || "URL Collection"}
              urlCount={pendingUrlList.urls.length}
              isValidating={isValidatingUrls}
              error={urlImportError}
              onConfirm={handleConfirmUrlImport}
              onCancel={() => {
                setShowUrlNameModal(false);
                setPendingUrlList(null);
                setUrlImportError(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
