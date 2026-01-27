import { create } from "zustand";
import { BrushType } from "./drawingStore";

export interface DrawingData {
  lines: Array<{
    points: number[];
    color: string;
    strokeWidth: number;
    tool: BrushType;
  }>;
  // Canvas dimensions at time of drawing (for proper scaling when viewing)
  canvasWidth?: number;
  canvasHeight?: number;
}

export interface ViewedImage {
  path: string;
  viewedAt: number;
  drawingData: DrawingData | null;
  hasMarkup: boolean;
}

// For resuming saved sessions
export interface ResumedSessionData {
  id: string;
  name: string;
  imageOrder: string[];
  currentIndex: number;
  drawings: Record<string, { drawingData: DrawingData; savedAt: number }>;
  settings: {
    timerDuration: number;
    breakDuration: number;
    imageOpacity: number;
  };
}

interface SessionState {
  // Folder and images
  folderPath: string | null;
  folderName: string | null;
  allImages: string[]; // All images from folder
  images: string[]; // Images for current session (may be limited)
  currentImageIndex: number;
  maxImages: number | null; // Limit for session
  
  // Session state
  isSessionActive: boolean;
  isSessionEnded: boolean;
  isInSetup: boolean; // Pre-session setup screen
  isViewingGallery: boolean; // Gallery view mode for saved sessions
  isViewingOnly: boolean; // True when viewing saved session without resuming (from Previous Sessions "View")
  returnToPreviousSessions: boolean; // Flag to tell FolderPicker to show Previous Sessions on mount
  galleryIndex: number; // Current image in gallery view
  viewedImages: ViewedImage[];
  
  // Resumed session tracking
  resumedSessionId: string | null;
  resumedSessionName: string | null;
  
  // Timer settings
  timerDuration: number; // in seconds
  breakDuration: number; // break between images in seconds
  isTimerPaused: boolean;
  isOnBreak: boolean; // true when showing break countdown
  
  // Image settings
  imageOpacity: number; // 0-100 percentage
  imageZoom: number; // 10-100 percentage (100 = fill viewport)
  
  // Drawing settings
  eraserDisabled: boolean; // Disable eraser tool
  
  // Display settings
  timerHidden: boolean; // Hide timer during session
  
  // Drawing state for current image
  currentDrawingData: DrawingData;
  
  // Actions
  setFolderPath: (path: string) => void;
  setFolderName: (name: string) => void;
  setImages: (images: string[]) => void;
  setMaxImages: (count: number | null) => void;
  enterSetup: () => void;
  exitSetup: () => void;
  startSession: (options?: { excludePath?: string; includeFirstPath?: string }) => void;
  resumeSession: (data: ResumedSessionData) => void;
  viewSession: (data: ResumedSessionData) => void;
  endSession: () => void;
  resetSession: () => void;
  
  // Gallery view actions
  setGalleryIndex: (index: number) => void;
  exitGallery: (returnToPreviousSessions?: boolean) => void;
  clearReturnToPreviousSessions: () => void;
  
  nextImage: () => void;
  previousImage: () => void;
  skipCurrentImage: () => void;
  startBreak: () => void;
  endBreak: () => void;
  
  setTimerDuration: (seconds: number) => void;
  setBreakDuration: (seconds: number) => void;
  setImageOpacity: (opacity: number) => void;
  setImageZoom: (zoom: number) => void;
  setEraserDisabled: (disabled: boolean) => void;
  setTimerHidden: (hidden: boolean) => void;
  toggleTimerPause: () => void;
  
