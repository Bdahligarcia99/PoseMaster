import { useEffect, useRef, useState } from "react";

export interface SavePresetDialogProps {
  isOpen: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export default function SavePresetDialog({ isOpen, onSave, onSkip, onCancel }: SavePresetDialogProps) {
  const [step, setStep] = useState<"ask" | "name">("ask");
  const [presetName, setPresetName] = useState("");
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (isOpen) {
      setStep("ask");
      setPresetName(`Preset ${new Date().toLocaleDateString()}`);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveClick = () => {
    const name = presetName.trim();
    if (name) onSave(name);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={step === "ask" ? "save-preset-ask-title" : "save-preset-name-title"}
        className="mx-4 w-full max-w-md rounded-xl border border-dark-accent bg-dark-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "ask" ? (
          <>
            <h3 id="save-preset-ask-title" className="mb-2 text-lg font-semibold text-dark-text">
              Save as Preset?
            </h3>
            <p className="mb-6 text-sm text-dark-muted">
              Would you like to save these settings as a preset for quick access later?
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg bg-dark-accent px-4 py-2 font-medium text-dark-text transition-colors hover:bg-dark-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="rounded-lg border border-dark-accent bg-dark-bg px-4 py-2 font-medium text-dark-text transition-colors hover:bg-dark-accent"
              >
                Just Start
              </button>
              <button
                type="button"
                onClick={() => setStep("name")}
                className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
              >
                Yes, Save
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 id="save-preset-name-title" className="mb-4 text-lg font-semibold text-dark-text">
              Name Your Preset
            </h3>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSaveClick();
                }
              }}
              className="mb-4 w-full rounded-lg border border-dark-accent bg-dark-bg px-3 py-2 text-dark-text placeholder-dark-muted
                         focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg bg-dark-accent px-4 py-2 font-medium text-dark-text transition-colors hover:bg-dark-bg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={!presetName.trim()}
                className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save & Start
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
