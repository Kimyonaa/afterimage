import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as tf from '@tensorflow/tfjs';
import { generate } from './dataset.mjs';
import { pairFeatures, forward, metrics, chooseThreshold } from './features.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  out = path.join(root, 'public/research');
const rows = generate(),
  vectors = JSON.parse(fs.readFileSync(path.join(root, 'ml/cache/embeddings.json'), 'utf8'));
const benchmark = JSON.parse(fs.readFileSync(path.join(out, 'benchmark.json'), 'utf8'));
const groups = Object.fromEntries(
  ['train', 'validation', 'test'].map((s) => [s, rows.filter((r) => r.split === s)]),
);
const cosine = (r) =>
  Math.max(
    0,
    Math.min(
      1,
      vectors[r.source].reduce((v, x, i) => v + x * vectors[r.candidate][i], 0),
    ),
  );
const results = [];
const t = chooseThreshold(
  groups.validation.map((r) => r.label),
  groups.validation.map(cosine),
);
results.push({
  name: 'Frozen MiniLM cosine',
  ...metrics(
    groups.test.map((r) => r.label),
    groups.test.map(cosine),
    t,
  ),
});
await tf.setBackend('cpu');
for (const [mode, name] of [
  ['embedding-only', 'Neural · embeddings only'],
  ['lexical-only', 'Neural · lexical only'],
]) {
  const features = (r) => {
    const x = pairFeatures(vectors[r.source], vectors[r.candidate], r.source, r.candidate);
    return mode === 'embedding-only' ? x.slice(0, -2) : x.slice(-2);
  };
  const xs = tf.tensor2d(groups.train.map(features)),
    ys = tf.tensor2d(groups.train.map((r) => [r.label])),
    vx = tf.tensor2d(groups.validation.map(features)),
    vy = tf.tensor2d(groups.validation.map((r) => [r.label]));
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [xs.shape[1]],
      units: 32,
      activation: 'relu',
      kernelInitializer: tf.initializers.glorotUniform({ seed: 42 }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: 16,
      activation: 'relu',
      kernelInitializer: tf.initializers.glorotUniform({ seed: 43 }),
    }),
  );
  model.add(
    tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      kernelInitializer: tf.initializers.glorotUniform({ seed: 44 }),
    }),
  );
  model.compile({ optimizer: tf.train.adam(0.002), loss: 'binaryCrossentropy' });
  let best = Infinity,
    bestWeights,
    bestEpoch;
  await model.fit(xs, ys, {
    epochs: 50,
    batchSize: 32,
    shuffle: false,
    validationData: [vx, vy],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        if (logs.val_loss < best) {
          best = logs.val_loss;
          bestWeights?.forEach((w) => w.dispose());
          bestWeights = model.getWeights().map((w) => w.clone());
          bestEpoch = epoch + 1;
        }
      },
    },
  });
  model.setWeights(bestWeights);
  const weights = model.getWeights(),
    layers = [];
  for (let i = 0; i < weights.length; i += 2)
    layers.push({ weights: weights[i].arraySync(), bias: weights[i + 1].arraySync() });
  const predict = (r) => forward(features(r), { layers });
  const threshold = chooseThreshold(
    groups.validation.map((r) => r.label),
    groups.validation.map(predict),
  );
  const result = {
    name,
    ...metrics(
      groups.test.map((r) => r.label),
      groups.test.map(predict),
      threshold,
    ),
  };
  results.push(result);
  fs.writeFileSync(
    path.join(out, `model-${mode}.json`),
    JSON.stringify({
      schemaVersion: 1,
      featureMode: mode,
      encoder: benchmark.encoder,
      threshold,
      layers,
      bestEpoch,
    }),
  );
  console.log(JSON.stringify(result));
  model.dispose();
  xs.dispose();
  ys.dispose();
  vx.dispose();
  vy.dispose();
  bestWeights.forEach((w) => w.dispose());
}
benchmark.models = [
  ...benchmark.models.filter((m) =>
    ['Exact passage', 'Token containment', 'Neural pair classifier'].includes(m.name),
  ),
  ...results,
];
benchmark.ablation =
  'Exploratory follow-up on the same split after seeing the initial baseline results. Both ablated heads use the original seed, architecture width, optimizer, 50 epochs, validation checkpoint selection, and validation-only threshold rule. Results are not an independent confirmation.';
benchmark.limitations = benchmark.limitations.map((s) =>
  s.startsWith('The neural head includes')
    ? 'The follow-up ablations reuse the observed test split and are exploratory; a fresh independent evaluation is still required.'
    : s,
);
benchmark.datasetSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(out, 'dataset.jsonl')))
  .digest('hex');
fs.writeFileSync(path.join(out, 'benchmark.json'), JSON.stringify(benchmark, null, 2));
fs.writeFileSync(
  path.join(out, 'ablation-protocol.json'),
  JSON.stringify(
    {
      seed: 42,
      epochs: 50,
      batchSize: 32,
      learningRate: 0.002,
      checkpoint: 'minimum validation binary cross entropy',
      threshold: 'maximum validation recall at FPR <= 0.05; ties prefer precision',
      testUse:
        'exploratory comparison; no hyperparameters or thresholds selected using test labels',
      models: results,
    },
    null,
    2,
  ),
);
console.log('Saved ablations and dataset fingerprint.');
