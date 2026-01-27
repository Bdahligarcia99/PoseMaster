# PoseMaster

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="PoseMaster Icon" width="128" height="128">
</p>

<p align="center">
  <strong>A cross-platform desktop app for artists to practice gesture drawing with timed reference images.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#keyboard-shortcuts">Shortcuts</a> •
  <a href="#development">Development</a> •
  <a href="#license">License</a>
</p>

---

## About

PoseMaster helps artists practice gesture drawing, figure construction, skeleton studies, cylinders in perspective, and more using timed reference images. Save your sessions with drawings to review later, and export to share with instructors or communities for feedback.

**Get reference images from:** [Cubebrush](https://cubebrush.co), [Proko](https://www.proko.com), [Line of Action](https://line-of-action.com), [QuickPoses](https://www.quickposes.com), [Posemaniacs](https://www.posemaniacs.com), [ArtStation Marketplace](https://www.artstation.com/marketplace), [SenshiStock](https://senshistock.com), and more.

## Features

### Drawing & Practice
- **Multiple drawing tools**: Pen, ballpoint, pencil, brush, and highlighter - each with unique visual characteristics
- **Adjustable settings**: Stroke width, color palette, image opacity, and zoom
- **Eraser tool**: Optional, can be disabled in settings
- **Non-destructive**: Drawings are stored as separate layers, original images are never modified

### Session Management
- **Folder-based loading**: Select folders containing reference images (JPG, PNG, GIF, WebP, BMP, TIFF)
- **Multiple folders**: Save and quickly switch between different image folders
- **Customizable timer**: Preset durations (30s, 45s, 1min, 2min, 5min, 10min) or custom time
- **Break intervals**: Configurable pause between images for reorientation
- **Image count limit**: Choose how many images per session
- **Session saving**: Save sessions to resume later, preserving all drawings and progress
- **Session history**: View and manage all saved sessions

### Export Options
- **Individual images**: Export as PNG files with drawings baked in
- **PDF sequence**: One image per page
- **PDF gallery**: Multiple images per page (1, 2, or 3 column layouts)
- **Opacity support**: Apply session opacity settings to exports

### User Experience
- **Splash screen**: Beautiful app launch screen
- **Dark mode UI**: Easy on the eyes during long practice sessions
- **Session setup preview**: Practice drawing and adjust settings before starting
- **Gallery view**: Review all images in a session with navigation

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/Bdahligarcia99/PoseMaster/releases) page.

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `PoseMaster_x.x.x_aarch64.dmg` |
| macOS (Intel) | `PoseMaster_x.x.x_x64.dmg` |
| Windows | `PoseMaster_x.x.x_x64-setup.exe` |
| Linux | `PoseMaster_x.x.x_amd64.deb` |

### macOS Installation

1. Download the `.dmg` file
2. Double-click to open
3. Drag PoseMaster to your Applications folder
4. First launch: Right-click → Open (to bypass Gatekeeper)

## Usage

### Quick Start

1. **Add a folder**: Click "Add Folder" and select a folder containing reference images
2. **Configure session**: Set timer duration, break time, and number of images
3. **Start practicing**: Click "New Session" to begin, or "Session Setup" to preview first
4. **Draw**: Use the toolbar to select tools and colors
5. **Save or export**: After the session, save to continue later or export your work

### Session Setup

Before starting a session, you can:
- Adjust image **opacity** (see through to trace)
- Adjust **zoom** level
- **Practice drawing** on a preview image
- **Hide timer** for distraction-free practice
- **Disable eraser** to prevent accidental erasing
- Choose to **include the preview image** in your session

### Previous Sessions

Access your saved sessions from the main screen:
- **Resume**: Continue an incomplete session from where you left off
- **View**: Browse the session gallery
- **Export**: Export the session without opening it
- **Delete**: Remove a saved session

## Keyboard Shortcuts

### During Session
| Key | Action |
|-----|--------|
| `Space` | Pause/Resume timer |
| `→` | Skip to next image |
| `←` | Go to previous image (during break) |
| `X` | Remove current image from session |
| `Escape` | End session |

### Drawing
| Key | Action |
|-----|--------|
| `Z` | Undo |
| `Y` | Redo |
| `C` | Clear canvas |

### Gallery View
| Key | Action |
|-----|--------|
| `←` / `→` | Navigate images |
| `D` | Toggle drawing layer visibility |
| `Escape` | Exit gallery |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)
- [pnpm](https://pnpm.io/) or npm

### Setup

```bash
# Clone the repository
git clone https://github.com/Bdahligarcia99/PoseMaster.git
cd PoseMaster

# Install dependencies
npm install

# Run development server
npm run tauri dev
```

### Building

```bash
# Create production build
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Tauri v2 (Rust) |
| Drawing | react-konva (Canvas) |
| Styling | Tailwind CSS |
| State | Zustand |
| PDF Export | jsPDF |

### Project Structure

```
PoseMaster/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── DrawingCanvas.tsx
│   │   ├── ExportOptionsModal.tsx
│   │   ├── FolderPicker.tsx
│   │   ├── SessionGallery.tsx
│   │   ├── SessionSetup.tsx
│   │   ├── SessionSummary.tsx
│   │   ├── SessionView.tsx
│   │   ├── Toolbar.tsx
│   │   └── ...
│   ├── store/              # Zustand state stores
│   │   ├── sessionStore.ts
│   │   ├── drawingStore.ts
│   │   ├── savedSessionsStore.ts
│   │   └── settingsStore.ts
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   └── commands.rs     # Tauri commands
│   ├── icons/              # App icons
│   └── tauri.conf.json     # Tauri config
├── public/                 # Static assets
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Tauri](https://tauri.app/)
- Drawing powered by [Konva](https://konvajs.org/)
- Icons and UI inspired by modern design principles
