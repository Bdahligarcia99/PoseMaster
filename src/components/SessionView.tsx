import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../store/sessionStore";
import { useSavedSessionsStore, ImageDrawing } from "../store/savedSessionsStore";
import ImageViewer from "./ImageViewer";
import Toolbar from "./Toolbar";
import Timer from "./Timer";
import SaveSessionModal from "./SaveSessionModal";

// Lazy load DrawingCanvas to prevent initial freeze
const DrawingCanvas = lazy(() => import("./DrawingCanvas"));

export default function SessionView() {
  const {
    images,
    currentImageIndex,
    viewedImages,
    endSession,
    resetSession,
    isOnBreak,
    folderPath,
    folderName,
    timerDuration,
    breakDuration,
    imageOpacity,
    imageZoom,
    resumedSessionId,
    resumedSessionName,
    currentDrawingData,
    saveCurrentImageDrawing,
    skipCurrentImage,
  } = useSessionStore();
  const { saveSession, updateSession } = useSavedSessionsStore();

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(
    null
  );
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const currentImage = images[currentImageIndex];

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case " ": // Space to pause/resume
          e.preventDefault();
          useSessionStore.getState().toggleTimerPause();
          break;
        case "ArrowRight": // Right arrow to skip
          e.preventDefault();
          useSessionStore.getState().nextImage();
          break;
        case "ArrowLeft": // Left arrow to go back
          e.preventDefault();
          useSessionStore.getState().previousImage();
          break;
        case "x": // X to remove/skip image from session
        case "X":
          e.preventDefault();
          skipCurrentImage();
          break;
        case "Escape": // Escape to end session
          e.preventDefault();
          endSession();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [endSession]);

  // Save and exit handler
  const handleSaveAndExit = async (name: string) => {
    // First, save current drawing to viewedImages
    saveCurrentImageDrawing();
    
    // Get updated viewedImages (need to get fresh state after save)
    const state = useSessionStore.getState();
    
    // Build drawings record from viewedImages including current
    const drawings: Record<string, ImageDrawing> = {};
    
    // Add all viewed images with drawings
    for (const viewed of state.viewedImages) {
      if (viewed.drawingData && viewed.drawingData.lines.length > 0) {
        drawings[viewed.path] = {
          imagePath: viewed.path,
          drawingData: viewed.drawingData,
          savedAt: viewed.viewedAt,
        };
      }
    }
    
    // Also add current drawing if it has content and isn't already saved
    if (currentDrawingData.lines.length > 0 && !drawings[currentImage]) {
      drawings[currentImage] = {
        imagePath: currentImage,
        drawingData: currentDrawingData,
        savedAt: Date.now(),
      };
    }

    if (resumedSessionId) {
      // Update existing session
      await updateSession(resumedSessionId, {
        name: name || resumedSessionName || undefined,
        currentImageIndex,
        drawings,
        settings: { timerDuration, breakDuration, imageOpacity },
      });
    } else {
      // Create new session
      await saveSession({
        name,
        folderPath: folderPath || "",
        folderName: folderName || "Unknown",
        settings: { timerDuration, breakDuration, imageOpacity },
        currentImageIndex,
        totalImages: images.length,
        imageOrder: images,
        drawings,
      });
    }

    // Reset and go back to home
    resetSession();
    setShowSaveModal(false);
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Save Session Modal */}
      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveAndExit}
        defaultName={resumedSessionName || undefined}
      />

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
          </div>

          {/* Timer */}
          <div className="flex-1 max-w-md">
            <Timer />
          </div>

          {/* Session buttons */}
          <div className="flex items-center gap-2">
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
              onClick={endSession}
              className="px-4 py-2 bg-dark-accent hover:bg-red-600/80 rounded-lg text-dark-text 
                         hover:text-white font-medium transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div
        ref={handleContainerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
      >
        {/* Zoom wrapper - contains both image and canvas */}
        <div 
          className="relative transition-all duration-200"
          style={{ 
            width: `${imageZoom}%`,
            height: `${imageZoom}%`,
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {/* Image layer */}
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageViewer
              imagePath={currentImage}
              onDimensionsChange={(width, height) => {
                setImageDimensions({ width, height });
                // Delay canvas rendering slightly to prevent blocking
                setTimeout(() => setCanvasReady(true), 50);
              }}
            />
          </div>

          {/* Drawing canvas overlay */}
          {imageDimensions && containerDimensions && canvasReady && !isOnBreak && (
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

        {/* Break overlay */}
        {isOnBreak && (
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
      </div>

      {/* Bottom toolbar */}
      <div className="flex-shrink-0 border-t border-dark-accent">
        <Toolbar />
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-16 left-4 text-dark-muted text-xs opacity-50">
        <span className="mr-3">Space: Pause</span>
        <span className="mr-3">← →: Navigate</span>
        <span className="mr-3">X: Skip</span>
        <span>Esc: End</span>
      </div>
    </div>
  );
}
