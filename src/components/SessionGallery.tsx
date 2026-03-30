import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore, getFreeDrawGuidelinesKey } from "../store/sessionStore";
import GuidelineOverlay from "./GuidelineOverlay";

export default function SessionGallery() {
  const {
    viewedImages,
    galleryIndex,
    setGalleryIndex,
    viewedSessionName,
    imageOpacity,
    isViewingOnly,
    isBrowsingGallery,
    exitGallery,
    exitBrowseMode,
    imageGuidelines,
    freeDrawDrawings,
    isSplitScreen,
  } = useSessionStore();

  // Go back to session summary (for completed sessions)
  const handleBackToSummary = () => {
    useSessionStore.setState({ isViewingGallery: false, isSessionEnded: true });
  };

  // Go back to Previous Sessions screen
  const handleBackToPreviousSessions = () => {
    exitGallery(true); // true = return to Previous Sessions
  };

  // Go back to main screen
  const handleBackToMain = () => {
    exitGallery(false); // false = return to main screen
  };

  // Go back when in browse mode (returns to home)
  const handleBackFromBrowse = () => {
    exitBrowseMode();
  };

  const [mainImage, setMainImage] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const [isLoadingMain, setIsLoadingMain] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [showDrawings, setShowDrawings] = useState(true); // Toggle for drawing layer visibility
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = viewedImages[galleryIndex];
  const hasDrawings = currentImage?.hasMarkup || false;
  const hasAnyDrawings = viewedImages.some((img) => img.hasMarkup);
  const drawingData = currentImage?.drawingData;
  const freeDrawingData =
    currentImage &&
    (() => {
      const d =
        freeDrawDrawings[currentImage.path] ??
        currentImage.freeDrawData ??
        null;
      return d && d.lines.length > 0 ? d : null;
    })();

  const emptyGuidelines = { vertical: [] as number[], horizontal: [] as number[] };

  // Update image dimensions when image loads or window resizes
  const updateImageDimensions = useCallback(() => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight,
      });
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    updateImageDimensions();
  }, [updateImageDimensions]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener("resize", updateImageDimensions);
    return () => window.removeEventListener("resize", updateImageDimensions);
  }, [updateImageDimensions]);

  // Load main image when gallery index changes
  useEffect(() => {
    if (!currentImage) return;

    const loadImage = async () => {
      setIsLoadingMain(true);
      try {
        const { path } = currentImage;
        const base64 = path.startsWith("http")
          ? await invoke<string>("fetch_url_image_as_base64", { url: path })
          : await invoke<string>("get_image_as_base64", { imagePath: path });
        setMainImage(base64);
      } catch (err) {
        console.error("Failed to load image:", err);
      }
      setIsLoadingMain(false);
    };

    loadImage();
  }, [currentImage?.path]);

  // Load thumbnails progressively
  useEffect(() => {
    const loadThumbnails = async () => {
      for (const img of viewedImages) {
        if (!thumbnails.has(img.path)) {
          try {
            const base64 = img.path.startsWith("http")
              ? await invoke<string>("fetch_url_image_as_base64", { url: img.path })
              : await invoke<string>("get_image_as_base64", { imagePath: img.path });
            setThumbnails((prev) => new Map(prev).set(img.path, base64));
          } catch (err) {
            console.error("Failed to load thumbnail:", err);
          }
        }
      }
    };

    loadThumbnails();
  }, [viewedImages]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (thumbnailsRef.current) {
      const activeThumb = thumbnailsRef.current.children[galleryIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [galleryIndex]);

  const goToPrevious = () => {
    if (galleryIndex > 0) {
      setGalleryIndex(galleryIndex - 1);
    }
  };

  const goToNext = () => {
    if (galleryIndex < viewedImages.length - 1) {
      setGalleryIndex(galleryIndex + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "Escape") {
        if (isBrowsingGallery) {
          handleBackFromBrowse();
        } else if (isViewingOnly) {
          handleBackToPreviousSessions();
        } else {
          handleBackToSummary();
        }
      } else if (e.key === "d" || e.key === "D") {
        setShowDrawings(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryIndex, viewedImages.length, isViewingOnly, isBrowsingGallery]);

  const getFileName = (path: string) => {
    return path.split("/").pop() || path.split("\\").pop() || path;
  };

  return (
    <div className="h-screen flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-surface border-b border-dark-accent">
        {isBrowsingGallery ? (
          // Single back button when browsing (from New Session)
          <button
            onClick={handleBackFromBrowse}
            className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text 
                       hover:bg-dark-accent rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        ) : isViewingOnly ? (
          // Two buttons when viewing from Previous Sessions
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToPreviousSessions}
              className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text 
                         hover:bg-dark-accent rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Sessions
            </button>
            <button
              onClick={handleBackToMain}
              className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text 
                         hover:bg-dark-accent rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Home
            </button>
          </div>
        ) : (
          // Single back button when viewing from session summary
          <button
            onClick={handleBackToSummary}
            className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}

        <div className="text-center">
          <h1 className="text-dark-text font-medium">
            {viewedSessionName || "Session Gallery"}
          </h1>
          <p className="text-dark-muted text-sm">
            {galleryIndex + 1} of {viewedImages.length} images
          </p>
        </div>

        {/* Layer visibility toggle - only when session has drawings */}
        {hasAnyDrawings && (
        <button
          onClick={() => setShowDrawings(!showDrawings)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
            ${showDrawings 
              ? "bg-blue-600 text-white" 
              : "bg-dark-bg text-dark-muted hover:text-dark-text"
            }`}
          title={showDrawings ? "Hide drawings" : "Show drawings"}
        >
          {/* Eye icon */}
          {showDrawings ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
          <span className="text-sm font-medium">Drawings</span>
        </button>
        )}
      </div>

      {/* Main viewport */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
        {/* Previous button */}
        <button
          onClick={goToPrevious}
          disabled={galleryIndex === 0}
          className="absolute left-4 z-10 p-3 bg-dark-surface/80 hover:bg-dark-surface 
                     rounded-full text-dark-text disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all shadow-lg"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Image container */}
        <div className="relative max-w-full max-h-full flex items-center justify-center">
          {isLoadingMain ? (
            <div className="w-96 h-96 flex items-center justify-center">
              <svg className="animate-spin h-12 w-12 text-dark-muted" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : mainImage ? (
            <div className="relative inline-block">
              <img
                ref={imageRef}
                src={mainImage}
                alt={getFileName(currentImage?.path || "")}
                className="max-h-[calc(100vh-220px)] max-w-full object-contain rounded-lg shadow-xl"
                style={{ opacity: imageOpacity / 100 }}
                onLoad={handleImageLoad}
              />

              {currentImage && imageDimensions.width > 0 && (
                <>
                  <div className="absolute top-0 left-0 z-[1] pointer-events-none rounded-lg overflow-hidden">
                    <GuidelineOverlay
                      width={imageDimensions.width}
                      height={imageDimensions.height}
                      guidelines={imageGuidelines[currentImage.path] ?? emptyGuidelines}
                      onAddGuideline={() => {}}
                      onUpdateGuideline={() => {}}
                      onRemoveGuideline={() => {}}
                    />
                  </div>
                  {isSplitScreen && (
                    <div className="absolute top-0 left-0 z-[3] pointer-events-none rounded-lg overflow-hidden">
                      <GuidelineOverlay
                        width={imageDimensions.width}
                        height={imageDimensions.height}
                        guidelines={
                          imageGuidelines[getFreeDrawGuidelinesKey(currentImage.path)] ??
                          emptyGuidelines
                        }
                        onAddGuideline={() => {}}
                        onUpdateGuideline={() => {}}
                        onRemoveGuideline={() => {}}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Curator / single-pane drawing overlay */}
              {showDrawings && drawingData && imageDimensions.width > 0 && (
                <svg
                  className="absolute top-0 left-0 z-[2] pointer-events-none rounded-lg transition-opacity duration-200"
                  width={imageDimensions.width}
                  height={imageDimensions.height}
                  viewBox={`0 0 ${drawingData.canvasWidth || imageDimensions.width} ${drawingData.canvasHeight || imageDimensions.height}`}
                  preserveAspectRatio="none"
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

              {/* Practice pane strokes (split sessions) */}
              {showDrawings && freeDrawingData && imageDimensions.width > 0 && (
                <svg
                  className="absolute top-0 left-0 z-[4] pointer-events-none rounded-lg transition-opacity duration-200"
                  width={imageDimensions.width}
                  height={imageDimensions.height}
                  viewBox={`0 0 ${freeDrawingData.canvasWidth || imageDimensions.width} ${freeDrawingData.canvasHeight || imageDimensions.height}`}
                  preserveAspectRatio="none"
                >
                  {freeDrawingData.lines.map((line, i) => (
                    <polyline
                      key={`free-${i}`}
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

              {/* Drawing indicator badge */}
              {hasDrawings && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 rounded text-white text-xs font-medium">
                  Has Drawings
                </div>
              )}
            </div>
          ) : (
            <div className="w-96 h-96 flex items-center justify-center text-dark-muted">
              No image loaded
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={goToNext}
          disabled={galleryIndex === viewedImages.length - 1}
          className="absolute right-4 z-10 p-3 bg-dark-surface/80 hover:bg-dark-surface 
                     rounded-full text-dark-text disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all shadow-lg"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Image info */}
        {currentImage && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-dark-surface/90 rounded-lg">
            <p className="text-dark-text text-sm font-medium truncate max-w-md">
              {getFileName(currentImage.path)}
            </p>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      <div className="bg-dark-surface border-t border-dark-accent p-3">
        <div
          ref={thumbnailsRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin"
          style={{ scrollbarColor: "#0f3460 #1a1a2e" }}
        >
          {viewedImages.map((img, index) => {
            const thumb = thumbnails.get(img.path);
            const isActive = index === galleryIndex;

            return (
              <button
                key={img.path}
                onClick={() => setGalleryIndex(index)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden 
                           transition-all ${
                             isActive
                               ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-dark-surface"
                               : "opacity-60 hover:opacity-100"
                           }`}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-dark-bg flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-dark-muted" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}

                {/* Drawing indicator on thumbnail */}
                {img.hasMarkup && (
                  <div className="absolute bottom-1 right-1 w-3 h-3 bg-blue-500 rounded-full" />
                )}

                {/* Index number */}
                <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-xs">
                  {index + 1}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
