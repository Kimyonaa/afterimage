'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  FlaskConical,
  FileText,
  ScanLine,
  Layers,
  BookOpen,
  RotateCcw,
  Download,
  LockKeyhole,
  UnlockKeyhole,
  Check,
  Search,
  Bell,
  PanelTop,
  History,
  TestTubes,
  ChevronDown,
  CircleHelp,
  Fingerprint,
  Play,
  ShieldCheck,
  ExternalLink,
  LoaderCircle,
} from 'lucide-react';
import RunArchive, { RepairComparison, exportRun } from '@/components/afterimage/RunArchive';
const PassageLab = lazy(() => import('@/components/afterimage/PassageLab'));
const ModelBench = lazy(() => import('@/components/afterimage/ModelBench'));
const TrainingBench = lazy(() => import('@/components/afterimage/TrainingBench'));
import { ARCHIVE_KEY, parseArchive, type Run } from '@/lib/afterimage/runs';
import { cases, DEFAULT_STATE, type LabState, type Surface } from '@/lib/afterimage/fixtures';

type Observation = {
  surface: Surface;
  status: number;
  text: string;
  permitted: boolean;
  caseId: string;
  revoked: boolean;
  repaired: boolean;
  observation: string;
};
type Finding = Observation & {
  score: number;
  exact: number;
  fuzzy: number;
  flagged: boolean;
  reason: string;
};
const surfaceNames: Record<Surface, string> = {
  document: 'Document',
  search: 'Search preview',
  activity: 'Activity feed',
  tab: 'Open-tab snapshot',
};
const surfaceIcons = { document: FileText, search: Search, activity: Bell, tab: PanelTop };
const detectorNames: Record<string, string> = {
  hybrid: 'Exact + entailment (recorded)',
  neural: 'Neural pair classifier',
  fuzzy: 'Token containment',
  exact: 'Exact passage',
  cosine: 'Frozen MiniLM cosine',
  embedding: 'Neural · embeddings only',
  lexical: 'Neural · lexical only',
};
type View = 'investigation' | 'benchmark' | 'method' | 'passage' | 'archive';
const views: View[] = ['investigation', 'benchmark', 'method', 'passage', 'archive'];
const fmt = (n: number) => `${(n * 100).toFixed(1)}%`;
export default function Home() {
  const [view, updateView] = useState<View>('investigation');
  function setView(next: View) {
    window.location.hash = next;
    updateView(next);
  }
  useEffect(() => {
    const read = () => {
      if (window.location.hash === '#workspace') return;
      const next = window.location.hash.slice(1) as View;
      updateView(views.includes(next) ? next : 'investigation');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const [state, setState] = useState<LabState>(DEFAULT_STATE);
  const [run, setRun] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [archiveWarning, setArchiveWarning] = useState('');
  useEffect(() => {
    try {
      setRuns(parseArchive(localStorage.getItem(ARCHIVE_KEY)));
    } catch {
      setArchiveWarning('Browser storage is unavailable. Export evidence to keep it.');
    }
  }, []);
  function saveRun(value: Run) {
    setRuns((previous) => {
      const next = [value, ...previous].slice(0, 20);
      try {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
      } catch {
        setArchiveWarning('Evidence could not be saved in this browser. Export it before closing.');
      }
      return next;
    });
  }
  function clearArchive() {
    setRuns([]);
    try {
      localStorage.removeItem(ARCHIVE_KEY);
    } catch {
      setArchiveWarning('Browser storage could not be cleared.');
    }
  }
  const [selected, setSelected] = useState<Surface>('search');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(false);
  const [filter, setFilter] = useState<'all' | 'flagged'>('all');
  const [detector, setDetector] = useState('hybrid');
  const [ready, setReady] = useState(false);
  const c = cases.find((x) => x.id === state.caseId) ?? cases[0];
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/lab', { cache: 'no-store', signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load the lab.');
        return response.json() as Promise<{ state: LabState }>;
      })
      .then((lab) => {
        setState(lab.state);
        setReady(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('The lab could not connect. Reload to try again.');
      });
    return () => controller.abort();
  }, []);
  async function mutate(action: string, caseId?: string) {
    const response = await fetch('/api/lab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, caseId }),
    });
    if (!response.ok) throw new Error('The lab could not update access. Please try again.');
    const body = (await response.json()) as { state: LabState };
    setState(body.state);
    return body.state as LabState;
  }
  async function scan(next: LabState) {
    const observations = await Promise.all(
      (['document', 'search', 'activity', 'tab'] as Surface[]).map(async (name) => {
        const r = await fetch(`/api/surface?name=${name}`, { cache: 'no-store' });
        if (r.status !== 200 && r.status !== 403)
          throw new Error('A surface could not be checked.');
        return (await r.json()) as Observation;
      }),
    );
    const response = await fetch('/api/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observations, detector }),
    });
    if (!response.ok) throw new Error('The detector could not complete this run.');
    const results = (await response.json()) as Pick<
      Run,
      'findings' | 'threshold' | 'model' | 'execution'
    >;
    const completed = { ...results, state: next, createdAt: new Date().toISOString() };
    setRun(completed);
    saveRun(completed);
    setSelected(results.findings.find((f: Finding) => f.flagged)?.surface ?? 'document');
  }
  async function act(action: 'revoke' | 'repair' | 'reset' | 'scan', caseId?: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (action === 'reset') {
        await mutate('reset', caseId);
        setRun(null);
        setSelected('search');
        setNotice('Lab reset. The collaborator has access again.');
      } else {
        if (action !== 'scan') setRun(null);
        const next = action === 'scan' ? state : await mutate(action);
        await scan(next);
        setNotice(
          action === 'repair'
            ? 'All four surfaces checked again with the fix enabled.'
            : 'Trace complete. Select a surface to inspect its evidence.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  const flagged = run?.findings.filter((f) => f.flagged).length ?? 0;
  const knownMisses =
    run && run.state.revoked && !run.state.repaired
      ? run.findings.filter((f) => f.surface !== 'document' && !f.flagged).length
      : 0;
  const evidence = run?.findings.find((f) => f.surface === selected);
  const step = run?.state.repaired ? 3 : run ? 2 : state.revoked ? 1 : 0;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Afterimage home">
          <span className="brand-icon">
            <Layers size={22} />
          </span>
          <span>
            afterimage<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">
          RESEARCH WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Main navigation">
          <button
            className={view === 'investigation' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('investigation')}
          >
            <ScanLine size={18} /> Investigation <span className="nav-key">I</span>
          </button>
          <button
            className={view === 'benchmark' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('benchmark')}
          >
            <FlaskConical size={18} /> Model bench <span className="nav-key">B</span>
          </button>
          <button
            className={view === 'passage' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('passage')}
          >
            <TestTubes size={18} /> Passage lab <span className="nav-key">P</span>
          </button>
          <button
            className={view === 'archive' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('archive')}
          >
            <History size={18} /> Run archive <span className="nav-key">R</span>
          </button>
          <button
            className={view === 'method' ? 'nav-item active' : 'nav-item'}
            onClick={() => setView('method')}
          >
            <BookOpen size={18} /> Field notes <span className="nav-key">N</span>
          </button>
        </nav>
        <div className="sidebar-separator" />
        <div className="workspace-label">
          CASE FILES <span>03</span>
        </div>
        <div className="case-list">
          {cases.map((x) => (
            <button
              disabled={busy || !ready}
              key={x.id}
              className={`case-link ${x.id === c.id ? 'chosen' : ''}`}
              onClick={() => {
                setView('investigation');
                void act('reset', x.id);
              }}
            >
              <span className="case-number">{x.number}</span>
              <span>
                {x.title}
                <small>{x.code}</small>
              </span>
              {x.id === c.id && <span className="case-tick" />}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="lab-mark">
            <FlaskConical size={16} /> Controlled research lab
          </div>
          <p>
            Three fictional case files.
            <br />
            An experiment in access control.
          </p>
          <div className="profile">
            <span className="avatar">AN</span>
            <div>
              Anupam Nainiwal<small>Independent research</small>
            </div>
            <span className="version">v0.3</span>
          </div>
        </div>
      </aside>
      <main className="main-area" id="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>
              {view === 'investigation'
                ? 'Investigation'
                : view === 'benchmark'
                  ? 'Model bench'
                  : view === 'passage'
                    ? 'Passage lab'
                    : view === 'archive'
                      ? 'Run archive'
                      : 'Field notes'}
            </strong>
          </div>
          <div className="topbar-right">
            <a
              className="repository-link"
              href="https://github.com/Kimyonaa/afterimage"
              target="_blank"
              rel="noreferrer"
            >
              Source code <ExternalLink size={13} />
            </a>
            <button
              className="icon-button"
              onClick={() => setView('method')}
              aria-label="About this research"
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <Suspense
          fallback={
            <p className="secondary-page" role="status">
              Loading workspace…
            </p>
          }
        >
          {view === 'investigation' ? (
            <>
              <section className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="short-line" />
                    01 / ACCESS REVOCATION
                  </div>
                  <h1>The revocation desk.</h1>
                  <p>
                    Remove a collaborator’s access, then inspect what the application still returns.
                  </p>
                </div>
                <button
                  className="button secondary export"
                  disabled={!run || busy}
                  onClick={() => run && exportRun(run, runs)}
                >
                  <Download size={16} /> Export evidence
                </button>
              </section>
              <details className="quick-guide">
                <summary>First visit? A two-minute walkthrough</summary>
                <ol>
                  <li>
                    Choose a case and select <strong>Revoke &amp; trace</strong>. If a previous
                    session is active, reset it first.
                  </li>
                  <li>
                    Compare the source with the search preview and activity message. The source is
                    blocked, but three deliberately faulty surfaces still expose content.
                  </li>
                  <li>
                    Select <strong>Apply fix &amp; recheck</strong>. Inspect the before/after
                    evidence and export the result.
                  </li>
                </ol>
                <p>
                  This is a fictional portal with known faults. Open{' '}
                  <a href="#benchmark">Model bench</a> to see the detector’s measured mistakes, or{' '}
                  <a href="#passage">Passage lab</a> to explore the role of access policy.
                </p>
              </details>
              <section className="experiment-bar" aria-label="Experiment controls">
                <div className="experiment-case">
                  <span className="mini-label">ACTIVE CASE</span>
                  <strong>
                    {c.number} <span>/</span> {c.title}
                  </strong>
                </div>
                <div className="subject">
                  <span className="small-avatar">MK</span>
                  <div>
                    <strong>Mira Kapoor</strong>
                    <span>
                      Collaborator · {state.revoked ? 'access revoked' : 'access granted'}
                    </span>
                  </div>
                </div>
                <div className="experiment-actions">
                  <select
                    className="mobile-case-select"
                    aria-label="Choose case file"
                    value={state.caseId}
                    disabled={busy || !ready}
                    onChange={(e) => void act('reset', e.target.value)}
                  >
                    {cases.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.number} / {x.title}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button reset-button"
                    disabled={busy || !ready}
                    onClick={() => void act('reset')}
                    aria-label="Reset experiment"
                  >
                    <RotateCcw size={17} />
                  </button>
                  <button
                    className={`button primary ${state.repaired ? 'finished' : ''}`}
                    disabled={busy || !ready}
                    onClick={() =>
                      void act(!state.revoked ? 'revoke' : !state.repaired ? 'repair' : 'scan')
                    }
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : state.repaired ? (
                      <ScanLine size={17} />
                    ) : state.revoked ? (
                      <ShieldCheck size={17} />
                    ) : (
                      <Play size={16} />
                    )}{' '}
                    {busy
                      ? 'Tracing surfaces…'
                      : !state.revoked
                        ? 'Revoke & trace'
                        : !state.repaired
                          ? 'Apply fix & recheck'
                          : 'Trace again'}
                  </button>
                </div>
              </section>
              <div className="steps" aria-label="Experiment progress">
                {['Access granted', 'Access revoked', 'Surfaces traced', 'Fix verified'].map(
                  (label, i) => (
                    <div
                      key={label}
                      className={`step ${i <= step ? 'done' : ''} ${i === step ? 'current' : ''}`}
                    >
                      <span>{i < step ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span>
                      {label}
                      {i === step && <small>CURRENT</small>}
                    </div>
                  ),
                )}
              </div>
              {error && (
                <div role="alert" className="message error">
                  {error}
                </div>
              )}
              <div className="sr-only" aria-live="polite">
                {notice}
              </div>
              {archiveWarning && (
                <p className="message" role="status">
                  {archiveWarning}
                </p>
              )}
              <div className="investigation-layout">
                <section className="document-pane">
                  <div className="pane-heading">
                    <span>
                      <FileText size={16} /> Protected source
                    </span>
                    <span className="mono">{c.code}</span>
                  </div>
                  <div className="paper-wrap">
                    <article className="paper">
                      <div className="paper-top">
                        <span>
                          FIELD RECORD
                          <br />
                          <b>RESEARCH OFFICE</b>
                        </span>
                        <Fingerprint size={34} strokeWidth={1} />
                      </div>
                      <div className="classification">
                        <LockKeyhole size={11} /> RESTRICTED CIRCULATION
                      </div>
                      <h2>{c.title}</h2>
                      <p className="paper-subtitle">{c.subtitle}</p>
                      <div className="paper-byline">
                        <span>{c.author}</span>
                        <span>{c.date}</span>
                      </div>
                      <p className="paper-context">{c.context}</p>
                      <div
                        className={`source-passage ${run && !state.repaired ? 'is-highlighted' : ''}`}
                      >
                        <span className="margin-mark">01</span>
                        <p>{c.source}</p>
                      </div>
                      <p className="paper-context">
                        Distribution: principal investigator and approved collaborators. Access
                        changes must propagate to every derived view.
                      </p>
                      <div className="paper-bottom">
                        <span>INTERNAL WORKING DOCUMENT</span>
                        <span>01 / 01</span>
                      </div>
                    </article>
                    <div className="source-caption">
                      <LockKeyhole size={13} /> Investigator reference. This is not the
                      collaborator’s view.
                    </div>
                  </div>
                  <div className="policy-strip">
                    <span className={`policy-icon ${state.revoked ? 'revoked' : ''}`}>
                      {state.revoked ? <LockKeyhole size={17} /> : <UnlockKeyhole size={17} />}
                    </span>
                    <div>
                      <strong>
                        {state.revoked
                          ? 'Mira may no longer read this resource.'
                          : 'Mira can read this resource.'}
                      </strong>
                      <span>Policy: all derived private content follows document access.</span>
                    </div>
                  </div>
                </section>
                <section className="evidence-pane">
                  <div className="pane-heading">
                    <span>
                      <ScanLine size={16} /> Surface trace
                    </span>
                    <span className={`trace-count ${run && flagged ? 'danger-text' : ''}`}>
                      {run ? `${flagged} flagged / 4 checked` : '4 surfaces ready'}
                    </span>
                  </div>
                  <div className="surface-grid">
                    {(['document', 'search', 'activity', 'tab'] as Surface[]).map((name) => {
                      const Icon = surfaceIcons[name],
                        f = run?.findings.find((x) => x.surface === name);
                      return (
                        <button
                          key={name}
                          onClick={() => setSelected(name)}
                          className={`surface-cell ${selected === name ? 'selected' : ''} ${f?.flagged ? 'has-leak' : ''}`}
                        >
                          <Icon size={18} />
                          <span>{surfaceNames[name]}</span>
                          <small>
                            {!run
                              ? 'Not checked'
                              : f?.flagged
                                ? 'Residual content'
                                : f?.status === 403
                                  ? 'Access denied'
                                  : 'No finding'}
                          </small>
                          <span className="surface-indicator">
                            {!run ? '—' : f?.flagged ? '!' : <Check size={12} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {!run ? (
                    <div className="empty-evidence">
                      <span className="empty-index">OBSERVATION / —</span>
                      <h3>No observations yet.</h3>
                      <p>
                        {state.revoked
                          ? 'Trace the current surfaces to inspect the existing access policy, or reset the experiment to start again.'
                          : 'Revoke Mira’s access to see what survives in search, notifications, and an open-tab snapshot.'}
                      </p>
                      <div className="empty-note">
                        The source should close. Search results and activity messages should follow.
                      </div>
                    </div>
                  ) : evidence ? (
                    <div className="evidence-content">
                      <div className="evidence-label">
                        <span className={evidence.flagged ? 'finding-stamp' : 'clean-stamp'}>
                          {evidence.flagged
                            ? 'REVIEW REQUIRED'
                            : evidence.status === 403
                              ? 'ACCESS ENFORCED'
                              : 'NO FINDING'}
                        </span>
                        <span className="mono">HTTP {evidence.status}</span>
                      </div>
                      <h3>
                        {evidence.flagged
                          ? 'Protected content is still visible.'
                          : evidence.status === 403
                            ? 'The document request was denied.'
                            : 'No protected match above threshold.'}
                      </h3>
                      <div className={`observed-snippet ${evidence.flagged ? 'leak' : ''}`}>
                        <div>
                          <span className="snippet-icon">
                            {selected === 'search' ? (
                              <Search size={14} />
                            ) : selected === 'activity' ? (
                              <Bell size={14} />
                            ) : (
                              <FileText size={14} />
                            )}
                          </span>
                          <span>
                            {selected === 'search'
                              ? 'Research portal / Search results'
                              : selected === 'activity'
                                ? 'Research portal / Recent activity'
                                : selected === 'tab'
                                  ? 'Research portal / Tab snapshot'
                                  : 'Research portal / Document'}
                          </span>
                        </div>
                        <p>{evidence.text}</p>
                      </div>
                      <div className="match-summary">
                        <div>
                          <span>Content match score</span>
                          <strong>{fmt(evidence.score)}</strong>
                        </div>
                        <div className="match-meter">
                          <span style={{ width: fmt(evidence.score) }} />
                        </div>
                        <small>
                          Decision threshold {fmt(run.threshold)} · score is not calibrated
                          probability
                        </small>
                        {run.execution && <small>{run.execution}</small>}
                      </div>
                      <p className="evidence-reason">{evidence.reason}</p>
                      <button
                        className="details-toggle"
                        aria-expanded={details}
                        onClick={() => setDetails(!details)}
                      >
                        Reproduction details{' '}
                        <ChevronDown size={14} className={details ? 'rotated' : ''} />
                      </button>
                      {details && (
                        <div className="reproduction">
                          <ol>
                            <li>Grant Mira access to {c.code}.</li>
                            <li>Revoke document access in the lab.</li>
                            <li>
                              Request <code>/api/surface?name={selected}</code> with the same lab
                              cookie.
                            </li>
                            <li>Compare the observed passage against the protected source.</li>
                          </ol>
                          <p>{evidence.observation}</p>
                          <code>{run.createdAt}</code>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {run && run.model !== detectorNames[detector] && (
                    <p className="detector-pending">
                      Showing {run.model}. Rerun to apply the new detector.
                    </p>
                  )}
                  <div className="detector-footer">
                    <div>
                      <FlaskConical size={14} />
                      <label htmlFor="detector">Detector</label>
                      <select
                        id="detector"
                        value={detector}
                        disabled={busy}
                        onChange={(e) => setDetector(e.target.value)}
                      >
                        {Object.entries(detectorNames).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {run && (
                      <button disabled={busy} onClick={() => void act('scan')}>
                        Rerun
                      </button>
                    )}
                  </div>
                </section>
              </div>
              {run && <RepairComparison run={run} runs={runs} />}
              <section className="observations">
                {run && (
                  <div className="oracle-note">
                    <FlaskConical size={14} />
                    <span>
                      Fixture ground truth:{' '}
                      <strong>
                        {run.state.revoked && !run.state.repaired ? 3 : 0} seeded leaks
                      </strong>{' '}
                      · {flagged} detector findings
                      {knownMisses > 0
                        ? ` · ${knownMisses} known miss${knownMisses > 1 ? 'es' : ''}`
                        : ''}
                      .{' '}
                      {knownMisses > 0
                        ? 'At least one seeded leak was missed. Inspect the unflagged surfaces.'
                        : 'Inspect the passages alongside the detector result.'}
                    </span>
                  </div>
                )}
                <div className="observations-heading">
                  <h2>
                    Observation log <span>{run ? '04' : '00'}</span>
                  </h2>
                  <div className="log-actions">
                    <button
                      className={filter === 'all' ? 'text-tab on' : 'text-tab'}
                      onClick={() => setFilter('all')}
                    >
                      All surfaces
                    </button>
                    <button
                      className={filter === 'flagged' ? 'text-tab on' : 'text-tab'}
                      onClick={() => setFilter('flagged')}
                    >
                      Flagged only
                    </button>
                    <a href="/portal" target="_blank" rel="noreferrer">
                      Open collaborator view <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
                {run ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Surface</th>
                          <th>Response</th>
                          <th>Match score</th>
                          <th>Finding</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {run.findings
                          .filter((f) => filter === 'all' || f.flagged)
                          .map((f) => (
                            <tr key={f.surface} onClick={() => setSelected(f.surface)}>
                              <td>{surfaceNames[f.surface]}</td>
                              <td>
                                <span className="http-status">{f.status}</span>
                              </td>
                              <td>{fmt(f.score)}</td>
                              <td>
                                <span className={f.flagged ? 'status-label bad' : 'status-label'}>
                                  {f.flagged
                                    ? 'Review required'
                                    : f.status === 403
                                      ? 'Access enforced'
                                      : 'No finding'}
                                </span>
                              </td>
                              <td>
                                <button
                                  aria-label={`Inspect ${surfaceNames[f.surface]}`}
                                  onClick={() => setSelected(f.surface)}
                                >
                                  <ArrowUpRight size={15} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {filter === 'flagged' && !flagged && (
                      <p className="log-empty">No surfaces were flagged in this run.</p>
                    )}
                  </div>
                ) : (
                  <div className="log-empty">
                    <span className="mono">—</span> Your first trace will appear here. Each
                    observation includes the response and reproduction steps.
                  </div>
                )}
              </section>
              <footer className="page-footer">
                <span>AFTERIMAGE / ACCESS REVOCATION RESEARCH</span>
                <span>Fictional portal · explicit policy · inspectable evidence</span>
              </footer>
            </>
          ) : view === 'benchmark' ? (
            <ModelBench original={<TrainingBench />} />
          ) : view === 'passage' ? (
            <PassageLab />
          ) : view === 'archive' ? (
            <RunArchive runs={runs} onClear={clearArchive} />
          ) : (
            <MethodView />
          )}
        </Suspense>
      </main>
    </div>
  );
}
function MethodView() {
  return (
    <div className="secondary-page notes-page">
      <div className="eyebrow">
        <span className="short-line" /> FIELD NOTES / 001
      </div>
      <h1>Notes on the experiment.</h1>
      <p className="notes-lead">
        Afterimage is a research prototype for a specific failure: an application removes access to
        a document but keeps disclosing its contents through derived views.
      </p>
      <div className="notes-rule" />
      <div className="note-grid">
        <span className="note-index">01</span>
        <section>
          <h2>One policy, several surfaces.</h2>
          <p>
            The lab gives a collaborator access to a fictional research document. Revocation blocks
            the document endpoint. In the deliberately faulty version, search, activity, and an
            application-managed tab snapshot still return private content. The fix applies the same
            access check to every derived surface.
          </p>
          <p>
            The collaborator view makes real HTTP requests to the local fixture endpoints. Lab state
            lives in an HTTP-only cookie. This is a scenario controller, not a production
            authentication system.
          </p>
        </section>
      </div>
      <div className="note-grid">
        <span className="note-index">02</span>
        <section>
          <h2>Recognize the information.</h2>
          <p>
            A neural pair classifier estimates content correspondence between a protected source and
            an observed passage. Exact matching and token containment are available as baselines. A
            finding requires both a denied policy and a content match above the selected threshold.
          </p>
          <p>
            Every score comes from the selected detector. Scores are evidence for review, not
            calibrated probabilities or proof that a passage reveals a secret. The model may miss
            leaks or flag unrelated text.
          </p>
        </section>
      </div>
      <div className="note-grid">
        <span className="note-index">03</span>
        <section>
          <h2>Make the limits inspectable.</h2>
          <p>
            The benchmark uses generated records with known labels and document-grouped splits.
            Synthetic wording, a small vocabulary, and one portal limit what can be inferred. The
            open-tab surface is an application snapshot; this prototype does not inspect browser
            internals, downloaded files, or real third-party services.
          </p>
          <p>
            The investigator can see fixture source text by design. All records are fictional.
            Exported evidence describes a lab run, not a vulnerability discovered in an external
            website.
          </p>
        </section>
      </div>
      <div className="note-grid">
        <span className="note-index">04</span>
        <section>
          <h2>Build on established work.</h2>
          <p>
            <a href="https://github.com/PortSwigger/autorize" target="_blank" rel="noreferrer">
              Autorize <ArrowUpRight size={13} />
            </a>{' '}
            tests authorization across request contexts.{' '}
            <a
              href="https://web.dev/articles/sign-out-best-practices"
              target="_blank"
              rel="noreferrer"
            >
              Google’s sign-out guidance <ArrowUpRight size={13} />
            </a>{' '}
            describes clearing sensitive state. Afterimage explores content correspondence across
            derived views during revocation. It does not claim to invent authorization testing.
          </p>
        </section>
      </div>
      <div className="research-signature">
        <Fingerprint size={35} strokeWidth={1} />
        <div>
          Afterimage / Research notebook
          <span>Anupam Nainiwal · Security / Machine learning / Interface design</span>
        </div>
      </div>
    </div>
  );
}
