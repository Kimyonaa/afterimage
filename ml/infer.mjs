import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline, env } from '@huggingface/transformers';
import { pairFeatures, forward } from './features.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [source, candidate] = process.argv.slice(2);
if (!source || !candidate) {
  console.error('Usage: node ml/infer.mjs "protected passage" "observed passage"');
  process.exit(1);
}
env.cacheDir = path.join(root, 'ml/cache/models');
const model = JSON.parse(fs.readFileSync(path.join(root, 'public/research/model.json'), 'utf8'));
const encoder = await pipeline('feature-extraction', model.encoder, { dtype: model.dtype });
const [a, b] = (await encoder([source, candidate], { pooling: 'mean', normalize: true })).tolist();
const score = forward(pairFeatures(a, b, source, candidate), model);
console.log(
  JSON.stringify(
    {
      score,
      threshold: model.threshold,
      contentMatch: score >= model.threshold,
      note: 'Content correspondence only; a denied policy is separately required for a finding.',
    },
    null,
    2,
  ),
);
await encoder.dispose();
