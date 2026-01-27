import { Component, ErrorInfo, ReactNode, useState } from "react";
import { useSessionStore } from "./store/sessionStore";
import FolderPicker from "./components/FolderPicker";
import SessionSetup from "./components/SessionSetup";
import SessionView from "./components/SessionView";
import SessionSummary from "./components/SessionSummary";
import SessionGallery from "./components/SessionGallery";
import SplashScreen from "./components/SplashScreen";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center p-8">
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-lg">
            <h1 className="text-red-300 text-xl font-bold mb-2">Something went wrong</h1>
            <pre className="text-red-200 text-sm whitespace-pre-wrap overflow-auto">
              {this.state.error?.message}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const { images, isSessionActive, isSessionEnded, isViewingGallery, isInSetup } = useSessionStore();

  // Show splash screen on app launch
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} duration={2500} />;
  }

  // Show gallery view for saved sessions
  if (isViewingGallery) {
    return <SessionGallery />;
  }

  // Show session summary when session has ended
  if (isSessionEnded) {
    return <SessionSummary />;
  }

  // Show session view when we have images and session is active
  if (images.length > 0 && isSessionActive) {
    return <SessionView />;
  }

  // Show setup screen before session starts
  if (isInSetup) {
    return <SessionSetup />;
  }

  // Default: show folder picker / start screen
  return <FolderPicker />;
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
