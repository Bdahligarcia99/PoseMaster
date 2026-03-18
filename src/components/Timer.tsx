import { useEffect, useState, useCallback, useRef } from "react";
import { useSessionStore } from "../store/sessionStore";

export default function Timer() {
  const isTimedMode = useSessionStore((state) => state.isTimedMode);
  const timerDuration = useSessionStore((state) => state.timerDuration);
  const breakDuration = useSessionStore((state) => state.breakDuration);
  const isTimerPaused = useSessionStore((state) => state.isTimerPaused);
  const isOnBreak = useSessionStore((state) => state.isOnBreak);
  const timerHidden = useSessionStore((state) => state.timerHidden);
  const toggleTimerPause = useSessionStore((state) => state.toggleTimerPause);
  const currentImageIndex = useSessionStore((state) => state.currentImageIndex);
  const images = useSessionStore((state) => state.images);
  const endSession = useSessionStore((state) => state.endSession);
  const startBreak = useSessionStore((state) => state.startBreak);
  const endBreak = useSessionStore((state) => state.endBreak);
  
  const [timeRemaining, setTimeRemaining] = useState(timerDuration);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(breakDuration);
  const isAdvancingRef = useRef(false);

  // Untimed mode: no countdown, user advances manually
  const showTimer = isTimedMode && !timerHidden;

  // Reset timer when image changes (not during break)
  useEffect(() => {
    if (!isOnBreak && isTimedMode) {
      setTimeRemaining(timerDuration);
      isAdvancingRef.current = false;
    }
  }, [timerDuration, currentImageIndex, isOnBreak, isTimedMode]);

  // Reset break timer when break starts
  useEffect(() => {
    if (isOnBreak) {
      setBreakTimeRemaining(breakDuration);
    }
  }, [isOnBreak, breakDuration]);

  // Main image timer countdown (skip when untimed)
  useEffect(() => {
    if (!isTimedMode || isTimerPaused || isOnBreak) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Prevent double-advance
          if (isAdvancingRef.current) return timerDuration;
          isAdvancingRef.current = true;
          
          // Check if this is the last image
          if (currentImageIndex >= images.length - 1) {
            // End session
            setTimeout(() => endSession(), 0);
            return 0;
          }
          
          // Time's up - start break if break duration > 0
          if (breakDuration > 0) {
            setTimeout(() => startBreak(), 0);
            return timerDuration;
          }
          
          // No break, advance to next image immediately
          setTimeout(() => {
            useSessionStore.getState().nextImage();
          }, 0);
          return timerDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimedMode, isTimerPaused, isOnBreak, timerDuration, breakDuration, currentImageIndex, images.length, endSession, startBreak]);

  // Break countdown (only in timed mode)
  useEffect(() => {
    if (!isTimedMode || !isOnBreak || isTimerPaused) return;

    const interval = setInterval(() => {
      setBreakTimeRemaining((prev) => {
        if (prev <= 1) {
          // Break is over, advance to next image
          setTimeout(() => {
            endBreak();
            useSessionStore.getState().nextImage();
            isAdvancingRef.current = false;
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimedMode, isOnBreak, isTimerPaused, endBreak]);

  // Reset timer when manually skipping
  const handleSkip = useCallback(() => {
    // If on break, skip the break
    if (isOnBreak) {
      endBreak();
      useSessionStore.getState().nextImage();
      isAdvancingRef.current = false;
      return;
    }

    // Check if this is the last image
    if (currentImageIndex >= images.length - 1) {
      endSession();
      return;
    }

    // Untimed: always advance immediately. Timed: start break if enabled, else advance
    if (!isTimedMode) {
      useSessionStore.getState().nextImage();
      return;
    }
    if (breakDuration > 0) {
      startBreak();
    } else {
      useSessionStore.getState().nextImage();
    }
    setTimeRemaining(timerDuration);
  }, [isTimedMode, timerDuration, breakDuration, currentImageIndex, images.length, endSession, isOnBreak, startBreak, endBreak]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  // During image: fills up from 0% to 100%
  // During break: empties from 100% back to 0%
  const progress = isOnBreak 
    ? (breakTimeRemaining / breakDuration) * 100  // Goes from 100% down to 0%
    : ((timerDuration - timeRemaining) / timerDuration) * 100;  // Goes from 0% up to 100%

  return (
    <div className="flex items-center gap-4">
      {/* Break indicator - only show if timer is visible */}
      {showTimer && isOnBreak && (
        <span className="text-yellow-400 font-medium text-sm">BREAK</span>
      )}
      
      {/* Progress bar - hide if timer hidden or untimed */}
      {showTimer && (
        <div className="flex-1 h-2 bg-dark-surface rounded-full overflow-hidden">
          <div
            className={`h-full ${isOnBreak ? "bg-yellow-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Time display - hide if timer hidden or untimed */}
      {showTimer && (
        <span className={`font-mono text-lg min-w-[60px] text-right ${
          isOnBreak ? "text-yellow-400" : "text-dark-text"
        }`}>
          {isOnBreak ? formatTime(breakTimeRemaining) : formatTime(timeRemaining)}
        </span>
      )}

      {/* Spacer when timer is hidden or untimed to push buttons to the right */}
      {!showTimer && <div className="flex-1" />}

      {/* Pause/Resume button - only in timed mode */}
      {isTimedMode && (
      <button
        onClick={toggleTimerPause}
        className="p-2 rounded-lg bg-dark-surface hover:bg-dark-accent transition-colors"
        title={isTimerPaused ? "Resume" : "Pause"}
      >
        {isTimerPaused ? (
          <svg className="w-5 h-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        )}
      </button>
      )}

      {/* Skip / Next button */}
      <button
        onClick={handleSkip}
        className="p-2 rounded-lg bg-dark-surface hover:bg-dark-accent transition-colors"
        title="Skip to next image"
      >
        <svg className="w-5 h-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}

// Export a hook for external timer reset
export function useTimerReset() {
  const timerDuration = useSessionStore((state) => state.timerDuration);
  return { reset: () => {}, timerDuration };
}
