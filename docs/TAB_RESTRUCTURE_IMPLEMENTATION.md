# Tab Restructure & Presets Overhaul Implementation Plan

> Feature: Redesign home screen tabs with prebuilt presets for intuitive onboarding

## Overview

Restructure the app's tab system to make it more intuitive:
- **New Session** tab: Prebuilt presets + user presets (quick start)
- **Previous Sessions** tab: No changes
- **Advanced** tab: Full settings control (current "New Session" content)

---

## Tab Structure

### Before
```
[ New Session ] [ Previous Sessions ] [ Presets ]
```

### After
```
[ New Session ] [ Previous Sessions ] [ Advanced ]
```

| Tab | Content |
|-----|---------|
| New Session | Prebuilt preset tiles + collapsible user presets list |
| Previous Sessions | Unchanged |
| Advanced | All settings (folders, timer, mode selection, etc.) |

---

## Prebuilt Presets

| ID | Name | Per Image | Break | Images | Total | Markup | Description |
|----|------|-----------|-------|--------|-------|--------|-------------|
| `quick-gestures` | Quick Gestures | 30s | 5s | 50 | ~29 min | Off | Fast gesture practice |
| `standard-practice` | Standard Practice | 1 min | 5s | 27 | ~29 min | Off | Balanced study |
| `deep-study` | Deep Study | 2 min | 5s | 14 | ~30 min | Off | Detailed observation |
| `structure-study` | Structure Study | 2 min | 5s | 14 | ~30 min | On | Skeleton & cylinder practice |

**Prebuilt Behavior:**
- Cannot be modified directly
- User can load → modify in Advanced → save as NEW preset
- Always available (not stored in user data)

---

## Decisions Summary

| Aspect | Decision |
|--------|----------|
| Prebuilt Presets | 4 presets - templates only, cannot be modified |
| User Presets | "My Presets (X)" with count, collapsible list |
| Previous Sessions | Stays as 2nd tab, no changes |
| Persistence on Reopen | Remember last used preset (prebuilt or user-created) |
| Remember Settings Checkboxes | Remove entirely - app auto-remembers during session |
| Starting from Advanced | Ask "Save as preset?" before starting |
| Mode Selection | Lives in Advanced tab, presets remember mode |
| Split View | Full support - presets can store split view preference |

---

## UI Mockup

### New Session Tab

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Quick     │  │  Standard   │  │    Deep     │         │
│  │  Gestures   │  │  Practice   │  │   Study     │         │
│  │   ~29min    │  │   ~29min    │  │   ~30min    │         │
│  │    30s      │  │    1min     │  │    2min     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐                                           │
│  │  Structure  │                                           │
│  │   Study     │                                           │
│  │   ~30min    │                                           │
│  │  ✏️ Markup   │                                           │
│  └─────────────┘                                           │
│                                                             │
│  ▼ My Presets (3)                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Custom Practice Session              [Load] [Delete]│   │
│  │ Quick Warmup                         [Load] [Delete]│   │
│  │ Long Study Session                   [Load] [Delete]│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [ + New Preset ]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Advanced Tab

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Practice Mode                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │Image Curator │ │  Free Draw   │ │     3D       │        │
│  │   (active)   │ │ (coming soon)│ │ (coming soon)│        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  Image Sources                                              │
│  [Filter ▼] [Import URLs] [Add Folder]                     │
│  ☑ Folder 1 (234)  ☑ Folder 2 (156)                        │
│                                                             │
│  Timer Mode          │  Image Count                        │
│  [Timed] [Untimed]   │  [All ▼]                            │
│                      │                                      │
│  Image Duration      │                                      │
│  [30s] [1m] [2m] ... │                                      │
│                      │                                      │
│  Break               │                                      │
│  [None] [2s] [5s]... │                                      │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Session duration: 29m 30s                                  │
│  50 images × 30s + 49 breaks × 5s                          │
│                                                             │
│  [Browse]  [Session Setup]  [Begin Session]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Phased Implementation

### Phase 1: Tab Restructure
- [ ] Rename "Presets" tab → "New Session"
- [ ] Rename "New Session" tab → "Advanced"
- [ ] Reorder tabs: New Session, Previous Sessions, Advanced
- [ ] Update `activeTab` state type and handlers
- [ ] Update TabNav component usage

### Phase 2: Prebuilt Presets
- [ ] Define `PREBUILT_PRESETS` constant array with 4 presets
- [ ] Create `PrebuiltPresetTile` component
- [ ] Design tile UI (name, duration, key settings indicator)
- [ ] Clicking tile loads settings and goes to Session Setup
- [ ] Prebuilt presets not stored in user data