  updateCurrentDrawing: (data: DrawingData) => void;
  saveCurrentImageDrawing: () => void;
  clearCurrentDrawing: () => void;
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

const initialDrawingData: DrawingData = { lines: [] };

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  folderPath: null,
  folderName: null,
  allImages: [],
  images: [],
  currentImageIndex: 0,
  maxImages: null,
  isSessionActive: false,
  isSessionEnded: false,
  isInSetup: false,
  isViewingGallery: false,
  isViewingOnly: false,
  returnToPreviousSessions: false,
  galleryIndex: 0,
  viewedImages: [],
  resumedSessionId: null,
  resumedSessionName: null,
  timerDuration: 30, // default 30 seconds
  breakDuration: 3, // default 3 second break between images
  imageOpacity: 100, // default full opacity
  imageZoom: 100, // default full size
  eraserDisabled: false, // default eraser enabled
  timerHidden: false, // default timer visible
  isTimerPaused: false,
  isOnBreak: false,
  currentDrawingData: { ...initialDrawingData },

  // Actions
  setFolderPath: (path) => set({ folderPath: path }),
  
  setFolderName: (name) => set({ folderName: name }),
  
  setImages: (images) => {
    const shuffled = shuffleArray(images);
    set({ allImages: shuffled, images: shuffled });
  },
  
  setMaxImages: (count) => set({ maxImages: count }),
  
  enterSetup: () => set({ isInSetup: true }),
  
  exitSetup: () => set({ isInSetup: false }),
  
  startSession: (options?: { excludePath?: string; includeFirstPath?: string }) => {
    const state = get();
    const { excludePath, includeFirstPath } = options || {};
    
    // Filter out the excluded image if provided
    let availableImages = state.allImages;
    if (excludePath) {
      availableImages = state.allImages.filter(img => img !== excludePath);
    }
    
    const maxCount = state.maxImages;
    let sessionImages = maxCount && maxCount < availableImages.length
      ? availableImages.slice(0, maxCount)
      : availableImages;
    
    // If includeFirstPath is set, ensure it's at the beginning
    if (includeFirstPath) {
      // Remove it from wherever it is
      sessionImages = sessionImages.filter(img => img !== includeFirstPath);
      // Add it to the front
      sessionImages = [includeFirstPath, ...sessionImages];
      // Trim back to maxCount if needed
      if (maxCount && sessionImages.length > maxCount) {
        sessionImages = sessionImages.slice(0, maxCount);
      }
    }
    
    // Preserve current drawing data if includeFirstPath is set (keeping practice drawings)
    const preserveDrawing = includeFirstPath && state.currentDrawingData.lines.length > 0;
    
    set({ 
      images: sessionImages,
      isSessionActive: true, 
      isSessionEnded: false,
      isInSetup: false,
      isOnBreak: false,
      viewedImages: preserveDrawing ? [{
        path: includeFirstPath,
        viewedAt: Date.now(),
        drawingData: state.currentDrawingData,
        hasMarkup: true,
      }] : [],
      currentImageIndex: 0,
      currentDrawingData: preserveDrawing ? state.currentDrawingData : { lines: [] },
      isTimerPaused: false,
      resumedSessionId: null,
      resumedSessionName: null,
    });
  },
  
  resumeSession: (data) => {
    // Convert saved drawings to viewedImages format
    const viewedImages: ViewedImage[] = Object.entries(data.drawings).map(([path, drawing]) => ({
      path,
      viewedAt: drawing.savedAt,
      drawingData: drawing.drawingData,
      hasMarkup: drawing.drawingData.lines.length > 0,
    }));
    
    // Get drawing for current image if it exists
    const currentImagePath = data.imageOrder[data.currentIndex];
    const currentDrawing = data.drawings[currentImagePath];
    
    set({
      images: data.imageOrder,
      allImages: data.imageOrder,
      currentImageIndex: data.currentIndex,
      isSessionActive: true,
      isSessionEnded: false,
      isOnBreak: false,
      viewedImages,
      currentDrawingData: currentDrawing?.drawingData || { lines: [] },
      isTimerPaused: false,
      resumedSessionId: data.id,
      resumedSessionName: data.name,
      timerDuration: data.settings.timerDuration,
      breakDuration: data.settings.breakDuration,
      imageOpacity: data.settings.imageOpacity,
      maxImages: data.imageOrder.length,
    });
  },
  
