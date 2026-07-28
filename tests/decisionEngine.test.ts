import { describe, it, expect } from 'vitest';
import {
  corroborationSignal,
  decide,
  factCheckSignal,
  fuse,
  labelStances,
  linguisticSignal,
  llmSignal,
  referenceSignal,
  type SignalContribution,
} from '@/lib/decisionEngine';
import type { RetrievalOutcome, RetrievedEvidence } from '@/lib/retrieval';

function evidence(overrides: Partial<RetrievedEvidence> = {}): RetrievedEvidence {
  return {
    title: 'Headline',
    publisher: 'Reuters',
    author: null,
    url: `https://example.com/${Math.random().toString(36).slice(2)}`,
    publishedAt: '2026-07-01T00:00:00Z',
    snippet: 'Snippet',
    stance: 'Neutral',
    similarity: 0.5,
    reliability: 0.9,
    provider: 'newsapi',
    ...overrides,
  };
}

function outcome(items: RetrievedEvidence[], overrides: Partial<RetrievalOutcome> = {}): RetrievalOutcome {
  return {
    evidence: items,
    providersQueried: items.length > 0 || overrides.providersQueried ? ['newsapi'] : ['newsapi'],
    providersFailed: [],
    offline: false,
    ...overrides,
  };
}

const OFFLINE: RetrievalOutcome = {
  evidence: [],
  providersQueried: [],
  providersFailed: [],
  offline: true,
};

describe('TC-DE-01 linguisticSignal()', () => {
  it('leans negative for sensationalist text', () => {
    const signal = linguisticSignal(
      'SHOCKING TRUTH they don\'t want you to know',
      'Doctors hate this one weird trick, a guaranteed cure, share before deleted!!'
    );
    expect(signal.score).toBeLessThan(0);
    expect(signal.detail).toBeTruthy();
  });

  it('leans positive for attributed reporting', () => {
    const signal = linguisticSignal(
      'Central bank raises rates',
      'According to Reuters, a peer-reviewed study published in nature confirms the trend.'
    );
    expect(signal.score).toBeGreaterThan(0);
  });

  it('returns exactly 0 when no markers are present', () => {
    const signal = linguisticSignal('Meeting held', 'A meeting took place.');
    expect(signal.score).toBe(0);
  });

  it('always carries the lowest evidence weight', () => {
    const signal = linguisticSignal('x', 'y');
    expect(signal.weight).toBeLessThanOrEqual(0.12);
  });

  it('always populates a human-readable detail', () => {
    for (const [t, c] of [['a', 'b'], ['SHOCKING!!', 'conspiracy'], ['Study', 'according to reuters']]) {
      expect(linguisticSignal(t, c).detail.length).toBeGreaterThan(10);
    }
  });
});

describe('TC-DE-02 factCheckSignal()', () => {
  it('returns null when no fact-check was retrieved', () => {
    expect(factCheckSignal([evidence({ provider: 'newsapi' })])).toBeNull();
  });

  it('returns null when fact-checks exist but are all Neutral', () => {
    expect(factCheckSignal([evidence({ provider: 'factcheck', stance: 'Neutral' })])).toBeNull();
  });

  it('leans strongly negative when fact-checkers rated the claim false', () => {
    const signal = factCheckSignal([
      evidence({ provider: 'factcheck', stance: 'Contradicting', publisher: 'Alt News', similarity: 0.8 }),
      evidence({ provider: 'factcheck', stance: 'Contradicting', publisher: 'BOOM Live', similarity: 0.7 }),
    ]);
    expect(signal).not.toBeNull();
    expect(signal!.score).toBe(-1);
    expect(signal!.detail).toContain('Alt News');
  });

  it('carries the highest weight of any signal', () => {
    const factCheck = factCheckSignal([evidence({ provider: 'factcheck', stance: 'Contradicting' })])!;
    const corroboration = corroborationSignal([evidence({ provider: 'googlenews' })]);
    const reference = referenceSignal([evidence({ provider: 'wikidata' })])!;
    const linguistic = linguisticSignal('t', 'c');
    const llm = llmSignal({ score: 1, reasoning: 'x' })!;

    for (const other of [corroboration, reference, linguistic, llm]) {
      expect(factCheck.weight).toBeGreaterThan(other.weight);
    }
  });
});

