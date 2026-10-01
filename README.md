# Afterimage

A lab for checking what a web application still reveals after access is revoked.

A working research prototype that traces private passages across a web application's derived views after a collaborator loses access. The project combines application security, passage matching, and an interface for inspecting detector mistakes.

[Demo walkthrough](docs/demo.md) · [Research protocol](ml/README.md) · [Model attribution](NOTICE.md)

The hosted notebook is currently private. The source runs locally without a Sites account or an API key. Model weights are downloaded separately and are not checked into Git.

## Run locally

Requires Node.js 22.13 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by the development server. The app includes pretrained/exported detector artifacts, so using the lab requires neither a GPU nor an API key.

1. Select one of three fictional research cases.
2. Optionally open **Collaborator view** in another tab.
3. Click **Revoke & trace**. The source returns HTTP 403; three deliberately faulty derived surfaces still return private content.
4. Inspect the source and returned passages side by side. The default exact-plus-entailment detector catches all three seeded leaks in the monsoon case and two in the other cases. The original neural head still catches two. Ground truth is displayed separately.
5. Click **Apply fix & recheck**. Derived views enforce the same policy and return a public abstract. Findings clear.
6. Export the run as JSON, inspect before/after evidence, or revisit the last 20 runs in Run archive.
7. Open Model bench to compare frozen detectors and inspect individual mistakes.

This project includes only fictional fixtures; it does not scan external websites or ingest your resume.

## Notebook interface (v0.3)

The workbench uses a restrained paper-and-ink layout, direct observation labels, and responsive document views. Hosted Passage Lab explains how to open the local edition and does not automatically contact a loopback service. Reduced-motion preferences are respected.

## Live Passage Lab

```sh
npm ci --prefix ml
npm run dev:lab
```

This starts the web app and a local model companion on port 8765. If the web app is already running, use `npm run model:serve` in a second terminal. First startup downloads `Xenova/nli-deberta-v3-xsmall`; later runs use `ml/cache/`. Passage Lab accepts your own text and performs real local ONNX inference. Passage text is not sent to an external service or stored in the run archive. Inputs are limited to 4,000 characters per passage and 512 combined tokens.

The investigator’s **Exact + entailment (recorded)** option combines a live exact-match check with recorded NLI scores for known fixtures. It does not run DeBERTa inside the web worker. Passage Lab runs the actual model for each comparison. DeBERTa is pretrained, not fine-tuned by this project.

## Fresh challenge

A separate author-designed challenge has 48 pairs from 12 fictional documents, including paraphrases, partial facts, contradictions, and related public text. Original weights and thresholds stayed frozen; the NLI threshold was fixed at 0.8 before evaluation. Standalone DeBERTa detected **20/24 matches**, with **1/24 false positives** (95.2% precision, 83.3% recall). The original trained head detected none at its frozen threshold. All five NLI mistakes are inspectable in Model bench.

This small synthetic, paraphrase-heavy challenge is not independent real-world validation. Whole-passage entailment can miss partial disclosures when a candidate also contains unsupported details. Its results measure standalone NLI, not the investigator’s exact-plus-NLI combination. The original experiment is preserved below.

Run archive stores up to 20 fictional fixture runs in this browser. Repair comparisons use the most recent earlier revoked, unfixed run with the same case and detector. Export includes source, policy, observations, and comparison when available.

## What is implemented

- Responsive investigation workspace, three cases, four surfaces, collaborator portal.
- Real HTTP fixture endpoints, per-browser HTTP-only lab cookie, revocation and repair transitions.
- Explicit policy gate separate from content correspondence scoring.
- Frozen quantized MiniLM-L6 sentence encoder plus a trained neural classifier (770 → 32 → 16 → 1).
- Portable TypeScript inference for the trained head. Fixture embeddings are precomputed; each trace runs the head against observed fixture text.
- Exact-passage and token-containment baselines.
- Source-grouped synthetic dataset, reproducible training, measured holdout metrics, per-example predictions.
- Exportable evidence and explicit seeded-ground-truth/missed-detection display.

## Research results

The initial experiment contains 640 pairs from 80 source documents: 400 train, 80 validation, 160 test. Training, validation, and test use distinct topic families. All derivatives remain with their source. Some template scaffolding is shared, so this is not a wholly independent language-distribution test.

