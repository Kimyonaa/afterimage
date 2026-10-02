'use client';
import { useEffect, useState } from 'react';
import { cases } from '@/lib/afterimage/fixtures';
import { isFinding } from '@/lib/afterimage/detector';

type Recording = { score: number; probabilities: Record<string, number> };
type Recordings = {
  model: string;
  threshold: number;
  cases: Record<string, { source: string; passages: Record<string, Recording> }>;
};
export default function RecordedLab({ onLive }: { onLive?: () => void }) {
  const [data, setData] = useState<Recordings | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  const [caseId, setCase] = useState('monsoon'),
    [surface, setSurface] = useState<'activity' | 'search' | 'publicText'>('activity');
  const [revoked, setRevoked] = useState(true),
    [approved, setApproved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/research/nli-fixture-recordings.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('The recorded examples could not be loaded.');
        return r.json() as Promise<Recordings>;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  const c = cases.find((c) => c.id === caseId)!;
  const recorded = data?.cases[caseId];
  const result = recorded?.source === c.source ? recorded.passages[c[surface]] : undefined;
  const flagged =
    !!data && !!result && isFinding(!revoked || approved, 200, result.score, data.threshold);
  return (
    <div className="secondary-page passage-lab">
      <div className="eyebrow">PASSAGE LAB / RECORDED EXAMPLES</div>
      <div className="section-title">
        <div>
          <h1>Separate the match from the policy.</h1>
          <p>Explore saved model results, then change who is allowed to see the passage.</p>
        </div>
      </div>
      <p className="recording-disclosure">
        These scores were recorded using pretrained DeBERTa. Changing a policy below updates the
        finding; it does not run the model again. To compare your own text, use the local edition.
      </p>
      {onLive && (
        <button className="button secondary" onClick={onLive}>
          Return to live local comparisons
        </button>
      )}
      <div className="recording-controls">
        <label>
          Case file
          <select value={caseId} onChange={(e) => setCase(e.target.value)}>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observed passage
          <select
            value={surface}
            onChange={(e) => {
              setSurface(e.target.value as typeof surface);
              setApproved(e.target.value === 'publicText');
            }}
          >
            <option value="activity">Rewritten activity message</option>
            <option value="search">Search excerpt</option>
            <option value="publicText">Public abstract</option>
          </select>
        </label>
      </div>
      <div className="comparison-panes">
        <article>
          <span className="comparison-tag">PROTECTED SOURCE</span>
          <p>{c.source}</p>
        </article>
        <article>
          <span className="comparison-tag">OBSERVED PASSAGE</span>
          <p>{c[surface]}</p>
        </article>
      </div>
      <div className="passage-policy">
        <div>
          <label>
            <input
              type="checkbox"
              checked={revoked}
              onChange={(e) => setRevoked(e.target.checked)}
            />{' '}
            Recipient’s access has been revoked
          </label>
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />{' '}
            This passage is approved for public release
          </label>
        </div>
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="button secondary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <p role="status">Loading recorded results…</p>
      ) : !result ? (
        <p role="alert">This recording does not match the current fixture.</p>
      ) : (
        <section className="passage-result" aria-live="polite">
          <span className={flagged ? 'finding-stamp' : 'clean-stamp'}>
            {flagged
              ? 'REVIEW REQUIRED'
              : !revoked || approved
                ? 'PERMITTED BY POLICY'
                : 'NO MATCH ABOVE THRESHOLD'}
          </span>
          <h2>
            {flagged
              ? 'A content match with access denied.'
              : !revoked || approved
                ? 'The policy allows this passage.'
                : 'The model did not find a strong enough match.'}
          </h2>
          <div className="nli-scores">
            {Object.entries(result.probabilities).map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{(value * 100).toFixed(1)}%</strong>
                <div>
                  <i style={{ width: `${value * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="comparison-note">
            Recorded score · {(data.threshold * 100).toFixed(0)}% decision threshold · scores are
            uncalibrated.
          </p>
          {surface !== 'publicText' && revoked && !approved && !flagged && (
            <p className="recorded-miss">
              Known miss: this fictional passage contains a protected fact, even though its
              entailment score is below the threshold. No finding does not mean no disclosure.
            </p>
          )}
        </section>
      )}
      <details className="local-setup">
        <summary>Compare your own passages locally</summary>
        <p>
          Clone the repository, install the app and model dependencies, then start the workbench:
        </p>
        <pre>
          <code>
            git clone https://github.com/Kimyonaa/afterimage.git{'\n'}cd afterimage{'\n'}npm ci
            {'\n'}npm ci --prefix ml{'\n'}npm run dev:lab
          </code>
        </pre>
        <p>
          The first run downloads the model. Open{' '}
          <a href="http://127.0.0.1:5173/#passage">the local Passage Lab</a> once it is ready. Your
          passage text stays on your computer.
        </p>
      </details>
      <a className="source-download" href="/research/nli-fixture-recordings.json" download>
        Download the recorded scores
      </a>
    </div>
  );
}