describe('TC-DE-03 corroborationSignal()', () => {
  it('penalises a total absence of coverage, but only mildly', () => {
    const signal = corroborationSignal([]);
    expect(signal.score).toBeLessThan(0);
    expect(signal.score).toBeGreaterThan(-0.5);
    expect(signal.detail).toMatch(/Absence of coverage is weak evidence/i);
  });

  it('rewards multiple close matches from reliable outlets', () => {
    const items = Array.from({ length: 3 }, () => evidence({ similarity: 0.6, reliability: 0.95 }));
    expect(corroborationSignal(items).score).toBe(1);
  });

  it('does not reward loose matches from unknown outlets', () => {
    const items = [evidence({ similarity: 0.15, reliability: 0.4, publisher: 'Random Blog' })];
    expect(corroborationSignal(items).score).toBeLessThan(0);
  });
});

describe('TC-DE-04 llmSignal()', () => {
  it('returns null when the model did not run', () => {
    expect(llmSignal(null)).toBeNull();
  });

  it('clamps an out-of-range score', () => {
    expect(llmSignal({ score: 5, reasoning: 'x' })!.score).toBe(1);
    expect(llmSignal({ score: -5, reasoning: 'x' })!.score).toBe(-1);
  });

  it('carries the lowest weight of all layers', () => {
    const llm = llmSignal({ score: 1, reasoning: 'x' })!;
    const factCheck = factCheckSignal([evidence({ provider: 'factcheck', stance: 'Contradicting' })])!;
    const corroboration = corroborationSignal([evidence({ provider: 'googlenews' })]);
    const reference = referenceSignal([evidence({ provider: 'wikidata' })])!;

    for (const heavier of [factCheck, corroboration, reference]) {
      expect(llm.weight).toBeLessThanOrEqual(heavier.weight);
    }
  });
});

describe('TC-DE-05 three-state verdict (PRD §3 — fixes P1-1)', () => {
  it('returns Fake when fact-checkers contradict the claim', () => {
    const items = [
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.8, reliability: 0.95 }),
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.7, reliability: 0.9 }),
    ];
    expect(decide('Free electricity for all', 'A forwarded claim.', outcome(items)).verdict).toBe('Fake');
  });

  it('returns Real when several reliable outlets corroborate', () => {
    const items = Array.from({ length: 4 }, () => evidence({ similarity: 0.65, reliability: 0.95 }));
    expect(decide('Central bank raises rates', 'According to Reuters the bank raised rates.', outcome(items)).verdict).toBe(
      'Real'
    );
  });

  it('returns Uncertain when the evidence is balanced', () => {
    const items = [
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.5, reliability: 0.9 }),
      evidence({ provider: 'factcheck', stance: 'Supporting', similarity: 0.5, reliability: 0.9 }),
    ];
    expect(decide('Contested claim', 'Sources disagree about this.', outcome(items)).verdict).toBe('Uncertain');
  });

  it('returns Uncertain whenever no provider is configured', () => {
    const decision = decide('Anything at all', 'Some body text here.', OFFLINE);
    expect(decision.verdict).toBe('Uncertain');
    expect(decision.caveats.join(' ')).toMatch(/No evidence provider is configured/i);
  });

  it('never returns a verdict outside the three permitted values', () => {
    const cases: RetrievalOutcome[] = [OFFLINE, outcome([]), outcome([evidence()])];
    for (const retrieval of cases) {
      expect(['Real', 'Fake', 'Uncertain']).toContain(decide('t', 'c', retrieval).verdict);
    }
  });
});

describe('TC-DE-06 confidence semantics (fixes D-3 — the inverted score)', () => {
  it('reports confidence in the verdict returned, never its inverse', () => {
    const weak = [evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.35, reliability: 0.85 })];
    const strong = Array.from({ length: 5 }, () =>
      evidence({ provider: 'factcheck', stance: 'Contradicting', similarity: 0.9, reliability: 0.97 })
    );

    const weakDecision = decide('Claim', 'Body text of the claim.', outcome(weak));
    const strongDecision = decide('Claim', 'Body text of the claim.', outcome(strong));

    expect(weakDecision.verdict).toBe('Fake');
    expect(strongDecision.verdict).toBe('Fake');
    // Stronger contradicting evidence must raise, never lower, the confidence.
    expect(strongDecision.confidence).toBeGreaterThan(weakDecision.confidence);
  });

  it('keeps confidence within 10..97 for every input shape', () => {
    const cases: Array<[string, string, RetrievalOutcome]> = [
      ['', '', OFFLINE],
      ['x', 'y', outcome([])],
      ['Claim', 'Body', outcome(Array.from({ length: 8 }, () => evidence({ similarity: 0.95 })))],
      ['CURE ALL!!', 'illuminati deep state guaranteed cure', outcome([])],
    ];
    for (const [title, content, retrieval] of cases) {
      const { confidence } = decide(title, content, retrieval);
      expect(confidence).toBeGreaterThanOrEqual(10);
      expect(confidence).toBeLessThanOrEqual(97);
    }
  });

  it('reports low confidence when running with no providers', () => {
    expect(decide('Claim', 'Body', OFFLINE).confidence).toBeLessThan(40);
  });

  it('is deterministic — identical inputs give identical confidence', () => {
    const items = [evidence({ url: 'https://fixed.example/1', similarity: 0.6 })];
    const a = decide('Claim', 'Body', outcome(items)).confidence;
    const b = decide('Claim', 'Body', outcome(items)).confidence;
    expect(a).toBe(b);
  });
});

