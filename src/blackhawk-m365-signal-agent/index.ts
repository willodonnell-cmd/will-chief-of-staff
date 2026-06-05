import { loadBlackhawkM365SignalAgentConfig } from "./config";
import { BlackhawkClient } from "./clients/blackhawk-client";
import { GraphMicrosoft365Client } from "./clients/microsoft/graph-client";
import { CalendarCollector } from "./collectors/calendar-collector";
import { OutlookCollector } from "./collectors/outlook-collector";
import { TeamsCollector } from "./collectors/teams-collector";
import { getBlackhawkM365SignalAgentSchedulerDefinition } from "./scheduler/scheduler";
import { createStructuredLogger } from "./utils/logging";
import { RunWorkflow } from "./workflows/run-workflow";

export {
  BlackhawkClient,
  CalendarCollector,
  GraphMicrosoft365Client,
  OutlookCollector,
  RunWorkflow,
  TeamsCollector,
  getBlackhawkM365SignalAgentSchedulerDefinition,
  loadBlackhawkM365SignalAgentConfig
};

export function createBlackhawkM365SignalAgentWorkflow() {
  const config = loadBlackhawkM365SignalAgentConfig();
  const graphClient = new GraphMicrosoft365Client(config);
  const logger = createStructuredLogger({
    service: "blackhawk-m365-signal-agent",
    level: config.logLevel,
    secrets: [config.blackhawkImportSecret, config.m365ClientSecret]
  });

  return new RunWorkflow({
    config,
    blackhawkClient: new BlackhawkClient(config),
    collectors: [
      new OutlookCollector(graphClient),
      new CalendarCollector(graphClient),
      new TeamsCollector(graphClient)
    ],
    logger
  });
}

async function main() {
  const workflow = createBlackhawkM365SignalAgentWorkflow();
  const result = await workflow.run();
  console.log(JSON.stringify(result));

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1])) {
  void main();
}
