import { create } from "zustand";
import { BrushType, HistoryState, useDrawingStore } from "./drawingStore";

export interface SessionImage {
  path: string;
  sourceType: "local" | "url-stream" | "url-cached";
  collectionId?: string;
  originalUrl?: string;
}

/** Persistence key for saving sessions - use originalUrl for url-cached, else path */
export function getPersistencePath(img: SessionImage): string {
  return img.originalUrl ?? img.path;
}

export type ActiveSplitCanvas = "curator" | "freeDraw";

/** Per-image guide lines: X in image/canvas space for verticals, Y for horizontals. */
export interface ImageGuidelinesData {
  vertical: number[];
  horizontal: number[];
}

/** Store key for Practice-pane guidelines in split mode (distinct from curator guides). */
export function getFreeDrawGuidelinesKey(imagePath: string): string {
  return `${imagePath}-freeDraw`;
}

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
  /** Practice-pane strokes in split mode (saved / gallery). */
  freeDrawData?: DrawingData | null;
  hasMarkup: boolean;
}

// For viewing saved sessions (gallery)
export interface ViewSessionData {
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
  curatorDrawings?: Record<string, DrawingData>;
  freeDrawDrawings?: Record<string, DrawingData>;
  imageGuidelines?: Record<string, ImageGuidelinesData>;
  isSplitScreen?: boolean;
  splitSidesSwapped?: boolean;
}

interface SessionState {
  // Folder and images
  folderPath: string | null; // Legacy single folder (kept for compatibility)
  folderPaths: string[]; // Multiple folder paths
  folderName: string | null; // Legacy single folder name
  folderNames: string[]; // Multiple folder names
  allImages: SessionImage[]; // All images from sources
  images: SessionImage[]; // Images for current session (may be limited)
  currentImageIndex: number;
  maxImages: number | null; // Limit for session
  
  // Session state
  isSessionActive: boolean;
  isSessionEnded: boolean;
  isInSetup: boolean; // Pre-session setup screen
  isViewingGallery: boolean; // Gallery view mode for saved sessions
  isViewingOnly: boolean; // True when viewing saved session (from Previous Sessions "View")
  isBrowsingGallery: boolean; // True when browsing current folder selection (no session)
  returnToPreviousSessions: boolean; // Flag to tell FolderPicker to show Previous Sessions on mount
  galleryIndex: number; // Current image in gallery view
  viewedImages: ViewedImage[];
  
  // Viewed session tracking (when viewing from Previous Sessions)
  viewedSessionId: string | null;
  viewedSessionName: string | null;
  
  // Timer settings
  isTimedMode: boolean; // true = Timed (timer + breaks), false = Untimed (manual advance)
  isTimedSession: boolean; // alias for isTimedMode, controls timed vs untimed session behavior
  timerDuration: number; // in seconds
  breakDuration: number; // break between images in seconds
  isTimerPaused: boolean;
  isOnBreak: boolean; // true when showing break countdown
  
  // Image settings
  imageOpacity: number; // 0-100 percentage
  imageZoom: number; // 10-200 percentage (100 = fill viewport)
  
  // Drawing settings
  markupEnabled: boolean; // Enable drawing tools during session
  eraserDisabled: boolean; // Disable eraser, undo, clear (when markup enabled)
  
  // Display settings
  timerHidden: boolean; // Hide timer during session

  // Split screen (Image Curator + Free Draw)
  isSplitScreen: boolean;
  activeCanvas: ActiveSplitCanvas;
  splitSidesSwapped: boolean;
  /** Path of the random setup preview image (for split-layer clear / save). */
  setupPreviewImagePath: string | null;
  /** Overlay Practice strokes on Image Curator (split screen compare). */
  isCompareMode: boolean;
  /** Compare overlay visibility 10–100 (%). */
  compareOverlayOpacity: number;

  // Drawing state for current image
  currentDrawingData: DrawingData;

  /** Split mode: curator layer per image path */
  curatorDrawings: Record<string, DrawingData>;
  /** Split mode: free-draw layer per image path */
  freeDrawDrawings: Record<string, DrawingData>;

  /** Alignment guides per reference image path */
  imageGuidelines: Record<string, ImageGuidelinesData>;

  // Per-image undo history (keyed by image path)
  imageHistories: Record<string, HistoryState>;
  
