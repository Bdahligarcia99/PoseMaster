import { useCallback, useEffect, useRef, useState } from "react";

const RAIL_PX = 8;
/** Within this many px of an edge, releasing a moved guide deletes it. */
const EDGE_REMOVE_PX = 12;
const LINE_HIT_PX = 8;

export interface GuidelineOverlayProps {
  width: number;
  height: number;
  guidelines: { vertical: number[]; horizontal: number[] };
  onAddGuideline: (type: "vertical" | "horizontal", position: number) => void;
  onUpdateGuideline: (type: "vertical" | "horizontal", index: number, position: number) => void;
  onRemoveGuideline: (type: "vertical" | "horizontal", index: number) => void;
}

type DragMode =
  | { kind: "create-vertical" }
  | { kind: "create-horizontal" }
  | { kind: "move-vertical"; index: number }
  | { kind: "move-horizontal"; index: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function GuidelineOverlay({
  width,
  height,
  guidelines,
  onAddGuideline,
  onUpdateGuideline,
  onRemoveGuideline,
}: GuidelineOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ type: "vertical" | "horizontal"; pos: number } | null>(
    null
  );

  const toLocal = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      return {
        x: clamp(clientX - rect.left, 0, width),
        y: clamp(clientY - rect.top, 0, height),
      };
    },
    [width, height]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const { x, y } = toLocal(e.clientX, e.clientY);
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "create-vertical" || d.kind === "move-vertical") {
        setPreview({ type: "vertical", pos: x });
      } else {
        setPreview({ type: "horizontal", pos: y });
      }
    };

    const handleUp = (e: MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      setPreview(null);
      if (!d || !containerRef.current) return;

      const { x, y } = toLocal(e.clientX, e.clientY);

      if (d.kind === "create-vertical") {
        onAddGuideline("vertical", x);
      } else if (d.kind === "create-horizontal") {
        onAddGuideline("horizontal", y);
      } else if (d.kind === "move-vertical") {
        if (x <= EDGE_REMOVE_PX || x >= width - EDGE_REMOVE_PX) {
          onRemoveGuideline("vertical", d.index);
        } else {
          onUpdateGuideline("vertical", d.index, x);
        }
      } else if (d.kind === "move-horizontal") {
        if (y <= EDGE_REMOVE_PX || y >= height - EDGE_REMOVE_PX) {
          onRemoveGuideline("horizontal", d.index);
        } else {
          onUpdateGuideline("horizontal", d.index, y);
        }
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    isDragging,
    height,
    onAddGuideline,
    onRemoveGuideline,
    onUpdateGuideline,
    toLocal,
    width,
  ]);

  const startCreateVertical = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "create-vertical" };
    const { x } = toLocal(e.clientX, e.clientY);
    setPreview({ type: "vertical", pos: x });
    setIsDragging(true);
  };

  const startCreateHorizontal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "create-horizontal" };
    const { y } = toLocal(e.clientX, e.clientY);
    setPreview({ type: "horizontal", pos: y });
    setIsDragging(true);
  };

  const startMoveVertical = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "move-vertical", index };
    const { x } = toLocal(e.clientX, e.clientY);
    setPreview({ type: "vertical", pos: x });
    setIsDragging(true);
  };

  const startMoveHorizontal = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { kind: "move-horizontal", index };
    const { y } = toLocal(e.clientX, e.clientY);
    setPreview({ type: "horizontal", pos: y });
    setIsDragging(true);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none select-none"
      style={{ width, height }}
    >
      {/* Existing vertical guidelines */}
      {guidelines.vertical.map((x, i) => (
        <div
          key={`v-${i}-${x}`}
          className="group absolute top-0 bottom-0 z-[25] cursor-ew-resize pointer-events-auto"
          style={{ left: x, width: LINE_HIT_PX, marginLeft: -LINE_HIT_PX / 2 }}
          onMouseDown={(e) => startMoveVertical(i, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemoveGuideline("vertical", i);
          }}
        >
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-cyan-400 shadow-[0_0_1px_rgba(34,211,238,0.9)]"
            aria-hidden
          />
          <button
            type="button"
            className="absolute left-1/2 top-0 z-[40] flex h-5 w-5 -translate-x-1/2 -translate-y-0.5 items-center justify-center rounded
              bg-dark-bg/95 text-[10px] font-bold leading-none text-cyan-300 opacity-0 shadow border border-cyan-500/50
              transition-opacity hover:bg-red-900/90 hover:text-white hover:border-red-400 group-hover:opacity-100"
            title="Remove guide"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveGuideline("vertical", i);
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Existing horizontal guidelines */}
      {guidelines.horizontal.map((y, i) => (
        <div
          key={`h-${i}-${y}`}
          className="group absolute left-0 right-0 z-[25] cursor-ns-resize pointer-events-auto"
          style={{ top: y, height: LINE_HIT_PX, marginTop: -LINE_HIT_PX / 2 }}
          onMouseDown={(e) => startMoveHorizontal(i, e)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemoveGuideline("horizontal", i);
          }}
        >
          <div
            className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-fuchsia-400 shadow-[0_0_1px_rgba(232,121,249,0.9)]"
            aria-hidden
          />
          <button
            type="button"
            className="absolute left-0 top-1/2 z-[40] flex h-5 w-5 -translate-x-0.5 -translate-y-1/2 items-center justify-center rounded
              bg-dark-bg/95 text-[10px] font-bold leading-none text-fuchsia-300 opacity-0 shadow border border-fuchsia-500/50
              transition-opacity hover:bg-red-900/90 hover:text-white hover:border-red-400 group-hover:opacity-100"
            title="Remove guide"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveGuideline("horizontal", i);
            }}
          >
            ×
          </button>
        </div>
      ))}

      {/* Preview while dragging */}
      {preview && (
        <div className="pointer-events-none z-[28]" aria-hidden>
          {preview.type === "vertical" ? (
            <div
              className="absolute top-0 bottom-0 w-px bg-cyan-300/80"
              style={{ left: preview.pos }}
            />
          ) : (
            <div
              className="absolute left-0 right-0 h-px bg-fuchsia-300/80"
              style={{ top: preview.pos }}
            />
          )}
        </div>
      )}

      {/* Edge rails (on top for grab affordance) */}
      <div
        className="absolute left-0 top-0 bottom-0 z-[30] cursor-ew-resize pointer-events-auto hover:bg-cyan-500/20"
        style={{ width: RAIL_PX }}
        title="Drag horizontally to place a vertical guide"
        onMouseDown={startCreateVertical}
        role="presentation"
      />
      <div
        className="absolute right-0 top-0 bottom-0 z-[30] cursor-ew-resize pointer-events-auto hover:bg-cyan-500/20"
        style={{ width: RAIL_PX }}
        title="Drag horizontally to place a vertical guide"
        onMouseDown={startCreateVertical}
        role="presentation"
      />
      <div
        className="absolute left-0 right-0 top-0 z-[30] cursor-ns-resize pointer-events-auto hover:bg-fuchsia-500/20"
        style={{ height: RAIL_PX }}
        title="Drag vertically to place a horizontal guide"
        onMouseDown={startCreateHorizontal}
        role="presentation"
      />
      <div
        className="absolute left-0 right-0 bottom-0 z-[30] cursor-ns-resize pointer-events-auto hover:bg-fuchsia-500/20"
        style={{ height: RAIL_PX }}
        title="Drag vertically to place a horizontal guide"
        onMouseDown={startCreateHorizontal}
        role="presentation"
      />
    </div>
  );
}
