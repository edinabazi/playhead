import type { UpdateMessage } from "./UpdateMessageDialog";

/** " Thanks @user! (#123)" after a release note that came from a GitHub issue. */
function Thanks({ user, issue }: { user: string; issue: number }) {
  return (
    <>
      {" "}
      Thanks{" "}
      <a href={`https://github.com/${user}`} target="_blank" rel="noreferrer">
        @{user}
      </a>
      ! (
      <a
        href={`https://github.com/edinabazi/playhead/issues/${issue}`}
        target="_blank"
        rel="noreferrer"
      >
        #{issue}
      </a>
      )
    </>
  );
}

export const updateMessagesByVersion: Record<string, UpdateMessage> = {
  "0.3.0": {
    title: "Welcome to Playhead 0.3",
    description: (
      <>
        <h3>New</h3>
        <ul>
          <li>
            <strong>Loop a section:</strong> Shift+drag across the waveform to loop it; drag the
            edges to adjust.
          </li>
          <li>
            <strong>Markers:</strong> press M to drop a marker at the playhead. Click to jump,
            double-click to rename.
          </li>
          <li>
            <strong>Smart playlists</strong> that update as your library changes. Create one from
            the Playlists header.
          </li>
          <li>
            <strong>Key detection:</strong> turn on the Key column to see each track’s key in
            Camelot notation.
          </li>
          <li>
            <strong>Play Next</strong> and <strong>Play Later</strong> in the track menu.
          </li>
          <li>
            <strong>Sleep timer</strong> next to the volume control.
          </li>
          <li>
            <strong>Playback speed</strong> from 0.5× to 2× in the sound panel, with an option to
            keep the pitch.
          </li>
          <li>
            <strong>Duplicate finder</strong> in Settings → Library.
          </li>
          <li>
            <strong>Window corner radius</strong> setting in Appearance.
            <Thanks user="wex288" issue={17} />
          </li>
          <li>
            <strong>Search the current folder or playlist:</strong> press Tab in search.
            <Thanks user="wex288" issue={22} />
          </li>
          <li>
            <strong>SoundCloud playlists:</strong> drag tracks onto them (hold Option to move),
            remove and reorder tracks, and create, rename or delete playlists.
            <Thanks user="portrgent" issue={29} />
          </li>
          <li>
            <strong>SoundCloud search</strong> with Tab in search, and{" "}
            <strong>SoundCloud comments</strong> along the waveform.
          </li>
          <li>
            Optional SoundCloud extras in Settings → Integrations: sync likes and keep playing
            similar tracks.
          </li>
        </ul>
        <h3>Improved</h3>
        <ul>
          <li>
            Volume normalization uses ReplayGain tags. Your library rescans once to read them.
          </li>
          <li>The equalizer moved to the top-right controls.</li>
          <li>
            Click outside the equalizer or column picker to close it.
            <Thanks user="wex288" issue={24} />
          </li>
          <li>
            Column resize handles show a resize cursor.
            <Thanks user="wex288" issue={23} />
          </li>
          <li>
            Removed the redundant “Track no.” column.
            <Thanks user="wex288" issue={26} />
          </li>
          <li>
            Tooltips near the window edge are no longer cut off.
            <Thanks user="wex288" issue={27} />
          </li>
        </ul>
        <h3>Fixed</h3>
        <ul>
          <li>
            High CPU and GPU use while idle.
            <Thanks user="wex288" issue={21} />
          </li>
          <li>
            “Remember playback position” now resumes where you left off.
            <Thanks user="wex288" issue={25} />
          </li>
          <li>
            AIFF files now play.
            <Thanks user="portrgent" issue={28} />
          </li>
          <li>SoundCloud and Last.fm no longer sign you out when busy.</li>
          <li>Stuck SoundCloud sign-ins can be cancelled.</li>
        </ul>
      </>
    ),
    buttonLabel: "Got it",
  },
  "0.2.7": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>
          Fixed “Install update and restart” hiding the window instead of restarting Playhead.
        </li>
        {[
          { issue: 15, text: "Remember window size and position after quitting." },
          {
            issue: 16,
            text: "Click the playing cover or press Cmd/Ctrl+J to reveal and select the current song.",
          },
          { issue: 18, text: "Keep keyboard selection visible as you navigate tracks." },
          { issue: 19, text: "Fixed automatic playback skipping the next song." },
          {
            issue: 20,
            text: "Remove deleted files during folder watching, rebuilds, and launch rescans.",
          },
        ].map(({ issue, text }) => (
          <li key={issue}>
            {text} Thanks{" "}
            <a href="https://github.com/wex288" target="_blank" rel="noreferrer">
              @wex288
            </a>
            ! (
            <a
              href={`https://github.com/edinabazi/playhead/issues/${issue}`}
              target="_blank"
              rel="noreferrer"
            >
              #{issue}
            </a>
            )
          </li>
        ))}
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.6": {
    title: "Playhead has been updated",
    description: (
      <>
        <ul>
          <li>Customize and resize track columns, and sort by metadata</li>
          <li>Read embedded and .lrc lyrics with synced highlighting and click-to-seek</li>
          <li>More reliable network-drive playback with automatic recovery and Retry</li>
          <li>Import larger libraries with progress, cancellation, and faster browsing</li>
        </ul>
        <p>
          Thanks to{" "}
          <a href="https://github.com/stripedgoat" target="_blank" rel="noreferrer">
            @stripedgoat
          </a>
          ,{" "}
          <a href="https://github.com/reviewlord" target="_blank" rel="noreferrer">
            @reviewlord
          </a>
          ,{" "}
          <a href="https://github.com/steamfan" target="_blank" rel="noreferrer">
            @steamfan
          </a>
          , and{" "}
          <a href="https://github.com/andreschoppe" target="_blank" rel="noreferrer">
            @andreschoppe
          </a>{" "}
          for the requests and reports!
        </p>
      </>
    ),
    buttonLabel: "Got it",
  },
  "0.1.10": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>
          Added <strong>bitrate</strong> support (go to Settings &rarr; Advanced, click on "Rebuild
          library index" to show)
        </li>
        <li>
          Added <strong>tags</strong> support for additional library organization
        </li>
        <li>You can now right click on search results for additional functionality</li>
        <li>Fixed window controls positioning on Windows/Linux</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.1.12": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>
          Added <strong>queue</strong> support (CMD/Ctrl+L)
        </li>
        <li>Improved shuffle logic</li>
        <li>Fixed sidebar animations</li>
        <li>Code cleanup and refactoring</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.0": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>Added SoundCloud integration</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.1": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>Secured Last.fm and SoundCloud integrations</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.2": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>Added playlist import and export for common DJ playlist formats</li>
        <li>Right-clicking the player track info now opens the track menu reliably</li>
        <li>Library views now remember where you were when switching around the sidebar</li>
        <li>Improved library rescans so playlist tracks are better protected</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.3": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>Added volume normalization</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
  "0.2.4": {
    title: "Playhead has been updated",
    description: (
      <ul>
        <li>Playback continues when the window is closed</li>
        <li>Fixed right-click crashes</li>
        <li>Faster library loading and rescans</li>
      </ul>
    ),
    buttonLabel: "Got it",
  },
};
