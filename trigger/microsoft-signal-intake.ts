import { loadLocalAgentProducedMicrosoft365SignalEnvelope } from "../lib/microsoft-signal-intake";
import {
  adaptMicrosoft365SignalsToPrototypeDailyBrief,
  type PrototypeDailyBriefInput
} from "../lib/prototype-daily-brief";

export type MicrosoftSignalIntakeWorkflowResult = {
  fixtureProducedAt: string;
  signalCount: number;
  dailyBrief: PrototypeDailyBriefInput;
};

export async function runMicrosoftSignalIntakeWorkflow(): Promise<MicrosoftSignalIntakeWorkflowResult> {
  const envelope = await loadLocalAgentProducedMicrosoft365SignalEnvelope();
  const dailyBrief = adaptMicrosoft365SignalsToPrototypeDailyBrief(envelope);

  return {
    fixtureProducedAt: envelope.producedAt,
    signalCount: envelope.signals.length,
    dailyBrief
  };
}
