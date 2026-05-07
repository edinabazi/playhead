<p align="center">
  <img src="./docs/assets/hero.png" alt="Playhead Hero" />
</p>

<h1 align="center">Playhead</h1>

<p align="center">
  A minimal, design-driven, local-first music player for people who still keep their own music files.
</p>

<p align="center">
  <strong>Waveforms.</strong> <strong>Metadata.</strong> <strong>Folders.</strong> <strong>No accounts.</strong> <strong>No ads.</strong>
</p>

<p align="center">
  <a href="#status">Status</a>
  ·
  <a href="#features">Features</a>
  ·
  <a href="#development">Development</a>
  ·
  <a href="#contributing">Contributing</a>
  ·
  <a href="#license">License</a>
</p>

---

## Why Playhead exists

Most music apps are either streaming-first, overly complex, ugly, cloud-tied, or built around workflows that do not fit people with real local music collections.

Playhead is for music enthusiasts, DJs, producers, collectors, and anyone who wants a clean desktop player for their own files.

Add your folders. Browse your library. See the waveform. Play tracks quickly. Edit metadata when something is wrong. Keep everything local.

No account. No subscription. No cloud library. No ads. No bloated onboarding. Just your music.

Playhead was designed and built by a designer, developer, and DJ hobbyist who always wanted a simple, modern, waveform-based local music player that felt good to use.

## Screenshots

> Replace these with real screenshots from the app.

<p align="center">
  <img src="./docs/assets/screenshot_1.png" alt="Playhead library view" />
</p>

<p align="center">
  <img src="./docs/assets/screenshot_2.png" alt="Playhead search modal" />
</p>

<p align="center">
  <img src="./docs/assets/screenshot_3.png" alt="Playhead library settings" />
</p>

<p align="center">
  <img src="./docs/assets/screenshot_4.png" alt="Playhead shortcuts view" />
</p>

## Features

### Two ways to browse your music

Playhead supports two display modes, depending on how you like to organize your collection.

**Library mode** combines your imported folders into one clean music library. Browse by tracks, artists, albums, playlists, and favorites.

**Folder mode** keeps your imported folders visible as the main structure. This is useful for DJs, producers, download folders, exports, set prep, samples, references, and messy real-world music libraries.

### Local-first playback

Playhead plays audio directly from your machine. Your files stay on disk, and your library state is stored locally.

Supported formats include:

- MP3
- FLAC
- WAV
- AIFF / AIF
- M4A
- OGG
- OPUS
- AAC

### Waveform-based player

Playhead generates and caches waveform data for local audio files, giving you a quick visual sense of the track while you listen.

### Metadata editing

View and edit track metadata without leaving the app.

Editable fields include:

- Title
- Artist
- Album
- Album artist
- Genre
- Year
- Track number
- Disk number
- Composer
- BPM
- Comment
- Artwork

Metadata reading is powered by `music-metadata`. Metadata writing uses a native bridge through `node-taglib-sharp`, so write support depends on the audio format and tag support available through that layer.

### Built for speed and simplicity

Playhead is intentionally minimal. The goal is zero learning curve.

- Slick modern UI
- Dark mode
- Smooth animations and interactions
- Keyboard shortcuts
- Native media key support
- Drag and drop folder imports
- Folder watching
- Playlists
- Favorites
- Shuffle and repeat
- Search
- Backup and restore of local library state
- Show tracks in the native file manager

## Privacy

Playhead is local-first by design.

It is not a streaming app. It does not require an account. It does not upload your library to a cloud service. It does not serve ads.

The app includes optional telemetry support for product improvement. Release builds can run without a telemetry key, and telemetry can be disabled in settings.

## Status

Playhead is in active development and should currently be treated as beta software.

Current limitations:

- macOS is the only packaged target right now.
- Windows and Linux support may return later.
- Builds may be unsigned or not notarized during early development.
- Metadata writing depends on supported formats.
- Some behavior may change as the app stabilizes.

Use it, test it, break it, report issues, and help shape it.

## Development

Install dependencies:

```bash
pnpm install
```

Start the app in development:

```bash
pnpm dev
```

Run checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Build a distributable app:

```bash
pnpm dist
```

Build for macOS:

```bash
pnpm dist:mac
```

## Tech stack

Playhead is built with:

- Electron
- electron-vite
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Wavesurfer.js
- music-metadata
- node-taglib-sharp
- Vitest
- ESLint
- Prettier
- electron-builder

## Architecture

```txt
src/main
  Electron main process, IPC, folder scanning, folder watching,
  metadata read/write, artwork extraction, library persistence,
  and native media shortcuts.

src/preload
  Context bridge API exposed to the renderer as window.playhead.

src/shared
  Shared types used across main, preload, and renderer boundaries.

src/renderer/src
  React renderer and feature UI.
```

Main renderer feature areas:

```txt
features/library      Library state, sources, artists, albums, empty states
features/player       Player shell, transport controls, media session helpers
features/waveform     Waveform generation and drawing
features/sidebar      Folder and playlist navigation
features/tracks       Track list, artwork, menus, favorites, ordering
features/search       Command-style track search
features/metadata     Metadata editor and artwork replacement
features/settings     Library, playback, appearance, shortcuts, advanced settings
components/ui         Local UI primitives
```

## Contributing

Playhead is meant to stay focused, polished, and simple.

Good contributions are usually:

- Small and easy to review
- Consistent with the existing UI direction
- Local-first by default
- Useful for real music collections
- Clear about tradeoffs

Before opening a pull request, please run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Roadmap ideas

These are not promises, just likely areas of exploration:

- Better waveform performance and caching
- More metadata format coverage
- More keyboard-first workflows
- Better playlist and crate-style organization
- Improved folder-mode filtering
- More polished macOS packaging
- Possible Windows and Linux support later

## License

Playhead is open source under the [MIT License](./LICENSE).
