/**
 * Authoritative cross-surah handoff confirmation helpers.
 * Follower opening logic delegates margin / temporal rules to commit-controller + evidence.
 */
export {
  HANDOFF_MARGIN_MIN,
  CROSS_SURAH_ENTER,
  CROSS_SURAH_STAY,
} from './evidence';

export { decideLocationCommit, freshCommitState } from './commit-controller';
