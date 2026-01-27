import { useRef, useState, useCallback } from "react";
import { Stage, Layer, Line } from "react-konva";
import { useSessionStore, DrawingData } from "../store/sessionStore";
import { useDrawingStore, BRUSH_CONFIGS, BrushType } from "../store/drawingStore";
import Konva from "konva";

interface DrawingCanvasProps {
  width: number;
  height: number;
}

export default function DrawingCanvas({ width, height }: DrawingCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const { currentDrawingData, updateCurrentDrawing } = useSessionStore();
  const { tool, color, strokeWidth, pushHistory } = useDrawingStore();

  // Get brush config for current tool
  const getBrushConfig = (brushType: BrushType) => {
    return BRUSH_CONFIGS[brushType] || BRUSH_CONFIGS.pen;
  };

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

      const newDrawingData: DrawingData = {
        lines: [...currentDrawingData.lines, newLine],
        canvasWidth: width,
        canvasHeight: height,
      };
      updateCurrentDrawing(newDrawingData);
    },
    [currentDrawingData, updateCurrentDrawing, tool, color, strokeWidth, width, height]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (!isDrawing) return;

      const stage = e.target.getStage();
      const pos = stage?.getPointerPosition();
      if (!pos) return;

      const lines = currentDrawingData.lines;
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;

      // Add point to current line
      const updatedLine = {
        ...lastLine,
        points: [...lastLine.points, pos.x, pos.y],
      };

      const newDrawingData: DrawingData = {
        lines: [...lines.slice(0, -1), updatedLine],
        canvasWidth: width,
        canvasHeight: height,
      };
      updateCurrentDrawing(newDrawingData);
    },
    [isDrawing, currentDrawingData, updateCurrentDrawing, width, height]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      // Push current state to history for undo/redo
      pushHistory(currentDrawingData.lines);
    }
    setIsDrawing(false);
  }, [isDrawing, currentDrawingData.lines, pushHistory]);

  // Export canvas as data URL
  const exportCanvas = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    return stage.toDataURL({ pixelRatio: 2 });
  }, []);

  // Make export function available globally for save functionality
  (window as unknown as { exportDrawingCanvas: () => string | null }).exportDrawingCanvas = exportCanvas;

  // Render a line with brush-specific properties
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
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMousemove={handleMouseMove}
      onMouseup={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
      style={{ cursor: "crosshair" }}
    >
      <Layer>
        {currentDrawingData.lines.map((line, i) => renderLine(line, i))}
      </Layer>
    </Stage>
  );
}
