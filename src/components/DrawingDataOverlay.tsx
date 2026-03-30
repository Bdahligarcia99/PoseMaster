import { Stage, Layer, Line } from "react-konva";
import { DrawingData } from "../store/sessionStore";
import { BRUSH_CONFIGS, BrushType } from "../store/drawingStore";

interface DrawingDataOverlayProps {
  width: number;
  height: number;
  drawingData: DrawingData;
}

/** Read-only Konva view of strokes (e.g. Practice layer overlaid on Image Curator for compare mode). */
export default function DrawingDataOverlay({ width, height, drawingData }: DrawingDataOverlayProps) {
  const cw = drawingData.canvasWidth ?? width;
  const ch = drawingData.canvasHeight ?? height;
  const scaleX = width / (cw || 1);
  const scaleY = height / (ch || 1);

  const getBrushConfig = (brushType: BrushType) => BRUSH_CONFIGS[brushType] || BRUSH_CONFIGS.pen;

  return (
    <div className="pointer-events-none" style={{ width, height }}>
      <Stage width={width} height={height} listening={false}>
        <Layer scaleX={scaleX} scaleY={scaleY}>
          {drawingData.lines.map((line, index) => {
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
          })}
        </Layer>
      </Stage>
    </div>
  );
}
