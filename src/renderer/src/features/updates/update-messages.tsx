import type { UpdateMessage } from "./UpdateMessageDialog";

export const updateMessagesByVersion: Record<string, UpdateMessage> = {
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
};
