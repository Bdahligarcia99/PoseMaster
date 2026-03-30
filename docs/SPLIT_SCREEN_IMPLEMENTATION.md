# Split Screen Mode Implementation Plan

> Feature: Split Screen for Image Curator with Free Draw Canvas

## Overview

Add a split screen mode to the Session Setup area that divides the canvas into two halves:
- **Left**: Image Curator (reference image)
- **Right**: Free Draw (blank practice canvas)

This enables proportion exercises where users draw on the blank canvas, then overlay their drawing on the reference for comparison.

---

## Feature Summary

| Aspect | Detail |
|--------|--------|
| Toggle Location | Top center of Session Setup (not in settings pane) |
| Split Type | Vertical (50/50) |
| Resizable | No (v1) |
| Zoom | Always linked (both halves zoom together) |
| Timer | Works as usual based on timed/untimed setting |

### Drawing Layers
- **Two separate drawing layer arrays** (one per side)
- Both are **per-image** (advancing to next image = new layers for both sides)
- Markup toggle affects both halves
- Free Draw side always has drawing enabled

### Layer Transfer
- **Temporary toggle** to overlay Free Draw drawing onto Image Curator
- For comparison only, not permanent

### Toolbar
- **Shared** between both canvases
- Same brush, color, size settings apply to active canvas
- Click a canvas to make it active

### Guidelines
- Draggable from canvas edges
- Vertical lines (drag from left/right edge)
- Horizontal lines (drag from top/bottom edge)
- Stored per-image

---

## Settings Behavior (When Split Screen Active)

| Setting | Behavior |
|---------|----------|
| Opacity | Image Curator side ONLY (Free Draw has no opacity) |
| Image Size/Zoom | Linked (affects both halves) |
| Markup Controls | Applies to both halves |
| Hide Timer | Universal |
| Include Preview | Universal |
| Remember Settings | Works as normal |

---

## Phased Implementation

### Phase 1: Split Screen Foundation
- [ ] Add split screen toggle button to Session Setup header (top center)
- [ ] Create split view layout (50/50 vertical)
- [ ] Left: Image Curator, Right: Free Draw (default positions)
- [ ] Zoom is always linked (both halves zoom together)
- [ ] State additions to sessionStore:
  - `isSplitScreen: boolean`

### Phase 2: Dual Drawing Layers
- [ ] Create separate drawing layer arrays:
  - `curatorDrawings: Record<string, DrawingData>` (per image)
  - `freeDrawDrawings: Record<string, DrawingData>` (per image)
- [ ] Track active canvas: `activeCanvas: "curator" | "freeDraw"`
- [ ] Click on a canvas to make it active
- [ ] Visual indicator showing which canvas is active (border/glow)

### Phase 3: Shared Toolbar Integration
- [ ] Toolbar controls apply to active/focused canvas
- [ ] Brush, color, size, eraser all work on whichever canvas is active
- [ ] Same tool state shared between both canvases

### Phase 4: Settings & Layer Transfer
- [ ] Opacity slider affects Image Curator side only
- [ ] All other settings work universally
- [ ] Add "Compare" / "Overlay" button when split screen is active
- [ ] Temporarily renders Free Draw layer on top of Image Curator
- [ ] Toggle on/off for comparison mode

### Phase 5: Draggable Guidelines
- [ ] Add guide rails to canvas edges (visual affordance)
- [ ] Drag from left/right edge → creates vertical guideline
- [ ] Drag from top/bottom edge → creates horizontal guideline
- [ ] Guidelines are draggable/repositionable
- [ ] Delete by dragging back to edge or X button
- [ ] Store guidelines per image: `imageGuidelines: Record<string, { vertical: number[], horizontal: number[] }>`

### Phase 6: Polish & Integration
- [ ] Swap sides toggle: Switch Image Curator ↔ Free Draw positions
- [ ] Keyboard shortcuts for split screen toggle
- [ ] Save split screen preference in settings
- [ ] Session saving includes both layer arrays
- [ ] Handle edge cases (small screens, aspect ratios)

---

## State Changes Summary

### sessionStore.ts additions
```typescript
// Split screen state
isSplitScreen: boolean;
activeCanvas: "curator" | "freeDraw";
splitSidesSwapped: boolean;

// Dual drawing layers (per image path)
curatorDrawings: Record<string, DrawingData>;
freeDrawDrawings: Record<string, DrawingData>;

// Guidelines (per image path)
imageGuidelines: Record<string, {
  vertical: number[];   // X positions
  horizontal: number[]; // Y positions
}>;
```

### New Actions
```typescript
toggleSplitScreen: () => void;
setActiveCanvas: (canvas: "curator" | "freeDraw") => void;
swapSplitSides: () => void;
updateCuratorDrawing: (imagePath: string, data: DrawingData) => void;
updateFreeDrawDrawing: (imagePath: string, data: DrawingData) => void;
addGuideline: (imagePath: string, type: "vertical" | "horizontal", position: number) => void;
removeGuideline: (imagePath: string, type: "vertical" | "horizontal", index: number) => void;
updateGuidelinePosition: (imagePath: string, type: "vertical" | "horizontal", index: number, position: number) => void;
```

---

## UI Components

### New Components
- `SplitScreenToggle.tsx` - Toggle button for header
- `FreeDrawCanvas.tsx` - Blank canvas for practice drawing
- `GuidelineOverlay.tsx` - Draggable guidelines layer
- `CompareOverlay.tsx` - Overlay for layer transfer comparison

### Modified Components
- `SessionSetup.tsx` - Add split screen layout and toggle
- `SessionView.tsx` - Support split screen during active sessions
- `Toolbar.tsx` - Handle active canvas context
- Settings pane - Show which half is active, opacity for curator only

---

## Future Considerations

- Free Draw as standalone mode (separate from Image Curator)
- Resizable split (drag to adjust 50/50 ratio)
- Multiple guideline colors/styles
- Save/load guideline presets
- Undo/redo for guidelines

---

## Git Tag

This implementation plan was created at tag: `v1.3.0-pre-split-screen`

To return to this state:
```bash
git checkout v1.3.0-pre-split-screen
```
