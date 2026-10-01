'use client';
import { useState } from 'react';
import { Download, History, Trash2, FileText } from 'lucide-react';
import { cases } from '@/lib/afterimage/fixtures';
import { type Run, evidenceBundle, previousUnfixed } from '@/lib/afterimage/runs';
const names: Record<string, string> = {
  document: 'Document',
  search: 'Search preview',
  activity: 'Activity feed',
  tab: 'Tab snapshot',
};
export function exportRun(run: Run, runs: Run[]) {
  const c = cases.find((x) => x.id === run.state.caseId);
  if (!c) return;
  const blob = new Blob(
      [JSON.stringify(evidenceBundle(run, c, previousUnfixed(runs, run)), null, 2)],
      { type: 'application/json' },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `afterimage-${c.id}-${run.createdAt.replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
export function RepairComparison({ run, runs }: { run: Run; runs: Run[] }) {
  const before = previousUnfixed(runs, run);
  const [surface, setSurface] = useState('search');
  if (!run.state.repaired || !before) return null;
  const old = before.findings.find((f) => f.surface === surface),
    now = run.findings.find((f) => f.surface === surface);
  return (
    <section className="repair-comparison">
      <div className="comparison-heading">
        <div>
          <span className="eyebrow">REPAIR COMPARISON</span>
          <h2>What changed after the fix?</h2>
        </div>
        <label>
          Surface
          <select value={surface} onChange={(e) => setSurface(e.target.value)}>
            {Object.entries(names).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="comparison-panes">
        <article>
          <span className="comparison-tag before">
            BEFORE / {old?.flagged ? 'FLAGGED' : 'NOT FLAGGED'}
          </span>
          <p>{old?.text}</p>
          <small>
            HTTP {old?.status} · {(Number(old?.score) * 100).toFixed(1)}% match
          </small>
        </article>
        <article>
          <span className="comparison-tag after">
            AFTER / {now?.flagged ? 'FLAGGED' : 'NOT FLAGGED'}
          </span>
          <p>{now?.text}</p>
          <small>
            HTTP {now?.status} · {(Number(now?.score) * 100).toFixed(1)}% match
          </small>
        </article>
      </div>
      <p className="comparison-note">
        Compared with the most recent earlier unfixed run using {run.model}. A lower model score
        alone does not prove the fix.
      </p>
    </section>
  );
}
export default function RunArchive({ runs, onClear }: { runs: Run[]; onClear: () => void }) {
  const [selected, setSelected] = useState(0);
  const run = runs[Math.min(selected, Math.max(0, runs.length - 1))];
  const c = cases.find((x) => x.id === run?.state.caseId);
  return (
    <div className="secondary-page">
      <div className="eyebrow">
        <History size={14} /> LOCAL EVIDENCE ARCHIVE
      </div>
      <div className="section-title">
        <div>
          <h1>Saved observations.</h1>
          <p>The latest 20 runs stay in this browser. Exports include the source and policy.</p>
        </div>
        <button className="button secondary" disabled={!runs.length} onClick={onClear}>
          <Trash2 size={15} /> Clear archive
        </button>
      </div>
      {!run ? (
        <div className="archive-empty">
          <FileText size={30} strokeWidth={1} />
          <h2>No traces saved yet.</h2>
          <p>Run an investigation to save its observations here.</p>
        </div>
      ) : (
        <div className="archive-layout">
          <div className="archive-list" aria-label="Saved runs">
            {runs.map((r, i) => (
              <button
                key={`${r.createdAt}-${i}`}
                className={selected === i ? 'selected' : ''}
                onClick={() => setSelected(i)}
              >
                <strong>
                  {cases.find((x) => x.id === r.state.caseId)?.title ?? r.state.caseId}
                </strong>
                <span>
                  {r.state.repaired
                    ? 'After fix'
                    : r.state.revoked
                      ? 'Access revoked'
                      : 'Access granted'}{' '}
                  · {r.findings.filter((f) => f.flagged).length} flagged
                </span>
                <small>
                  {new Date(r.createdAt).toLocaleString()} · {r.model}
                </small>
              </button>
            ))}
          </div>
          <section className="archive-report">
            <div className="comparison-heading">
              <div>
                <span className="eyebrow">SAVED OBSERVATION</span>
                <h2>{c?.title}</h2>
              </div>
              <button className="button secondary" onClick={() => exportRun(run, runs)}>
                <Download size={15} /> Export
              </button>
            </div>
            <div className="archive-source">
              <span>PROTECTED SOURCE</span>
              <p>{c?.source}</p>
            </div>
            {run.findings.map((f) => (
              <article key={f.surface}>
                <div>
                  <strong>{names[f.surface]}</strong>
                  <span className={f.flagged ? 'danger-text' : ''}>
                    {f.flagged ? 'Flagged' : f.status === 403 ? 'Denied' : 'Not flagged'} · HTTP{' '}
                    {f.status}
                  </span>
                </div>
                <p>{f.text}</p>
              </article>
            ))}
            <small>
              Viewing this saved run does not change the live portal or its permissions.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
