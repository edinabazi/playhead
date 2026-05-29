# Release Setup

Playhead builds GitHub Releases from `main` when `package.json` contains a version that does not
already have a matching Git tag.

## Version Flow

1. Update `package.json` and `package-lock.json` to the next version.
2. Merge or push that change to `main`.
3. GitHub Actions runs lint, tests, typecheck, and macOS builds.
4. The workflow creates a draft GitHub Release tagged `v<version>`.
5. Review the draft release notes and assets, then publish it.

Published releases are required for in-app updates. Installed apps check the GitHub release feed,
download newer versions in the background, and show an **Update** button when the update is ready to
install.

## Assets

- macOS Apple Silicon: `Playhead-mac-arm64.dmg` and `Playhead-mac-arm64.zip`
- macOS Intel: `Playhead-mac-x64.dmg` and `Playhead-mac-x64.zip`
- Windows Intel/AMD: `Playhead-win-x64.exe` and `Playhead-win-x64.zip`
- Linux Intel/AMD: `Playhead-linux-x64.AppImage`, `Playhead-linux-x64.deb`, and
  `Playhead-linux-x64.tar.gz`

macOS release builds are signed and notarized when the required Apple Developer secrets are present
in GitHub Actions.
Windows and Linux builds are currently unsigned.

The updater is disabled in development and only runs from packaged apps. To test the full flow, build
and install an older packaged version, publish a newer GitHub Release, then launch the older app and
wait for the **Update** button.

## GitHub Configuration

- `GITHUB_TOKEN`: provided automatically by GitHub Actions.
- `MACOS_CERTIFICATE`: base64-encoded `.p12` export of the Developer ID Application certificate.
- `MACOS_CERTIFICATE_PASSWORD`: password used when exporting the `.p12` certificate.
- `APPLE_ID`: Apple Developer account email used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: app-specific password for the Apple ID.
- `APPLE_TEAM_ID`: Apple Developer Team ID.
- `POSTHOG_PROJECT_API_KEY`: optional. This is baked into the main-process bundle during CI builds.
  If it is missing, release builds still work and in-app telemetry cannot send events.
- `POSTHOG_HOST`: optional repository variable. Defaults to `https://eu.i.posthog.com`.
- `PLAYHEAD_INTEGRATIONS_BROKER_URL`: repository variable for the secure Last.fm/SoundCloud broker.
  Production builds must use this URL instead of bundling provider secrets.

Do not inject Last.fm or SoundCloud provider secrets into release builds. `LASTFM_SHARED_SECRET` and
`SOUNDCLOUD_CLIENT_SECRET` live on the integrations broker only; see
[`docs/integrations-broker.md`](integrations-broker.md).

## macOS Signing Secrets

Export the signing certificate from Keychain Access:

1. Open Keychain Access.
2. Select `login` -> `My Certificates`.
3. Expand `Developer ID Application: HEJ NONA DOOEL (8B6VFDJHA2)` and confirm it contains a private
   key.
4. Right-click the certificate row and choose `Export`.
5. Save it as `developer-id-application.p12`.
6. Set a strong export password. Use that same value for `MACOS_CERTIFICATE_PASSWORD`.

Encode the `.p12` for GitHub:

```bash
base64 -i developer-id-application.p12 | pbcopy
```

Add the copied value as the `MACOS_CERTIFICATE` repository secret.

The workflow also signs, notarizes, and staples generated `.dmg` files after packaging. This lets
Gatekeeper verify both the app bundle and the downloadable disk image.

Stable download URLs:

```text
https://github.com/edinabazi/playhead/releases/latest/download/Playhead-mac-arm64.dmg
https://github.com/edinabazi/playhead/releases/latest/download/Playhead-mac-x64.dmg
https://github.com/edinabazi/playhead/releases/latest/download/Playhead-win-x64.exe
https://github.com/edinabazi/playhead/releases/latest/download/Playhead-linux-x64.AppImage
https://github.com/edinabazi/playhead/releases/latest/download/Playhead-linux-x64.deb
```

## Local Builds

```bash
npm run dist
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Run the command on macOS for the most reliable local package.
