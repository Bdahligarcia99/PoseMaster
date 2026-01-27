import { useState, useEffect, useRef } from "react";
import { useSavedSessionsStore } from "../store/savedSessionsStore";

interface SaveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

export default function SaveSessionModal({ isOpen, onClose, onSave, defaultName }: SaveSessionModalProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { getNextSessionNumber } = useSavedSessionsStore();

  useEffect(() => {
    if (isOpen) {
      // Generate default name
      const sessionNum = getNextSessionNumber();
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      const generatedName = defaultName || `Session #${sessionNum} - ${dateStr} ${timeStr}`;
      setName(generatedName);
      
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultName, getNextSessionNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(name.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-dark-surface rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-dark-text mb-4">Save Session</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="sessionName" className="block text-dark-muted text-sm mb-2">
              Session Name
            </label>
            <input
              ref={inputRef}
              id="sessionName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter session name..."
              className="w-full px-4 py-3 bg-dark-bg border border-dark-accent rounded-lg 
                         text-dark-text placeholder-dark-muted
                         focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-dark-muted text-xs mt-2">
              Leave as-is for auto-generated name, or enter your own
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-dark-bg hover:bg-dark-accent 
                         text-dark-text rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 
                         text-white rounded-lg font-medium transition-colors"
            >
              Save Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
