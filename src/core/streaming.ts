import type { StreamingConfig } from '@tilawa/core';
import { TRACKING_COMPLETION_COVERAGE } from './sequential';

/** Session constructor defaults. Live following uses RecitationFollower, not
 * Tilawa's streaming tracker. */
export const LIVE_STREAMING_CONFIG: Partial<StreamingConfig> = {
  discoveryTriggerSec: 1.5,
  trackingTriggerSec: 0.25,
  discoveryMaxWindowSec: 12,
  trackingMaxWindowSec: 12,
  discoveryRepeatCycles: 2,
  nextVerseEmitMode: 'deferred_confirm',
  decodeStabilityEnabled: true,
  trackingCompletionCoverage: TRACKING_COMPLETION_COVERAGE,
  tailAfterCommitSec: 0.75,
  finalSilenceSec: 5,
  trackingSilenceTimeoutSec: 8,
  staleCycleLimit: 12,
};
