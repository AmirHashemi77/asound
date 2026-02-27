# ASound Project Context (for ChatGPT)

## 1) Project Overview
ASound is a **client-side music player PWA** built with **React + TypeScript + Vite**.
It lets users import local audio files/folders, stores metadata and files in IndexedDB, and provides offline-friendly playback with a mobile-first UI.

Core stack:
- React 18, TypeScript, Vite
- Zustand (state management)
- Dexie (IndexedDB wrapper)
- Framer Motion (animations)
- Three.js (background visualizer)
- vite-plugin-pwa (PWA + service worker)
- music-metadata-browser (audio metadata parsing)

## 2) Product Goals
- Play local music files without a backend.
- Work as a PWA with offline capabilities.
- Support iOS/Android/Desktop browser environments as much as possible.
- Provide a simple library + playlist + player experience.

## 3) Main User Scenarios
### Scenario A: First launch and initial import
1. User opens app for first time.
2. `InitialImportGate` checks if library is empty and first import is not done.
3. User imports from folder (if supported) or files.
4. App extracts metadata (title/artist/album/duration/cover).
5. Tracks are saved to IndexedDB and shown in Library.

### Scenario B: Add more music later
1. User navigates to Add Music page.
2. Picks files via File System Access API or file input fallback.
3. App extracts metadata and stores tracks.
4. New tracks are prepended to the library list.

### Scenario C: Playback control
1. User picks a track in Library/Playlist.
2. `currentTrackId` set in store; `isPlaying=true`.
3. Audio engine resolves source (blob/file-handle) and sets `audio.src`.
4. Playback starts; Media Session metadata/handlers are set.
5. Mini player + full player both control same audio singleton.

### Scenario D: Playlist management
1. User creates playlist.
2. Adds/removes tracks via bottom sheet.
3. Reorders tracks with up/down actions.
4. Plays any playlist item directly.

### Scenario E: Settings and storage
1. User toggles Theme / Low Power / Auto Import.
2. Can clear library + cached handles from IndexedDB.
3. Low Power disables Three.js visualizer for battery saving.

## 4) Architecture
### Frontend structure
- `src/main.tsx`: app bootstrap + router + theme provider + SW registration
- `src/App.tsx`: root layout, route definitions, startup components
- `src/pages/*`: top-level screens
- `src/components/*`: reusable UI and overlays
- `src/store/*`: Zustand stores + audio context
- `src/lib/*`: browser/media utility layer
- `src/db/*`: Dexie database and repositories

### State layer
#### `usePlayerStore` (`src/store/player.ts`)
Holds:
- tracks, playlists
- currentTrackId, isPlaying
- currentTime, duration
- shuffle, repeat
Provides actions:
- library load/add/remove
- playlist CRUD
- playback flags (set current, play state, seek state)
- metadata repair pass for incomplete tracks

#### `useSettings` (`src/store/settings.ts`)
Persisted settings:
- `lowPowerMode`
- `autoImport`
- `volume`

#### Theme context (`src/store/theme.tsx`)
- light/dark/system mode
- resolves system preference and sets `document.documentElement.dark`

### Audio engine
- Hook: `src/hooks/useAudioEngine.ts`
- Singleton audio element: `src/lib/audioEngine.ts`
- Responsibilities:
  - play/pause/next/prev/seek
  - sync `currentTime` + duration to store
  - apply volume from settings
  - handle repeat/shuffle behavior
  - resolve track sources from blob or stored file handles
  - setup Media Session handlers
  - request/release Wake Lock

### Persistence layer (IndexedDB)
Dexie DB name: `prism-player` (`src/db/db.ts`)
Tables:
- `tracks`: audio metadata + optional blob + source info
- `playlists`: name + ordered `trackIds`
- `handles`: persisted `FileSystemFileHandle`

Repositories:
- `trackRepo`: bulk upsert/get/delete/clear
- `playlistRepo`: create/get/update/delete
- `handleRepo`: save/get/clear

## 5) Data Model
### TrackMeta
- `id`, `title`, `artist`, `album`, `duration`
- `coverUrl`, `addedAt`, `lastModified`, `size`
- `source`: `handle | file | blob`
- optional `handleId`, optional `blob`

### Playlist
- `id`, `name`
- `trackIds` (ordered)
- `createdAt`, `updatedAt`

## 6) PWA/Offline Behavior
- SW registration in `src/pwa/registerSW.ts`
- `vite-plugin-pwa` config in `vite.config.ts`
- Runtime cache includes audio requests (`CacheFirst`, `audio-cache`, up to 120 entries / 30 days)
- Install prompt component supports:
  - `beforeinstallprompt` (Chromium)
  - iOS instruction fallback (Share -> Add to Home Screen)

## 7) UX Components of Note
- `StartupSplash`: initial branding animation
- `InitialImportGate`: first-time import modal
- `MiniPlayer`: persistent bottom compact player
- `BackgroundVisualizer`: Three.js floating circles reacting to audio energy (disabled in low power mode)
- `SortSheet`, `TrackPickerSheet`: bottom-sheet interactions

## 8) Platform Constraints
- iOS Safari lacks full File System Access API support.
- iOS lock-screen/background audio controls are limited by Safari behavior.
- IndexedDB capacity depends on device/browser limits.
- Auto-import stores blobs for resilience/offline playback but increases storage use.

## 9) Routing Map
- `/` -> Library
- `/playlists` -> Playlists
- `/player` -> Full Player
- `/settings` -> Settings
- `/add` -> Add Music

## 10) How to Run
```bash
npm install
npm run dev
```
Build/preview:
```bash
npm run build
npm run preview
```

## 11) Suggested Prompt to Give ChatGPT
Use this prompt when asking ChatGPT to help on this repo:

```text
You are my senior React/TypeScript pair programmer for the ASound project.

Project summary:
- ASound is a local-music PWA (React + TS + Vite).
- State is managed by Zustand (`usePlayerStore`, `useSettings`).
- Data persists in IndexedDB via Dexie (`tracks`, `playlists`, `handles`).
- Playback is driven by a singleton HTMLAudioElement through `useAudioEngine`.
- Track sources may be blobs or persisted File System handles.
- Key features: library import, playlist management, full player + mini player, media session, wake lock, install prompt.
- Routes: `/`, `/playlists`, `/player`, `/settings`, `/add`.

When you propose changes:
1) Preserve current architecture (store/db/lib/page boundaries).
2) Keep mobile-first behavior and PWA constraints in mind.
3) Mention exact files to edit and why.
4) Include edge cases for iOS Safari and offline behavior.
5) Prefer incremental, testable patches.
```

## 12) Important File References
- App shell and routes: `src/App.tsx`
- Audio engine hook: `src/hooks/useAudioEngine.ts`
- Player store: `src/store/player.ts`
- Settings store: `src/store/settings.ts`
- DB schema: `src/db/db.ts`
- Import utilities: `src/lib/fileAccess.ts`
- Add music page: `src/pages/AddMusicPage.tsx`
- First import modal: `src/components/InitialImportGate.tsx`
- PWA config: `vite.config.ts`
