import type { UpdateMessage } from "./UpdateMessageDialog";

export const updateMessagesByVersion: Record<string, UpdateMessage> = {
  "0.1.10": {
    title: "Playhead has been updated",
    description:
      "Added kbps metadata, but you might have to remove and readd your folders in Playhead to get it to work. Apologies for the inconvenience.",
    buttonLabel: "Got it",
  },
};
