import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../store/sessionStore";
import { useSavedSessionsStore, ImageDrawing } from "../store/savedSessionsStore";
import { useSettingsStore } from "../store/settingsStore";
import ImageViewer from "./ImageViewer";
import Toolbar from "./Toolbar";
import DrawingDataOverlay from "./DrawingDataOverlay";
import GuidelineOverlay from "./GuidelineOverlay";
import {
  SessionTimerProvider,
  TimerProgressSection,
  TimerPauseControl,
  TimerSkipControl,
} from "./Timer";
import SaveSessionModal from "./SaveSessionModal";

// Lazy load drawing surfaces to prevent initial freeze
const DrawingCanvas = lazy(() => import("./DrawingCanvas"));
const FreeDrawCanvas = lazy(() => import("./FreeDrawCanvas"));

export default function SessionView() {
  const {
    images,
    currentImageIndex,
    viewedImages,
    getPersistencePath,
    endSession,
    resetSession,
    isOnBreak,
    isTimedMode,
    nextImage,
    folderPath,
    folderName,
    timerDuration,
    breakDuration,
    imageOpacity,
    imageZoom,
    markupEnabled,
    saveCurrentImageDrawing,
    skipCurrentImage,
    isSplitScreen,
    splitSidesSwapped,
    swapSplitSides,
    toggleSplitScreen,
    activeCanvas,
    setActiveCanvas,
    isCompareMode,
    toggleCompareMode,
    compareOverlayOpacity,
    freeDrawDrawings,
    imageGuidelines,
    addGuideline,
    updateGuidelinePosition,
    removeGuideline,
  } = useSessionStore();
  const { saveSession } = useSavedSessionsStore();
  const { updateSettings } = useSettingsStore();

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);

  const currentImage = images[currentImageIndex]?.path;

  /** Stable reference so ImageViewer's effect does not re-run on every parent render */
  const prefetchSources = useMemo(
    () => images.slice(currentImageIndex + 1, currentImageIndex + 3).map((img) => img.path),
    [images, currentImageIndex]
  );

  const hasViewedImages = viewedImages.length > 0;

  const handleEndSessionRequest = useCallback(() => {
    if (!hasViewedImages) {
      resetSession();
      return;
    }
    setShowEndConfirmModal(true);
  }, [hasViewedImages, resetSession]);

  const handleExitWithoutSaving = () => {
    setShowEndConfirmModal(false);
    resetSession();
  };

  const handleSaveAndExitFromConfirm = () => {
    setShowEndConfirmModal(false);
    setShowSaveModal(true);
  };

  const toggleSplitAndPersistPreference = useCallback(() => {
    toggleSplitScreen();
    void updateSettings({
      preferSplitScreen: useSessionStore.getState().isSplitScreen,
    });
  }, [toggleSplitScreen, updateSettings]);

  // Prevent display sleep during session
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

  // Reset canvas ready state when image changes
  useEffect(() => {
    setCanvasReady(false);
    setImageDimensions(null);
  }, [currentImageIndex]);

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

  // Advance to next image (or end session if on last)
  const handleNextImage = useCallback(() => {
    if (currentImageIndex >= images.length - 1) {
      endSession();
    } else {
      nextImage();
    }
  }, [currentImageIndex, images.length, endSession, nextImage]);

  // Keyboard shortcuts
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLSelectElement) return true;
      return target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const lower = e.key.toLowerCase();

      if (lower === "s" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        toggleSplitAndPersistPreference();
        return;
      }

      if (e.key === "Tab" && isSplitScreen) {
        e.preventDefault();
        setActiveCanvas(activeCanvas === "curator" ? "freeDraw" : "curator");
        return;
      }

      if (lower === "c" && !e.ctrlKey && !e.metaKey && isSplitScreen) {
        toggleCompareMode();
        return;
      }

      if (lower === "x" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (isSplitScreen) {
          swapSplitSides();
        } else {
          skipCurrentImage();
        }
        return;
      }

      switch (e.key) {
        case " ": // Space: pause/resume (timed) or next image (untimed)
          e.preventDefault();
          if (useSessionStore.getState().isTimedMode) {
            useSessionStore.getState().toggleTimerPause();
          } else {
            handleNextImage();
          }
          break;
        case "ArrowRight": // Right arrow to advance
          e.preventDefault();
          handleNextImage();
          break;
        case "ArrowLeft": // Left arrow to go back
          e.preventDefault();
          useSessionStore.getState().previousImage();
          break;
        case "Escape": // Escape to end session
          e.preventDefault();
          handleEndSessionRequest();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleEndSessionRequest,
    handleNextImage,
    isSplitScreen,
    activeCanvas,
    toggleSplitAndPersistPreference,
    setActiveCanvas,
    toggleCompareMode,
    swapSplitSides,
    skipCurrentImage,
  ]);

  // Save and exit handler
  const handleSaveAndExit = async (name: string) => {
    // First, save current drawing to viewedImages
    saveCurrentImageDrawing();
    
    const state = useSessionStore.getState();

    const imageOrder = state.viewedImages.map((v) => getPersistencePath(v.path));

    const drawings: Record<string, ImageDrawing> = !markupEnabled ? {} : (() => {
      const out: Record<string, ImageDrawing> = {};
      for (const viewed of state.viewedImages) {
        if (viewed.drawingData && viewed.drawingData.lines.length > 0) {
          const key = getPersistencePath(viewed.path);
          out[key] = {
            imagePath: key,
            drawingData: viewed.drawingData,
            savedAt: viewed.viewedAt,
          };
        }
      }
      return out;
    })();

    const splitSnap = state.getSplitPersistSnapshot();

    await saveSession({
        name,
        folderPath: folderPath || "",
        folderName: folderName || "Unknown",
        settings: {
          timerDuration,
          breakDuration,
          imageOpacity,
          isTimedMode,
          markupEnabled,
        },
        imageOrder,
        drawings,
        curatorDrawings: splitSnap.curatorDrawings,
        freeDrawDrawings: splitSnap.freeDrawDrawings,
        imageGuidelines: splitSnap.imageGuidelines,
        isSplitScreen: splitSnap.isSplitScreen,
        splitSidesSwapped: splitSnap.splitSidesSwapped,
      });

    // Reset and go back to home
    resetSession();
    setShowSaveModal(false);
  };

  return (
    <SessionTimerProvider>
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Save Session Modal */}
      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveAndExit}
        defaultName={undefined}
      />

      {/* End Session confirmation modal */}
      {showEndConfirmModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setShowEndConfirmModal(false)}
        >
          <div
            className="bg-dark-surface rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl border border-dark-accent"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-dark-text font-medium mb-4">
              Would you like to save this session?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSaveAndExitFromConfirm}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
              >
                Save & Exit
              </button>
              <button
                onClick={handleExitWithoutSaving}
                className="w-full px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium transition-colors"
              >
                Exit Without Saving
              </button>
              <button
                onClick={() => setShowEndConfirmModal(false)}
                className="w-full px-4 py-2 bg-dark-bg hover:bg-dark-surface rounded-lg text-dark-muted font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex-shrink-0 px-4 py-3 bg-dark-surface border-b border-dark-accent">
        <div className="flex items-center justify-between gap-4">
          {/* Image counter and skip button */}
          <div className="flex items-center gap-3">
            <div className="text-dark-muted">
              <span className="text-dark-text font-medium">{currentImageIndex + 1}</span>
              <span className="mx-1">/</span>
              <span>{images.length}</span>
              <span className="ml-2 text-sm">
                ({viewedImages.length} viewed)
              </span>
            </div>
            <button
              onClick={skipCurrentImage}
              className="p-1.5 rounded-lg text-dark-muted hover:text-red-400 hover:bg-red-600/20 
                         transition-colors"
              title="Remove image from session (X)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </button>
            {isSplitScreen && (
              <>
                <button
                  type="button"
                  onClick={() => swapSplitSides()}
                  title="Swap sides"
                  aria-label="Swap sides"
                  className="flex items-center justify-center p-1.5 rounded-lg text-dark-muted hover:text-dark-text bg-dark-bg border border-dark-accent transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M7 16l-4-4 4-4" />
                    <path d="M17 8l4 4-4 4" />
                    <path d="M3 12h18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => toggleCompareMode()}
                  title="Show Practice strokes over the reference"
                  aria-pressed={isCompareMode}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      isCompareMode
                        ? "bg-cyan-600 text-white ring-1 ring-cyan-400/50"
                        : "text-dark-muted hover:text-dark-text bg-dark-bg border border-dark-accent"
                    }`}
                >
                  Compare
                </button>
              </>
            )}
          </div>

          {/* Timer track + pause (skip is with session actions) */}
          <div className="flex min-w-0 max-w-md flex-1 items-center gap-4">
            <TimerProgressSection />
            {isTimedMode ? <TimerPauseControl /> : null}
          </div>

          {/* Session buttons */}
          <div className="flex shrink-0 items-center gap-2">
            <TimerSkipControl />
            <button
              type="button"
              onClick={toggleSplitAndPersistPreference}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors
                ${isSplitScreen
                  ? "bg-blue-600 text-white"
                  : "text-dark-muted hover:bg-dark-accent hover:text-dark-text"
                }`}
              title={isSplitScreen ? "Disable split view" : "Enable split view"}
              aria-pressed={isSplitScreen}
              aria-label={isSplitScreen ? "Disable split view" : "Enable split view"}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <rect x="3" y="3" width="8" height="18" rx="1" strokeWidth={2} />
                <rect x="13" y="3" width="8" height="18" rx="1" strokeWidth={2} />
              </svg>
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white 
                         font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save & Exit
            </button>
            <button
              onClick={handleEndSessionRequest}
              className="px-4 py-2 bg-dark-accent hover:bg-red-600/80 rounded-lg text-dark-text 
                         hover:text-white font-medium transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden">
        {isSplitScreen ? (
          <div className="flex-1 flex min-h-0 w-full">
            <div
              className={`flex-1 flex min-w-0 min-h-0 ${splitSidesSwapped ? "order-3" : "order-1"}`}
            >
              <div
                ref={handleContainerRef}
                className="flex-1 relative overflow-auto flex items-center justify-center min-h-0"
              >
                <div
                  role="presentation"
                  onClick={() => setActiveCanvas("curator")}
                  className={`relative transition-all duration-200 min-w-0 min-h-0 rounded-md ${
                    activeCanvas === "curator"
                      ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-dark-bg"
                      : "border border-dark-accent/40"
                  }`}
                  style={{
                    width: `${imageZoom}%`,
                    height: `${imageZoom}%`,
                  }}
                >
                  <span className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-dark-bg/85 px-2 py-0.5 text-xs font-medium text-dark-muted border border-dark-accent/40">
                    Image
                  </span>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageViewer
                      imagePath={currentImage}
                      prefetchSources={prefetchSources}
                      onDimensionsChange={(width, height) => {
                        setImageDimensions({ width, height });
                        setTimeout(() => setCanvasReady(true), 50);
                      }}
                    />
                  </div>
                  {imageDimensions &&
                    containerDimensions &&
                    canvasReady &&
                    currentImage &&
                    !isOnBreak && (
                      <>
                        <div
                          className={`absolute z-[1] ${
                            activeCanvas === "curator"
                              ? "pointer-events-auto"
                              : "pointer-events-none"
                          }`}
                          style={{
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            width: imageDimensions.width,
                            height: imageDimensions.height,
                          }}
                        >
                          <GuidelineOverlay
                            width={imageDimensions.width}
                            height={imageDimensions.height}
                            guidelines={
                              imageGuidelines[currentImage] ?? {
                                vertical: [],
                                horizontal: [],
                              }
                            }
                            onAddGuideline={(type, pos) =>
                              addGuideline(currentImage, type, pos)
                            }
                            onUpdateGuideline={(type, index, pos) =>
                              updateGuidelinePosition(currentImage, type, index, pos)
                            }
                            onRemoveGuideline={(type, index) =>
                              removeGuideline(currentImage, type, index)
                            }
                          />
                        </div>
                        {markupEnabled && (
                          <div
                            className={`absolute z-[2] ${
                              activeCanvas === "curator"
                                ? "pointer-events-auto"
                                : "pointer-events-none"
                            }`}
                            style={{
                              left: "50%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              width: imageDimensions.width,
                              height: imageDimensions.height,
                            }}
                          >
                            <Suspense fallback={null}>
                              <DrawingCanvas
                                width={imageDimensions.width}
                                height={imageDimensions.height}
                                isActive={activeCanvas === "curator"}
                              />
                            </Suspense>
                          </div>
                        )}
                      </>
                    )}
                  {isCompareMode &&
                    currentImage &&
                    imageDimensions &&
                    canvasReady &&
                    !isOnBreak &&
                    (freeDrawDrawings[currentImage]?.lines.length ?? 0) > 0 && (
                      <div
                        className="absolute pointer-events-none z-[8]"
                        style={{
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
                          width: imageDimensions.width,
                          height: imageDimensions.height,
                          opacity: compareOverlayOpacity / 100,
                        }}
                      >
                        <DrawingDataOverlay
                          width={imageDimensions.width}
                          height={imageDimensions.height}
                          drawingData={freeDrawDrawings[currentImage]!}
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>

            <div
              className="w-1 shrink-0 bg-dark-accent self-stretch order-2"
              role="separator"
              aria-orientation="vertical"
            />

            <div
              className={`flex-1 flex min-w-0 min-h-0 ${splitSidesSwapped ? "order-1" : "order-3"}`}
            >
              <div className="flex-1 relative overflow-auto flex items-center justify-center min-h-0">
                <div
                  className="relative transition-all duration-200 min-w-0 min-h-0 flex items-center justify-center"
                  style={{
                    width: `${imageZoom}%`,
                    height: `${imageZoom}%`,
                  }}
                >
                  {imageDimensions && canvasReady && !isOnBreak && (
                    <div className="relative" style={{ width: imageDimensions.width, height: imageDimensions.height }}>
                      <span className="absolute top-2 left-2 z-10 pointer-events-none rounded bg-dark-bg/85 px-2 py-0.5 text-xs font-medium text-dark-muted border border-dark-accent/40">
                        Practice
                      </span>
                      {markupEnabled && (
                        <Suspense fallback={null}>
                          <FreeDrawCanvas
                            width={imageDimensions.width}
                            height={imageDimensions.height}
                            isActive={activeCanvas === "freeDraw"}
                            onActivate={() => setActiveCanvas("freeDraw")}
                          />
                        </Suspense>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={handleContainerRef}
            className="flex-1 relative overflow-auto flex items-center justify-center min-h-0"
          >
            <div
              className="relative transition-all duration-200 min-w-0 min-h-0"
              style={{
                width: `${imageZoom}%`,
                height: `${imageZoom}%`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageViewer
                  imagePath={currentImage}
                  prefetchSources={prefetchSources}
                  onDimensionsChange={(width, height) => {
                    setImageDimensions({ width, height });
                    setTimeout(() => setCanvasReady(true), 50);
                  }}
                />
              </div>

              {imageDimensions &&
                containerDimensions &&
                canvasReady &&
                currentImage &&
                !isOnBreak && (
                  <>
                    <div
                      className="absolute z-[1] pointer-events-auto"
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                      }}
                    >
                      <GuidelineOverlay
                        width={imageDimensions.width}
                        height={imageDimensions.height}
                        guidelines={
                          imageGuidelines[currentImage] ?? {
                            vertical: [],
                            horizontal: [],
                          }
                        }
                        onAddGuideline={(type, pos) =>
                          addGuideline(currentImage, type, pos)
                        }
                        onUpdateGuideline={(type, index, pos) =>
                          updateGuidelinePosition(currentImage, type, index, pos)
                        }
                        onRemoveGuideline={(type, index) =>
                          removeGuideline(currentImage, type, index)
                        }
                      />
                    </div>
                    {markupEnabled && (
                      <div
                        className="absolute z-[2] pointer-events-auto"
                        style={{
                          left: "50%",
                          top: "50%",
                          transform: "translate(-50%, -50%)",
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
                  </>
                )}
            </div>
          </div>
        )}

        {/* Break overlay - only in timed mode */}
        {isTimedMode && isOnBreak && (
          <div className="absolute inset-0 bg-dark-bg/90 flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h2 className="text-3xl font-bold text-yellow-400 mb-2">Get Ready!</h2>
              <p className="text-dark-muted text-lg">Next image coming up...</p>
              <p className="text-dark-muted text-sm mt-4">
                Image {currentImageIndex + 2} of {images.length}
              </p>
            </div>
          </div>
        )}

        {/* Prominent Next Image button - untimed mode only */}
        {!isTimedMode && (
          <button
            onClick={handleNextImage}
            className="absolute bottom-8 right-8 px-8 py-4 bg-blue-600 hover:bg-blue-700 
                       rounded-xl text-white font-semibold text-lg shadow-lg shadow-blue-900/30
                       flex items-center gap-3 transition-colors z-10"
            title="Next image (→)"
          >
            Next Image
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom toolbar - only when markup enabled */}
      {markupEnabled && (
        <div className="flex-shrink-0 border-t border-dark-accent">
          <Toolbar />
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-16 left-4 text-dark-muted text-xs opacity-50 max-w-xl">
        {isTimedMode ? (
          <>
            <span className="mr-3">Space: Pause</span>
            <span className="mr-3">← →: Navigate</span>
            <span className="mr-3">{isSplitScreen ? "X: Swap sides" : "X: Skip"}</span>
          </>
        ) : (
          <>
            <span className="mr-3">→ or Space: Next</span>
            <span className="mr-3">←: Back</span>
            <span className="mr-3">{isSplitScreen ? "X: Swap sides" : "X: Skip"}</span>
          </>
        )}
        {isSplitScreen && (
          <span className="mr-3">S: Split · Tab: Pane · C: Compare</span>
        )}
        <span>Esc: End</span>
      </div>
    </div>
    </SessionTimerProvider>
  );
}
