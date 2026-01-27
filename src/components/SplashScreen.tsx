import { useState, useEffect } from "react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export default function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out slightly before the duration ends
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, duration - 500);

    // Complete after full duration
    const completeTimer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [duration, onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-dark-bg flex flex-col items-center justify-center z-50 transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* App Icon with subtle animation */}
      <div className="relative">
        <img
          src="/app-icon.png"
          alt="PoseMaster"
          className="w-32 h-32 rounded-3xl shadow-2xl animate-pulse"
          style={{ animationDuration: "2s" }}
        />
        {/* Subtle glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl -z-10 scale-150" />
      </div>

      {/* App Name */}
      <h1 className="text-3xl font-bold text-dark-text mt-6">PoseMaster</h1>
      
      {/* Tagline */}
      <p className="text-dark-muted text-sm mt-2">Gesture Drawing Practice</p>

      {/* Loading indicator */}
      <div className="mt-8 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "0ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
