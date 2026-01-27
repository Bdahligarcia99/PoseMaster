# Changelog

All notable changes to PoseMaster will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-27

### Added
- Initial release
- Folder-based image loading with support for JPG, PNG, GIF, WebP, BMP, TIFF
- Multiple drawing tools: pen, ballpoint, pencil, brush, highlighter
- Customizable eraser tool (can be disabled)
- Adjustable stroke width and color palette
- Timer with preset durations (30s, 45s, 1min, 2min, 5min, 10min) and custom time
- Break intervals between images
- Image count limits per session
- Image opacity and zoom controls
- Session saving with non-destructive drawing layers
- Session resume functionality
- Previous sessions management (view, resume, export, delete)
- Export options:
  - Individual PNG images
  - PDF with one image per page
  - PDF gallery with 1, 2, or 3 column layouts
- Session setup preview screen
- Gallery view for browsing session images
- Drawing layer visibility toggle
- Skip/remove image from session feature
- Option to hide timer during sessions
- Splash screen on app launch
- Dark mode UI
- Keyboard shortcuts for all major actions

### Technical
- Built with Tauri v2 (Rust backend)
- React 18 + TypeScript frontend
- react-konva for canvas drawing
- Zustand for state management
- Tailwind CSS for styling
- jsPDF for PDF exports