describe('TC-DE-07 caveats', () => {
  it('flags a failed provider', () => {
    const decision = decide('Claim', 'Body text', outcome([evidence()], { providersFailed: ['newsapi'] }));
    expect(decision.caveats.join(' ')).toContain('newsapi');
  });

  it('flags a very short claim', () => {
    const decision = decide('Hi', 'Hi', outcome([evidence()]));
    expect(decision.caveats.join(' ')).toMatch(/very short/i);
  });

  it('records no caveats for a well-evidenced, full-length claim', () => {
    const items = Array.from({ length: 4 }, () => evidence({ similarity: 0.7 }));
    const decision = decide(
      'Central bank raises interest rates by 25 basis points',
      'According to Reuters, the central bank raised rates following its policy meeting this week in a widely expected move.',
      outcome(items)
    );
    expect(decision.caveats).toHaveLength(0);
  });
});

describe('TC-DE-08 labelStances()', () => {
  it('never overwrites a fact-checker’s own rating', () => {
    const items = [evidence({ provider: 'factcheck', stance: 'Contradicting' })];
    expect(labelStances(items, 'Real')[0].stance).toBe('Contradicting');
  });

  it('marks everything Neutral under an Uncertain verdict', () => {
    const items = [evidence({ similarity: 0.9, reliability: 0.95 })];
    expect(labelStances(items, 'Uncertain')[0].stance).toBe('Neutral');
  });

  it('marks close, credible matches as Supporting under a Real verdict', () => {
    const items = [evidence({ similarity: 0.5, reliability: 0.9 })];
    expect(labelStances(items, 'Real')[0].stance).toBe('Supporting');
  });

  it('does not mutate the input', () => {
    const items = [evidence({ stance: 'Neutral' })];
    labelStances(items, 'Real');
    expect(items[0].stance).toBe('Neutral');
  });

  it('preserves an authoritative incumbency record against the verdict', () => {
    // A structured Wikidata office record stating the claim names the wrong
    // person must stay Contradicting even inside a Real verdict — otherwise the
    // report shows the decisive evidence as mere "context".
    const items = [evidence({ provider: 'wikidata', stance: 'Contradicting', similarity: 0.95 })];
    expect(labelStances(items, 'Real')[0].stance).toBe('Contradicting');
    expect(labelStances(items, 'Uncertain')[0].stance).toBe('Contradicting');
  });
});

describe('TC-DE-09 fuse() weighting', () => {
  it('lets the heaviest signal dominate a lighter opposing one', () => {
    const signals: SignalContribution[] = [
      { label: 'Professional fact-checks', score: -1, weight: 0.5, detail: 'Rated false.' },
      { label: 'Language analysis', score: 1, weight: 0.12, detail: 'Reads professionally.' },
    ];
    expect(fuse(signals, outcome([evidence()]), 200).verdict).toBe('Fake');
  });

  it('produces Uncertain when signals cancel out', () => {
    const signals: SignalContribution[] = [
      { label: 'A', score: 1, weight: 0.3, detail: 'x' },
      { label: 'B', score: -1, weight: 0.3, detail: 'y' },
    ];
    expect(fuse(signals, outcome([evidence()]), 200).verdict).toBe('Uncertain');
  });

  it('reports which layers ran', () => {
    const decision = decide('Claim', 'Body', outcome([evidence()]), { score: 0.5, reasoning: 'Supported.' });
    expect(decision.layers.linguistic).toBe(true);
    expect(decision.layers.retrieval).toBe(true);
    expect(decision.layers.llm).toBe(true);
  });

  it('always returns a non-empty summary', () => {
    for (const retrieval of [OFFLINE, outcome([]), outcome([evidence()])]) {
      expect(decide('t', 'c', retrieval).summary.length).toBeGreaterThan(10);
    }
  });
});


