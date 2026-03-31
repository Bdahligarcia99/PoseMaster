import type { Preset, PresetSettings } from "../store/presetsStore";

export interface PrebuiltPresetTileProps {
  preset: Preset;
  onSelect: (preset: Preset) => void;
}

/**
 * Total session length for timed + specific image count:
 * n images × timer + (n - 1) breaks.
 */
export function formatPresetEstimatedDuration(settings: PresetSettings): string | null {
  if (!settings.isTimedMode) {
    return "Untimed";
  }
  const n = settings.maxImages;
  if (n == null || n < 1) {
    return null;
  }
  const totalSec = n * settings.timerDuration + Math.max(0, n - 1) * settings.breakDuration;
  const totalMinutes = totalSec / 60;
  if (totalMinutes < 60) {
    const rounded = Math.max(1, Math.round(totalMinutes));
    return `~${rounded} min`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (m === 0) {
    return `~${h}h`;
  }
  return `~${h}h ${m}m`;
}

function formatImageTimer(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return m === 1 ? "1 min" : `${m} min`;
  }
  return `${seconds}s`;
}

export default function PrebuiltPresetTile({ preset, onSelect }: PrebuiltPresetTileProps) {
  const { settings } = preset;
  const durationLabel = formatPresetEstimatedDuration(settings);
  const imageTimer = formatImageTimer(settings.timerDuration);
  const breakLabel =
    settings.breakDuration > 0 ? `+${settings.breakDuration}s breaks` : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      className="w-full text-left rounded-xl border border-dark-accent/50 bg-dark-surface p-4
                 transition-colors hover:bg-dark-accent hover:border-dark-accent
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg"
    >
      <div className="font-semibold text-lg text-dark-text">{preset.name}</div>
      {durationLabel && (
        <div className="mt-1 text-sm text-dark-muted">{durationLabel}</div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dark-muted">
        <span className="rounded-md bg-dark-bg/80 px-2 py-0.5 text-dark-text">{imageTimer}</span>
        {breakLabel && (
          <>
            <span className="text-dark-muted/80" aria-hidden>
              •
            </span>
            <span className="rounded-md bg-dark-bg/80 px-2 py-0.5 text-dark-text">{breakLabel}</span>
          </>
        )}
        {settings.markupEnabled && (
          <>
            <span className="text-dark-muted/80" aria-hidden>
              •
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md bg-dark-bg/80 px-2 py-0.5 text-green-400"
              title="Markup enabled"
            >
              <span aria-hidden>✏️</span>
              <span>Markup</span>
            </span>
          </>
        )}
      </div>
    </button>
  );
}
