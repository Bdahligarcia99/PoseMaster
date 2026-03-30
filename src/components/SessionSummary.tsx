import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore, ViewedImage } from "../store/sessionStore";
import { useSavedSessionsStore, ImageDrawing } from "../store/savedSessionsStore";
import SaveSessionModal from "./SaveSessionModal";
import ExportOptionsModal from "./ExportOptionsModal";

interface ThumbnailProps {
  viewedImage: ViewedImage;
  isSelected: boolean;
  onToggleSelect: () => void;
}

function Thumbnail({ viewedImage, isSelected, onToggleSelect }: ThumbnailProps) {
  const freeFromStore = useSessionStore((s) => s.freeDrawDrawings[viewedImage.path]);
  const [thumbnailData, setThumbnailData] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const loadThumbnail = async () => {
      try {
        const data = viewedImage.path.startsWith("http")
          ? await invoke<string>("fetch_url_image_as_base64", { url: viewedImage.path })
          : await invoke<string>("get_image_as_base64", { imagePath: viewedImage.path });
        setThumbnailData(data);
      } catch (err) {
        console.error("Failed to load thumbnail:", err);
      }
    };
    loadThumbnail();
  }, [viewedImage.path]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  };

  const fileName = viewedImage.path.split("/").pop() || viewedImage.path.split("\\").pop() || "Unknown";
  const drawingData = viewedImage.drawingData;
  const freeDrawData =
    viewedImage.freeDrawData ??
    (freeFromStore && freeFromStore.lines.length > 0 ? freeFromStore : null);

  return (
    <div
      onClick={onToggleSelect}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
        ${isSelected ? "border-blue-500 ring-2 ring-blue-500/50" : "border-transparent hover:border-dark-accent"}
        ${viewedImage.hasMarkup ? "ring-2 ring-green-500/30" : ""}`}
    >
      {/* Thumbnail image with drawing overlay */}
      <div className="aspect-[4/3] bg-dark-surface relative">
        {thumbnailData ? (
          <>
            <img
              ref={imageRef}
              src={thumbnailData}
              alt={fileName}
              className="w-full h-full object-cover"
              onLoad={handleImageLoad}
            />
            {/* Drawing overlays (curator + practice in split) */}
            {viewedImage.hasMarkup && drawingData && imageDimensions.width > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-[1]"
                width={imageDimensions.width}
                height={imageDimensions.height}
                viewBox={`0 0 ${drawingData.canvasWidth || imageDimensions.width} ${drawingData.canvasHeight || imageDimensions.height}`}
                preserveAspectRatio="xMidYMid slice"
              >
                {drawingData.lines.map((line, i) => (
                  <polyline
                    key={i}
                    points={line.points
                      .reduce((acc: string[], _point, idx) => {
                        if (idx % 2 === 0 && idx + 1 < line.points.length) {
                          acc.push(`${line.points[idx]},${line.points[idx + 1]}`);
                        }
                        return acc;
                      }, [])
                      .join(" ")}
                    fill="none"
                    stroke={line.tool === "eraser" ? "transparent" : line.color}
                    strokeWidth={line.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            )}
            {freeDrawData && freeDrawData.lines.length > 0 && imageDimensions.width > 0 && (
              <svg
                className="absolute inset-0 pointer-events-none z-[2]"
                width={imageDimensions.width}
                height={imageDimensions.height}
                viewBox={`0 0 ${freeDrawData.canvasWidth || imageDimensions.width} ${freeDrawData.canvasHeight || imageDimensions.height}`}
                preserveAspectRatio="xMidYMid slice"
              >
                {freeDrawData.lines.map((line, i) => (
                  <polyline
                    key={`f-${i}`}
                    points={line.points
                      .reduce((acc: string[], _point, idx) => {
                        if (idx % 2 === 0 && idx + 1 < line.points.length) {
                          acc.push(`${line.points[idx]},${line.points[idx + 1]}`);
                        }
                        return acc;
                      }, [])
                      .join(" ")}
                    fill="none"
                    stroke={line.tool === "eraser" ? "transparent" : line.color}
                    strokeWidth={line.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-dark-muted" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Markup indicator */}
      {viewedImage.hasMarkup && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-green-600 rounded text-xs text-white font-medium">
          Markup
        </div>
      )}

      {/* Selection checkbox */}
      <div
        className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center
          ${isSelected ? "bg-blue-500 border-blue-500" : "bg-dark-bg/70 border-dark-muted"}`}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}
      </div>

      {/* File name */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-xs text-white truncate">{fileName}</p>
      </div>
    </div>
  );
}

