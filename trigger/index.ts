import { TriggerClient } from "@trigger.dev/sdk";

const triggerKey = process.env.TRIGGER_SECRET_KEY;

export const triggerClient = triggerKey
  ? new TriggerClient({
      id: "will-chief-of-staff",
      apiKey: triggerKey
    })
  : null;

