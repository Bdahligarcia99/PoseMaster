import { lazy, Suspense } from "react";
import { useSessionStore, getFreeDrawGuidelinesKey } from "../store/sessionStore";
import GuidelineOverlay from "./GuidelineOverlay";

const DrawingCanvas = lazy(() => import("./DrawingCanvas"));

export interface FreeDrawCanvasProps {
  width: number;
  height: number;
  isActive: boolean;
  onActivate: () => void;
  /** Setup preview or other override; defaults to current session image path. */
  freeLayerPath?: string | null;
}

export default function FreeDrawCanvas({
  width,
  height,
  isActive,
  onActivate,
  freeLayerPath: freeLayerPathProp = null,
}: FreeDrawCanvasProps) {
  const isSplitScreen = useSessionStore((s) => s.isSplitScreen);
  const images = useSessionStore((s) => s.images);
  const currentImageIndex = useSessionStore((s) => s.currentImageIndex);
  const sessionPath = images[currentImageIndex]?.path ?? null;
  const layerImagePath = freeLayerPathProp ?? sessionPath;

  const useFreeLayer = Boolean(isSplitScreen && layerImagePath);
  const guidelinesKey =
    useFreeLayer && layerImagePath ? getFreeDrawGuidelinesKey(layerImagePath) : null;

  const imageGuidelines = useSessionStore((s) => s.imageGuidelines);
  const addGuideline = useSessionStore((s) => s.addGuideline);
  const updateGuidelinePosition = useSessionStore((s) => s.updateGuidelinePosition);
  const removeGuideline = useSessionStore((s) => s.removeGuideline);

  const guidelines = guidelinesKey
    ? imageGuidelines[guidelinesKey] ?? { vertical: [], horizontal: [] }
    : { vertical: [], horizontal: [] };

  return (
    <div
      onClick={onActivate}
      className={`relative rounded-md overflow-hidden ${
        isActive
          ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-dark-bg shadow-[0_0_12px_rgba(59,130,246,0.35)]"
          : "border border-dark-accent/40"
      }`}
    >
      <div className="absolute inset-0 bg-gray-100" aria-hidden />

      <div className="relative" style={{ width, height }}>
        {guidelinesKey && (
          <div
            className={`absolute inset-0 z-[1] ${isActive ? "pointer-events-auto" : "pointer-events-none"}`}
          >
            <GuidelineOverlay
              width={width}
              height={height}
              guidelines={guidelines}
              onAddGuideline={(type, pos) => addGuideline(guidelinesKey, type, pos)}
              onUpdateGuideline={(type, index, pos) =>
                updateGuidelinePosition(guidelinesKey, type, index, pos)
              }
              onRemoveGuideline={(type, index) => removeGuideline(guidelinesKey, type, index)}
            />
          </div>
        )}
        <div className={`relative z-[2] ${isActive ? "" : "pointer-events-none"}`}>
          <Suspense fallback={null}>
            <DrawingCanvas
              width={width}
              height={height}
              isActive={isActive}
              {...(useFreeLayer
                ? { splitDrawingRole: "free" as const, layerImagePath }
                : {})}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
