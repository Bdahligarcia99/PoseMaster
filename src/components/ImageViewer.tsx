import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../store/sessionStore";

function isUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

// Prefetch cache for URL images (stream mode) - key: url, value: base64 data URL
const prefetchCache = new Map<string, string>();
const MAX_PREFETCH_CACHE = 4;

interface ImageViewerProps {
  imagePath?: string | null;
  onDimensionsChange?: (width: number, height: number) => void;
  opacity?: number; // Optional override, otherwise uses store
  /** Next 1-2 image paths/URLs to prefetch when current is a stream URL */
  prefetchSources?: string[];
}

export default function ImageViewer({ imagePath, onDimensionsChange, opacity, prefetchSources = [] }: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const storeOpacity = useSessionStore((state) => state.imageOpacity);
  const effectiveOpacity = opacity !== undefined ? opacity : storeOpacity;

  const loadImage = useCallback(async (path: string): Promise<string> => {
    if (isUrl(path)) {
      return invoke<string>("fetch_url_image_as_base64", { url: path });
    }
    return invoke<string>("get_image_as_base64", { imagePath: path });
  }, []);

  useEffect(() => {
    if (!imagePath || loadingRef.current) return;
    loadingRef.current = true;

    setIsLoading(true);
    setError(null);
    setDimensions(null);

    // Check prefetch cache first (stream mode)
    const cached = isUrl(imagePath) ? prefetchCache.get(imagePath) : null;
    if (cached) {
      prefetchCache.delete(imagePath);
      setImageUrl(cached);
      setIsLoading(false);
      loadingRef.current = false;
      return;
    }

    loadImage(imagePath)
      .then((base64Data) => {
        setImageUrl(base64Data);
        setIsLoading(false);
        loadingRef.current = false;

        // Prefetch next 1-2 URLs in stream mode for smoother experience
        if (isUrl(imagePath) && prefetchSources.length > 0) {
          const toPrefetch = prefetchSources.filter(isUrl).slice(0, 2);
          for (const src of toPrefetch) {
            if (prefetchCache.has(src)) continue;
            loadImage(src).then((data) => {
              if (prefetchCache.size < MAX_PREFETCH_CACHE) {
                prefetchCache.set(src, data);
              }
            }).catch(() => { /* ignore prefetch errors */ });
          }
        }
      })
      .catch((err) => {
        console.error("Error loading image:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
        loadingRef.current = false;
      });

    return () => {
      loadingRef.current = false;
    };
  }, [imagePath, loadImage, prefetchSources]);

  // Calculate displayed dimensions when image loads
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = containerRef.current;

    setIsLoading(false);
    
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    // Calculate scaled dimensions to fit container while maintaining aspect ratio
    // Allow scaling up when zoomed beyond 100%
    const widthRatio = containerWidth / imgWidth;
    const heightRatio = containerHeight / imgHeight;
    const scale = Math.min(widthRatio, heightRatio);

    const displayWidth = Math.floor(imgWidth * scale);
    const displayHeight = Math.floor(imgHeight * scale);

    setDimensions({ width: displayWidth, height: displayHeight });
    onDimensionsChange?.(displayWidth, displayHeight);
  }, [onDimensionsChange]);

  if (!imagePath) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg text-dark-muted">
        No image
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
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
          <span className="text-dark-muted">Loading image...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center p-4 max-w-md">
          <div className="text-red-400 mb-2 font-medium">Failed to load image</div>
          <div className="text-dark-muted text-sm mb-4 break-all">{error}</div>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              loadingRef.current = false;
              loadImage(imagePath)
                .then(setImageUrl)
                .then(() => setIsLoading(false))
                .catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                  setIsLoading(false);
                });
            }}
            className="px-4 py-2 bg-dark-accent hover:bg-blue-600 rounded-lg text-dark-text text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full flex items-center justify-center bg-dark-bg overflow-hidden"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Reference"
          onLoad={handleImageLoad}
          onError={() => {
            setError("Failed to load image");
            setIsLoading(false);
          }}
          className="max-w-full max-h-full object-contain transition-opacity duration-200"
          style={{
            ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
            opacity: effectiveOpacity / 100,
          }}
          draggable={false}
        />
      )}
    </div>
  );
}
