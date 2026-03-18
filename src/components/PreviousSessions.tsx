import { useState } from "react";
import { useSavedSessionsStore, SavedSession } from "../store/savedSessionsStore";
import { ViewedImage } from "../store/sessionStore";
import ExportOptionsModal from "./ExportOptionsModal";

interface PreviousSessionsProps {
  onBack: () => void;
  onView: (session: SavedSession) => void;
  embedded?: boolean; // When true, used inside tab (compact layout)
}

export default function PreviousSessions({ onBack, onView, embedded = false }: PreviousSessionsProps) {
  const { sessions, deleteSession } = useSavedSessionsStore();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSession, setExportSession] = useState<SavedSession | null>(null);

  // Convert saved session to ViewedImage array for export (handles sessions with/without drawings)
  const getViewedImagesFromSession = (session: SavedSession): ViewedImage[] => {
    const drawings = session.drawings || {};
    return session.imageOrder.map((path) => {
      const drawing = drawings[path];
      return {
        path,
        viewedAt: drawing?.savedAt || session.createdAt,
        drawingData: drawing?.drawingData || null,
        hasMarkup: drawing ? drawing.drawingData.lines.length > 0 : false,
      };
    });
  };

  const handleExport = (session: SavedSession) => {
    setExportSession(session);
    setShowExportModal(true);
  };

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this session? This cannot be undone.")) {
      await deleteSession(sessionId);
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className={embedded ? "overflow-y-auto" : "min-h-screen bg-dark-bg overflow-y-auto"}>
      <div className={`flex flex-col items-center ${embedded ? "p-4" : "p-6"}`}>
        <div className={`w-full space-y-6 ${embedded ? "max-w-full" : "max-w-4xl"}`}>
          {/* Header */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 text-dark-muted hover:text-dark-text 
                         hover:bg-dark-surface rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-dark-text">Previous Sessions</h1>
              <p className="text-dark-muted text-sm">
                {sessions.length} saved session{sessions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Sessions List */}
          {sessions.length === 0 ? (
            <div className="bg-dark-surface rounded-xl p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-dark-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-dark-text font-medium mb-2">No Saved Sessions</h3>
              <p className="text-dark-muted text-sm">
                Your saved sessions will appear here. Start a practice session and save it to see it here!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const imageCount = session.imageOrder.length;

                return (
                  <div
                    key={session.id}
                    className="bg-dark-surface rounded-xl p-4 hover:bg-dark-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Session Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-dark-text font-semibold text-lg truncate">
                          {session.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-dark-muted text-sm">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(session.createdAt)} at {formatTime(session.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {imageCount} image{imageCount !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                            {session.folderName}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => onView(session)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white 
                                     font-medium text-sm transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </button>
                        <button
                          onClick={() => handleExport(session)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white 
                                     font-medium text-sm transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          Export
                        </button>
                        <button
                          onClick={(e) => handleDelete(session.id, e)}
                          className="px-4 py-2 bg-dark-bg hover:bg-red-600/50 rounded-lg text-dark-muted 
                                     hover:text-red-300 font-medium text-sm transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      {exportSession && (
        <ExportOptionsModal
          isOpen={showExportModal}
          onClose={() => {
            setShowExportModal(false);
            setExportSession(null);
          }}
          viewedImages={getViewedImagesFromSession(exportSession)}
          selectedImages={new Set(exportSession.imageOrder)}
          imageOpacity={exportSession.settings.imageOpacity}
          folderPath={exportSession.folderPath}
          sessionName={exportSession.name}
        />
      )}
    </div>
  );
}
