# Release Setup

Playhead builds GitHub Releases from `main` when `package.json` contains a version that does not
already have a matching Git tag.

## Version Flow

1. Update `package.json` and `package-lock.json` to the next version.
2. Merge or push that change to `main`.
3. GitHub Actions runs lint, tests, typecheck, and macOS builds.
4. The workflow creates a draft GitHub Release tagged `v<version>`.
5. Review the draft release notes and assets, then publish it.

## Assets

- macOS: `.dmg` and `.zip`

macOS signing/notarization is not configured yet. Unsigned builds are fine for early open-source
releases, but users will see OS security warnings.

## GitHub Configuration

- `GITHUB_TOKEN`: provided automatically by GitHub Actions.
- `POSTHOG_PROJECT_API_KEY`: optional. This is baked into the main-process bundle during CI builds.
  If it is missing, release builds still work and in-app telemetry cannot send events.
- `POSTHOG_HOST`: optional repository variable. Defaults to `https://eu.i.posthog.com`.

## Local Builds

```bash
npm run dist
npm run dist:mac
```

Run the command on macOS for the most reliable local package.
