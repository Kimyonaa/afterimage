# Afterimage research

The encoder is frozen MiniLM-L6 (quantized ONNX, 384 dimensions). A small neural pair classifier is trained locally using TensorFlow.js. No paid API key is used.

```sh
npm install --prefix ml
node --experimental-strip-types scripts/export-fixtures.mjs
node ml/train.mjs
node ml/ablate.mjs
node ml/infer.mjs "A protected passage" "An observed passage"
```

Node 22.13+ is required. The first training run downloads the public model. Later runs reuse `ml/cache/`. The fixture encoder vectors are exported so the hosted lab can execute the trained neural head without loading a transformer into a constrained web worker. The hosted detector intentionally supports the finite fixture corpus; `infer.mjs` supports arbitrary passages locally.

Dataset: 640 generated pairs, 80 source documents, 8 topic families. Split by topic family (5/1/2), with all derivatives grouped by source document. Test paraphrase and partial-excerpt scaffolding differ from training; other templates remain shared. This is a limited synthetic benchmark, not evidence of production usefulness.

Training uses seed 42, no random batch shuffle, Adam 0.002, 50 epochs, batch size 32. The checkpoint with lowest validation loss is selected. Each detector threshold maximizes validation recall subject to a validation false-positive rate of at most 5%; ties prefer precision. Test data is not used for checkpoint/threshold selection. Scores are not calibrated probabilities.

The neural input combines |embedding difference|, embedding product, token containment, and exact-match features. This is not an end-to-end fine-tuned transformer. The published results include the measured lexical baselines. The follow-up ablations isolate embedding-only and lexical-only heads using the same original training protocol. They reuse the observed test split and are exploratory, not independent validation.

Outputs: model weights, fixture embeddings, benchmark metadata, full labeled dataset, per-example test predictions. Do not tune on the test examples after viewing results.

Future work: independently authored real-world corpus with permission; fresh independent ablation evaluation; unseen application templates; contradiction and minimal-fact tests; calibrated scores; visual matching. Treat these as missing experiments, not completed capabilities.

## Experiment 002: pretrained entailment

`npm run evaluate:nli` evaluates the untouched original detectors and quantized pretrained `Xenova/nli-deberta-v3-xsmall` on `challenge.mjs`: 48 manually authored pairs, 12 fictional documents. The fixed 0.8 NLI threshold and evaluation protocol are recorded in `public/research/nli-protocol.json`. No NLI training or threshold tuning was performed. This is a small author-designed challenge, not independent external validation.

Outputs: challenge JSONL, full predictions and confusion counts, corpus SHA-256, and explicitly recorded demo-fixture NLI scores. The investigator combines those recordings with live exact matching; challenge metrics are for standalone NLI. Original benchmark artifacts are unchanged.

`npm run model:serve` loads the model into a loopback-only HTTP companion for the browser Passage Lab. `/compare` executes fresh inference for each request; it does not store text. Policy gating follows content matching. Whole-passage entailment can reject a passage that leaks one fact but introduces another unsupported claim. Scores are uncalibrated.
