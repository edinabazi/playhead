import type { UpdateMessage } from "./UpdateMessageDialog";

export const updateMessagesByVersion: Record<string, UpdateMessage> = {
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