describe('TC-DE-10 referenceSignal() — Wikipedia / Wikidata', () => {
  it('returns null when no reference source was retrieved', () => {
    expect(referenceSignal([evidence({ provider: 'googlenews' })])).toBeNull();
  });

  it('supports the claim when reference data matches closely', () => {
    const signal = referenceSignal([
      evidence({ provider: 'wikidata', similarity: 0.8, publisher: 'Wikidata', title: 'C. Joseph Vijay — Chief Minister of Tamil Nadu' }),
    ]);
    expect(signal!.score).toBe(1);
    expect(signal!.detail).toContain('Wikidata');
  });

  it('is neutral, never negative, when reference data does not match', () => {
    const signal = referenceSignal([evidence({ provider: 'wikipedia', similarity: 0.1 })]);
    // A weak reference match is uninformative — it must not be read as evidence
    // AGAINST the claim, or every niche true claim would be marked Fake.
    expect(signal!.score).toBe(0);
  });

  it('uses the strongest reference match available', () => {
    const signal = referenceSignal([
      evidence({ provider: 'wikipedia', similarity: 0.2 }),
      evidence({ provider: 'wikidata', similarity: 0.75 }),
    ]);
    expect(signal!.score).toBe(1);
  });
});

describe('TC-DE-11 keyless providers drive real verdicts', () => {
  it('counts Google News as independent corroboration', () => {
    const items = Array.from({ length: 4 }, (_, i) =>
      evidence({ provider: 'googlenews', similarity: 0.6, reliability: 0.9, publisher: `Outlet ${i}` })
    );
    expect(corroborationSignal(items).score).toBe(1);
  });

  it('reaches a Real verdict from keyless sources alone', () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) =>
        evidence({ provider: 'googlenews', similarity: 0.65, reliability: 0.9, publisher: `Outlet ${i}` })
      ),
      evidence({ provider: 'wikidata', similarity: 0.7, publisher: 'Wikidata' }),
    ];
    const decision = decide('Vijay is Chief Minister of Tamil Nadu', 'Reported widely today.', outcome(items));
    expect(decision.verdict).toBe('Real');
    expect(decision.layers.reference).toBe(true);
  });
});


describe('TC-DE-12 fail-safe when the authoritative check is unreachable', () => {
  /*
   * The dangerous case: an office claim where Wikidata was unreachable. Plenty
   * of news mentions the person and the office, so lexical evidence looks like
   * strong support — but it cannot tell a CURRENT holder from a FORMER one.
   * Returning "Real" here would be a confident wrong answer.
   */
  const newsHeavy = Array.from({ length: 6 }, (_, i) =>
    evidence({ provider: 'googlenews', similarity: 0.7, reliability: 0.92, publisher: `Outlet ${i}` })
  );

  it('declines to rule rather than guessing from news coverage alone', () => {
    const decision = decide(
      'M K Stalin is the current Chief Minister of Tamil Nadu',
      '',
      outcome(newsHeavy, { providersFailed: ['wikidata-office'] })
    );
    expect(decision.verdict).toBe('Uncertain');
  });

  it('reports low confidence when the decisive source was unreachable', () => {
    const decision = decide('X is the Chief Minister of Y', '', outcome(newsHeavy, { providersFailed: ['wikidata-office'] }));
    expect(decision.confidence).toBeLessThanOrEqual(35);
  });

  it('explains why no verdict was given', () => {
    const decision = decide('X is the Chief Minister of Y', '', outcome(newsHeavy, { providersFailed: ['wikidata-office'] }));
    expect(decision.caveats.join(' ')).toMatch(/authoritative record could not be reached/i);
    expect(decision.summary).toMatch(/No verdict given/i);
  });

  it('still rules normally when the check succeeded', () => {
    const decision = decide('X is the Chief Minister of Y', '', outcome(newsHeavy));
    expect(decision.verdict).toBe('Real');
  });

  it('is unaffected by an unrelated provider failing', () => {
    const decision = decide('X is the Chief Minister of Y', '', outcome(newsHeavy, { providersFailed: ['wikipedia'] }));
    expect(decision.verdict).toBe('Real');
  });
});
