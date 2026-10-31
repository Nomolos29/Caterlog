/**
 * Smart Co-Pilot Idle-Takeover Decision Policy
 *
 * Determines whether Caterlog should respond immediately, schedule an idle-takeover
 * timer (default 60s), or stay silent when a buyer messages a vendor on WhatsApp.
 */

export type DomainCopilotMode = "COPILOT" | "FULL_AUTO" | "MANUAL";

export interface CopilotEvaluationInput {
  copilotMode: DomainCopilotMode;
  copilotIdleSeconds: number;
  sessionCopilotPaused: boolean;
  lastVendorMessageAt: Date | null;
  now: Date;
}

export type CopilotDecision =
  | { action: "RESPOND_IMMEDIATELY"; reason: string }
  | { action: "SCHEDULE_IDLE_TAKEOVER"; delaySeconds: number; reason: string }
  | { action: "DO_NOTHING"; reason: string };

export function evaluateCopilotAction(input: CopilotEvaluationInput): CopilotDecision {
  if (input.sessionCopilotPaused) {
    return {
      action: "DO_NOTHING",
      reason: "Co-Pilot is manually paused for this specific buyer chat thread.",
    };
  }

  if (input.copilotMode === "MANUAL") {
    return {
      action: "DO_NOTHING",
      reason: "Vendor store is set to MANUAL mode.",
    };
  }

  if (input.copilotMode === "FULL_AUTO") {
    return {
      action: "RESPOND_IMMEDIATELY",
      reason: "Vendor store is set to FULL_AUTO mode (<2s instant response).",
    };
  }

  // COPILOT Mode: Give the vendor `copilotIdleSeconds` (default 60s) to reply from their phone.
  const idleSeconds = Math.max(5, input.copilotIdleSeconds);
  return {
    action: "SCHEDULE_IDLE_TAKEOVER",
    delaySeconds: idleSeconds,
    reason: `Waiting ${idleSeconds}s for vendor mobile activity before Co-Pilot takes over.`,
  };
}

/**
 * Called when the scheduled idle timer fires after `copilotIdleSeconds`.
 * Checks if the vendor sent a message from their phone while the timer was counting down.
 */
export function shouldExecuteScheduledTakeover(params: {
  buyerMessageReceivedAt: Date;
  lastVendorMessageAt: Date | null;
  sessionCopilotPaused: boolean;
  copilotMode: DomainCopilotMode;
}): boolean {
  if (params.sessionCopilotPaused || params.copilotMode === "MANUAL") {
    return false;
  }
  if (!params.lastVendorMessageAt) {
    return true;
  }
  // If vendor replied *after* the buyer's inquiry arrived, vendor is active in the thread -> abort takeover
  return params.lastVendorMessageAt.getTime() < params.buyerMessageReceivedAt.getTime();
}

