import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useSessionStore } from "../store/sessionStore";
import { useSettingsStore } from "../store/settingsStore";
import { useDrawingStore } from "../store/drawingStore";
import Toolbar from "./Toolbar";

// Lazy load DrawingCanvas to prevent initial freeze
const DrawingCanvas = lazy(() => import("./DrawingCanvas"));

export default function SessionSetup() {
  const {
    allImages,
    imageOpacity,
    imageZoom,
    markupEnabled,
    eraserDisabled,
    isTimedMode,
    timerHidden,
    setImageOpacity,
    setImageZoom,
    setMarkupEnabled,
    setEraserDisabled,
    setTimerHidden,
    startSession,
    exitSetup,
    timerDuration,
    breakDuration,
    maxImages,
    clearCurrentDrawing,
    currentDrawingData,
  } = useSessionStore();

  const { clearHistory } = useDrawingStore();
  const { updateSettings, settings, setRememberSetupSettings } = useSettingsStore();

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImagePath, setPreviewImagePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isHoveringRight, setIsHoveringRight] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number } | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [includePreviewInSession, setIncludePreviewInSession] = useState(false);

  // Prevent display sleep during setup (user is practicing)
  useEffect(() => {
    invoke("prevent_display_sleep").catch((err) => {
      console.warn("Failed to prevent display sleep:", err);
    });

    return () => {
      invoke("allow_display_sleep").catch((err) => {
        console.warn("Failed to allow display sleep:", err);
      });
    };
  }, []);

  // Load a random preview image (this image will be excluded from the actual session)
  useEffect(() => {
    const loadPreview = async () => {
      if (allImages.length === 0) return;
      
      // Pick a random image for preview (will be excluded from session)
      const randomIndex = Math.floor(Math.random() * allImages.length);
      const imagePath = allImages[randomIndex];
      setPreviewImagePath(imagePath);
      
      try {
        const base64 = await invoke<string>("get_image_as_base64", {
          imagePath,
        });
        setPreviewImage(base64);
      } catch (err) {
        console.error("Failed to load preview:", err);
      }
      setIsLoading(false);
    };

    loadPreview();
    
    // Clear any existing drawing data when entering setup
    clearCurrentDrawing();
    clearHistory();
  }, [allImages, clearCurrentDrawing, clearHistory]);

  // Track container size for canvas positioning
  const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const updateSize = () => {
        setContainerDimensions({
          width: node.clientWidth,
          height: node.clientHeight,
        });
      };

      updateSize();

      const resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(node);

      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleBack = () => {
    clearCurrentDrawing();
    clearHistory();
    exitSetup();
  };

  const handleBeginSession = async () => {
    // Save settings before starting (only when Remember Current Settings is checked)
    if (settings.rememberSetupSettings) {
      await updateSettings({
        imageOpacity,
        imageZoom,
        markupEnabled,
        eraserDisabled,
        timerHidden,
      });
    }
    
    if (includePreviewInSession && previewImagePath) {
      // Include preview image at the start, preserving any drawings
      startSession({ includeFirstPath: previewImagePath });
    } else {
      // Exclude preview image from session
      clearCurrentDrawing();
      clearHistory();
      startSession({ excludePath: previewImagePath || undefined });
    }
  };

  const handleSavePreview = async () => {
    if (!previewImagePath || currentDrawingData.lines.length === 0) {
      setSaveMessage({ type: 'error', text: 'No drawing to save' });
      setTimeout(() => setSaveMessage(null), 3000);
      return;
    }

    try {
      // Pick output folder
      const outputFolder = await open({
        directory: true,
        title: "Select folder to save image",
      });

      if (!outputFolder) return;

      setIsSaving(true);
      setSaveMessage(null);

      // Get the drawing canvas export function
      const exportCanvas = (window as unknown as { exportDrawingCanvas: () => string | null }).exportDrawingCanvas;
      const drawingDataUrl = exportCanvas?.();

      if (!drawingDataUrl) {
        throw new Error("Failed to export drawing");
      }

      await invoke("save_annotated_image", {
        request: {
          original_path: previewImagePath,
          drawing_data_url: drawingDataUrl,
          output_folder: outputFolder,
        },
      });

      setSaveMessage({ type: 'success', text: 'Image saved!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save:", err);
      setSaveMessage({ type: 'error', text: 'Failed to save image' });
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle image load to get dimensions
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      width: img.clientWidth,
      height: img.clientHeight,
    });
    setTimeout(() => setCanvasReady(true), 50);
  };

  // Calculate session info (excluding preview image unless "Include Preview" is on)
  const availableImages = (previewImagePath && !includePreviewInSession) 
    ? allImages.length - 1 
    : allImages.length;
  const imageCount = maxImages && maxImages < availableImages ? maxImages : availableImages;
  const totalSeconds = imageCount > 0 ? (imageCount * timerDuration) + ((imageCount - 1) * breakDuration) : 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Show settings when hovering right edge or panel is pinned open
  const settingsVisible = showSettings || isHoveringRight;

  return (
    <div className="h-screen flex flex-col bg-dark-bg">
      {/* Header - similar to SessionView */}
      <div className="flex-shrink-0 bg-dark-surface border-b border-dark-accent">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            {(isTimedMode && !timerHidden) && (
              <div className="text-dark-muted text-sm">
                <span className="text-dark-text font-medium">{imageCount}</span> images • {durationText}
              </div>
            )}
          </div>

          {/* Timer preview - hidden when Untimed or Hide Timer */}
          <div className="flex-1 max-w-md">
            {isTimedMode && !timerHidden ? (
              <div className="flex items-center gap-4">
                {/* Progress bar preview */}
                <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden">
                  <div className="h-full w-0 bg-blue-500" />
                </div>
                {/* Time display */}
                <span className="font-mono text-lg min-w-[60px] text-right text-dark-text">
                  {Math.floor(timerDuration / 60)}:{(timerDuration % 60).toString().padStart(2, "0")}
                </span>
                {/* Placeholder pause button */}
                <button
                  disabled
                  className="p-2 rounded-lg bg-dark-bg text-dark-muted cursor-not-allowed opacity-50"
                  title="Pause (preview only)"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                </button>
                {/* Placeholder skip button */}
                <button
                  disabled
                  className="p-2 rounded-lg bg-dark-bg text-dark-muted cursor-not-allowed opacity-50"
                  title="Skip (preview only)"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="text-center">
                <h1 className="text-lg font-bold text-dark-text">Session Setup</h1>
                <p className="text-dark-muted text-sm">
                  {imageCount} images
                  {isTimedMode ? ` • ${durationText} • Timer hidden` : " • Untimed — advance manually"}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Save message */}
            {saveMessage && (
              <span className={`text-sm font-medium ${
                saveMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {saveMessage.text}
              </span>
            )}

            {/* Save preview button */}
            <button
              onClick={handleSavePreview}
              disabled={isSaving || !markupEnabled || currentDrawingData.lines.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
                text-dark-muted hover:text-dark-text hover:bg-dark-accent
                disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save preview image with drawing"
            >
              {isSaving ? (
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
            </button>

            {/* Settings toggle button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
                ${showSettings 
                  ? "bg-blue-600 text-white" 
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-accent"
                }`}
              title="Toggle settings panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            <button
              onClick={handleBeginSession}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 
                         rounded-lg text-white font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Begin Session
            </button>
          </div>
        </div>
      </div>

      {/* Main content area - matches SessionView exactly */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={handleContainerRef}
          className="flex-1 relative overflow-auto flex items-center justify-center min-h-0"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-12 w-12 text-dark-muted" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : previewImage ? (
            /* Zoom wrapper - same as SessionView */
            <div 
              className="relative transition-all duration-200 min-w-0 min-h-0"
              style={{ 
                width: `${imageZoom}%`,
                height: `${imageZoom}%`,
              }}
            >
              {/* Image layer */}
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain"
                  style={{ opacity: imageOpacity / 100 }}
                  onLoad={handleImageLoad}
                />
              </div>

              {/* Drawing canvas overlay - only when markup enabled */}
              {markupEnabled && imageDimensions && containerDimensions && canvasReady && (
                <div
                  className="absolute pointer-events-auto"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: imageDimensions.width,
                    height: imageDimensions.height,
                  }}
                >
                  <Suspense fallback={null}>
                    <DrawingCanvas
                      width={imageDimensions.width}
                      height={imageDimensions.height}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          ) : (
            <div className="text-dark-muted text-center">
              <p>No preview available</p>
            </div>
          )}

          {/* Hint text at bottom */}
          {!settingsVisible && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-dark-surface/90 rounded-lg">
              <p className="text-dark-muted text-sm">
                {markupEnabled
                  ? "Click Settings to adjust display"
                  : "Markup disabled • View reference only"}
              </p>
            </div>
          )}
        </div>

        {/* Right edge hover zone */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-12 z-10"
          onMouseEnter={() => setIsHoveringRight(true)}
          onMouseLeave={() => setIsHoveringRight(false)}
        />

        {/* Settings panel - slides in from right */}
        <div 
          className={`absolute right-0 top-0 bottom-0 w-80 bg-dark-surface border-l border-dark-accent 
                      p-6 overflow-y-auto transition-transform duration-300 ease-in-out z-20
                      ${settingsVisible ? 'translate-x-0' : 'translate-x-full'}`}
          onMouseEnter={() => setIsHoveringRight(true)}
          onMouseLeave={() => setIsHoveringRight(false)}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-dark-text">Display Settings</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 text-dark-muted hover:text-dark-text transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Opacity control */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="text-dark-text font-medium">Image Opacity</label>
              <span className="text-dark-muted text-sm">{imageOpacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={imageOpacity}
              onChange={(e) => setImageOpacity(parseInt(e.target.value))}
              className="w-full h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:bg-blue-500
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:hover:bg-blue-400"
            />
            <div className="flex justify-between mt-2">
              {[25, 50, 75, 100].map((val) => (
                <button
                  key={val}
                  onClick={() => setImageOpacity(val)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors
                    ${imageOpacity === val
                      ? "bg-blue-600 text-white"
                      : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                    }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-dark-muted text-xs mt-2">
              Lower opacity helps see your drawings over the reference
            </p>
          </div>

          {/* Zoom control */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <label className="text-dark-text font-medium">Image Size</label>
              <span className="text-dark-muted text-sm">{imageZoom}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="200"
              value={imageZoom}
              onChange={(e) => setImageZoom(parseInt(e.target.value))}
              className="w-full h-2 bg-dark-bg rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:bg-blue-500
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:hover:bg-blue-400"
            />
            <div className="flex justify-between mt-2">
              {[25, 50, 75, 100, 150, 200].map((val) => (
                <button
                  key={val}
                  onClick={() => setImageZoom(val)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors
                    ${imageZoom === val
                      ? "bg-blue-600 text-white"
                      : "bg-dark-bg text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                    }`}
                >
                  {val}%
                </button>
              ))}
            </div>
            <p className="text-dark-muted text-xs mt-2">
              Smaller size leaves more room; zoom in for detail work
            </p>
          </div>

          {/* Markup Controls - parent section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-dark-text font-medium">Markup Controls</label>
              <button
                onClick={() => setMarkupEnabled(!markupEnabled)}
                className={`relative w-11 h-6 rounded-full transition-colors
                  ${markupEnabled ? "bg-blue-600" : "bg-dark-accent"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                    ${markupEnabled ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
            <div className={`rounded-lg border border-dark-accent p-3 transition-opacity ${!markupEnabled ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <label className={`font-medium ${!markupEnabled ? "text-dark-muted" : "text-dark-text"}`}>Erasing</label>
                  <p className="text-dark-muted text-xs mt-1">
                    Enable eraser, undo, and clear
                  </p>
                </div>
                <button
                  onClick={() => markupEnabled && setEraserDisabled(!eraserDisabled)}
                  disabled={!markupEnabled}
                  className={`relative w-11 h-6 rounded-full transition-colors
                    ${!markupEnabled ? "cursor-not-allowed opacity-50" : ""}
                    ${!eraserDisabled ? "bg-blue-600" : "bg-dark-accent"}`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                      ${!eraserDisabled ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Timer visibility toggle - disabled when Untimed */}
          <div className={`mb-6 transition-opacity ${!isTimedMode ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <div>
                <label className={`font-medium ${!isTimedMode ? "text-dark-muted" : "text-dark-text"}`}>Hide Timer</label>
                <p className="text-dark-muted text-xs mt-1">
                  {isTimedMode ? "Draw without time pressure" : "No timer in untimed mode"}
                </p>
              </div>
              <button
                onClick={() => isTimedMode && setTimerHidden(!timerHidden)}
                disabled={!isTimedMode}
                className={`relative w-11 h-6 rounded-full transition-colors
                  ${!isTimedMode ? "cursor-not-allowed" : ""}
                  ${timerHidden ? "bg-blue-600" : "bg-dark-accent"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                    ${timerHidden ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>

          {/* Include preview in session toggle */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-dark-text font-medium">Include Preview</label>
                <p className="text-dark-muted text-xs mt-1">
                  Add this image to session
                </p>
              </div>
              <button
                onClick={() => setIncludePreviewInSession(!includePreviewInSession)}
                className={`relative w-11 h-6 rounded-full transition-colors
                  ${includePreviewInSession ? "bg-green-600" : "bg-dark-accent"}`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform
                    ${includePreviewInSession ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>

          {/* Session info */}
          <div className="pt-6 border-t border-dark-accent">
            <h3 className="text-dark-muted text-sm font-medium uppercase tracking-wide mb-3">
              Session Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Images</span>
                <span className="text-dark-text">{imageCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Per image</span>
                <span className="text-dark-text">{timerDuration}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Break</span>
                <span className="text-dark-text">{breakDuration}s</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-dark-accent">
                <span className="text-dark-muted">Total time</span>
                <span className="text-dark-text font-semibold">{durationText}</span>
              </div>
            </div>
          </div>

          {/* Remember Current Settings */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.rememberSetupSettings === true}
              onChange={(e) => setRememberSetupSettings(e.target.checked)}
              className="w-4 h-4 rounded border-dark-accent bg-dark-bg text-blue-600 
                         focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-dark-text text-sm">Remember current settings</span>
          </label>

          {/* Begin button */}
          <button
            onClick={handleBeginSession}
            className="w-full mt-6 py-4 bg-green-600 hover:bg-green-700 
                       rounded-xl text-white font-semibold text-lg transition-colors
                       flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Begin Session
          </button>
        </div>
      </div>

      {/* Bottom toolbar - only when markup enabled */}
      {markupEnabled && (
        <div className="flex-shrink-0 border-t border-dark-accent">
          <Toolbar />
        </div>
      )}
    </div>
  );
}