  // Actions
  setFolderPath: (path: string) => void;
  setFolderPaths: (paths: string[]) => void;
  setFolderName: (name: string) => void;
  setFolderNames: (names: string[]) => void;
  setImages: (images: SessionImage[]) => void;
  setMaxImages: (count: number | null) => void;
  enterSetup: () => void;
  exitSetup: () => void;
  startSession: (options?: { excludePath?: string; includeFirstPath?: string }) => void;
  getPersistencePath: (displayPath: string) => string;
  viewSession: (data: ViewSessionData) => void;
  endSession: () => void;
  resetSession: () => void;
  
  // Gallery view actions
  setGalleryIndex: (index: number) => void;
  exitGallery: (returnToPreviousSessions?: boolean) => void;
  enterBrowseMode: () => void;
  exitBrowseMode: () => void;
  clearReturnToPreviousSessions: () => void;
  
  nextImage: () => void;
  previousImage: () => void;
  skipCurrentImage: () => void;
  startBreak: () => void;
  endBreak: () => void;
  
  setTimedMode: (timed: boolean) => void;
  setTimerDuration: (seconds: number) => void;
  setBreakDuration: (seconds: number) => void;
  setImageOpacity: (opacity: number) => void;
  setImageZoom: (zoom: number) => void;
  setMarkupEnabled: (enabled: boolean) => void;
  setEraserDisabled: (disabled: boolean) => void;
  setTimerHidden: (hidden: boolean) => void;
  toggleTimerPause: () => void;

  toggleSplitScreen: () => void;
  setActiveCanvas: (canvas: ActiveSplitCanvas) => void;
  swapSplitSides: () => void;
  toggleCompareMode: () => void;
  setCompareOverlayOpacity: (opacity: number) => void;

  updateCurrentDrawing: (data: DrawingData) => void;
  updateCuratorDrawing: (imagePath: string, data: DrawingData) => void;
  updateFreeDrawDrawing: (imagePath: string, data: DrawingData) => void;
  getCuratorDrawing: (imagePath: string) => DrawingData | null;
  getFreeDrawDrawing: (imagePath: string) => DrawingData | null;
  saveCurrentImageDrawing: () => void;

  addGuideline: (
    imagePath: string,
    type: "vertical" | "horizontal",
    position: number
  ) => void;
  removeGuideline: (
    imagePath: string,
    type: "vertical" | "horizontal",
    index: number
  ) => void;
  updateGuidelinePosition: (
    imagePath: string,
    type: "vertical" | "horizontal",
    index: number,
    newPosition: number
  ) => void;
  clearGuidelines: (imagePath: string) => void;

  /** Snapshot for persisting split layers + guides (keys use persistence paths). */
  getSplitPersistSnapshot: () => {
    curatorDrawings: Record<string, DrawingData>;
    freeDrawDrawings: Record<string, DrawingData>;
    imageGuidelines: Record<string, ImageGuidelinesData>;
    isSplitScreen: boolean;
    splitSidesSwapped: boolean;
  };

