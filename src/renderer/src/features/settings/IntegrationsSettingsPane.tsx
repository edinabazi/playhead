import { Switch } from "@/components/ui/switch";
import type { IconComponent } from "@/lib/icon-context";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";
import type {
  LastfmSettings,
  DiscordSettings,
  LastfmState,
  SoundCloudCollectionId,
  SoundCloudSettings,
  SoundCloudState,
} from "../../../../shared/library";

const soundcloudCollections: Array<{
  id: SoundCloudCollectionId;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    id: "playlists",
    titleKey: "settings.integrations.collection.playlists.title",
    descriptionKey: "settings.integrations.collection.playlists.description",
  },
  {
    id: "liked-tracks",
    titleKey: "settings.integrations.collection.loved.title",
    descriptionKey: "settings.integrations.collection.loved.description",
  },
  {
    id: "uploads",
    titleKey: "settings.integrations.collection.uploads.title",
    descriptionKey: "settings.integrations.collection.uploads.description",
  },
  {
    id: "reposted-tracks",
    titleKey: "settings.integrations.collection.reposted.title",
    descriptionKey: "settings.integrations.collection.reposted.description",
  },
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
  onCancelSoundCloudAuth,
  onDisconnectSoundCloud,
  discordConfigured,
  discordSettings,
  onDiscordSettingsChange,
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
  onCancelSoundCloudAuth: () => void;
  onDisconnectSoundCloud: () => void;
  discordConfigured: boolean;
  discordSettings: DiscordSettings;
  onDiscordSettingsChange: (settings: DiscordSettings) => void;
}) {
  const t = useTranslation();
  const LoaderIcon = icons.loader;
  const XIcon = icons.x;
  const disabled = lastfmPendingAction || !lastfmState.configured;
  const status = !lastfmState.configured
    ? t("settings.integrations.status.missingCredentials")
    : lastfmState.connected
      ? t("settings.integrations.status.connected")
      : lastfmState.pendingAuth
        ? t("settings.integrations.status.waitingForApproval")
        : t("settings.integrations.status.notConnected");
  const accountLabel = lastfmState.username
    ? t("settings.integrations.signedInAs", { username: lastfmState.username })
    : t("settings.integrations.lastfm.connectDescription");

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
                  {t("settings.integrations.lastfm.iApproved")}
                </button>
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
                  aria-label={t("settings.integrations.lastfm.cancelAria")}
                  title={t("common.cancel")}
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
                {t("settings.integrations.lastfm.disconnect")}
              </button>
            )}
          </div>
        </div>
        {!lastfmState.configured && (
          <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
            {t("settings.integrations.brokerMissing")}
          </p>
        )}
        {lastfmState.connected && (
          <div className="mt-4 w-full overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.025]">
            <IntegrationSwitch
              title={t("settings.integrations.lastfm.scrobble.title")}
              description={t("settings.integrations.lastfm.scrobble.description")}
              checked={lastfmSettings.scrobblingEnabled}
              onCheckedChange={(scrobblingEnabled) =>
                onLastfmSettingsChange({ ...lastfmSettings, scrobblingEnabled })
              }
            />
            <IntegrationSwitch
              title={t("settings.integrations.lastfm.loved.title")}
              description={t("settings.integrations.lastfm.loved.description")}
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
              {t("settings.integrations.lastfm.retryQueued", { count: lastfmState.queueSize })}
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
        onCancelAuth={onCancelSoundCloudAuth}
        onDisconnect={onDisconnectSoundCloud}
      />
      {discordConfigured && (
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.035]">
          <IntegrationSwitch
            title={t("settings.integrations.discord.title")}
            description={t("settings.integrations.discord.description")}
            checked={discordSettings.enabled}
            onCheckedChange={(enabled) => onDiscordSettingsChange({ ...discordSettings, enabled })}
          />
        </div>
      )}
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
  onCancelAuth,
  onDisconnect,
}: {
  state: SoundCloudState;
  settings: SoundCloudSettings;
  pendingAction: boolean;
  loaderIcon: IconComponent;
  onSettingsChange: (settings: SoundCloudSettings) => void;
  onConnect: () => void;
  onCompleteAuth: (input: string) => void;
  onCancelAuth: () => void;
  onDisconnect: () => void;
}) {
  const t = useTranslation();
  const disabled = pendingAction || !state.configured;
  const [authInput, setAuthInput] = useState("");
  const status = !state.configured
    ? t("settings.integrations.status.missingCredentials")
    : state.connected
      ? t("settings.integrations.status.connected")
      : state.pendingAuth
        ? t("settings.integrations.status.waitingForCode")
        : t("settings.integrations.status.notConnected");
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
                ? t("settings.integrations.signedInAs", { username: state.username })
                : t("settings.integrations.soundcloud.connectDescription")}
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
              {t("settings.integrations.soundcloud.connect")}
            </button>
          )}
          {!state.connected && state.pendingAuth && (
            <button
              type="button"
              className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
              disabled={pendingAction}
              onClick={onCancelAuth}
            >
              {t("common.cancel")}
            </button>
          )}
          {state.connected && (
            <button
              type="button"
              className="h-9 rounded-full px-4 text-[13px] font-medium text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-[0.98] disabled:opacity-45"
              disabled={pendingAction}
              onClick={onDisconnect}
            >
              {t("settings.integrations.lastfm.disconnect")}
            </button>
          )}
        </div>
      </div>
      {!state.configured && (
        <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
          The secure integrations broker is not configured for this build.
        </p>
      )}
      {!state.connected && state.pendingAuth && (
        <div className="mt-4 rounded-[16px] border border-white/10 bg-white/[0.025] p-3">
          <label className="block text-[12px] font-semibold leading-4 text-foreground">
            {t("settings.integrations.soundcloud.authLabel")}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              className="h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-black/30 px-3 text-[13px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/70"
              value={authInput}
              placeholder={t("settings.integrations.soundcloud.codePlaceholder")}
              onChange={(event) => setAuthInput(event.target.value)}
            />
            <button
              type="button"
              className="h-9 rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-45"
              disabled={pendingAction || authInput.trim().length === 0}
              onClick={() => onCompleteAuth(authInput)}
            >
              {t("settings.integrations.soundcloud.connectAction")}
            </button>
          </div>
          <p className="mt-2 text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
            {t("settings.integrations.soundcloud.authHelp")}
          </p>
        </div>
      )}
      {state.connected && (
        <div className="mt-4 w-full overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.025]">
          <IntegrationSwitch
            title={t("settings.integrations.soundcloud.sidebar.title")}
            description={t("settings.integrations.soundcloud.sidebar.description")}
            checked={settings.enabled}
            onCheckedChange={(enabled) => onSettingsChange({ ...settings, enabled })}
          />
          <IntegrationSwitch
            title={t("settings.integrations.soundcloud.likes.title")}
            description={t("settings.integrations.soundcloud.likes.description")}
            checked={settings.likeSyncEnabled}
            onCheckedChange={(likeSyncEnabled) =>
              onSettingsChange({ ...settings, likeSyncEnabled })
            }
          />
          <IntegrationSwitch
            title={t("settings.integrations.soundcloud.station.title")}
            description={t("settings.integrations.soundcloud.station.description")}
            checked={settings.stationEnabled}
            onCheckedChange={(stationEnabled) => onSettingsChange({ ...settings, stationEnabled })}
          />
          <IntegrationSwitch
            title={t("settings.integrations.soundcloud.comments.title")}
            description={t("settings.integrations.soundcloud.comments.description")}
            checked={settings.commentsEnabled}
            onCheckedChange={(commentsEnabled) =>
              onSettingsChange({ ...settings, commentsEnabled })
            }
          />
          {settings.commentsEnabled && (
            <IntegrationSwitch
              title={t("settings.integrations.soundcloud.commentPopups.title")}
              description={t("settings.integrations.soundcloud.commentPopups.description")}
              checked={settings.commentPopupsEnabled}
              onCheckedChange={(commentPopupsEnabled) =>
                onSettingsChange({ ...settings, commentPopupsEnabled })
              }
            />
          )}
          {soundcloudCollections.map((collection) => (
            <IntegrationSwitch
              key={collection.id}
              title={t(collection.titleKey)}
              description={t(collection.descriptionKey)}
              checked={visible.has(collection.id)}
              onCheckedChange={(checked) => setCollection(collection.id, checked)}
            />
          ))}
        </div>
      )}
      {state.connected && (
        <p className="mt-3 max-w-[420px] text-pretty text-[12px] font-medium leading-4 text-muted-foreground">
          {t("settings.integrations.soundcloud.playbackNote")}
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
