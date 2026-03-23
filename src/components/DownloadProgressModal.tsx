import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { UrlCollection } from "../store/settingsStore";

interface DownloadProgressModalProps {
  collection: UrlCollection;
  onComplete: (cachePath: string) => void;
  onCancel: () => void;
}

interface DownloadResult {
  url: string;
  local_path: string;
  success: boolean;
  error?: string;
}

function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

export default function DownloadProgressModal({
  collection,
  onComplete,
  onCancel,
}: DownloadProgressModalProps) {
  const [completed, setCompleted] = useState(0);
  const [total] = useState(collection.urls.length);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<"downloading" | "done" | "cancelled">("downloading");
  const cancelledRef = useRef(false);

  const runDownload = useCallback(async () => {
    const base = (await appDataDir()).replace(/[/\\]$/, "");
    const cacheFolder = `${base}/url-cache/${collection.id}/`;

    const successfulPaths: string[] = [];
    const failed: string[] = [];

    for (let i = 0; i < collection.urls.length; i++) {
      if (cancelledRef.current) {
        setStatus("cancelled");
        return;
      }

      const url = collection.urls[i];
      setCurrentUrl(url);

      try {
        const result = await invoke<DownloadResult>("download_single_url_image", {
          url,
          cacheFolder,
          collectionId: collection.id,
          index: i,
        });

        if (result.success) {
          successfulPaths.push(result.local_path);
        } else {
          failed.push(url);
        }
      } catch {
        failed.push(url);
      }

      setCompleted((c) => c + 1);
      setFailedUrls([...failed]);
    }

    if (cancelledRef.current) {
      setStatus("cancelled");
      return;
    }

    setStatus("done");
    setCurrentUrl(null);

    if (successfulPaths.length > 0) {
      onComplete(cacheFolder);
    }
  }, [collection, onComplete]);

  useEffect(() => {
    runDownload();
    return () => {
      cancelledRef.current = true;
    };
  }, [runDownload]);

  const handleCancel = () => {
    cancelledRef.current = true;
    setStatus("cancelled");
    onCancel();
  };

  const handleRetryFailed = async () => {
    if (failedUrls.length === 0) return;

    setStatus("downloading");
    setCompleted(total - failedUrls.length);
    cancelledRef.current = false;

    const base = (await appDataDir()).replace(/[/\\]$/, "");
    const cacheFolder = `${base}/url-cache/${collection.id}/`;
    const stillFailed: string[] = [];

    for (let i = 0; i < collection.urls.length; i++) {
      const url = collection.urls[i];
      if (!failedUrls.includes(url)) continue;
      if (cancelledRef.current) break;

      setCurrentUrl(url);

      try {
        const result = await invoke<DownloadResult>("download_single_url_image", {
          url,
          cacheFolder,
          collectionId: collection.id,
          index: i,
        });
        if (!result.success) stillFailed.push(url);
      } catch {
        stillFailed.push(url);
      }
      setCompleted((c) => c + 1);
    }

    setFailedUrls(stillFailed);
    setStatus("done");
    setCurrentUrl(null);

    if (stillFailed.length === 0) {
      onComplete(cacheFolder);
    }
  };

  const successCount = completed - failedUrls.length;
  const isFinished = status === "done" || status === "cancelled";

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={isFinished ? (e) => e.target === e.currentTarget && onCancel() : undefined}
    >
      <div
        className="bg-dark-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-xl border border-dark-accent"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-dark-text font-semibold text-lg mb-2">{collection.name}</h3>

        {status === "downloading" && (
          <>
            <div className="h-2 bg-dark-bg rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-dark-muted text-sm mb-1">
              {completed} of {total} images
            </p>
            {currentUrl && (
              <p className="text-dark-muted/80 text-xs truncate" title={currentUrl}>
                {truncateUrl(currentUrl)}
              </p>
            )}
            <button
              onClick={handleCancel}
              className="mt-4 w-full px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white font-medium"
            >
              Cancel
            </button>
          </>
        )}

        {status === "done" && (
          <>
            <p className="text-dark-muted text-sm mb-4">
              {failedUrls.length === 0 ? (
                <>All {total} images downloaded.</>
              ) : (
                <>
                  Downloaded {successCount}/{total} images ({failedUrls.length} failed)
                </>
              )}
            </p>
            <div className="flex gap-2">
              {failedUrls.length > 0 && (
                <button
                  onClick={handleRetryFailed}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium"
                >
                  Retry Failed
                </button>
              )}
              <button
                onClick={() => onCancel()}
                className="flex-1 px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium"
              >
                {successCount > 0 ? "Done" : "Close"}
              </button>
            </div>
          </>
        )}

        {status === "cancelled" && (
          <>
            <p className="text-dark-muted text-sm mb-4">Download cancelled.</p>
            <button
              onClick={() => onCancel()}
              className="w-full px-4 py-2 bg-dark-accent hover:bg-dark-bg rounded-lg text-dark-text font-medium"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
