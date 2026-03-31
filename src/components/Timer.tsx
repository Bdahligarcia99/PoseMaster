import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSessionStore } from "../store/sessionStore";

type SessionTimerContextValue = {
  showTimer: boolean;
  isTimedMode: boolean;
  isOnBreak: boolean;
  isTimerPaused: boolean;
  progress: number;
  timeRemaining: number;
  breakTimeRemaining: number;
  toggleTimerPause: () => void;
  handleSkip: () => void;
  formatTime: (seconds: number) => string;
};

const SessionTimerContext = createContext<SessionTimerContextValue | null>(null);

function useSessionTimerContext(component: string): SessionTimerContextValue {
  const ctx = useContext(SessionTimerContext);
  if (!ctx) {
    throw new Error(`${component} must be used inside SessionTimerProvider`);
  }
  return ctx;
}

function useSessionTimerModel(): SessionTimerContextValue {
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

  const showTimer = isTimedMode && !timerHidden;

  useEffect(() => {
    if (!isOnBreak && isTimedMode) {
      setTimeRemaining(timerDuration);
      isAdvancingRef.current = false;
    }
  }, [timerDuration, currentImageIndex, isOnBreak, isTimedMode]);

  useEffect(() => {
    if (isOnBreak) {
      setBreakTimeRemaining(breakDuration);
    }
  }, [isOnBreak, breakDuration]);

  useEffect(() => {
    if (!isTimedMode || isTimerPaused || isOnBreak) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (isAdvancingRef.current) return timerDuration;
          isAdvancingRef.current = true;

          if (currentImageIndex >= images.length - 1) {
            setTimeout(() => endSession(), 0);
            return 0;
          }

          if (breakDuration > 0) {
            setTimeout(() => startBreak(), 0);
            return timerDuration;
          }

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

  useEffect(() => {
    if (!isTimedMode || !isOnBreak || isTimerPaused) return;

    const interval = setInterval(() => {
      setBreakTimeRemaining((prev) => {
        if (prev <= 1) {
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

  const handleSkip = useCallback(() => {
    if (isOnBreak) {
      endBreak();
      useSessionStore.getState().nextImage();
      isAdvancingRef.current = false;
      return;
    }

    if (currentImageIndex >= images.length - 1) {
      endSession();
      return;
    }

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

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const progress = useMemo(() => {
    if (isOnBreak) {
      if (breakDuration <= 0) return 0;
      return ((breakDuration - breakTimeRemaining) / breakDuration) * 100;
    }
    if (timerDuration <= 0) return 0;
    return ((timerDuration - timeRemaining) / timerDuration) * 100;
  }, [isOnBreak, breakDuration, breakTimeRemaining, timerDuration, timeRemaining]);

  return useMemo(
    () => ({
      showTimer,
      isTimedMode,
      isOnBreak,
      isTimerPaused,
      progress,
      timeRemaining,
      breakTimeRemaining,
      toggleTimerPause,
      handleSkip,
      formatTime,
    }),
    [
      showTimer,
      isTimedMode,
      isOnBreak,
      isTimerPaused,
      progress,
      timeRemaining,
      breakTimeRemaining,
      toggleTimerPause,
      handleSkip,
      formatTime,
    ]
  );
}

export function SessionTimerProvider({ children }: { children: ReactNode }) {
  const value = useSessionTimerModel();
  return <SessionTimerContext.Provider value={value}>{children}</SessionTimerContext.Provider>;
}

export function TimerProgressSection() {
  const { showTimer, isOnBreak, progress, timeRemaining, breakTimeRemaining, formatTime } =
    useSessionTimerContext("TimerProgressSection");

  if (!showTimer) {
    return <div className="flex-1" />;
  }

  return (
    <>
      {isOnBreak && <span className="text-sm font-medium text-yellow-400">BREAK</span>}
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-dark-surface">
        <div
          className={`h-full transition-[width] duration-200 ease-linear ${isOnBreak ? "bg-yellow-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span
        className={`min-w-[60px] text-right font-mono text-lg ${isOnBreak ? "text-yellow-400" : "text-dark-text"}`}
      >
        {isOnBreak ? formatTime(breakTimeRemaining) : formatTime(timeRemaining)}
      </span>
    </>
  );
}

export function TimerPauseControl() {
  const { isTimedMode, isTimerPaused, toggleTimerPause } = useSessionTimerContext("TimerPauseControl");

  if (!isTimedMode) return null;

  return (
    <button
      type="button"
      onClick={toggleTimerPause}
      className="rounded-lg bg-dark-surface p-2 transition-colors hover:bg-dark-accent"
      title={isTimerPaused ? "Resume" : "Pause"}
    >
      {isTimerPaused ? (
        <svg className="h-5 w-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
        </svg>
      )}
    </button>
  );
}

export function TimerSkipControl() {
  const { handleSkip } = useSessionTimerContext("TimerSkipControl");

  return (
    <button
      type="button"
      onClick={handleSkip}
      className="rounded-lg bg-dark-surface p-2 transition-colors hover:bg-dark-accent"
      title="Skip to next image"
    >
      <svg className="h-5 w-5 text-dark-text" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
      </svg>
    </button>
  );
}

export function useTimerReset() {
  const timerDuration = useSessionStore((state) => state.timerDuration);
  return { reset: () => {}, timerDuration };
}
