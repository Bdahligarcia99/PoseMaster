import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../store/sessionStore";
import { useSettingsStore } from "../store/settingsStore";
import { useSavedSessionsStore, SavedSession } from "../store/savedSessionsStore";
import TimerPresets from "./TimerPresets";
import PreviousSessions from "./PreviousSessions";

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

export default function FolderPicker() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalImages, setTotalImages] = useState<number>(0);
  const [selectedImageCount, setSelectedImageCount] = useState<number | null>(10); // Default to 10
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(null);
  const [showPreviousSessions, setShowPreviousSessions] = useState(false);
  const hasAutoLoaded = useRef(false);

  const { setFolderPath, setFolderName, setImages, enterSetup, startSession, resumeSession, viewSession, timerDuration, breakDuration, setBreakDuration, setMaxImages, setTimerDuration, setImageOpacity, setImageZoom, setEraserDisabled, setTimerHidden, returnToPreviousSessions, clearReturnToPreviousSessions } = useSessionStore();
  
  // Check if we should show Previous Sessions on mount (returning from gallery view)
  useEffect(() => {
    if (returnToPreviousSessions) {
      setShowPreviousSessions(true);
      clearReturnToPreviousSessions();
    }
  }, [returnToPreviousSessions, clearReturnToPreviousSessions]);
  const { savedFolders, settings, isLoaded, loadSettings, addFolder, removeFolder, updateSettings, setLastSelectedFolder } = useSettingsStore();
  const { sessions: savedSessions, isLoaded: sessionsLoaded, loadSessions } = useSavedSessionsStore();

  // Load folder images helper
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
      setFolderPath(folderPath);
      setImages(imagePaths);
      setTotalImages(imagePaths.length);
      setCurrentFolderPath(folderPath);
      // Set default to 10 or total if less than 10
      setSelectedImageCount(imagePaths.length <= 10 ? null : 10);
      setIsLoading(false);

      if (shouldSave) {
        const folderName = folderPath.split("/").pop() || folderPath.split("\\").pop() || folderPath;
        await addFolder({
          path: folderPath,
          name: folderName,
          imageCount: imagePaths.length,
          addedAt: Date.now(),
        });
        await setLastSelectedFolder(folderPath);
      }

      return true;
    } catch (err) {
      console.error("Error loading folder:", err);
      setError(err instanceof Error ? err.message : "Failed to load images");
      setIsLoading(false);
      return false;
    }
  }, [setFolderPath, setImages, addFolder, setLastSelectedFolder]);

  // Load settings and saved sessions on mount
  useEffect(() => {
    loadSettings();
    loadSessions();
  }, [loadSettings, loadSessions]);

  // Apply saved settings when loaded
  useEffect(() => {
    if (isLoaded) {
      setTimerDuration(settings.timerDuration);
      setBreakDuration(settings.breakDuration);
      setImageOpacity(settings.imageOpacity);
      setImageZoom(settings.imageZoom);
      setEraserDisabled(settings.eraserDisabled);
      setTimerHidden(settings.timerHidden);
      if (settings.maxImages !== null) {
        setSelectedImageCount(settings.maxImages);
      }
    }
  }, [isLoaded, settings.timerDuration, settings.breakDuration, settings.maxImages, settings.imageOpacity, settings.imageZoom, settings.eraserDisabled, settings.timerHidden, setTimerDuration, setBreakDuration, setImageOpacity, setImageZoom, setEraserDisabled, setTimerHidden]);

  // Auto-load last selected folder (only once)
  useEffect(() => {
    if (isLoaded && settings.lastSelectedFolder && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      loadFolderImages(settings.lastSelectedFolder, false);
    }
  }, [isLoaded, settings.lastSelectedFolder, loadFolderImages]);

  // Save settings when going to setup (timer/break/count only - opacity/zoom saved in SessionSetup)
  const saveCurrentSettings = useCallback(() => {
    if (isLoaded) {
      updateSettings({
        timerDuration,
        breakDuration,
        maxImages: selectedImageCount,
      });
    }
  }, [timerDuration, breakDuration, selectedImageCount, isLoaded, updateSettings]);

  // Calculate session duration including breaks
  const sessionDuration = useMemo(() => {
    const count = selectedImageCount || totalImages;
    if (count === 0) return null;
    // Total time = (image time × count) + (break time × (count - 1))
    // No break before first image
    const totalSeconds = (count * timerDuration) + ((count - 1) * breakDuration);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, [selectedImageCount, totalImages, timerDuration, breakDuration]);

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

  const handleSelectSavedFolder = async (folderPath: string) => {
    await loadFolderImages(folderPath, false);
    await setLastSelectedFolder(folderPath);
  };

  const handleRemoveFolder = async (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeFolder(folderPath);
    if (currentFolderPath === folderPath) {
      setCurrentFolderPath(null);
      setTotalImages(0);
      setFolderPath("");
      setImages([]);
    }
  };

  // Common setup before starting any session
  const prepareSession = () => {
    // Save current settings for next time
    saveCurrentSettings();
    
    // Set folder name for potential saving later
    if (currentFolderPath) {
      const name = currentFolderPath.split("/").pop() || currentFolderPath.split("\\").pop() || currentFolderPath;
      setFolderName(name);
    }
    // Set max images if user selected a limit
    if (selectedImageCount && selectedImageCount < totalImages) {
      setMaxImages(selectedImageCount);
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

  const handleResumeSession = (session: SavedSession) => {
    // Set folder info
    setFolderPath(session.folderPath);
    setFolderName(session.folderName);
    
    // Resume the session with all its data
    resumeSession({
      id: session.id,
      name: session.name,
      imageOrder: session.imageOrder,
      currentIndex: session.currentImageIndex,
      drawings: session.drawings,
      settings: session.settings,
    });
  };

  const handleViewSession = (session: SavedSession) => {
    // View the session summary without starting the timer
    viewSession({
      id: session.id,
      name: session.name,
      imageOrder: session.imageOrder,
      currentIndex: session.currentImageIndex,
      drawings: session.drawings,
      settings: session.settings,
    });
  };

  // Image count presets
  const imageCountPresets = [10, 20, 30, 50, 100].filter(n => n <= totalImages);

  // Show Previous Sessions screen
  if (showPreviousSessions) {
    return (
      <PreviousSessions
        onBack={() => setShowPreviousSessions(false)}
        onResume={handleResumeSession}
        onView={handleViewSession}
      />
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg overflow-y-auto">
      <div className="flex flex-col items-center p-6">
        <div className="w-full max-w-3xl space-y-6">
          
          {/* Header */}
          <div className="text-center py-4">
            <h1 className="text-3xl font-bold text-dark-text">PoseMaster</h1>
            <AppDescription />
            {/* Previous Sessions Button */}
            {sessionsLoaded && savedSessions.length > 0 && (
              <button
                onClick={() => setShowPreviousSessions(true)}
                className="mt-3 px-4 py-2 bg-dark-surface hover:bg-dark-accent rounded-lg 
                           text-dark-muted hover:text-dark-text transition-colors 
                           flex items-center gap-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Previous Sessions ({savedSessions.length})
              </button>
            )}
          </div>

          {/* Folder Selection Section */}
          <div className="bg-dark-surface rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide">Folders</h2>
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
            
            {/* Folder Buttons */}
            <div className="flex flex-wrap gap-2">
              {savedFolders.length === 0 ? (
                <p className="text-dark-muted text-sm py-2">No folders added yet. Click "Add Folder" to get started.</p>
              ) : (
                savedFolders.map((folder) => (
                  <div key={folder.path} className="relative group">
                    <button
                      onClick={() => !isLoading && handleSelectSavedFolder(folder.path)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
                        ${currentFolderPath === folder.path 
                          ? "bg-blue-600 text-white" 
                          : "bg-dark-bg text-dark-text hover:bg-dark-accent"
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{folder.name}</span>
                      <span className={`text-xs ${currentFolderPath === folder.path ? "text-blue-200" : "text-dark-muted"}`}>
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
                ))
              )}
            </div>

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
              
              {/* Left Column: Timer & Break */}
              <div className="bg-dark-surface rounded-xl p-4 space-y-4">
                {/* Timer Settings */}
                <div>
                  <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                    Image Duration
                  </h3>
                  <TimerPresets />
                </div>

                {/* Break Duration */}
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
              </div>

              {/* Right Column: Image Count */}
              <div className="bg-dark-surface rounded-xl p-4">
                <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-2">
                  Number of Images
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => setSelectedImageCount(null)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
                      ${selectedImageCount === null
                        ? "bg-blue-600 text-white"
                        : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                      }`}
                  >
                    All ({totalImages})
                  </button>
                  {imageCountPresets.map((count) => (
                    <button
                      key={count}
                      onClick={() => setSelectedImageCount(count)}
                      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors
                        ${selectedImageCount === count
                          ? "bg-blue-600 text-white"
                          : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                        }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                
                {/* Custom input */}
                <div className="flex items-center gap-2">
                  <span className="text-dark-muted text-xs">Custom:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalImages}
                    value={selectedImageCount || ""}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val > 0 && val <= totalImages) {
                        setSelectedImageCount(val);
                      } else if (e.target.value === "") {
                        setSelectedImageCount(null);
                      }
                    }}
                    placeholder={`1-${totalImages}`}
                    className="w-20 px-2 py-1 bg-dark-bg border border-dark-accent rounded 
                               text-dark-text text-center text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Session Summary & Start */}
          {totalImages > 0 && (
            <div className="bg-dark-surface rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-dark-muted text-sm">Session duration</p>
                  <p className="text-dark-text font-bold text-2xl">{sessionDuration}</p>
                  <p className="text-dark-muted text-xs">
                    {selectedImageCount || totalImages} images × {timerDuration}s
                    {breakDuration > 0 && ` + ${(selectedImageCount || totalImages) - 1} breaks × ${breakDuration}s`}
                  </p>
                </div>
                <div className="flex gap-3">
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
                    New Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Instructions (only show if no folder selected) */}
          {totalImages === 0 && (
            <div className="text-center text-dark-muted text-sm py-4">
              <p>Select a folder containing reference images to begin.</p>
              <p className="text-xs mt-1">Supported: JPG, PNG, GIF, WebP, BMP, TIFF</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
