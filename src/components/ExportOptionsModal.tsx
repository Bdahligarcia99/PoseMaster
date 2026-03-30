import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { jsPDF } from "jspdf";
import { ViewedImage } from "../store/sessionStore";
import { BRUSH_CONFIGS, BrushType } from "../store/drawingStore";

export type ExportFormat = "images" | "pdf" | "pdf-gallery";
export type GalleryLayout = "1-column" | "2-column" | "3-column";

interface ExportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewedImages: ViewedImage[];
  selectedImages: Set<string>;
  imageOpacity: number;
  folderPath: string | null;
  sessionName?: string;
}

export default function ExportOptionsModal({
  isOpen,
  onClose,
  viewedImages,
  selectedImages,
  imageOpacity,
  folderPath,
  sessionName,
}: ExportOptionsModalProps) {
  const [format, setFormat] = useState<ExportFormat>("images");
  const [galleryLayout, setGalleryLayout] = useState<GalleryLayout>("2-column");
  const [applyOpacity, setApplyOpacity] = useState(true);
  const [includeWithoutMarkup, setIncludeWithoutMarkup] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  if (!isOpen) return null;

  const selectedViewedImages = viewedImages.filter((img) => selectedImages.has(img.path));
  const imagesWithMarkup = selectedViewedImages.filter((img) => img.hasMarkup);
  const hasAnyDrawings = viewedImages.some((img) => img.hasMarkup);
  // Sessions without drawings: export reference images only (no overlay)
  const imagesToExport =
    hasAnyDrawings
      ? includeWithoutMarkup
        ? selectedViewedImages
        : imagesWithMarkup
      : selectedViewedImages;

  const handleExport = async () => {
    if (imagesToExport.length === 0) return;

    try {
      // Ask for output location
      const outputFolder = await open({
        directory: true,
        multiple: false,
        title: format === "images" ? "Select folder for exported images" : "Select folder for PDF",
      });

      if (!outputFolder) return;

      // Check same folder warning
      if (folderPath && outputFolder === folderPath && format === "images") {
        alert("Please choose a different folder to avoid overwriting original images.");
        return;
      }

      setIsExporting(true);
      setProgress({ current: 0, total: imagesToExport.length });
      setResult(null);

      if (format === "images") {
        await exportAsImages(outputFolder as string);
      } else if (format === "pdf") {
        await exportAsPdfSequence(outputFolder as string);
      } else if (format === "pdf-gallery") {
        await exportAsPdfGallery(outputFolder as string);
      }
    } catch (err) {
      console.error("Export error:", err);
      setResult({ success: 0, failed: imagesToExport.length });
    } finally {
      setIsExporting(false);
    }
  };

  const loadImageAsBase64 = async (imagePath: string): Promise<string> => {
    return imagePath.startsWith("http")
      ? invoke<string>("fetch_url_image_as_base64", { url: imagePath })
      : invoke<string>("get_image_as_base64", { imagePath });
  };

  const renderImageWithDrawing = async (
    viewedImage: ViewedImage,
    targetWidth?: number,
    targetHeight?: number
  ): Promise<HTMLCanvasElement | null> => {
    try {
      // Load the original image
      const base64 = await loadImageAsBase64(viewedImage.path);
      
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Calculate dimensions
          let width = targetWidth || img.width;
          let height = targetHeight || img.height;
          
          if (targetWidth && targetHeight) {
            // Fit within bounds while maintaining aspect ratio
            const imgAspect = img.width / img.height;
            const targetAspect = targetWidth / targetHeight;
            
            if (imgAspect > targetAspect) {
              width = targetWidth;
              height = targetWidth / imgAspect;
            } else {
              height = targetHeight;
              width = targetHeight * imgAspect;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          // Apply opacity if enabled
          ctx.globalAlpha = applyOpacity ? imageOpacity / 100 : 1;
          ctx.drawImage(img, 0, 0, width, height);
          ctx.globalAlpha = 1;

          const drawMarkupLayer = (layer: typeof viewedImage.drawingData) => {
            if (!layer || !layer.lines.length) return;
            const scaleX = width / (layer.canvasWidth || img.width);
            const scaleY = height / (layer.canvasHeight || img.height);

            for (const line of layer.lines) {
              if (line.points.length < 4) continue;

              const brushConfig = BRUSH_CONFIGS[line.tool as BrushType] || BRUSH_CONFIGS.pen;

              ctx.beginPath();
              ctx.strokeStyle = line.tool === "eraser" ? "rgba(0,0,0,0)" : line.color;
              ctx.lineWidth = line.strokeWidth * Math.min(scaleX, scaleY);
              ctx.lineCap = brushConfig.lineCap;
              ctx.lineJoin = brushConfig.lineJoin;
              ctx.globalAlpha = line.tool === "eraser" ? 1 : brushConfig.opacity;

              if (line.tool === "eraser") {
                ctx.globalCompositeOperation = "destination-out";
              } else {
                ctx.globalCompositeOperation = "source-over";
              }

              ctx.moveTo(line.points[0] * scaleX, line.points[1] * scaleY);
              for (let i = 2; i < line.points.length; i += 2) {
                ctx.lineTo(line.points[i] * scaleX, line.points[i + 1] * scaleY);
              }
              ctx.stroke();
              ctx.globalCompositeOperation = "source-over";
              ctx.globalAlpha = 1;
            }
          };

          drawMarkupLayer(viewedImage.drawingData);
          drawMarkupLayer(viewedImage.freeDrawData ?? null);

          resolve(canvas);
        };
        img.onerror = () => resolve(null);
        img.src = base64;
      });
    } catch {
      return null;
    }
  };

  const exportAsImages = async (outputFolder: string) => {
    let success = 0;
    let failed = 0;

    for (const viewedImage of imagesToExport) {
      try {
        const canvas = await renderImageWithDrawing(viewedImage);
        if (canvas) {
          const dataUrl = canvas.toDataURL("image/png");
          
          // Extract just the drawing data for the backend to merge
          await invoke("save_annotated_image", {
            request: {
              original_path: viewedImage.path,
              drawing_data_url: dataUrl,
              output_folder: outputFolder,
              apply_opacity: applyOpacity,
              opacity: imageOpacity,
            },
          });
          success++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error("Failed to export image:", err);
        failed++;
      }
      setProgress((prev) => ({ ...prev, current: prev.current + 1 }));
    }

    setResult({ success, failed });
  };

  const exportAsPdfSequence = async (outputFolder: string) => {
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [1920, 1080],
      });

      let isFirstPage = true;

      for (let i = 0; i < imagesToExport.length; i++) {
        const viewedImage = imagesToExport[i];
        
        if (!isFirstPage) {
          pdf.addPage([1920, 1080], "landscape");
        }
        isFirstPage = false;

        const canvas = await renderImageWithDrawing(viewedImage, 1920, 1080);
        if (canvas) {
          const imgData = canvas.toDataURL("image/jpeg", 0.9);
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          
          // Center the image on the page
          const x = (1920 - imgWidth) / 2;
          const y = (1080 - imgHeight) / 2;
          
          pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);
        }

        setProgress({ current: i + 1, total: imagesToExport.length });
      }

      const filename = `${sessionName || "session"}_${Date.now()}.pdf`;
      const pdfBlob = pdf.output("blob");
      
      // Convert blob to base64 and save via Tauri
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await invoke("save_pdf", {
          base64Data: base64,
          outputPath: `${outputFolder}/${filename}`,
        });
        setResult({ success: imagesToExport.length, failed: 0 });
      };
      reader.readAsDataURL(pdfBlob);
    } catch (err) {
      console.error("PDF export error:", err);
      setResult({ success: 0, failed: imagesToExport.length });
    }
  };

  const exportAsPdfGallery = async (outputFolder: string) => {
    try {
      const columns = galleryLayout === "1-column" ? 1 : galleryLayout === "2-column" ? 2 : 3;
      const pageWidth = 1920;
      const pageHeight = 1080;
      const margin = 40;
      const gap = 20;
      
      const cellWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
      const rows = columns === 1 ? 2 : columns === 2 ? 2 : 3;
      const cellHeight = (pageHeight - margin * 2 - gap * (rows - 1)) / rows;
      const imagesPerPage = columns * rows;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [pageWidth, pageHeight],
      });

      let isFirstPage = true;
      let imageIndex = 0;

      while (imageIndex < imagesToExport.length) {
        if (!isFirstPage) {
          pdf.addPage([pageWidth, pageHeight], "landscape");
        }
        isFirstPage = false;

        // Fill background
        pdf.setFillColor(26, 26, 46); // dark-bg color
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        for (let slot = 0; slot < imagesPerPage && imageIndex < imagesToExport.length; slot++) {
          const viewedImage = imagesToExport[imageIndex];
          const col = slot % columns;
          const row = Math.floor(slot / columns);
          
          const x = margin + col * (cellWidth + gap);
          const y = margin + row * (cellHeight + gap);

          const canvas = await renderImageWithDrawing(viewedImage, cellWidth, cellHeight);
          if (canvas) {
            const imgData = canvas.toDataURL("image/jpeg", 0.85);
            
            // Center the image within the cell
            const offsetX = (cellWidth - canvas.width) / 2;
            const offsetY = (cellHeight - canvas.height) / 2;
            
            pdf.addImage(imgData, "JPEG", x + offsetX, y + offsetY, canvas.width, canvas.height);
          }

          imageIndex++;
          setProgress({ current: imageIndex, total: imagesToExport.length });
        }
      }

      const filename = `${sessionName || "session"}_gallery_${Date.now()}.pdf`;
      const pdfBlob = pdf.output("blob");
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await invoke("save_pdf", {
          base64Data: base64,
          outputPath: `${outputFolder}/${filename}`,
        });
        setResult({ success: imagesToExport.length, failed: 0 });
      };
      reader.readAsDataURL(pdfBlob);
    } catch (err) {
      console.error("Gallery PDF export error:", err);
      setResult({ success: 0, failed: imagesToExport.length });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-dark-surface rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dark-text">Export Options</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-dark-muted hover:text-dark-text transition-colors disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Format Selection */}
        <div className="mb-6">
          <label className="text-dark-text font-medium block mb-2">Export Format</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFormat("images")}
              disabled={isExporting}
              className={`p-3 rounded-lg border-2 transition-colors ${
                format === "images"
                  ? "border-blue-500 bg-blue-500/20 text-blue-400"
                  : "border-dark-accent bg-dark-bg text-dark-muted hover:border-dark-text"
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">Images</span>
            </button>
            <button
              onClick={() => setFormat("pdf")}
              disabled={isExporting}
              className={`p-3 rounded-lg border-2 transition-colors ${
                format === "pdf"
                  ? "border-blue-500 bg-blue-500/20 text-blue-400"
                  : "border-dark-accent bg-dark-bg text-dark-muted hover:border-dark-text"
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">PDF</span>
            </button>
            <button
              onClick={() => setFormat("pdf-gallery")}
              disabled={isExporting}
              className={`p-3 rounded-lg border-2 transition-colors ${
                format === "pdf-gallery"
                  ? "border-blue-500 bg-blue-500/20 text-blue-400"
                  : "border-dark-accent bg-dark-bg text-dark-muted hover:border-dark-text"
              }`}
            >
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="text-xs">Gallery</span>
            </button>
          </div>
        </div>

        {/* Gallery Layout (only for pdf-gallery) */}
        {format === "pdf-gallery" && (
          <div className="mb-6">
            <label className="text-dark-text font-medium block mb-2">Gallery Layout</label>
            <div className="flex gap-2">
              {(["1-column", "2-column", "3-column"] as GalleryLayout[]).map((layout) => (
                <button
                  key={layout}
                  onClick={() => setGalleryLayout(layout)}
                  disabled={isExporting}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                    galleryLayout === layout
                      ? "bg-blue-600 text-white"
                      : "bg-dark-bg text-dark-muted hover:bg-dark-accent"
                  }`}
                >
                  {layout.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyOpacity}
              onChange={(e) => setApplyOpacity(e.target.checked)}
              disabled={isExporting}
              className="w-5 h-5 rounded bg-dark-bg border-dark-accent text-blue-600 
                         focus:ring-blue-500 focus:ring-offset-dark-bg"
            />
            <span className="text-dark-text">Apply image opacity ({imageOpacity}%)</span>
          </label>
          {hasAnyDrawings && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWithoutMarkup}
                onChange={(e) => setIncludeWithoutMarkup(e.target.checked)}
                disabled={isExporting}
                className="w-5 h-5 rounded bg-dark-bg border-dark-accent text-blue-600 
                           focus:ring-blue-500 focus:ring-offset-dark-bg"
              />
              <span className="text-dark-text">Include images without drawings</span>
            </label>
          )}
        </div>

        {/* Summary */}
        <div className="bg-dark-bg rounded-lg p-3 mb-6">
          <p className="text-dark-muted text-sm">
            <span className="text-dark-text font-medium">{imagesToExport.length}</span> images will be exported
            {hasAnyDrawings
              ? imagesWithMarkup.length !== selectedViewedImages.length && (
                  <span className="ml-1">
                    ({imagesWithMarkup.length} with drawings)
                  </span>
                )
              : (
                  <span className="ml-1">(reference images only)</span>
                )}
          </p>
        </div>

        {/* Progress */}
        {isExporting && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-dark-muted mb-1">
              <span>Exporting...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`mb-6 p-3 rounded-lg ${
            result.failed === 0 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
          }`}>
            <p className="text-sm">
              {result.failed === 0
                ? `Successfully exported ${result.success} images!`
                : `Exported ${result.success} images, ${result.failed} failed.`}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 px-4 py-3 bg-dark-accent hover:bg-dark-bg text-dark-text 
                       rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {result ? "Done" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleExport}
              disabled={isExporting || imagesToExport.length === 0}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white 
                         rounded-lg font-medium transition-colors disabled:opacity-50
                         flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Export
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
