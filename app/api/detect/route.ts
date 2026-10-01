import { caseFor, observe, parseState, type Surface } from '@/lib/afterimage/fixtures';
import {
  exact,
  containment,
  infer,
  isFinding,
  cosine,
  type Model,
} from '@/lib/afterimage/detector';
import modelData from '@/public/research/model.json';
import embeddingModel from '@/public/research/model-embedding-only.json';
import lexicalModel from '@/public/research/model-lexical-only.json';
import vectorsData from '@/public/research/fixture-embeddings.json';
import benchmark from '@/public/research/benchmark.json';
import nliRecordings from '@/public/research/nli-fixture-recordings.json';
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      detector?: string;
      observations?: { surface: Surface; text: string; status: number }[];
    };
    const detector = body.detector ?? 'neural';
    if (
      !['neural', 'fuzzy', 'exact', 'cosine', 'embedding', 'lexical', 'hybrid'].includes(detector)
    )
      return Response.json({ error: 'Unknown detector' }, { status: 400 });
    if (
      !Array.isArray(body.observations) ||
      body.observations.length !== 4 ||
      new Set(body.observations.map((o) => o.surface)).size !== 4
    )
      return Response.json(
        { error: 'Four distinct surface observations are required' },
        { status: 400 },
      );
    const state = parseState(request.headers.get('cookie')),
      c = caseFor(state.caseId);
    const names = {
      neural: 'Neural pair classifier',
      fuzzy: 'Token containment',
      exact: 'Exact passage',
      cosine: 'Frozen MiniLM cosine',
      embedding: 'Neural · embeddings only',
      lexical: 'Neural · lexical only',
      hybrid: 'Exact + entailment (recorded)',
    };
    const name = names[detector as keyof typeof names];
    const measured = (benchmark.models as { name: string; threshold: number }[]).find(
      (m) => m.name === name,
    );
    if (!measured && detector !== 'hybrid')
      return Response.json({ error: 'Training results are not ready' }, { status: 503 });
    const threshold = detector === 'hybrid' ? nliRecordings.threshold : measured!.threshold;
    const findings = [];
    for (const o of body.observations) {
      if (!['document', 'search', 'activity', 'tab'].includes(o.surface))
        return Response.json({ error: 'Unknown surface' }, { status: 400 });
      const truth = observe(state, o.surface);
      if (o.text !== truth.text || o.status !== truth.status)
        return Response.json(
          { error: 'Lab state changed during the trace. Run it again.' },
          { status: 409 },
        );
      const e = exact(c.source, o.text),
        f = containment(c.source, o.text);
      const selectedModel =
        detector === 'embedding'
          ? embeddingModel
          : detector === 'lexical'
            ? lexicalModel
            : modelData;
      const recorded = (
        nliRecordings.cases as Record<
          string,
          { source: string; passages: Record<string, { score: number }> }
        >
      )[c.id];
      if (
        detector === 'hybrid' &&
        (!recorded || recorded.source !== c.source || !recorded.passages[o.text])
      )
        return Response.json(
          { error: 'The fixture recording does not match the current source.' },
          { status: 409 },
        );
      const score =
        detector === 'hybrid'
          ? Math.max(e, recorded.passages[o.text].score)
          : detector === 'exact'
            ? e
            : detector === 'fuzzy'
              ? f
              : detector === 'cosine'
                ? cosine(c.source, o.text, vectorsData as Record<string, number[]>)
                : infer(
                    c.source,
                    o.text,
                    vectorsData as Record<string, number[]>,
                    selectedModel as Model,
                  );
      const flagged = isFinding(truth.permitted, truth.status, score, threshold);
      const reason = truth.permitted
        ? 'The collaborator is authorized. A content match is expected and is not a finding.'
        : truth.status === 403
          ? 'The endpoint denied the request after revocation. No private document body was returned.'
          : flagged
            ? 'The collaborator is no longer authorized, but this surface returned a passage that matched the protected source above the selected threshold. Review the text to confirm disclosure.'
            : 'This passage did not match the source above the selected threshold. A negative result is not proof that the surface is safe.';
      findings.push({ ...truth, score, exact: e, fuzzy: f, flagged, reason });
    }
    return Response.json(
      {
        findings,
        threshold,
        model: name,
        execution:
          detector === 'hybrid'
            ? 'Live exact-match check + recorded local DeBERTa fixture inference. Use Passage Lab for live comparisons.'
            : 'Live portable detector inference using frozen fixture embeddings where required.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request' },
      { status: 400 },
    );
  }
}