export default function SessionSummary() {
  const {
    viewedImages,
    resetSession,
    folderPath,
    folderPaths,
    folderName,
    folderNames,
    timerDuration,
    breakDuration,
    imageOpacity,
    isTimedMode,
    markupEnabled,
    setGalleryIndex,
    getPersistencePath,
    freeDrawDrawings,
  } = useSessionStore();
  const { saveSession } = useSavedSessionsStore();

  const viewedImagesForExport = useMemo(
    () =>
      viewedImages.map((v) => ({
        ...v,
        freeDrawData:
          v.freeDrawData ??
          (freeDrawDrawings[v.path]?.lines.length ? freeDrawDrawings[v.path] : null),
      })),
    [viewedImages, freeDrawDrawings]
  );
  
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [sessionSaved, setSessionSaved] = useState(false);

  // Auto-select images with markup
  useEffect(() => {
    const withMarkup = viewedImages.filter((img) => img.hasMarkup).map((img) => img.path);
    setSelectedImages(new Set(withMarkup));
  }, [viewedImages]);

  const toggleSelect = (path: string) => {
    setSelectedImages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedImages(new Set(viewedImages.map((img) => img.path)));
  };

  const selectNone = () => {
    setSelectedImages(new Set());
  };

  const selectWithMarkup = () => {
    setSelectedImages(
      new Set(viewedImages.filter((img) => img.hasMarkup).map((img) => img.path))
    );
  };

  // Open gallery view
  const handleViewGallery = () => {
    // Set gallery index to 0 and switch to gallery mode
    setGalleryIndex(0);
    useSessionStore.setState({ isViewingGallery: true, isSessionEnded: false });
  };

  // Save session (non-destructive) - only include practiced images
  const handleSaveSession = async (name: string) => {
    const imageOrder = viewedImages.map((v) => getPersistencePath(v.path));

    const drawings: Record<string, ImageDrawing> = !markupEnabled ? {} : (() => {
      const out: Record<string, ImageDrawing> = {};
      for (const viewed of viewedImages) {
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

    const splitSnap = useSessionStore.getState().getSplitPersistSnapshot();

    await saveSession({
      name,
      folderPath: folderPath || (folderPaths.length > 0 ? folderPaths[0] : ""),
      folderName: folderName || "Unknown",
      folderPaths: folderPaths.length > 0 ? folderPaths : (folderPath ? [folderPath] : []),
      folderNames: folderNames.length > 0 ? folderNames : (folderName ? [folderName] : []),
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

    setSessionSaved(true);
    setShowSaveModal(false);
  };

  const handleNewSession = () => {
    resetSession();
  };

  const imagesWithMarkup = viewedImages.filter((img) => img.hasMarkup).length;

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Save Session Modal */}
      <SaveSessionModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveSession}
        defaultName={undefined}
      />

      {/* Export Options Modal */}
      <ExportOptionsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        viewedImages={viewedImagesForExport}
        selectedImages={selectedImages}
        imageOpacity={imageOpacity}
        folderPath={folderPath}
        sessionName={undefined}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-dark-surface border-b border-dark-accent">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-dark-text">Session Complete</h1>
            <p className="text-dark-muted mt-1">
              You viewed <span className="text-dark-text font-medium">{viewedImages.length}</span> images
              {imagesWithMarkup > 0 && (
                <>
                  , <span className="text-green-400 font-medium">{imagesWithMarkup}</span> with markup
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Gallery button */}
            <button
              onClick={handleViewGallery}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white 
                         font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View Gallery
            </button>
            
            {!sessionSaved ? (
              <button
                onClick={() => setShowSaveModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white 
                           font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Session
              </button>
            ) : (
              <span className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Session Saved
              </span>
            )}
            <button
              onClick={handleNewSession}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2
                ${sessionSaved 
                  ? "bg-dark-accent hover:bg-dark-bg text-dark-text" 
                  : "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/50"
                }`}
            >
              {!sessionSaved && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {sessionSaved ? "Done" : "Discard"}
            </button>
          </div>
        </div>
      </div>

      {/* Selection controls */}
      <div className="flex-shrink-0 px-6 py-3 bg-dark-surface/50 border-b border-dark-accent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-dark-muted">
              <span className="text-dark-text font-medium">{selectedImages.size}</span> selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Select all
              </button>
              <span className="text-dark-muted">|</span>
              <button
                onClick={selectNone}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                None
              </button>
              {imagesWithMarkup > 0 && (
                <>
                  <span className="text-dark-muted">|</span>
                  <button
                    onClick={selectWithMarkup}
                    className="text-sm text-green-400 hover:text-green-300"
                  >
                    With markup
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            disabled={selectedImages.size === 0}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 
                       disabled:cursor-not-allowed rounded-lg text-white font-medium 
                       transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {viewedImages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-dark-muted">
            No images were viewed in this session.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {viewedImages.map((viewedImage) => (
              <Thumbnail
                key={viewedImage.path}
                viewedImage={viewedImage}
                isSelected={selectedImages.has(viewedImage.path)}
                onToggleSelect={() => toggleSelect(viewedImage.path)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
