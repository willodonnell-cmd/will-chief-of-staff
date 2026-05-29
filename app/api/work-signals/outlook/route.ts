import { NextResponse } from "next/server";

import { getOutlookAccessTokenForActiveUser } from "@/lib/priority-inbox-sources";
import { listOutlookInboxMessages } from "@/lib/outlook";
import { normalizeOutlookMessageToWorkSignal } from "@/lib/work-signals/normalize-outlook";
import { rankWorkSignals, scoreExecutiveRelevance } from "@/lib/work-signals/ranking";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestedTop = Number.parseInt(requestUrl.searchParams.get("top") ?? "", 10);
  const top = Number.isFinite(requestedTop) ? Math.max(1, Math.min(requestedTop, 25)) : 10;

  const accessResult = await getOutlookAccessTokenForActiveUser();
  if (!accessResult.ok) {
    return NextResponse.json(
      {
        error: accessResult.error
      },
      {
        status: accessResult.status
      }
    );
  }

  try {
    const messages = await listOutlookInboxMessages(accessResult.accessToken, top);
    const signals = rankWorkSignals(
      messages.map((message) => normalizeOutlookMessageToWorkSignal(message))
    ).map((signal) => ({
      ...signal,
      executiveRelevance: scoreExecutiveRelevance(signal)
    }));

    return NextResponse.json({
      source: "outlook",
      connectedAccount: accessResult.accountLabel,
      count: signals.length,
      signals
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Outlook WorkSignals could not be loaded."
      },
      {
        status: 500
      }
    );
  }
}