| Detector | Precision | Recall | F1 | False-positive rate |
| --- | ---: | ---: | ---: | ---: |
| Exact passage | 1.000 | 0.500 | 0.667 | 0.000 |
| Token containment | 1.000 | 0.500 | 0.667 | 0.000 |
| Neural pair classifier | 1.000 | 0.500 | 0.667 | 0.000 |
| Frozen MiniLM cosine | 0.594 | 0.237 | 0.339 | 0.163 |
| Neural · embeddings only | 1.000 | 0.475 | 0.644 | 0.000 |
| Neural · lexical only | 1.000 | 0.500 | 0.667 | 0.000 |

**The neural classifier did not beat the baselines on this holdout.** It misses the unseen paraphrase scaffolding and the demo's activity paraphrases. These results are a baseline and a visible research failure, not evidence of production effectiveness. Thresholds were chosen on validation data to maximize recall under a 5% false-positive constraint, with precision as a tie-breaker. The selected neural threshold is high (~0.9966). We have not retuned it on the test set.

The neural head uses embedding differences and products plus lexical features. Follow-up embedding-only and lexical-only ablations are included. They reuse the observed split, so they are exploratory and do not establish independent generalization. Scores are uncalibrated. Labels represent correspondence under the fixture's confidentiality policy, not formal entailment.

## Reproduce training or compare arbitrary passages

```sh
npm ci --prefix ml
npm run fixtures
npm run research
node ml/infer.mjs "The protected source passage" "The observed candidate passage"
```

The first run downloads `Xenova/all-MiniLM-L6-v2` from Hugging Face. Later runs use `ml/cache`. The original sentence transformer is `sentence-transformers/all-MiniLM-L6-v2` (Apache-2.0). The encoder is frozen; only the small neural head is trained. See [ml/README.md](ml/README.md) for the protocol.

To test new arbitrary passages, use the local inference command. The hosted detector is deliberately limited to the fixture corpus and returns an error for unknown text, rather than silently substituting a lookup result or an unrelated score.

## Verify

```sh
npm run typecheck
npm test
# With npm run dev running:
npm run test:integration
# With the model companion running:
npm run test:nli
npm run build
```

GitHub Actions runs formatting, type checks, core tests, fixture HTTP integration, and a production build. Live NLI checks run separately because they require downloading model weights.

Core tests cover permission transitions, policy gating, exported inference parity, source-group separation, cookie handling, and baseline edge cases. HTTP integration tests cover all three cases, authorized scans, revoked scans, measured model misses, fixed scans, stale observation rejection, cookie isolation, and invalid surfaces.

## Architecture

```text
Browser investigator
  ├─ POST /api/lab             set/reset/revoke/repair scenario
  ├─ GET  /api/surface?name=…  observe four actual fixture responses
  └─ POST /api/detect          verify observations against current state
         ├─ explicit policy check
         ├─ frozen fixture embeddings
         ├─ trained neural head or lexical baseline
         └─ finding + source/response evidence

Local research pipeline
  generated source groups → MiniLM embeddings → trained MLP
  validation-only threshold selection → untouched test evaluation
  exported weights + fixture vectors + metrics + per-example predictions
```

The application-managed tab snapshot is a controlled fixture endpoint. It is **not** a browser-cache inspection. The lab cookie is a scenario selector, not secure application authentication. Investigator source text is intentionally available; these routes must never be repurposed to store actual confidential documents. Previously downloaded files are outside the revocation guarantee.

## Project map

- `app/page.tsx`, `app/globals.css`: investigator workbench.
- `app/portal/page.tsx`: collaborator view.
- `app/api/*`: fixture control, surface responses, detector API.
- `lib/afterimage/fixtures.ts`: explicit policy and seeded faults.
- `lib/afterimage/detector.ts`: portable inference and baselines.
- `ml/`: generation, training, arbitrary-passage inference.
- `public/research/`: trained artifacts, dataset, benchmark, predictions.
- `tests/`: core and HTTP integration tests.

## Next research milestones

1. Evaluate on an independently authored, permissioned real-world corpus.
2. Repeat the included lexical-only and embedding-only ablations on a fresh independent test set.
3. Expand minimal-fact and numeric-contradiction coverage; add multilingual tests.
4. Evaluate on additional application templates with permission.
5. Calibrate scores and measure reviewer confirmation time.
6. Extend to image previews only after demonstrating text generalization.

These are unimplemented experiments. The current project is a runnable research prototype, not a production vulnerability scanner.

## Prior work

- [Autorize](https://github.com/PortSwigger/autorize): authorization tests across request contexts.
- [Google sign-out guidance](https://web.dev/articles/sign-out-best-practices): clearing sensitive state and synchronizing sessions.
- [MiniLM model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): sentence embeddings.

No claim of unprecedented research novelty is made.
