import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { createTilawaSession, type TilawaSession, type TilawaAssets, type SessionRunner } from '@tilawa/core';
import { LIVE_STREAMING_CONFIG } from '../core/streaming';
import { content } from './content';

let modelPromise: Promise<TilawaSession> | null = null;
export function loadModel(): Promise<TilawaSession> {
  if (!modelPromise) modelPromise = initialize().catch((error) => { modelPromise = null; throw error; });
  return modelPromise;
}

async function initialize() {
  const model = Asset.fromModule(require('../../assets/model/fastconformer_full_mixed.onnx'));
  await model.downloadAsync();
  if (!model.localUri) throw new Error('Recognition model is not installed.');
  const readJson = async (module: number): Promise<unknown> => {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Recognition data is missing.');
    return new File(asset.localUri).json();
  };
  const [vocab, tokens, quran] = await Promise.all([
    readJson(require('../../assets/model/vocab.data')),
    readJson(require('../../assets/model/quran_ctc_tokens.data')),
    readJson(require('../../assets/model/quran.data')),
  ]);
  const assets = { vocab, quranCtcTokens: tokens, quran, blankId: 1024 } as TilawaAssets;
  content.setMetadata(assets.quran as Parameters<typeof content.setMetadata>[0]);
  const runtime = await InferenceSession.create(model.localUri.replace(/^file:\/\//, ''), {
    executionProviders: ['cpu'], intraOpNumThreads: 2, interOpNumThreads: 1,
    graphOptimizationLevel: 'all', enableCpuMemArena: false,
  });
  const outputName = runtime.outputNames[0];
  if (!outputName) { await runtime.release(); throw new Error('The recognition model has no output.'); }
  const runner: SessionRunner = {
    async run(audio) {
      const audioTensor = new Tensor('float32', audio, [1, audio.length]);
      const lengthTensor = new Tensor('int64', BigInt64Array.from([BigInt(audio.length)]), [1]);
      let outputs: InferenceSession.OnnxValueMapType | undefined;
      try {
        outputs = await runtime.run({ audio_signal: audioTensor, length: lengthTensor });
        const output = outputs[outputName];
        if (!output || output.dims.length !== 3 || output.dims[2] !== 1025 || !(output.data instanceof Float32Array)) throw new Error('Unexpected acoustic model output.');
        return { logprobs: new Float32Array(output.data), timeSteps: output.dims[1]!, vocabSize: output.dims[2]! };
      } finally {
        audioTensor.dispose(); lengthTensor.dispose();
        if (outputs) for (const tensor of Object.values(outputs)) tensor.dispose();
      }
    },
  };
  try { await runner.run(new Float32Array(16000)); }
  catch (error) { await runtime.release(); throw error; }
  const session = createTilawaSession(runner, assets, { config: LIVE_STREAMING_CONFIG });
  session.db.warmSearchIndexes();
  return session;
}
