# Playhead

Playhead is an alpha desktop music player for local libraries. It focuses on the core interaction:
scan folders, browse tracks, render waveforms, play with native media controls, manage simple
playlists, favorite tracks, search, and edit file metadata.

The app is intentionally local-first. Playback stays in the renderer through `HTMLAudioElement`;
the Web Audio API is used only to decode selected files and generate waveform peak data.

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Build local installers/packages:

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Release automation is documented in [`docs/releases.md`](docs/releases.md). Tracking is documented
in [`docs/tracking.md`](docs/tracking.md).

## Architecture

- `src/main`: Electron main process. Window creation, IPC, folder scanning, folder watching,
  metadata read/write, artwork extraction, library persistence, and native media shortcuts.
- `src/preload`: Context bridge API exposed as `window.playhead`.
- `src/shared`: Types used by main, preload, and renderer IPC boundaries.
- `src/renderer/src`: React renderer and feature UI.

Renderer feature folders:

- `features/library`: library state helpers, source selection, and empty library state.
- `features/player`: player shell, transport controls, waveform loading state, and Media Session helpers.
- `features/waveform`: waveform peak generation and canvas drawing.
- `features/sidebar`: folder/playlist navigation and sidebar context menus.
- `features/tracks`: track list, artwork, row menus, favorite actions, and drag/drop ordering.
- `features/search`: command search dialog.
- `features/metadata`: metadata editor and artwork replacement UI.
- `components/ui`: local shadcn/Fluid Functionalism primitives.

## Current Scope

Playhead currently avoids accounts, cloud sync, library databases, routing, native audio engines,
and large state libraries. Library data is persisted as local JSON through the Electron main process.

Known limitations:

- Metadata writing is limited to the file formats supported by the current native metadata bridge.
- The renderer composition in `App.tsx` still owns the top-level playback/library orchestration.
- Signed/notarized distribution is not set up yet.

## Contributing

Keep changes small, explicit, and easy to review. Prefer existing feature folders and shared types over
new layers. Run `npm run typecheck`, `npm run lint`, and `npm run test` before opening a PR.