### Phase 3: User Presets Section
- [ ] Create collapsible "My Presets (X)" section
- [ ] Header with expand/collapse toggle and count
- [ ] Default state: collapsed
- [ ] Expanded: list of user preset cards
- [ ] Move "New Preset" button into this section
- [ ] Load/Delete actions on each preset

### Phase 4: Advanced Tab Behavior
- [ ] Ensure all settings are in Advanced tab (folders, mode, timer, etc.)
- [ ] Add "Save as preset?" confirmation dialog
- [ ] Dialog appears when clicking "Begin Session"
- [ ] Options: Yes (name & save), No (just start), Cancel
- [ ] If Yes: save preset, then proceed to session

### Phase 5: Settings Persistence
- [ ] Add `lastUsedPresetId: string | null` to settingsStore
- [ ] On preset load: set `lastUsedPresetId`
- [ ] On app reopen: load last used preset's settings
- [ ] Settings auto-persist in sessionStore during app usage (already works)
- [ ] Add `splitScreenEnabled` to preset settings schema

### Phase 6: Remove Remember Settings Checkboxes
- [ ] Remove checkbox from FolderPicker (Advanced tab)
- [ ] Remove checkbox from SessionSetup
- [ ] Remove `rememberHomeSettings` from settingsStore
- [ ] Remove `rememberSetupSettings` from settingsStore
- [ ] Remove `clearRememberFlags` action
- [ ] Clean up any related migration logic

---

## State Changes

### presetsStore.ts

```typescript
// Prebuilt presets (constant, not stored in user data)
export const PREBUILT_PRESETS: Preset[] = [
  {
    id: "quick-gestures",
    name: "Quick Gestures",
    mode: "image-curator",
    createdAt: 0, // Indicates prebuilt
    isPrebuilt: true,
    settings: {
      isTimedMode: true,
      timerDuration: 30,
      breakDuration: 5,
      imageCountMode: "specific",
      maxImages: 50,
      imageOpacity: 100,
      imageZoom: 100,
      markupEnabled: false,
      eraserDisabled: false,
      timerHidden: false,
      splitScreenEnabled: false,
    },
  },
  {
    id: "standard-practice",
    name: "Standard Practice",
    // ... similar structure, timerDuration: 60, maxImages: 27
  },
  {
    id: "deep-study",
    name: "Deep Study",
    // ... timerDuration: 120, maxImages: 14
  },
  {
    id: "structure-study",
    name: "Structure Study",
    // ... timerDuration: 120, maxImages: 14, markupEnabled: true
  },
];
```

### settingsStore.ts

```typescript
interface AppSettings {
  // Add
  lastUsedPresetId: string | null;
  
  // Remove
  // rememberHomeSettings: boolean;  // DELETE
  // rememberSetupSettings: boolean; // DELETE
}
```

### Preset interface update

```typescript
interface PresetSettings {
  isTimedMode: boolean;
  timerDuration: number;
  breakDuration: number;
  imageCountMode: ImageCountMode;
  maxImages: number | null;
  imageOpacity: number;
  imageZoom: number;
  markupEnabled: boolean;
  eraserDisabled: boolean;
  timerHidden: boolean;
  splitScreenEnabled: boolean; // NEW
}

interface Preset {
  id: string;
  name: string;
  mode: PresetMode;
  createdAt: number;
  isPrebuilt?: boolean; // NEW - true for prebuilt presets
  settings: PresetSettings;
}
```

---

## New Components

| Component | Purpose |
|-----------|---------|
| `PrebuiltPresetTile.tsx` | Large clickable tile for prebuilt presets |
| `UserPresetsSection.tsx` | Collapsible section for user presets |
| `SavePresetDialog.tsx` | "Save as preset?" confirmation dialog |

---

## Migration Notes

1. Existing user presets remain unchanged
2. Existing settings should still load (backward compatible)
3. `rememberHomeSettings` and `rememberSetupSettings` can be ignored on load
4. First app open after update: no `lastUsedPresetId`, show New Session tab

---

## Future Considerations

- Add more prebuilt presets (e.g., split view preset)
- Preset categories/tags
- Import/export presets
- Preset sharing

---

## Git Tag

Create tag before implementation:
```bash
git tag -a v1.4.0-pre-tab-restructure -m "Stable state before tab restructure implementation"
```
