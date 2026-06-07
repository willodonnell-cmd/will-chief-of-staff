import {
  BLACKHAWK_M365_SIGNAL_AGENT_SCHEDULES,
  BLACKHAWK_M365_SIGNAL_AGENT_TIMEZONE
} from "./schedule-config";

export type SchedulerDefinition = {
  timezone: string;
  schedules: Array<{
    name: string;
    cron: string;
  }>;
};

export function getBlackhawkM365SignalAgentSchedulerDefinition(): SchedulerDefinition {
  return {
    timezone: BLACKHAWK_M365_SIGNAL_AGENT_TIMEZONE,
    schedules: [...BLACKHAWK_M365_SIGNAL_AGENT_SCHEDULES]
  };
}
