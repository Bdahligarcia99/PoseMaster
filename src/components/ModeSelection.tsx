export type PracticeMode = "image-curator" | "free-draw" | "3d-perspective";

interface ModeConfig {
  id: PracticeMode;
  label: string;
  disabled: boolean;
  icon: React.ReactNode;
}

const MODES: ModeConfig[] = [
  {
    id: "image-curator",
    label: "Image Curator",
    disabled: false,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "free-draw",
    label: "Free Draw",
    disabled: true,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
  },
  {
    id: "3d-perspective",
    label: "3D & Perspective",
    disabled: true,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
];

interface ModeSelectionProps {
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}

export default function ModeSelection({ value, onChange }: ModeSelectionProps) {
  return (
    <div className="flex gap-4" role="group" aria-label="Practice mode selection">
      {MODES.map((mode) => {
        const isSelected = value === mode.id;
        const isDisabled = mode.disabled;

        return (
          <button
            key={mode.id}
            type="button"
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(mode.id)}
            aria-selected={isSelected}
            aria-disabled={isDisabled}
            className={`
              relative flex-1 flex flex-col items-center gap-2 p-6 rounded-xl
              border-2 transition-all duration-200 min-w-0
              ${isDisabled
                ? "bg-dark-surface/60 border-dark-accent/50 text-dark-muted cursor-not-allowed opacity-70"
                : isSelected
                  ? "bg-dark-surface border-blue-500 text-dark-text shadow-lg shadow-blue-500/20"
                  : "bg-dark-surface border-dark-accent text-dark-text hover:border-blue-500/60 hover:bg-dark-surface/90"
              }
            `}
          >
            {isDisabled && (
              <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-dark-muted/30 text-dark-muted rounded-md">
                Coming Soon
              </span>
            )}
            <span className={isDisabled ? "text-dark-muted" : "text-dark-text"}>
              {mode.icon}
            </span>
            <span className="text-sm font-medium text-center">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
}