  viewSession: (data) => {
    // Convert saved drawings to viewedImages format (all images that have drawings)
    const viewedImages: ViewedImage[] = data.imageOrder.map((path) => {
      const drawing = data.drawings[path];
      return {
        path,
        viewedAt: drawing?.savedAt || Date.now(),
        drawingData: drawing?.drawingData || null,
        hasMarkup: drawing ? drawing.drawingData.lines.length > 0 : false,
      };
    });
    
    set({
      images: data.imageOrder,
      allImages: data.imageOrder,
      currentImageIndex: data.currentIndex,
      isSessionActive: false,
      isSessionEnded: false,
      isViewingGallery: true, // Go to gallery view
      isViewingOnly: true, // Just viewing, not from a completed session
      galleryIndex: 0, // Start at first image
      isOnBreak: false,
      viewedImages,
      currentDrawingData: { lines: [] },
      isTimerPaused: false,
      resumedSessionId: data.id,
      resumedSessionName: data.name,
      folderPath: null,
      folderName: null,
      timerDuration: data.settings.timerDuration,
      breakDuration: data.settings.breakDuration,
      imageOpacity: data.settings.imageOpacity,
      maxImages: data.imageOrder.length,
    });
  },
  
  endSession: () => {
    const state = get();
    // Save current image drawing before ending
    if (state.images.length > 0) {
      const currentImage = state.images[state.currentImageIndex];
      const hasMarkup = state.currentDrawingData.lines.length > 0;
      
      // Check if already in viewed images
      const existingIndex = state.viewedImages.findIndex(v => v.path === currentImage);
      
      let updatedViewed = [...state.viewedImages];
      if (existingIndex >= 0) {
        updatedViewed[existingIndex] = {
          ...updatedViewed[existingIndex],
          drawingData: hasMarkup ? state.currentDrawingData : updatedViewed[existingIndex].drawingData,
          hasMarkup: hasMarkup || updatedViewed[existingIndex].hasMarkup,
        };
      } else {
        updatedViewed.push({
          path: currentImage,
          viewedAt: Date.now(),
          drawingData: hasMarkup ? state.currentDrawingData : null,
          hasMarkup,
        });
      }
      
      set({ 
        isSessionActive: false, 
        isSessionEnded: true,
        viewedImages: updatedViewed,
      });
    } else {
      set({ isSessionActive: false, isSessionEnded: true });
    }
  },
  
  resetSession: () => set({
    folderPath: null,
    folderName: null,
    allImages: [],
    images: [],
    currentImageIndex: 0,
    maxImages: null,
    isSessionActive: false,
    isSessionEnded: false,
    isInSetup: false,
    isViewingGallery: false,
    isViewingOnly: false,
    returnToPreviousSessions: false,
    galleryIndex: 0,
    isOnBreak: false,
    viewedImages: [],
    currentDrawingData: { lines: [] },
    isTimerPaused: false,
    resumedSessionId: null,
    resumedSessionName: null,
  }),
  
  // Gallery view actions
  setGalleryIndex: (index) => set({ galleryIndex: index }),
  
  exitGallery: (returnToPreviousSessions = false) => set({
    isViewingGallery: false,
    isViewingOnly: false,
    returnToPreviousSessions,
    galleryIndex: 0,
    images: [],
    viewedImages: [],
    resumedSessionId: null,
    resumedSessionName: null,
  }),
  
  clearReturnToPreviousSessions: () => set({ returnToPreviousSessions: false }),
  
  startBreak: () => set({ isOnBreak: true }),
  
  endBreak: () => set({ isOnBreak: false }),
  
  nextImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    
    // Save current drawing before moving
    const currentImage = state.images[state.currentImageIndex];
    const hasMarkup = state.currentDrawingData.lines.length > 0;
    
    const existingIndex = state.viewedImages.findIndex(v => v.path === currentImage);
    let updatedViewed = [...state.viewedImages];
    