  // Per-image history management
  saveImageHistory: (imagePath: string, historyState: HistoryState) => void;
  getImageHistory: (imagePath: string) => HistoryState | null;
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

function cloneDrawingData(data: DrawingData): DrawingData {
  return {
    ...data,
    lines: data.lines.map((line) => ({
      ...line,
      points: [...line.points],
    })),
  };
}

function emptyImageGuidelines(): ImageGuidelinesData {
  return { vertical: [], horizontal: [] };
}

/** Curator overlay + free layer both count as markup in split mode. */
function hasSplitMarkup(
  state: SessionState,
  imagePath: string,
  curatorSnapshot: DrawingData
): boolean {
  const curatorLines = curatorSnapshot.lines.length;
  if (curatorLines > 0) return true;
  const free = state.freeDrawDrawings[imagePath];
  return Boolean(free && free.lines.length > 0);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  folderPath: null,
  folderPaths: [],
  folderName: null,
  folderNames: [],
  allImages: [],
  images: [],
  currentImageIndex: 0,
  maxImages: null,
  isSessionActive: false,
  isSessionEnded: false,
  isInSetup: false,
  isViewingGallery: false,
  isViewingOnly: false,
  isBrowsingGallery: false,
  returnToPreviousSessions: false,
  galleryIndex: 0,
  viewedImages: [],
  viewedSessionId: null,
  viewedSessionName: null,
  isTimedMode: true, // default Timed
  isTimedSession: true, // alias, kept in sync with isTimedMode
  timerDuration: 30, // default 30 seconds
  breakDuration: 3, // default 3 second break between images
  imageOpacity: 100, // default full opacity
  imageZoom: 100, // default full size
  markupEnabled: true, // default drawing enabled
  eraserDisabled: false, // default eraser enabled
  timerHidden: false, // default timer visible
  isSplitScreen: false,
  activeCanvas: "curator",
  splitSidesSwapped: false,
  setupPreviewImagePath: null,
  isCompareMode: false,
  compareOverlayOpacity: 70,
  isTimerPaused: false,
  isOnBreak: false,
  currentDrawingData: { ...initialDrawingData },
  curatorDrawings: {},
  freeDrawDrawings: {},
  imageGuidelines: {},
  imageHistories: {},

  // Actions
  setFolderPath: (path) => set({ folderPath: path, folderPaths: [path] }),
  
  setFolderPaths: (paths) => set({ folderPaths: paths, folderPath: paths.length > 0 ? paths[0] : null }),
  
  setFolderName: (name) => set({ folderName: name, folderNames: [name] }),
  
  setFolderNames: (names) => set({ folderNames: names, folderName: names.length > 0 ? names.join(", ") : null }),
  
  setImages: (images) => {
    const shuffled = shuffleArray(images);
    set({ allImages: shuffled, images: shuffled });
  },

  getPersistencePath: (displayPath) => {
    const state = get();
    const img = state.allImages.find((i) => i.path === displayPath);
    return img ? getPersistencePath(img) : displayPath;
  },
  
  setMaxImages: (count) => set({ maxImages: count }),
  
  enterSetup: () => set({ isInSetup: true }),
  
  exitSetup: () =>
    set({ isInSetup: false, setupPreviewImagePath: null, isCompareMode: false }),
  
  startSession: (options?: { excludePath?: string; includeFirstPath?: string }) => {
    const state = get();
    const { excludePath, includeFirstPath } = options || {};

    let availableImages = state.allImages;
    if (excludePath) {
      availableImages = state.allImages.filter((img) => img.path !== excludePath);
    }

    const maxCount = state.maxImages;
    let sessionImages =
      maxCount && maxCount < availableImages.length
        ? availableImages.slice(0, maxCount)
        : availableImages;

    if (includeFirstPath) {
      sessionImages = sessionImages.filter((img) => img.path !== includeFirstPath);
      const firstImg = state.allImages.find((i) => i.path === includeFirstPath);
      if (firstImg) sessionImages = [firstImg, ...sessionImages];
      if (maxCount && sessionImages.length > maxCount) {
        sessionImages = sessionImages.slice(0, maxCount);
      }
    }

    const preserveDrawing = includeFirstPath && state.currentDrawingData.lines.length > 0;

    const drawingStore = useDrawingStore.getState();
    drawingStore.clearHistory();
    drawingStore.clearFreeHistory();

    set({
      images: sessionImages,
      isSessionActive: true,
      isSessionEnded: false,
      isInSetup: false,
      isOnBreak: false,
      viewedImages: preserveDrawing
        ? [
            {
              path: includeFirstPath as string,
              viewedAt: Date.now(),
              drawingData: state.currentDrawingData,
              hasMarkup: true,
            },
          ]
        : [],
      currentImageIndex: 0,
      currentDrawingData: preserveDrawing ? state.currentDrawingData : { lines: [] },
      curatorDrawings: {},
      freeDrawDrawings: {},
      imageGuidelines: {},
      setupPreviewImagePath: null,
      isCompareMode: false,
      compareOverlayOpacity: 70,
      imageHistories: {},
      isTimerPaused: false,
      viewedSessionId: null,
      viewedSessionName: null,
    });
  },
  
  viewSession: (data) => {
    const legacy = data.drawings ?? {};
    const loadedCurator = data.curatorDrawings ?? {};
    const loadedFree = data.freeDrawDrawings ?? {};
    const loadedGuidelines = data.imageGuidelines ?? {};

    const curatorMerged: Record<string, DrawingData> = {};
    const freeMerged: Record<string, DrawingData> = {};
    for (const path of data.imageOrder) {
      const cur = loadedCurator[path];
      const leg = legacy[path];
      if (cur && cur.lines.length > 0) {
        curatorMerged[path] = cloneDrawingData(cur);
      } else if (leg?.drawingData && leg.drawingData.lines.length > 0) {
        curatorMerged[path] = cloneDrawingData(leg.drawingData);
      }
      const free = loadedFree[path];
      if (free && free.lines.length > 0) {
        freeMerged[path] = cloneDrawingData(free);
      }
    }

    const guidelineClone: Record<string, ImageGuidelinesData> = {};
    for (const [k, v] of Object.entries(loadedGuidelines)) {
      guidelineClone[k] = {
        vertical: [...v.vertical],
        horizontal: [...v.horizontal],
      };
    }

    const viewedImages: ViewedImage[] = data.imageOrder.map((path) => {
      const leg = legacy[path];
      const curatorData = curatorMerged[path] ?? null;
      const freeData = freeMerged[path] ?? null;
      const hasMarkup = Boolean(
        (curatorData && curatorData.lines.length > 0) ||
          (freeData && freeData.lines.length > 0)
      );
      return {
        path,
        viewedAt: leg?.savedAt || Date.now(),
        drawingData: curatorData,
        freeDrawData: freeData,
        hasMarkup,
      };
    });

    const hasPracticeStrokes = Object.keys(freeMerged).length > 0;
    const splitRestored = data.isSplitScreen ?? hasPracticeStrokes;

    const sessionImages: SessionImage[] = data.imageOrder.map((path) => ({
      path,
      sourceType: path.startsWith("http") ? ("url-stream" as const) : ("local" as const),
    }));

    set({
      images: sessionImages,
      allImages: sessionImages,
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
      viewedSessionId: data.id,
      viewedSessionName: data.name,
      folderPath: null,
      folderName: null,
      isTimedMode: true,
      isTimedSession: true, // Viewing saved sessions
      timerDuration: data.settings.timerDuration,
      breakDuration: data.settings.breakDuration,
      imageOpacity: data.settings.imageOpacity,
      maxImages: data.imageOrder.length,
      isSplitScreen: splitRestored,
      activeCanvas: "curator",
      splitSidesSwapped: data.splitSidesSwapped ?? false,
      curatorDrawings: curatorMerged,
      freeDrawDrawings: freeMerged,
      imageGuidelines: guidelineClone,
      setupPreviewImagePath: null,
      isCompareMode: false,
      compareOverlayOpacity: 70,
    });
  },
  
  endSession: () => {
    const state = get();
    if (state.images.length > 0) {
      const currentImg = state.images[state.currentImageIndex];
      const currentImage = currentImg.path;
      const hasMarkup = state.isSplitScreen
        ? hasSplitMarkup(state, currentImage, state.currentDrawingData)
        : state.currentDrawingData.lines.length > 0;
      
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
    folderPaths: [],
    folderName: null,
    folderNames: [],
    allImages: [],
    images: [],
    currentImageIndex: 0,
    maxImages: null,
    isSessionActive: false,
    isSessionEnded: false,
    isInSetup: false,
    isViewingGallery: false,
    isViewingOnly: false,
    isBrowsingGallery: false,
    returnToPreviousSessions: false,
    galleryIndex: 0,
    isOnBreak: false,
    viewedImages: [],
    currentDrawingData: { lines: [] },
    imageHistories: {},
    isTimerPaused: false,
    viewedSessionId: null,
    viewedSessionName: null,
    isSplitScreen: false,
    activeCanvas: "curator",
    splitSidesSwapped: false,
    curatorDrawings: {},
    freeDrawDrawings: {},
    imageGuidelines: {},
    setupPreviewImagePath: null,
    isCompareMode: false,
    compareOverlayOpacity: 70,
  }),
  
  // Gallery view actions
  setGalleryIndex: (index) => set({ galleryIndex: index }),
  
  exitGallery: (returnToPreviousSessions = false) => set({
    isViewingGallery: false,
    isViewingOnly: false,
    isBrowsingGallery: false,
    returnToPreviousSessions,
    galleryIndex: 0,
    images: [],
    viewedImages: [],
    viewedSessionId: null,
    viewedSessionName: null,
    isSplitScreen: false,
    activeCanvas: "curator",
    splitSidesSwapped: false,
    curatorDrawings: {},
    freeDrawDrawings: {},
    imageGuidelines: {},
    setupPreviewImagePath: null,
    isCompareMode: false,
    compareOverlayOpacity: 70,
  }),

  enterBrowseMode: () => {
    const state = get();
    let imagesToBrowse = state.allImages;
    const maxCount = state.maxImages;
    if (maxCount && maxCount < imagesToBrowse.length) {
      imagesToBrowse = imagesToBrowse.slice(0, maxCount);
    }
    const shuffled = shuffleArray(imagesToBrowse);
    const viewedImages: ViewedImage[] = shuffled.map((img) => ({
      path: img.path,
      viewedAt: Date.now(),
      drawingData: null,
      hasMarkup: false,
    }));
    const folderLabel = state.folderNames?.length
      ? state.folderNames.join(", ")
      : `${viewedImages.length} images`;
    set({
      viewedImages,
      isViewingGallery: true,
      isViewingOnly: false,
      isBrowsingGallery: true,
      viewedSessionName: `Browsing ${folderLabel}`,
      galleryIndex: 0,
      viewedSessionId: null,
    });
  },

  exitBrowseMode: () => set({
    isViewingGallery: false,
    isBrowsingGallery: false,
    galleryIndex: 0,
    viewedImages: [],
    viewedSessionName: null,
  }),
  
  clearReturnToPreviousSessions: () => set({ returnToPreviousSessions: false }),
  
  startBreak: () => set({ isOnBreak: true }),
  
  endBreak: () => set({ isOnBreak: false }),
  
  nextImage: () => {
    const state = get();
    if (state.images.length === 0) return;

    const currentImg = state.images[state.currentImageIndex];
    const currentImage = currentImg.path;
    const hasMarkup = state.isSplitScreen
      ? hasSplitMarkup(state, currentImage, state.currentDrawingData)
      : state.currentDrawingData.lines.length > 0;

    let mergedCurator = state.curatorDrawings;
    if (state.isSplitScreen) {
      mergedCurator = {
        ...state.curatorDrawings,
        [currentImage]: cloneDrawingData(state.currentDrawingData),
      };
    }

    const drawingStore = useDrawingStore.getState();
    const currentHistory = drawingStore.getHistoryState();
    const updatedHistories = {
      ...state.imageHistories,
      [currentImage]: currentHistory,
    };

    const existingIndex = state.viewedImages.findIndex((v) => v.path === currentImage);
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
    const nextImg = state.images[nextIndex];
    const nextPath = nextImg.path;

    const nextImageViewed = updatedViewed.find((v) => v.path === nextPath);

    const loadNextCurator = (): DrawingData => {
      if (state.isSplitScreen) {
        const rec = mergedCurator[nextPath];
        if (rec) return cloneDrawingData(rec);
      }
      if (nextImageViewed?.drawingData) return cloneDrawingData(nextImageViewed.drawingData);
      return { lines: [] };
    };

    const nextHistory = updatedHistories[nextPath];
    if (nextHistory) {
      drawingStore.setHistoryState(nextHistory);
    } else {
      drawingStore.clearHistory();
    }
    drawingStore.clearFreeHistory();

    set({
      currentImageIndex: nextIndex,
      viewedImages: updatedViewed,
      currentDrawingData: loadNextCurator(),
      imageHistories: updatedHistories,
      curatorDrawings: mergedCurator,
    });
  },
  
  previousImage: () => {
    const state = get();
    if (state.images.length === 0) return;

    const currentImg = state.images[state.currentImageIndex];
    const currentImage = currentImg.path;
    const drawingStore = useDrawingStore.getState();
    const currentHistory = drawingStore.getHistoryState();
    const updatedHistories = {
      ...state.imageHistories,
      [currentImage]: currentHistory,
    };

    let mergedCurator = state.curatorDrawings;
    if (state.isSplitScreen) {
      mergedCurator = {
        ...state.curatorDrawings,
        [currentImage]: cloneDrawingData(state.currentDrawingData),
      };
    }

    const hasMarkup = state.isSplitScreen
      ? hasSplitMarkup(state, currentImage, state.currentDrawingData)
      : state.currentDrawingData.lines.length > 0;

    const existingIndex = state.viewedImages.findIndex((v) => v.path === currentImage);
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

    const prevIndex =
      state.currentImageIndex === 0 ? state.images.length - 1 : state.currentImageIndex - 1;
    const prevPath = state.images[prevIndex].path;

    const prevImageViewed = updatedViewed.find((v) => v.path === prevPath);

    const loadPrevCurator = (): DrawingData => {
      if (state.isSplitScreen) {
        const rec = mergedCurator[prevPath];
        if (rec) return cloneDrawingData(rec);
      }
      if (prevImageViewed?.drawingData) return cloneDrawingData(prevImageViewed.drawingData);
      return { lines: [] };
    };

    const prevHistory = updatedHistories[prevPath];
    if (prevHistory) {
      drawingStore.setHistoryState(prevHistory);
    } else {
      drawingStore.clearHistory();
    }
    drawingStore.clearFreeHistory();

    set({
      currentImageIndex: prevIndex,
      viewedImages: updatedViewed,
      currentDrawingData: loadPrevCurator(),
      imageHistories: updatedHistories,
      curatorDrawings: mergedCurator,
    });
  },
  
  skipCurrentImage: () => {
    const state = get();
    if (state.images.length <= 1) {
      get().endSession();
      return;
    }

    const currentImg = state.images[state.currentImageIndex];
    const currentImage = currentImg.path;

    const newImages = state.images.filter((_, idx) => idx !== state.currentImageIndex);
    const newAllImages = state.allImages.filter((img) => img.path !== currentImage);

    const newViewedImages = state.viewedImages.filter((v) => v.path !== currentImage);

    const newHistories = { ...state.imageHistories };
    delete newHistories[currentImage];

    const newCuratorDrawings = { ...state.curatorDrawings };
    delete newCuratorDrawings[currentImage];
    const newFreeDrawDrawings = { ...state.freeDrawDrawings };
    delete newFreeDrawDrawings[currentImage];
    const newImageGuidelines = { ...state.imageGuidelines };
    delete newImageGuidelines[currentImage];
    delete newImageGuidelines[getFreeDrawGuidelinesKey(currentImage)];

    let newIndex = state.currentImageIndex;
    if (newIndex >= newImages.length) {
      newIndex = newImages.length - 1;
    }

    const newCurrentImg = newImages[newIndex];
    const newCurrentImagePath = newCurrentImg.path;
    const newCurrentViewed = newViewedImages.find((v) => v.path === newCurrentImagePath);

    const loadCuratorAfterSkip = (): DrawingData => {
      if (state.isSplitScreen) {
        const rec = newCuratorDrawings[newCurrentImagePath];
        if (rec) return cloneDrawingData(rec);
      }
      if (newCurrentViewed?.drawingData) return cloneDrawingData(newCurrentViewed.drawingData);
      return { lines: [] };
    };

    const drawingStore = useDrawingStore.getState();
    const newHistory = newHistories[newCurrentImagePath];
    if (newHistory) {
      drawingStore.setHistoryState(newHistory);
    } else {
      drawingStore.clearHistory();
    }
    drawingStore.clearFreeHistory();

    set({
      images: newImages,
      allImages: newAllImages,
      viewedImages: newViewedImages,
      currentImageIndex: newIndex,
      currentDrawingData: loadCuratorAfterSkip(),
      imageHistories: newHistories,
      curatorDrawings: newCuratorDrawings,
      freeDrawDrawings: newFreeDrawDrawings,
      imageGuidelines: newImageGuidelines,
    });
  },
  
  setTimedMode: (timed) => set({ isTimedMode: timed, isTimedSession: timed }),
  
  setTimerDuration: (seconds) => set({ timerDuration: seconds }),
  
  setBreakDuration: (seconds) => set({ breakDuration: seconds }),
  
  setImageOpacity: (opacity) => set({ imageOpacity: Math.max(0, Math.min(100, opacity)) }),
  
  setImageZoom: (zoom) => set({ imageZoom: Math.max(10, Math.min(200, zoom)) }),
  
  setMarkupEnabled: (enabled) => set({ markupEnabled: enabled }),
  
  setEraserDisabled: (disabled) => set({ eraserDisabled: disabled }),
  
  setTimerHidden: (hidden) => set({ timerHidden: hidden }),
  
  toggleTimerPause: () => set((state) => ({ isTimerPaused: !state.isTimerPaused })),

  toggleSplitScreen: () =>
    set((state) => {
      const next = !state.isSplitScreen;
      return {
        isSplitScreen: next,
        ...(!next ? { isCompareMode: false } : {}),
      };
    }),

  setActiveCanvas: (canvas) => set({ activeCanvas: canvas }),

  swapSplitSides: () => set((state) => ({ splitSidesSwapped: !state.splitSidesSwapped })),

  toggleCompareMode: () =>
    set((state) => ({
      isCompareMode: state.isSplitScreen ? !state.isCompareMode : false,
    })),

  setCompareOverlayOpacity: (opacity) =>
    set({
      compareOverlayOpacity: Math.max(10, Math.min(100, opacity)),
    }),

  updateCurrentDrawing: (data) => {
    const state = get();
    if (!state.isSplitScreen) {
      set({ currentDrawingData: data });
      return;
    }
    if (
      !state.isSessionActive &&
      state.setupPreviewImagePath &&
      state.activeCanvas === "curator"
    ) {
      const p = state.setupPreviewImagePath;
      set({
        currentDrawingData: data,
        curatorDrawings: { ...state.curatorDrawings, [p]: data },
      });
      return;
    }
    const path = state.images[state.currentImageIndex]?.path;
    if (!path) {
      set({ currentDrawingData: data });
      return;
    }
    if (state.activeCanvas === "freeDraw") {
      set({
        freeDrawDrawings: { ...state.freeDrawDrawings, [path]: data },
      });
      return;
    }
    set({
      currentDrawingData: data,
      curatorDrawings: { ...state.curatorDrawings, [path]: data },
    });
  },

  updateCuratorDrawing: (imagePath, data) =>
    set((state) => {
      const curatorDrawings = { ...state.curatorDrawings, [imagePath]: data };
      const curPath = state.images[state.currentImageIndex]?.path;
      const syncCurrent =
        state.isSessionActive && state.isSplitScreen && curPath === imagePath;
      return {
        curatorDrawings,
        ...(syncCurrent ? { currentDrawingData: data } : {}),
      };
    }),

  updateFreeDrawDrawing: (imagePath, data) =>
    set((state) => ({
      freeDrawDrawings: { ...state.freeDrawDrawings, [imagePath]: data },
    })),

  getCuratorDrawing: (imagePath) => get().curatorDrawings[imagePath] ?? null,

  getFreeDrawDrawing: (imagePath) => get().freeDrawDrawings[imagePath] ?? null,

  saveCurrentImageDrawing: () => {
    const state = get();
    if (state.images.length === 0) return;

    const currentImage = state.images[state.currentImageIndex].path;
    const hasMarkup = state.isSplitScreen
      ? hasSplitMarkup(state, currentImage, state.currentDrawingData)
      : state.currentDrawingData.lines.length > 0;
    
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
  
  clearCurrentDrawing: () => {
    const state = get();
    if (!state.isSplitScreen) {
      set({ currentDrawingData: { lines: [] } });
      return;
    }
    const sessionPath = state.images[state.currentImageIndex]?.path;
    const path =
      state.isSessionActive && sessionPath
        ? sessionPath
        : state.setupPreviewImagePath;
    if (!path) {
      set({ currentDrawingData: { lines: [] } });
      return;
    }
    if (state.activeCanvas === "freeDraw") {
      set((s) => {
        const next = { ...s.freeDrawDrawings };
        delete next[path];
        return { freeDrawDrawings: next };
      });
      return;
    }
    set((s) => {
      const nextCur = { ...s.curatorDrawings };
      delete nextCur[path];
      const clearLiveCurator =
        (s.isSessionActive && s.images[s.currentImageIndex]?.path === path) ||
        (!s.isSessionActive && s.setupPreviewImagePath === path);
      return {
        curatorDrawings: nextCur,
        ...(clearLiveCurator ? { currentDrawingData: { lines: [] } } : {}),
      };
    });
  },
  
  // Per-image history management helpers
  saveImageHistory: (imagePath, historyState) => {
    set((state) => ({
      imageHistories: {
        ...state.imageHistories,
        [imagePath]: historyState,
      },
    }));
  },
  
  getImageHistory: (imagePath) => {
    const state = get();
    return state.imageHistories[imagePath] || null;
  },

  addGuideline: (imagePath, type, position) =>
    set((state) => {
      const prev = state.imageGuidelines[imagePath] ?? emptyImageGuidelines();
      const next: ImageGuidelinesData =
        type === "vertical"
          ? { ...prev, vertical: [...prev.vertical, position] }
          : { ...prev, horizontal: [...prev.horizontal, position] };
      return {
        imageGuidelines: { ...state.imageGuidelines, [imagePath]: next },
      };
    }),

  removeGuideline: (imagePath, type, index) =>
    set((state) => {
      const prev = state.imageGuidelines[imagePath];
      if (!prev) return {};
      const arr =
        type === "vertical" ? [...prev.vertical] : [...prev.horizontal];
      if (index < 0 || index >= arr.length) return {};
      arr.splice(index, 1);
      const next: ImageGuidelinesData =
        type === "vertical"
          ? { ...prev, vertical: arr }
          : { ...prev, horizontal: arr };
      const nextMap = { ...state.imageGuidelines };
      if (next.vertical.length === 0 && next.horizontal.length === 0) {
        delete nextMap[imagePath];
      } else {
        nextMap[imagePath] = next;
      }
      return { imageGuidelines: nextMap };
    }),

  updateGuidelinePosition: (imagePath, type, index, newPosition) =>
    set((state) => {
      const prev = state.imageGuidelines[imagePath];
      if (!prev) return {};
      const arr =
        type === "vertical" ? [...prev.vertical] : [...prev.horizontal];
      if (index < 0 || index >= arr.length) return {};
      arr[index] = newPosition;
      const next: ImageGuidelinesData =
        type === "vertical"
          ? { ...prev, vertical: arr }
          : { ...prev, horizontal: arr };
      return {
        imageGuidelines: { ...state.imageGuidelines, [imagePath]: next },
      };
    }),

  clearGuidelines: (imagePath) =>
    set((state) => {
      const next = { ...state.imageGuidelines };
      delete next[imagePath];
      return { imageGuidelines: next };
    }),

  getSplitPersistSnapshot: () => {
    const state = get();
    const toPersistKey = (displayPath: string) => {
      const img = state.allImages.find((i) => i.path === displayPath);
      return img ? getPersistencePath(img) : displayPath;
    };

    let curatorDisplay: Record<string, DrawingData> = {};
    if (state.isSplitScreen) {
      curatorDisplay = { ...state.curatorDrawings };
      const cur = state.images[state.currentImageIndex];
      if (cur) {
        curatorDisplay[cur.path] = cloneDrawingData(state.currentDrawingData);
      }
      for (const v of state.viewedImages) {
        if (
          v.drawingData &&
          v.drawingData.lines.length > 0 &&
          !curatorDisplay[v.path]
        ) {
          curatorDisplay[v.path] = cloneDrawingData(v.drawingData);
        }
      }
    }

    const mapDrawings = (rec: Record<string, DrawingData>) => {
      const out: Record<string, DrawingData> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (!v.lines.length) continue;
        out[toPersistKey(k)] = cloneDrawingData(v);
      }
      return out;
    };

    const freeSuffix = "-freeDraw";
    const mapGuidelines = () => {
      const out: Record<string, ImageGuidelinesData> = {};
      for (const [key, data] of Object.entries(state.imageGuidelines)) {
        if (!data.vertical.length && !data.horizontal.length) continue;
        if (key.endsWith(freeSuffix) && !state.isSplitScreen) continue;
        if (key.endsWith(freeSuffix)) {
          const baseDisplay = key.slice(0, -freeSuffix.length);
          out[`${toPersistKey(baseDisplay)}${freeSuffix}`] = {
            vertical: [...data.vertical],
            horizontal: [...data.horizontal],
          };
        } else {
          out[toPersistKey(key)] = {
            vertical: [...data.vertical],
            horizontal: [...data.horizontal],
          };
        }
      }
      return out;
    };

    return {
      curatorDrawings: mapDrawings(curatorDisplay),
      freeDrawDrawings: state.isSplitScreen ? mapDrawings(state.freeDrawDrawings) : {},
      imageGuidelines: mapGuidelines(),
      isSplitScreen: state.isSplitScreen,
      splitSidesSwapped: state.splitSidesSwapped,
    };
  },
}));
