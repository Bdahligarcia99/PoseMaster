import { useState } from "react";
import { useSessionStore } from "../store/sessionStore";

const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "1 min", seconds: 60 },
  { label: "2 min", seconds: 120 },
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
];

export default function TimerPresets() {
  const { timerDuration, setTimerDuration } = useSessionStore();
  const [showCustom, setShowCustom] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [customSeconds, setCustomSeconds] = useState("");

  const handlePresetClick = (seconds: number) => {
    setTimerDuration(seconds);
    setShowCustom(false);
  };

  const handleCustomSubmit = () => {
    const mins = parseInt(customMinutes) || 0;
    const secs = parseInt(customSeconds) || 0;
    const totalSeconds = mins * 60 + secs;
    
    if (totalSeconds > 0) {
      setTimerDuration(totalSeconds);
      setShowCustom(false);
    }
  };

  const isPresetSelected = (seconds: number) => {
    return timerDuration === seconds && !showCustom;
  };

  const isCustomSelected = !PRESETS.some((p) => p.seconds === timerDuration);

  return (
    <div className="space-y-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {PRESETS.map((preset) => (
          <button
            key={preset.seconds}
            onClick={() => handlePresetClick(preset.seconds)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200
              ${
                isPresetSelected(preset.seconds)
                  ? "bg-blue-600 text-white"
                  : "bg-dark-surface text-dark-muted hover:bg-dark-accent hover:text-dark-text"
              }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200
            ${
              isCustomSelected || showCustom
                ? "bg-blue-600 text-white"
                : "bg-dark-surface text-dark-muted hover:bg-dark-accent hover:text-dark-text"
            }`}
        >
          Custom
        </button>
      </div>

      {/* Custom time input */}
      {showCustom && (
        <div className="flex items-center justify-center gap-2 p-3 bg-dark-surface rounded-lg">
          <input
            type="number"
            min="0"
            max="60"
            placeholder="Min"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            className="w-16 px-2 py-1 bg-dark-bg border border-dark-accent rounded 
                       text-dark-text text-center focus:outline-none focus:border-blue-500"
          />
          <span className="text-dark-muted">:</span>
          <input
            type="number"
            min="0"
            max="59"
            placeholder="Sec"
            value={customSeconds}
            onChange={(e) => setCustomSeconds(e.target.value)}
            className="w-16 px-2 py-1 bg-dark-bg border border-dark-accent rounded 
                       text-dark-text text-center focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCustomSubmit}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white font-medium"
          >
            Set
          </button>
        </div>
      )}
    </div>
  );
}