    if (existingIndex >= 0) {
      updatedViewed[existingIndex] = {
        ...updatedViewed[existingIndex],
        drawingData: hasMarkup ? state.currentDrawingData : updatedViewed[existingIndex].drawingData,
        hasMarkup: hasMarkup || updatedViewed[existingIndex].hasMarkup,
      };
    } else {
      updatedViewed.push({
        path: currentImage,
        viewedAt: Date.now(),
        drawingData: hasMarkup ? state.currentDrawingData : null,
        hasMarkup,
      });
    }
    
    const nextIndex = (state.currentImageIndex + 1) % state.images.length;
    
    // Check if next image was already viewed and has drawing data
    const nextImageViewed = updatedViewed.find(v => v.path === state.images[nextIndex]);
    
    set({
      currentImageIndex: nextIndex,
      viewedImages: updatedViewed,
      currentDrawingData: nextImageViewed?.drawingData || { lines: [] },
    });
  },
  
  previousImage: () => {
    const state = get();
    if (state.images.length === 0) return;
    
    const prevIndex = state.currentImageIndex === 0 
      ? state.images.length - 1 
      : state.currentImageIndex - 1;
    
    // Check if prev image was already viewed and has drawing data
    const prevImageViewed = state.viewedImages.find(v => v.path === state.images[prevIndex]);
    
    set({
      currentImageIndex: prevIndex,
      currentDrawingData: prevImageViewed?.drawingData || { lines: [] },
    });
  },
  
  skipCurrentImage: () => {
    const state = get();
    if (state.images.length <= 1) {
      // Can't skip if only one image left, end session instead
      get().endSession();
      return;
    }
    
    const currentImage = state.images[state.currentImageIndex];
    
    // Remove current image from session
    const newImages = state.images.filter((_, idx) => idx !== state.currentImageIndex);
    
    // Remove from viewedImages if present
    const newViewedImages = state.viewedImages.filter(v => v.path !== currentImage);
    
    // Adjust currentImageIndex if needed
    let newIndex = state.currentImageIndex;
    if (newIndex >= newImages.length) {
      newIndex = newImages.length - 1;
    }
    
    // Get drawing data for new current image if it was viewed before
    const newCurrentImage = newImages[newIndex];
    const newCurrentViewed = newViewedImages.find(v => v.path === newCurrentImage);
    
    set({
      images: newImages,
      viewedImages: newViewedImages,
      currentImageIndex: newIndex,
      currentDrawingData: newCurrentViewed?.drawingData || { lines: [] },
    });
  },
  
  setTimerDuration: (seconds) => set({ timerDuration: seconds }),
  
  setBreakDuration: (seconds) => set({ breakDuration: seconds }),
  
  setImageOpacity: (opacity) => set({ imageOpacity: Math.max(0, Math.min(100, opacity)) }),
  
  setImageZoom: (zoom) => set({ imageZoom: Math.max(10, Math.min(100, zoom)) }),
  
  setEraserDisabled: (disabled) => set({ eraserDisabled: disabled }),
  
  setTimerHidden: (hidden) => set({ timerHidden: hidden }),
  
  toggleTimerPause: () => set((state) => ({ isTimerPaused: !state.isTimerPaused })),
  
  updateCurrentDrawing: (data) => set({ currentDrawingData: data }),
  
  saveCurrentImageDrawing: () => {
    const state = get();
    if (state.images.length === 0) return;
    
    const currentImage = state.images[state.currentImageIndex];
    const hasMarkup = state.currentDrawingData.lines.length > 0;
    
    const existingIndex = state.viewedImages.findIndex(v => v.path === currentImage);
    let updatedViewed = [...state.viewedImages];
    
    if (existingIndex >= 0) {
      updatedViewed[existingIndex] = {
        ...updatedViewed[existingIndex],
        drawingData: state.currentDrawingData,
        hasMarkup,
      };
    } else {
      updatedViewed.push({
        path: currentImage,
        viewedAt: Date.now(),
        drawingData: state.currentDrawingData,
        hasMarkup,
      });
    }
    
    set({ viewedImages: updatedViewed });
  },
  
  clearCurrentDrawing: () => set({ currentDrawingData: { lines: [] } }),
}));
