import { Switch } from "@/components/ui/switch";
import type { IconComponent } from "@/lib/icon-context";
import { useState } from "react";
import type {
  LastfmSettings,
  LastfmState,
  SoundCloudCollectionId,
  SoundCloudSettings,
  SoundCloudState,
} from "../../../../shared/library";

const soundcloudCollections: Array<{
  id: SoundCloudCollectionId;
  title: string;
  description: string;
}> = [
  { id: "playlists", title: "Playlists", description: "Show your SoundCloud playlists." },
  {
    id: "liked-tracks",
    title: "Loved tracks",
    description: "Show tracks you liked on SoundCloud.",
  },
  { id: "uploads", title: "Uploads", description: "Show tracks uploaded by your account." },
  { id: "reposted-tracks", title: "Reposted tracks", description: "Show tracks you reposted." },
];

export function IntegrationsSettingsPane({
  lastfmState,
  lastfmSettings,
  lastfmPendingAction,
  soundcloudState,
  soundcloudSettings,
  soundcloudPendingAction,
  icons,
  onLastfmSettingsChange,
  onConnectLastfm,
  onCompleteLastfmAuth,
  onCancelLastfmAuth,
  onDisconnectLastfm,
  onFlushLastfmQueue,
  onSoundCloudSettingsChange,
  onConnectSoundCloud,
  onCompleteSoundCloudAuth,
  onDisconnectSoundCloud,
}: {
  lastfmState: LastfmState;
  lastfmSettings: LastfmSettings;
  lastfmPendingAction: boolean;
  soundcloudState: SoundCloudState;
  soundcloudSettings: SoundCloudSettings;
  soundcloudPendingAction: boolean;
  icons: {
    loader: IconComponent;
    x: IconComponent;
  };
  onLastfmSettingsChange: (settings: LastfmSettings) => void;
  onConnectLastfm: () => void;
  onCompleteLastfmAuth: () => void;
  onCancelLastfmAuth: () => void;
  onDisconnectLastfm: () => void;
  onFlushLastfmQueue: () => void;
  onSoundCloudSettingsChange: (settings: SoundCloudSettings) => void;
  onConnectSoundCloud: () => void;
  onCompleteSoundCloudAuth: (input: string) => void;
  onDisconnectSoundCloud: () => void;
}) {
  const LoaderIcon = icons.loader;
  const XIcon = icons.x;
  const disabled = lastfmPendingAction || !lastfmState.configured;
  const status = !lastfmState.configured
    ? "Missing credentials"
    : lastfmState.connected
      ? "Connected"
      : lastfmState.pendingAuth
        ? "Waiting for approval"
        : "Not connected";
  const accountLabel = lastfmState.username
    ? `Signed in as ${lastfmState.username}`
    : "Connect your account to start syncing.";

  return (
    <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pb-5 pr-1">
      <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-[#d51007] text-white">
              <LastfmLogo />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-balance text-[14px] font-semibold leading-5 text-foreground">
                  Last.fm
                </h4>
                <span className="rounded-full bg-white/[0.07] px-2 py-0.5 -mt-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  {status}
                </span>
              </div>
              <p className="mt-0.5 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
                {accountLabel}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {lastfmPendingAction && (
              <LoaderIcon size={16} strokeWidth={1.8} className="animate-spin" />
            )}
            {!lastfmState.connected && !lastfmState.pendingAuth && (
              <button
                type="button"
                className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-45"
                disabled={disabled}
                onClick={onConnectLastfm}
              >
                Connect Last.fm
              </button>
            )}
            {!lastfmState.connected && lastfmState.pendingAuth && (
              <>
                <button
                  type="button"
                  className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-45"
                  disabled={lastfmPendingAction}
                  onClick={onCompleteLastfmAuth}
                >
                  I approved
                </button>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
                  aria-label="Cancel Last.fm connection"
                  title="Cancel"
                  disabled={lastfmPendingAction}
                  onClick={onCancelLastfmAuth}
                >
                  <XIcon size={15} strokeWidth={1.8} />
                </button>
              </>
            )}
            {lastfmState.connected && (
              <button
                type="button"
                className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
                disabled={lastfmPendingAction}
                onClick={onDisconnectLastfm}
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
        {!lastfmState.configured && (
          <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
            Add LASTFM_API_KEY and LASTFM_SHARED_SECRET to the app environment to enable this
            integration.
          </p>
        )}
        {lastfmState.connected && (
          <div className="mt-4 w-full overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.025]">
            <IntegrationSwitch
              title="Scrobble plays"
              description="Add completed plays to your listening history."
              checked={lastfmSettings.scrobblingEnabled}
              onCheckedChange={(scrobblingEnabled) =>
                onLastfmSettingsChange({ ...lastfmSettings, scrobblingEnabled })
              }
            />
            <IntegrationSwitch
              title="Sync loved"
              description="Sync love and unlove changes. Existing loved tracks won't get synced."
              checked={lastfmSettings.loveSyncEnabled}
              onCheckedChange={(loveSyncEnabled) =>
                onLastfmSettingsChange({ ...lastfmSettings, loveSyncEnabled })
              }
            />
          </div>
        )}
        {lastfmState.connected && lastfmState.queueSize > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
            <button
              type="button"
              className="rounded-full bg-white/[0.07] px-3 py-1 text-[12px] font-medium text-foreground transition hover:bg-white/[0.12] active:scale-[0.98]"
              disabled={lastfmPendingAction}
              onClick={onFlushLastfmQueue}
            >
              Retry {lastfmState.queueSize} queued
            </button>
          </div>
        )}
        {lastfmState.lastError && (
          <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-red-300">
            {lastfmState.lastError}
          </p>
        )}
      </div>
      <SoundCloudIntegrationCard
        state={soundcloudState}
        settings={soundcloudSettings}
        pendingAction={soundcloudPendingAction}
        loaderIcon={LoaderIcon}
        onSettingsChange={onSoundCloudSettingsChange}
        onConnect={onConnectSoundCloud}
        onCompleteAuth={onCompleteSoundCloudAuth}
        onDisconnect={onDisconnectSoundCloud}
      />
    </div>
  );
}

function SoundCloudIntegrationCard({
  state,
  settings,
  pendingAction,
  loaderIcon: LoaderIcon,
  onSettingsChange,
  onConnect,
  onCompleteAuth,
  onDisconnect,
}: {
  state: SoundCloudState;
  settings: SoundCloudSettings;
  pendingAction: boolean;
  loaderIcon: IconComponent;
  onSettingsChange: (settings: SoundCloudSettings) => void;
  onConnect: () => void;
  onCompleteAuth: (input: string) => void;
  onDisconnect: () => void;
}) {
  const disabled = pendingAction || !state.configured;
  const [authInput, setAuthInput] = useState("");
  const status = !state.configured
    ? "Missing credentials"
    : state.connected
      ? "Connected"
      : state.pendingAuth
        ? "Waiting for code"
        : "Not connected";
  const visible = new Set(settings.visibleCollections);

  const setCollection = (id: SoundCloudCollectionId, checked: boolean) => {
    const next = new Set(settings.visibleCollections);
    if (checked) next.add(id);
    else next.delete(id);
    onSettingsChange({ ...settings, visibleCollections: Array.from(next) });
  };

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[14px] bg-[#ff5500] text-white">
            <SoundCloudLogo />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-balance text-[14px] font-semibold leading-5 text-foreground">
                SoundCloud
              </h4>
              <span className="-mt-0.5 rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                {status}
              </span>
            </div>
            <p className="mt-0.5 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
              {state.username
                ? `Signed in as ${state.username}`
                : "Stream your SoundCloud collections in Playhead."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pendingAction && <LoaderIcon size={16} strokeWidth={1.8} className="animate-spin" />}
          {!state.connected && !state.pendingAuth && (
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-45"
              disabled={disabled}
              onClick={onConnect}
            >
              Connect SoundCloud
            </button>
          )}
          {!state.connected && state.pendingAuth && null}
          {state.connected && (
            <button
              type="button"
              className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
              disabled={pendingAction}
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>
      {!state.configured && (
        <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
          Add SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET to the app environment to enable
          this integration.
        </p>
      )}
      {!state.connected && state.pendingAuth && (
        <div className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.025] p-3">
          <label className="block text-[12px] font-semibold leading-4 text-foreground">
            Authorization code or callback URL
          </label>
          <div className="mt-2 flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-[13px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70"
              value={authInput}
              placeholder="Paste code or playhead://soundcloud/callback?code=..."
              onChange={(event) => setAuthInput(event.target.value)}
            />
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-45"
              disabled={pendingAction || authInput.trim().length === 0}
              onClick={() => onCompleteAuth(authInput)}
            >
              Connect
            </button>
          </div>
          <p className="mt-2 text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
            SoundCloud redirects to the URI registered for the app. If the browser shows a callback
            page or address bar with code=, paste the whole URL here.
          </p>
        </div>
      )}
      {state.connected && (
        <div className="mt-4 w-full overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.025]">
          <IntegrationSwitch
            title="Show SoundCloud in sidebar"
            description="Enable browsing and playback from SoundCloud."
            checked={settings.enabled}
            onCheckedChange={(enabled) => onSettingsChange({ ...settings, enabled })}
          />
          {soundcloudCollections.map((collection) => (
            <IntegrationSwitch
              key={collection.id}
              title={collection.title}
              description={collection.description}
              checked={visible.has(collection.id)}
              onCheckedChange={(checked) => setCollection(collection.id, checked)}
            />
          ))}
        </div>
      )}
      {state.connected && (
        <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
          SoundCloud playback uses streamable tracks only and keeps attribution visible in the
          player.
        </p>
      )}
      {state.lastError && (
        <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-red-300">
          {state.lastError}
        </p>
      )}
    </div>
  );
}

function SoundCloudLogo() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 32 20" fill="currentColor">
      <path d="M12.8 19.5H28a4 4 0 0 0 0-8 5.7 5.7 0 0 0-5.6-4.6 5.5 5.5 0 0 0-2.5.6A8.6 8.6 0 0 0 12.8.5v19Zm-2-17.4h1.1v17.4h-1.1V2.1Zm-2.2 2.7h1.1v14.7H8.6V4.8Zm-2.2 2.6h1.1v12.1H6.4V7.4Zm-2.1 2.1h1.1v10H4.3v-10Zm-2.2 1.7h1.1v8.3H2.1v-8.3ZM0 13.3h1.1v6.2H0v-6.2Z" />
    </svg>
  );
}

function LastfmLogo() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.63-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.93-1.457-4.59-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.89 0 12.233c0 4.18 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z" />
    </svg>
  );
}

function IntegrationSwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-5 border-b border-white/10 px-4 py-3.5 last:border-b-0">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-4 text-foreground">{title}</span>
        <span className="mt-0.5 block text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
          {description}
        </span>
      </span>
      <Switch aria-label={title} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
