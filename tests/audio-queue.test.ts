import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioQueue } from '../src/core/audio-queue';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 10));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
test('capture queues serialize inference, preserve order, and own bounded pending audio', async () => {
  const first = deferred<number>();
  const results: number[] = [];
  let runs = 0;
  const queue = new AudioQueue({ maxSamples: 8, process: async () => ++runs === 1 ? first.promise : runs,
    result: (value) => results.push(value), reset() {}, gap() { assert.fail('Unexpected gap'); }, error(error) { throw error; } });
  queue.push({ samples: new Float32Array(4), endMs: 250 });
  await tick();
  queue.push({ samples: new Float32Array(4), endMs: 500 });
  await tick();
  assert.equal(runs, 1, 'Second inference must wait for the first');
  first.resolve(1);
  await tick();
  assert.deepEqual(results, [1, 2]);
  await queue.close();
});
test('overflow drops oldest pending audio and keeps the in-flight lock', async () => {
  const first = deferred<number>();
  const results: number[] = [];
  let runs = 0; let resets = 0; let gaps = 0; let dropped = 0;
  const queue = new AudioQueue({
    maxSamples: 8,
    process: async () => ++runs === 1 ? first.promise : runs,
    result: (value) => results.push(value),
    reset() { resets++; },
    gap() { gaps++; },
    drop(samples) { dropped += samples; },
    error(error) { throw error; },
  });
  queue.push({ samples: new Float32Array(4), endMs: 250 });
  await tick();
  for (let index = 0; index < 3; index++) queue.push({ samples: new Float32Array(4), endMs: 500 + index * 250 });
  assert.equal(gaps, 0);
  assert.equal(resets, 0);
  assert.ok(dropped >= 4);
  first.resolve(1); await tick();
  assert.deepEqual(results[0], 1, 'In-flight output must still apply');
  assert.ok(results.length >= 2);
  assert.equal(resets, 0);
  await queue.close();
});
test('stop discards queued audio and ignores the in-flight output', async () => {
  const pending = deferred<number>();
  const queue = new AudioQueue({ maxSamples: 8, process: () => pending.promise,
    result() { assert.fail('Stopped session emitted output'); }, reset() {}, gap() {}, error(error) { throw error; } });
  queue.push({ samples: new Float32Array(4), endMs: 250 }); await tick();
  const closing = queue.close();
  queue.push({ samples: new Float32Array(4), endMs: 500 });
  pending.resolve(1); await closing;
});
test('an inference rejection is reported once and capture cannot restart the failed queue', async () => {
  let errors = 0; let calls = 0;
  const queue = new AudioQueue({ maxSamples: 8, process: async () => { calls++; throw new Error('Inference failed'); },
    result() { assert.fail(); }, reset() {}, gap() {}, error() { errors++; } });
  queue.push({ samples: new Float32Array(4), endMs: 250 }); await tick();
  queue.push({ samples: new Float32Array(4), endMs: 500 }); await tick();
  assert.equal(errors, 1); assert.equal(calls, 1); await queue.close();
});
test('backlog coalesces in order without crossing activity boundaries or losing sample clocks', async () => {
  const first = deferred<number>();
  const batches: number[][] = [];
  const ends: number[] = [];
  const voiced: number[] = [];
  const queue = new AudioQueue({ maxSamples: 24, maxBatchSamples: 8,
    process: async (packet) => { batches.push([...packet.samples]); return batches.length === 1 ? first.promise : batches.length; },
    result: (_value, packet) => { ends.push(packet.endMs); voiced.push(packet.voicedMs!); },
    reset() {}, gap() { assert.fail('Unexpected reset'); }, error(error) { throw error; } });
  queue.push({ samples: new Float32Array([1, 1, 1, 1]), endMs: 250, voicedMs: 250, voiced: true });
  await tick();
  queue.push({ samples: new Float32Array([2, 2, 2, 2]), endMs: 500, voicedMs: 500, voiced: true });
  queue.push({ samples: new Float32Array([3, 3, 3, 3]), endMs: 750, voicedMs: 750, voiced: true });
  queue.push({ samples: new Float32Array(4), endMs: 1000, voicedMs: 750, voiced: false });
  queue.push({ samples: new Float32Array([4, 4, 4, 4]), endMs: 1250, voicedMs: 1000, voiced: true });
  first.resolve(1);
  await new Promise<void>((resolve) => setTimeout(resolve, 120));
  assert.deepEqual(batches, [[1, 1, 1, 1], [2, 2, 2, 2, 3, 3, 3, 3], [0, 0, 0, 0], [4, 4, 4, 4]]);
  assert.deepEqual(ends, [250, 750, 1000, 1250]);
  assert.deepEqual(voiced, [250, 750, 750, 1000]);
  await queue.close();
});
