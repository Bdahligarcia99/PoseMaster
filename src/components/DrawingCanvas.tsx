import { useRef, useState, useCallback, useEffect } from "react";
import { Stage, Layer, Line } from "react-konva";
import { useSessionStore, DrawingData } from "../store/sessionStore";
import { useDrawingStore, BRUSH_CONFIGS, BrushType } from "../store/drawingStore";
import Konva from "konva";

interface DrawingCanvasProps {
  width: number;
  height: number;
  /** When false (split screen inactive pane), canvas is visible but ignores input. Default true. */
  isActive?: boolean;
  /** Split mode: free-draw pane — uses `freeDrawDrawings[layerImagePath]`. */
  splitDrawingRole?: "free";
  /** Scope for free layer (required for setup preview); defaults to current session image path. */
  layerImagePath?: string | null;
}

export default function DrawingCanvas({
  width,
  height,
  isActive = true,
  splitDrawingRole,
  layerImagePath = null,
}: DrawingCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const previousToolRef = useRef<BrushType | null>(null);
  const isUsingTabletEraserRef = useRef(false);

  const isSplitScreen = useSessionStore((s) => s.isSplitScreen);
  const images = useSessionStore((s) => s.images);
  const currentImageIndex = useSessionStore((s) => s.currentImageIndex);
  const currentDrawingData = useSessionStore((s) => s.currentDrawingData);
  const freeDrawDrawings = useSessionStore((s) => s.freeDrawDrawings);
  const updateCurrentDrawing = useSessionStore((s) => s.updateCurrentDrawing);
  const updateFreeDrawDrawing = useSessionStore((s) => s.updateFreeDrawDrawing);
  const setActiveCanvas = useSessionStore((s) => s.setActiveCanvas);
  const eraserDisabled = useSessionStore((s) => s.eraserDisabled);

  const { tool, color, strokeWidth, pushHistory, pushFreeHistory, setTool } = useDrawingStore();

  const sessionImagePath = images[currentImageIndex]?.path ?? "";
  const pathForFree = layerImagePath ?? sessionImagePath;
  const isFreePane =
    Boolean(isSplitScreen && splitDrawingRole === "free" && pathForFree);

  const drawingData: DrawingData = isFreePane
    ? freeDrawDrawings[pathForFree] ?? { lines: [] }
    : currentDrawingData;

  useEffect(() => {
    if (!isActive) setIsDrawing(false);
  }, [isActive]);

  const applyDrawingUpdate = useCallback(
    (data: DrawingData) => {
      if (isFreePane) {
        updateFreeDrawDrawing(pathForFree, data);
      } else {
        updateCurrentDrawing(data);
      }
    },
    [isFreePane, pathForFree, updateCurrentDrawing, updateFreeDrawDrawing]
  );

  useEffect(() => {
    if (isFreePane) return;
    const exportCanvas = () => {
      const stage = stageRef.current;
      if (!stage) return null;
      return stage.toDataURL({ pixelRatio: 2 });
    };
    (window as unknown as { exportDrawingCanvas: () => string | null }).exportDrawingCanvas = exportCanvas;
    return () => {
      delete (window as unknown as { exportDrawingCanvas?: () => string | null }).exportDrawingCanvas;
    };
  }, [isFreePane, width, height]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isActive) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "pen") return;

      const isEraserEnd = e.button === 5 || (e.buttons & 32) !== 0;

      if (isEraserEnd && !eraserDisabled) {
        if (!isUsingTabletEraserRef.current && tool !== "eraser") {
          previousToolRef.current = tool;
          isUsingTabletEraserRef.current = true;
          setTool("eraser");
        }
      } else if (e.button === 0 && isUsingTabletEraserRef.current) {
        isUsingTabletEraserRef.current = false;
        if (previousToolRef.current) {
          setTool(previousToolRef.current);
          previousToolRef.current = null;
        }
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isActive, tool, setTool, eraserDisabled]);

  const getBrushConfig = (brushType: BrushType) => {
    return BRUSH_CONFIGS[brushType] || BRUSH_CONFIGS.pen;
  };

  const activateCanvasForRole = useCallback(() => {
    if (!isSplitScreen) return;
    setActiveCanvas(isFreePane ? "freeDraw" : "curator");
  }, [isFreePane, isSplitScreen, setActiveCanvas]);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      activateCanvasForRole();
      setIsDrawing(true);
      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      const config = getBrushConfig(tool);
      const actualWidth = strokeWidth * config.widthMultiplier;

      const newLine = {
        points: [pos.x, pos.y],
        color: tool === "eraser" ? "transparent" : color,
        strokeWidth: actualWidth,
        tool,
      };

      const base = drawingData.lines;
      const newDrawingData: DrawingData = {
        lines: [...base, newLine],
        canvasWidth: width,
        canvasHeight: height,
      };
      applyDrawingUpdate(newDrawingData);
    },
    [
      activateCanvasForRole,
      applyDrawingUpdate,
      color,
      drawingData.lines,
      strokeWidth,
      tool,
      width,
      height,
    ]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isDrawing) return;

      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      const lines = drawingData.lines;
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;

      const updatedLine = {
        ...lastLine,
        points: [...lastLine.points, pos.x, pos.y],
      };

      const newDrawingData: DrawingData = {
        lines: [...lines.slice(0, -1), updatedLine],
        canvasWidth: width,
        canvasHeight: height,
      };
      applyDrawingUpdate(newDrawingData);
    },
    [applyDrawingUpdate, drawingData.lines, height, isDrawing, width]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      const sess = useSessionStore.getState();
      if (isFreePane) {
        const lines = sess.freeDrawDrawings[pathForFree]?.lines ?? [];
        pushFreeHistory(lines);
      } else {
        pushHistory(sess.currentDrawingData.lines);
      }
    }
    setIsDrawing(false);
  }, [isDrawing, isFreePane, pathForFree, pushFreeHistory, pushHistory]);

  const renderLine = (line: DrawingData["lines"][0], index: number) => {
    const config = getBrushConfig(line.tool);
    const isEraser = line.tool === "eraser";

    return (
      <Line
        key={index}
        points={line.points}
        stroke={isEraser ? "#1a1a2e" : line.color}
        strokeWidth={line.strokeWidth}
        tension={config.tension}
        lineCap={config.lineCap}
        lineJoin={config.lineJoin}
        opacity={isEraser ? 1 : config.opacity}
        shadowBlur={config.shadowBlur}
        shadowColor={isEraser ? undefined : line.color}
        globalCompositeOperation={isEraser ? "destination-out" : "source-over"}
      />
    );
  };

  return (
    <div
      ref={containerRef}
      className={!isActive ? "pointer-events-none" : undefined}
      style={{ touchAction: "none" }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        listening={isActive}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{ cursor: isActive ? "crosshair" : "default" }}
      >
        <Layer>
          {drawingData.lines.map((line, i) => renderLine(line, i))}
        </Layer>
      </Stage>
    </div>
  );
}
