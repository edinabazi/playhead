# Tracking Plan

Playhead telemetry is opt-out for official builds and can be turned off in Privacy settings. It only
sends anonymous product events when:

1. Privacy -> Share anonymous usage is enabled.
2. `POSTHOG_PROJECT_API_KEY` is configured.

The app runs normally without any PostHog environment variables. Missing telemetry configuration
only disables event delivery.

The app must not send file paths, track names, artist names, album names, artwork, library contents,
or any other media metadata that can identify a user's local collection.

## Current Events

| Event               | Trigger                     | Properties                                 |
| ------------------- | --------------------------- | ------------------------------------------ |
| `app_installed`     | First app launch            | `first_version`                            |
| `app_opened`        | App starts                  | none                                       |
| `telemetry_enabled` | User re-enables telemetry   | none                                       |
| `folder_added`      | User adds a folder          | `source`, `track_count`                    |
| `track_loaded`      | Track loads into the player | `autoplay`, `has_duration`, `audio_format` |
| `track_favorited`   | Track is added to Loved     | none                                       |
| `track_unfavorited` | Track is removed from Loved | none                                       |
| `playlist_created`  | Playlist is created         | `from_track`                               |

## Recommended Dashboard Metrics

- Installs: count download clicks on the website and GitHub Release asset downloads.
- Activated users: anonymous users with `folder_added`.
- Active users: anonymous users with `app_opened` in a day/week/month.
- Core usage: `track_loaded`, playlist creation rate, favorite rate.
- Retention: anonymous users returning after 1, 7, and 30 days.

## Website Tracking

Track website visits and download clicks separately from in-app telemetry. For a simple open-source
site, use Plausible, Fathom, or GA4. Use UTMs on external launch links, and track download buttons
with properties for `os`, `asset_type`, and `version`.

## PostHog Setup

Use Product Analytics for app usage events. Add `POSTHOG_PROJECT_API_KEY` as a GitHub Actions
secret, and optionally set `POSTHOG_HOST` as a repository variable. The EU cloud default is
`https://eu.i.posthog.com`.

The OpenTelemetry Logs installer in PostHog is for log ingestion, not product usage events. Add it
later only if Playhead needs centralized application logs.
