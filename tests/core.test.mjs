import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cases,
  DEFAULT_STATE,
  transition,
  observe,
  parseState,
} from '../lib/afterimage/fixtures.ts';
import { isFinding, infer, exact, containment } from '../lib/afterimage/detector.ts';
import { forward, pairFeatures, chooseThreshold, metrics } from '../ml/features.mjs';
const model = JSON.parse(
  fs.readFileSync(new URL('../public/research/model.json', import.meta.url)),
);
const vectors = JSON.parse(
  fs.readFileSync(new URL('../public/research/fixture-embeddings.json', import.meta.url)),
);
test('Revocation blocks source but seeded derivatives survive until repair', () => {
  for (const c of cases) {
    let s = transition(DEFAULT_STATE, 'reset', c.id);
    assert.equal(observe(s, 'document').status, 200);
    s = transition(s, 'revoke');
    assert.equal(observe(s, 'document').status, 403);
    for (const surface of ['search', 'activity', 'tab']) {
      const o = observe(s, surface);
      assert.equal(o.status, 200);
      assert.equal(o.permitted, false);
      assert.notEqual(o.text, c.publicText);
    }
    s = transition(s, 'repair');
    for (const surface of ['search', 'activity', 'tab'])
      assert.equal(observe(s, surface).text, c.publicText);
  }
});
test('A permitted or denied response is never a finding regardless of similarity', () => {
  assert.equal(isFinding(true, 200, 1, 0.5), false);
  assert.equal(isFinding(false, 403, 1, 0.5), false);
  assert.equal(isFinding(false, 200, 0.9, 0.5), true);
  assert.equal(isFinding(false, 200, 0.1, 0.5), false);
});
test('TypeScript portable inference matches exported research implementation', () => {
  for (const c of cases)
    for (const k of ['source', 'search', 'activity', 'publicText']) {
      const a = infer(c.source, c[k], vectors, model),
        b = forward(pairFeatures(vectors[c.source], vectors[c[k]], c.source, c[k]), model);
      assert.ok(Math.abs(a - b) < 1e-12);
    }
});
test('Source document groups never cross data splits and template provenance is explicit', () => {
  const rows = fs
    .readFileSync(new URL('../public/research/dataset.jsonl', import.meta.url), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse);
  const seen = new Map();
  for (const r of rows) {
    if (seen.has(r.documentId)) assert.equal(seen.get(r.documentId), r.split);
    seen.set(r.documentId, r.split);
  }
  assert.equal(seen.size, 80);
  assert.equal(rows.length, 640);
});
test('Cookie parse handles malformed state and reset clears prior repair', () => {
  assert.deepEqual(parseState('afterimage_lab=invalid'), DEFAULT_STATE);
  assert.deepEqual(
    transition({ caseId: 'monsoon', revoked: true, repaired: true }, 'reset'),
    DEFAULT_STATE,
  );
});
test('Threshold selection uses labels and meets validation false-positive budget', () => {
  const labels = [0, 0, 1, 1],
    scores = [0.1, 0.4, 0.7, 0.9],
    t = chooseThreshold(labels, scores),
    m = metrics(labels, scores, t);
  assert.equal(m.fpr, 0);
  assert.equal(m.recall, 1);
});
test('Lexical baselines handle empty and exact passages', () => {
  assert.equal(containment('source', ''), 0);
  assert.equal(exact(cases[0].source, cases[0].search), 1);
});
import { parseArchive, previousUnfixed, evidenceBundle } from '../lib/afterimage/runs.ts';
test('Corrupt archived data is discarded and exports preserve source and before/after evidence', () => {
  assert.deepEqual(parseArchive('{broken'), []);
  assert.deepEqual(parseArchive('[{"findings":[null]}]'), []);
  const findings = ['document', 'search', 'activity', 'tab'].map((surface) => ({
    ...observe({ ...DEFAULT_STATE, revoked: true }, surface),
    flagged: surface !== 'document',
    score: 1,
    exact: 1,
    fuzzy: 1,
    reason: 'fixture',
  }));
  const before = {
    findings,
    threshold: 0.8,
    model: 'test',
    createdAt: '2026-10-01T01:00:00Z',
    state: { ...DEFAULT_STATE, revoked: true },
  };
  const after = {
    ...before,
    createdAt: '2026-10-01T01:01:00Z',
    state: { ...before.state, repaired: true },
  };
  assert.equal(parseArchive(JSON.stringify([before, after])).length, 2);
  const malformed = { ...before, findings: [null, ...findings.slice(1)] };
  assert.deepEqual(parseArchive(JSON.stringify([malformed, before])), [before]);
  const earlier = { ...before, createdAt: '2026-10-01T00:00:00Z' };
  assert.equal(previousUnfixed([earlier, before], after), before);
  assert.equal(previousUnfixed([earlier], before), undefined);
  assert.equal(previousUnfixed([after, before], after), before);
  assert.equal(previousUnfixed([{ ...before, model: 'other' }], after), undefined);
  const bundle = evidenceBundle(after, cases[0], before);
  assert.equal(bundle.source.text, cases[0].source);
  assert.equal(bundle.comparison.before, before);
});
