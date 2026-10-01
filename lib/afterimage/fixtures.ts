export type Surface = 'document' | 'search' | 'activity' | 'tab';
export type LabState = { caseId: string; revoked: boolean; repaired: boolean };
export type CaseFile = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  author: string;
  date: string;
  source: string;
  context: string;
  search: string;
  activity: string;
  publicText: string;
  code: string;
};
export const cases: CaseFile[] = [
  {
    id: 'monsoon',
    number: '01',
    title: 'The missing monsoon',
    subtitle: 'Water systems · unpublished field research',
    author: 'Dr. Aditi Rao',
    date: '16 September 2026',
    code: 'THAR / 026',
    context:
      'Preliminary observations from the western field stations. Internal circulation only; the public abstract contains methodology, not results.',
    source:
      'The Khetolai pilot recorded a 31% reduction in groundwater recharge. The team will suspend the western borewell trial on 18 October. These findings remain confidential until the district review.',
    search: 'The Khetolai pilot recorded a 31% reduction in groundwater recharge.',
    activity:
      'The western borewell experiment will be paused on October 18 after recharge at Khetolai fell by nearly a third.',
    publicText:
      'The Thar water study examines seasonal groundwater recharge using field sensors. Results will be released after peer review.',
  },
  {
    id: 'orchid',
    number: '02',
    title: 'A location worth protecting',
    subtitle: 'Conservation · restricted field notes',
    author: 'Dr. Kabir Sen',
    date: '12 September 2026',
    code: 'FLORA / 041',
    context:
      'Habitat observations are shared with approved conservation collaborators. Exact nesting and population details are excluded from the public field guide.',
    source:
      'The orchid colony contains 47 flowering plants in the eastern quarry. The survey team will visit the site on 23 November. The colony location is restricted to the conservation team.',
    search: 'The orchid colony contains 47 flowering plants in the eastern quarry.',
    activity:
      'Forty-seven orchids are flowering at the quarry to the east; the researchers return there on November 23.',
    publicText:
      'The conservation project monitors rare orchids and publishes general habitat guidance without disclosing colony locations.',
  },
  {
    id: 'fellowship',
    number: '03',
    title: 'Before the announcement',
    subtitle: 'Research office · confidential review',
    author: 'Prof. Leena Shah',
    date: '9 September 2026',
    code: 'AWARDS / 013',
    context:
      'Panel deliberations are confidential. The public programme description is approved for general circulation; award decisions are not.',
    source:
      'The panel selected the Aster lab for a grant of 840000 rupees. The award will be announced on 14 December. The selection must remain private until the announcement.',
    search: 'The panel selected the Aster lab for a grant of 840000 rupees.',
    activity:
      'Aster is receiving an eight lakh forty thousand rupee research award, with the public announcement scheduled for December 14.',
    publicText:
      'The fellowship programme funds interdisciplinary research. Award recipients are published after the selection process concludes.',
  },
];
export const DEFAULT_STATE: LabState = { caseId: 'monsoon', revoked: false, repaired: false };
export function caseFor(id: string) {
  return cases.find((c) => c.id === id) ?? cases[0];
}
export function parseState(cookie: string | null): LabState {
  const raw = cookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('afterimage_lab='))
    ?.slice('afterimage_lab='.length);
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const x = JSON.parse(decodeURIComponent(raw));
    return {
      caseId: caseFor(x.caseId).id,
      revoked: x.revoked === true,
      repaired: x.repaired === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}
export function transition(state: LabState, action: string, caseId?: string): LabState {
  if (action === 'reset') return { ...DEFAULT_STATE, caseId: caseFor(caseId ?? state.caseId).id };
  if (action === 'revoke') return { ...state, revoked: true };
  if (action === 'repair') return { ...state, repaired: true };
  throw new Error('Unknown lab action');
}
export function observe(state: LabState, surface: Surface) {
  const c = caseFor(state.caseId);
  const protectedSurface = surface === 'document' || state.repaired;
  const denied = state.revoked && protectedSurface;
  const text = denied
    ? surface === 'document'
      ? 'Your access to this document has been removed.'
      : c.publicText
    : surface === 'search'
      ? c.search
      : surface === 'activity'
        ? c.activity
        : c.source;
  return {
    surface,
    status: denied && surface === 'document' ? 403 : 200,
    text,
    permitted: !state.revoked,
    caseId: c.id,
    revoked: state.revoked,
    repaired: state.repaired,
    observation:
      surface === 'tab'
        ? 'Application-managed tab snapshot; not a browser cache inspection.'
        : 'Live fixture endpoint response.',
  };
}
