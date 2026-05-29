# Integrations Broker

Playhead does not ship Last.fm or SoundCloud provider secrets in production builds.

The production app only embeds `PLAYHEAD_INTEGRATIONS_BROKER_URL`, which points to a Cloudflare
Worker. The Worker keeps provider credentials in Cloudflare secrets and exposes only the narrow
operations the desktop app needs:

- Last.fm auth token creation, session exchange, and signed track actions
- SoundCloud OAuth URL creation and token exchange/refresh

## Deployed Worker

```text
https://playhead-integrations-broker.edin-cee.workers.dev
```

## Worker Secrets

Set these on the Worker with `wrangler secret bulk` or `wrangler secret put`:

```text
LASTFM_API_KEY
LASTFM_SHARED_SECRET
SOUNDCLOUD_CLIENT_ID
SOUNDCLOUD_CLIENT_SECRET
```

`SOUNDCLOUD_REDIRECT_URI` is a non-secret Worker variable in `wrangler.jsonc` and defaults to:

```text
playhead://soundcloud/callback
```

## Release Build Config

Set this repository variable for GitHub Actions:

```text
PLAYHEAD_INTEGRATIONS_BROKER_URL=https://playhead-integrations-broker.edin-cee.workers.dev
```

Do not pass `LASTFM_SHARED_SECRET` or `SOUNDCLOUD_CLIENT_SECRET` into Electron release builds. Any
value defined through `electron.vite.config.ts` is recoverable from the packaged app.

## Commands

```bash
npm run broker:typecheck
npm run broker:deploy
```
