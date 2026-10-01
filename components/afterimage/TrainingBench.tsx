'use client';
import { useEffect, useState } from 'react';
import { Download, FlaskConical } from 'lucide-react';
type Metric = {
  name: string;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  threshold: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
};
type Benchmark = {
  status: string;
  note: string;
  models: Metric[];
  counts: { train: number; validation: number; test: number };
  architecture?: string;
  split?: string;
  limitations?: string[];
  seed?: number;
  epochs?: number;
  ablation?: string;
};

const fmt = (n: number) => `${(n * 100).toFixed(1)}%`;
export default function TrainingBench() {
  const [b, setData] = useState<Benchmark | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/research/benchmark.json', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('The training results could not be loaded.');
        return response.json() as Promise<Benchmark>;
      })
      .then(setData)
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [attempt]);
  function onDownload() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'afterimage-benchmark.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  if (error)
    return (
      <div className="secondary-page" role="alert">
        <p>{error}</p>
        <button className="button secondary" onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="secondary-page">
      <div className="eyebrow">
        <span className="short-line" /> EXPERIMENT 001 / TRAINED CLASSIFIER
      </div>
      <div className="section-title">
        <div>
          <h1>The model bench.</h1>
          <p>Training, validation, and test results for the original passage classifier.</p>
        </div>
        <button
          className="button secondary"
          disabled={!b || b.status !== 'complete'}
          onClick={onDownload}
        >
          <Download size={16} /> Download results
        </button>
      </div>
      <div className="benchmark-intro">
        <FlaskConical size={26} strokeWidth={1.4} />
        <div>
          <h2>
            {b?.status === 'complete' ? 'Synthetic holdout evaluation' : 'Experiment preparing'}
          </h2>
          <p>{b?.note ?? 'Loading experiment metadata…'}</p>
        </div>
        <span className="mono">SEED {b?.seed ?? '—'}</span>
      </div>
      <div className="dataset-counts">
        {(['train', 'validation', 'test'] as const).map((k) => (
          <div key={k}>
            <span>
              {k === 'train'
                ? 'Training pairs'
                : k === 'validation'
                  ? 'Validation pairs'
                  : 'Held-out test pairs'}
            </span>
            <strong>{b?.counts[k] ?? '—'}</strong>
          </div>
        ))}
      </div>
      <h2 className="bench-section-heading">
        Detection quality <span>Test split · thresholds selected on validation</span>
      </h2>
      <div className="table-scroll benchmark-table">
        <table>
          <thead>
            <tr>
              <th>Detector</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1</th>
              <th>False-positive rate</th>
            </tr>
          </thead>
          <tbody>
            {b?.models.map((m) => (
              <tr key={m.name}>
                <td>
                  <span className={m.name.includes('Neural') ? 'model-dot neural' : 'model-dot'} />
                  {m.name}
                </td>
                <td>{fmt(m.precision)}</td>
                <td>{fmt(m.recall)}</td>
                <td>
                  <div className="f1-cell">
                    <span>{m.f1.toFixed(3)}</span>
                    <div>
                      <i style={{ width: fmt(m.f1) }} />
                    </div>
                  </div>
                </td>
                <td>{fmt(m.fpr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="benchmark-conclusion">
        In this experiment, the neural classifier did not outperform the lexical baselines. It
        missed the held-out paraphrases. The follow-up ablations below isolate the embedding and
        lexical features; they reuse this split and remain exploratory.
      </p>
      {b?.ablation && <p className="ablation-note">{b.ablation}</p>}
      <div className="bench-notes">
        <section>
          <span className="eyebrow">01 / ARCHITECTURE</span>
          <h3>A learned passage comparison.</h3>
          <p>{b?.architecture ?? 'Architecture details will appear after the training run.'}</p>
          <p>
            The content model compares passages. The policy layer separately decides whether access
            is allowed. Similarity alone never establishes a security finding.
          </p>
        </section>
        <section>
          <span className="eyebrow">02 / EVALUATION</span>
          <h3>Keep the holdout separate.</h3>
          <p>{b?.split ?? 'Source documents are grouped before splitting.'}</p>
          <p>
            Thresholds target at most 5% false positives on validation. The test false-positive rate
            can be higher; the table reports what actually happened.
          </p>
        </section>
      </div>
      <div className="limitations">
        <h3>What these numbers do not establish</h3>
        <ul>
          {(
            b?.limitations ?? [
              'This is a controlled synthetic benchmark, not a production security evaluation.',
            ]
          ).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <a className="source-download" href="/research/dataset.jsonl" download>
        Download the labeled dataset <Download size={16} />
      </a>
    </div>
  );
}
