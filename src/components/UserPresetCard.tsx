import { useEffect, useRef, useState } from "react";
import type { Preset } from "../store/presetsStore";

export interface UserPresetCardProps {
  preset: Preset;
  onLoad: (preset: Preset) => void;
  onDelete: (id: string) => void;
  onRename: (preset: Preset) => void;
}

export function getSummary(preset: Preset): string {
  const s = preset.settings;
  const parts: string[] = [];

  parts.push(preset.mode === "image-curator" ? "Image Curator" : preset.mode);

  if (s.isTimedMode) {
    parts.push(
      s.timerDuration >= 60 ? `${s.timerDuration / 60}min` : `${s.timerDuration}s`,
    );
  } else {
    parts.push("Untimed");
  }

  if (s.imageCountMode === "all") {
    parts.push("All images");
  } else if (s.maxImages) {
    parts.push(`${s.maxImages} images`);
  }

  if (s.markupEnabled) {
    parts.push("✏️");
  }

  return parts.join(" • ");
}

export default function UserPresetCard({ preset, onLoad, onRename, onDelete }: UserPresetCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const handleDelete = () => {
    if (confirm("Delete this preset?")) {
      onDelete(preset.id);
    }
    setMenuOpen(false);
  };

  return (
    <div className="rounded-xl bg-dark-bg p-4 transition-colors hover:bg-dark-accent/20">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 flex-1 truncate font-medium text-dark-text">{preset.name}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onLoad(preset)}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 sm:px-4 sm:py-2"
          >
            Load
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-surface text-dark-text transition-colors hover:bg-dark-accent"
              aria-label="More actions"
            >
              <span className="select-none text-lg font-bold leading-none tracking-tight">···</span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-dark-accent/60 bg-dark-surface py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-dark-accent"
                  onClick={() => {
                    onRename(preset);
                    setMenuOpen(false);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-600/30"
                  onClick={handleDelete}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-1 text-xs text-dark-muted">{getSummary(preset)}</p>
    </div>
  );
}
