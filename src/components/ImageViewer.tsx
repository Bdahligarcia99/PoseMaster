import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../store/sessionStore";

function isUrl(path: string): boolean {
  return path.startsWith("http://") || path.startsWith("https://");
}

// Prefetch cache for URL images (stream mode)
const prefetchCache = new Map<string, string>();
const MAX_PREFETCH_CACHE = 4;

// LRU-ish cache for local folder images (avoids repeated base64 reads from disk)
const localImageCache = new Map<string, string>();
const MAX_LOCAL_CACHE = 32;

function touchLocalCache(path: string, data: string) {
  if (localImageCache.has(path)) {
    localImageCache.delete(path);
  }
  localImageCache.set(path, data);
  while (localImageCache.size > MAX_LOCAL_CACHE) {
    const first = localImageCache.keys().next().value;
    if (first === undefined) break;
    localImageCache.delete(first);
  }
}

function getLocalCached(path: string): string | undefined {
  const data = localImageCache.get(path);
  if (data !== undefined) {
    localImageCache.delete(path);
    localImageCache.set(path, data);
  }
  return data;
}

interface ImageViewerProps {
  imagePath?: string | null;
  onDimensionsChange?: (width: number, height: number) => void;
  opacity?: number;
  /** Next 1-2 image paths/URLs to prefetch when current is a stream URL */
  prefetchSources?: string[];
}

export default function ImageViewer({ imagePath, onDimensionsChange, opacity, prefetchSources = [] }: ImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const storeOpacity = useSessionStore((state) => state.imageOpacity);
  const effectiveOpacity = opacity !== undefined ? opacity : storeOpacity;

  const loadImage = useCallback(async (path: string): Promise<string> => {
    if (!isUrl(path)) {
      const cached = getLocalCached(path);
      if (cached) return cached;
    }
    if (isUrl(path)) {
      return invoke<string>("fetch_url_image_as_base64", { url: path });
    }
    const data = await invoke<string>("get_image_as_base64", { imagePath: path });
    touchLocalCache(path, data);
    return data;
  }, []);

  // Stable prefetch fingerprint — parent should memoize array; this avoids effect churn if reference slips
  const prefetchKey = useMemo(() => prefetchSources.join("\0"), [prefetchSources]);

  // Main load: only depends on imagePath (not prefetchSources) to avoid re-fetch on unrelated renders
  useEffect(() => {
    if (!imagePath) {
      setImageUrl(null);
      setIsLoading(false);
      setError(null);
      setDimensions(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setError(null);
      setDimensions(null);
      setIsLoading(true);

      const cachedPrefetch = isUrl(imagePath) ? prefetchCache.get(imagePath) : null;
      if (cachedPrefetch) {
        prefetchCache.delete(imagePath);
        if (!cancelled) {
          setImageUrl(cachedPrefetch);
          setIsLoading(false);
        }
        return;
      }

      try {
        const base64Data = await loadImage(imagePath);
        if (cancelled) return;
        setImageUrl(base64Data);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading image:", err);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [imagePath, loadImage]);

  // Prefetch next URLs only when current path or prefetch list content changes
  useEffect(() => {
    if (!imagePath || !isUrl(imagePath)) return;
    const toPrefetch = prefetchSources.filter(isUrl).slice(0, 2);
    if (toPrefetch.length === 0) return;

    for (const src of toPrefetch) {
      if (prefetchCache.has(src)) continue;
      loadImage(src)
        .then((data) => {
          if (prefetchCache.size < MAX_PREFETCH_CACHE) {
            prefetchCache.set(src, data);
          }
        })
        .catch(() => {
          /* ignore prefetch errors */
        });
    }
  }, [imagePath, prefetchKey, loadImage]);

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const container = containerRef.current;

      setIsLoading(false);

      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      const widthRatio = containerWidth / imgWidth;
      const heightRatio = containerHeight / imgHeight;
      const scale = Math.min(widthRatio, heightRatio);

      const displayWidth = Math.floor(imgWidth * scale);
      const displayHeight = Math.floor(imgHeight * scale);

      setDimensions({ width: displayWidth, height: displayHeight });
      onDimensionsChange?.(displayWidth, displayHeight);
    },
    [onDimensionsChange]
  );

  if (!imagePath) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg text-dark-muted">
        No image
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
              if (!isUrl(imagePath)) {
                localImageCache.delete(imagePath);
              }
              setIsLoading(true);
              loadImage(imagePath)
                .then((data) => {
                  setImageUrl(data);
                  setIsLoading(false);
                })
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

  // Spinner only when we have nothing to show yet (avoids flicker when swapping images)
  const showBlockingSpinner = isLoading && !imageUrl;

  if (showBlockingSpinner) {
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full flex items-center justify-center bg-dark-bg overflow-hidden"
    >
      {isLoading && imageUrl && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-dark-bg/40 pointer-events-none">
          <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
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
