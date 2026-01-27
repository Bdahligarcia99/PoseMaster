# Gesture Practice

A cross-platform desktop app for artists to practice gesture drawing with timed reference images.

## Features

- **Folder-based image loading**: Select a folder containing reference images (JPG, PNG, GIF, WebP, BMP, TIFF)
- **Customizable timer**: Preset durations (30s, 45s, 1min, 2min, 5min, 10min) or custom time
- **Drawing tools**: Pen and eraser with adjustable size and colors
- **Session tracking**: Track all viewed images during a practice session
- **Export**: Save annotated images with your markup to a new folder

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri backend)

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run tauri dev
   ```

## Building for Production

To create a production build:

```bash
npm run tauri build
```

This will create platform-specific installers in `src-tauri/target/release/bundle/`.

## Keyboard Shortcuts

- **Space**: Pause/Resume timer
- **Right Arrow**: Skip to next image
- **Left Arrow**: Go to previous image
- **Escape**: End session

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri v2 (Rust)
- **Drawing**: react-konva
- **Styling**: Tailwind CSS
- **State**: Zustand

## Project Structure

```
gesture-practice/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── store/              # Zustand state stores
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   └── commands.rs     # Tauri commands
│   └── tauri.conf.json
└── package.json
```

## License

MIT
