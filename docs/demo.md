# A short walkthrough

Afterimage asks whether private information survives a change in access. It uses a fictional portal so the expected result can be inspected alongside the detector's result.

1. Start the web app with `npm run dev` and open `http://127.0.0.1:5173`.
2. Select **The missing monsoon** and reset the experiment if needed.
3. Click **Revoke & trace**. The source returns 403, while search, activity, and the tab snapshot still disclose content. The default detector flags all three in this case.
4. Inspect the activity message. Its wording differs from the source. The default detector uses a recorded pretrained entailment score for this fixture, combined with live exact matching.
5. Switch to **Neural pair classifier** and rerun. It misses the activity paraphrase. This is a measured limitation of the trained baseline.
6. Click **Apply fix & recheck**. The same access rule now applies to the derived surfaces. The archive retains the original evidence.
7. Open **Model bench** to inspect the fresh challenge and its five NLI mistakes. The standalone NLI results do not measure the default hybrid detector.
8. For arbitrary passages, install the separate model dependencies with `npm ci --prefix ml`, start `npm run model:serve`, and open **Passage lab** locally.

## What to explain

- Content matching and access policy are separate decisions.
- The source-grouped training split prevents derivatives of a document from crossing splits, but shared templates still limit generalization.
- The original trained head did not outperform lexical baselines. Pretrained NLI improved results on a later, small synthetic challenge.
- The app-managed tab snapshot is a fixture, not a browser-cache scanner.
- Neither the demo nor the benchmark establishes production security effectiveness.

## What runs where

| Component | Execution |
| --- | --- |
| Investigator | Web app and fixture HTTP endpoints |
| Trained classifier | Exported weights and precomputed fixture embeddings |
| Default hybrid | Live exact matching plus recorded NLI fixture scores |
| Passage Lab | Fresh ONNX inference in a loopback-only local companion |
| Run archive | This browser's local storage; fictional fixture runs only |

The first model startup needs network access to download weights. Subsequent inference uses the local cache. The hosted site cannot use your local companion directly; open the local workbench.
