/** Microphone packet policy. Silence must not be inferred: Tilawa counts a
 * non-advancing tracking cycle as stale, and twelve 0.25 s cycles leave
 * tracking after about three seconds of pause. */
export const SPEECH_RMS = 0.005;
export const CAPTURE_GAP_SEC = 1.5;
export const LONG_PAUSE_SEC = 10;

export function isSpeech(rms: number, threshold = SPEECH_RMS): boolean {
  return rms >= threshold;
}

export function isCaptureGap(lastAudioEnd: number | null, when: number, gapSec = CAPTURE_GAP_SEC): boolean {
  return lastAudioEnd !== null && when - lastAudioEnd > gapSec;
}

export function isLongPause(silentSeconds: number, limit = LONG_PAUSE_SEC): boolean {
  return silentSeconds >= limit;
}
