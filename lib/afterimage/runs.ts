import type { LabState, Surface } from './fixtures';
export type Finding = {
  surface: Surface;
  status: number;
  text: string;
  permitted: boolean;
  caseId: string;
  revoked: boolean;
  repaired: boolean;
  observation: string;
  score: number;
  exact: number;
  fuzzy: number;
  flagged: boolean;
  reason: string;
};
export type Run = {
  findings: Finding[];
  threshold: number;
  model: string;
  execution?: string;
  createdAt: string;
  state: LabState;
};
export const ARCHIVE_KEY = 'afterimage-evidence-v1';
export function parseArchive(raw: string | null): Run[] {
  try {
    const list = JSON.parse(raw ?? '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((r: unknown): r is Run => {
        if (!r || typeof r !== 'object') return false;
        const x = r as Run;
        return (
          typeof x.createdAt === 'string' &&
          !Number.isNaN(Date.parse(x.createdAt)) &&
          typeof x.model === 'string' &&
          Number.isFinite(x.threshold) &&
          x.state &&
          typeof x.state.caseId === 'string' &&
          typeof x.state.revoked === 'boolean' &&
          typeof x.state.repaired === 'boolean' &&
          Array.isArray(x.findings) &&
          x.findings.length === 4 &&
          new Set(x.findings.map((f) => f.surface)).size === 4 &&
          x.findings.every(
            (f) =>
              f &&
              ['document', 'search', 'activity', 'tab'].includes(f.surface) &&
              typeof f.text === 'string' &&
              typeof f.flagged === 'boolean' &&
              Number.isFinite(f.score) &&
              Number.isFinite(f.status),
          )
        );
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}
export function previousUnfixed(runs: Run[], current: Run): Run | undefined {
  return runs.find(
    (r) =>
      r !== current &&
      r.state.caseId === current.state.caseId &&
      r.model === current.model &&
      r.state.revoked &&
      !r.state.repaired &&
      r.createdAt < current.createdAt,
  );
}
export function evidenceBundle(
  run: Run,
  source: { id: string; title: string; source: string },
  before?: Run,
) {
  return {
    schemaVersion: 2,
    kind: 'afterimage-fictional-lab-evidence',
    source: { id: source.id, title: source.title, text: source.source },
    policy:
      'Private derived content follows source access. Approved public abstracts are permitted.',
    run,
    ...(before
      ? {
          comparison: {
            before,
            after: run,
            note: 'Most recent earlier unfixed run for the same case and detector.',
          },
        }
      : {}),
    limitations: [
      'Controlled fixture, not an external vulnerability report.',
      'Content scores are not calibrated leakage probabilities.',
      'Application snapshot is not a browser-cache inspection.',
    ],
  };
}
