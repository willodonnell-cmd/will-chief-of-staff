export const BLACKHAWK_M365_SIGNAL_AGENT_TIMEZONE = "America/New_York";

export const BLACKHAWK_M365_SIGNAL_AGENT_SCHEDULES = [
  {
    name: "weekday-morning",
    cron: "30 7 * * 1-5"
  },
  {
    name: "weekday-midday",
    cron: "0 12 * * 1-5"
  },
  {
    name: "weekday-evening",
    cron: "0 17 * * 1-5"
  }
] as const;
