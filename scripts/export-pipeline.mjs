#!/usr/bin/env node
/**
 * Concatenate the recognition pipeline sources into zikrist_pipeline_export.txt.
 * Keep the FILE: order stable so diffs stay readable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.join(root, 'zikrist_pipeline_export.txt');

const files = [
  'src/core/audio-queue.ts',
  'src/core/bakeoff.ts',
  'src/core/basmala.ts',
  'src/core/capture-policy.ts',
  'src/core/continuation-gate.ts',
  'src/core/debug-hud.ts',
  'src/core/display-hold.ts',
  'src/core/expected-tape.ts',
  'src/core/follower.ts',
  'src/core/pack-policy.ts',
  'src/core/passage.ts',
  'src/core/recognition-clocks.ts',
  'src/core/salah-liturgy-display.ts',
  'src/core/salah-liturgy-matcher.ts',
  'src/core/salah-liturgy.ts',
  'src/core/salah-prior.ts',
  'src/core/schema.ts',
  'src/core/sequential.ts',
  'src/core/streaming.ts',
  'src/core/timeline.ts',
  'src/core/types.ts',
  'src/core/word-highlight.ts',
  'src/services/content.ts',
  'src/services/listening.ts',
  'src/services/model.ts',
  'src/services/storage.ts',
];

const rule = '='.repeat(60);
const chunks = files.map((relative) => {
  const source = fs.readFileSync(path.join(root, relative), 'utf8').replace(/\s+$/, '');
  return `${rule}\nFILE: ${relative}\n${rule}\n${source}\n`;
});

fs.writeFileSync(outPath, `${chunks.join('\n')}\n`);
console.log(`wrote ${path.relative(root, outPath)} (${files.length} files)`);
