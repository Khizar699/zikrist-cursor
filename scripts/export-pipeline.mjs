#!/usr/bin/env node
/**
 * Concatenate the recognition pipeline sources into zikrist_pipeline_export.txt.
 * Keep the FILE: order stable so diffs stay readable.
 * Regenerate after follower / tracking / listening changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'zikrist_pipeline_export.txt');

const files = [
  'AGENTS.md',
  'docs/reviews/mushaf-follower-refactor-report.md',
  'src/core/types.ts',
  'src/core/tracking/types.ts',
  'src/core/tracking/token-stats.ts',
  'src/core/tracking/evidence.ts',
  'src/core/tracking/follow-evidence.ts',
  'src/core/tracking/commit-controller.ts',
  'src/core/tracking/handoff-policy.ts',
  'src/core/audio-queue.ts',
  'src/core/capture-policy.ts',
  'src/core/recognition-clocks.ts',
  'src/core/basmala.ts',
  'src/core/expected-tape.ts',
  'src/core/sequential.ts',
  'src/core/salah-prior.ts',
  'src/core/follower.ts',
  'src/core/continuation-gate.ts',
  'src/core/timeline.ts',
  'src/core/display-hold.ts',
  'src/core/passage.ts',
  'src/core/word-highlight.ts',
  'src/core/debug-hud.ts',
  'src/services/listening.ts',
  'src/services/model.ts',
  'src/services/content.ts',
  'src/core/bakeoff.ts',
  'src/core/pack-policy.ts',
  'src/core/salah-liturgy-display.ts',
  'src/core/salah-liturgy-matcher.ts',
  'src/core/salah-liturgy.ts',
  'src/core/schema.ts',
  'src/core/streaming.ts',
  'src/services/storage.ts',
  'tests/follow-evidence.test.ts',
  'tests/mushaf-tracking.test.ts',
  'tests/expected-tape.test.ts',
  'tests/continuation-gate.test.ts',
  'tests/debug-hud.test.ts',
  'tests/follower.test.ts',
];

const rule = '='.repeat(60);

const preamble = `${rule}
FILE: _README (pipeline export index — not source code)
${rule}
Zikrist live recognition pipeline export. Read top-to-bottom for architecture, then code.

End-to-end flow:
  Microphone → AudioQueue → RecitationFollower.feed()
    → phase acquiring | following | reacquiring
    → Tilawa transcribe (src/services/model.ts)
    → match: expected-tape (follow) | openings index | neighborhood | throttled global locate
    → commit-controller (src/core/tracking/) → verse_match + locationCommit | verse_candidate
    → ContinuationGate → Listening.receive → Timeline → mushaf UI

Key concepts:
  - verse_match with locationCommit=true: allowed to paint cross-surah Mushaf jumps
  - FOLLOWING: no full-Quran scan each hop; sequence-first via scoreExpectedTape
  - LOCATING: acquiring / reacquiring → acquire()
  - Handoff: lockShortSurahOpening (114 openings) + decideLocationCommit margin / temporal rules

FollowerPhase: acquiring | following | reacquiring (src/core/types.ts)

Regression tests (included below after implementation):
  npm test — run full suite; export bundles pipeline-focused specs for review.

Files in this export (${files.length} paths):
${files.map((f) => `  - ${f}`).join('\n')}

Generated: ${new Date().toISOString()}
`;

const chunks = [preamble];

for (const relative of files) {
  const abs = path.join(root, relative);
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing: ${relative}`);
    continue;
  }
  const source = fs.readFileSync(abs, 'utf8').replace(/\s+$/, '');
  chunks.push(`${rule}\nFILE: ${relative}\n${rule}\n${source}\n`);
}

fs.writeFileSync(outPath, `${chunks.join('\n')}\n`);
console.log(`wrote ${path.relative(root, outPath)} (${chunks.length - 1} files + index)`);
