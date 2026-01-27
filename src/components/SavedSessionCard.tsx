import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SavedSession, useSavedSessionsStore } from "../store/savedSessionsStore";

interface SavedSessionCardProps {
  session: SavedSession;
  onResume: (session: SavedSession) => void;
  onView: (session: SavedSession) => void;
}

export default function SavedSessionCard({ session, onResume, onView }: SavedSessionCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { deleteSession } = useSavedSessionsStore();

  // Load thumbnail from first image
  useEffect(() => {
    if (session.imageOrder.length > 0) {
      invoke<string>("get_image_as_base64", { imagePath: session.imageOrder[0] })
        .then(setThumbnailUrl)
        .catch(() => setThumbnailUrl(null));
    }
  }, [session.imageOrder]);

  const handleDelete = async () => {
    setIsDeleting(true);
    await deleteSession(session.id);
    setIsDeleting(false);
    setShowDeleteConfirm(false);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const progress = session.currentImageIndex + 1;
  const total = session.totalImages;
  const progressPercent = (progress / total) * 100;
  const drawingCount = Object.keys(session.drawings).length;

  return (
    <div className="bg-dark-surface rounded-xl overflow-hidden group relative">
      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-dark-bg/95 z-10 flex flex-col items-center justify-center p-4">
          <p className="text-dark-text text-center mb-4">Delete this session?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-dark-accent hover:bg-dark-surface text-dark-text rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="h-32 bg-dark-bg relative overflow-hidden">
        {thumbnailUrl ? (
          <img 
            src={thumbnailUrl} 
            alt="Session preview" 
            className="w-full h-full object-cover opacity-60"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Progress overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-dark-bg/50">
          <div 
            className="h-full bg-blue-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="absolute top-2 right-2 w-8 h-8 bg-dark-bg/80 hover:bg-red-600 
                     rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 
                     transition-opacity"
          title="Delete session"
        >
          <svg className="w-4 h-4 text-dark-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-dark-text font-medium truncate mb-1" title={session.name}>
          {session.name}
        </h3>
        
        <div className="text-dark-muted text-xs space-y-1 mb-3">
          <p className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {session.folderName}
          </p>
          <p className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDate(session.lastAccessedAt)}
          </p>
        </div>

        <div className="flex items-center justify-between text-xs mb-3">
          <span className="text-dark-muted">
            Progress: <span className="text-dark-text">{progress}/{total}</span>
          </span>
          {drawingCount > 0 && (
            <span className="text-dark-muted">
              <span className="text-blue-400">{drawingCount}</span> drawings
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onView(session)}
            className="flex-1 px-3 py-2 bg-dark-accent hover:bg-dark-bg 
                       text-dark-text rounded-lg font-medium text-sm transition-colors
                       flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View
          </button>
          <button
            onClick={() => onResume(session)}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 
                       text-white rounded-lg font-medium text-sm transition-colors
                       flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}
