// Mock API service for Truth-Guard AI Verification Engine

const DEFAULT_HISTORY = [
  {
    id: 'tg-8921',
    title: 'Scientists Discover Miracle Pill That Eliminates 100% of Aging Overnight',
    verdict: 'Fake',
    confidence: 96.4,
    date: '2026-07-20 14:32',
    snippet: 'Sensational claims regarding an unverified anti-aging breakthrough lacking clinical trial data...',
    language: 'English',
    wordCount: 342,
    explanation: 'The article relies on clickbait medical claims, unverified anonymous quotes, and lacks references to peer-reviewed scientific journals.',
    evidence: [
      { source: 'Snopes', verdict: 'False Claim', matchScore: 98, url: 'https://snopes.com' },
      { source: 'Reuters Fact Check', verdict: 'Debunked', matchScore: 95, url: 'https://reuters.com' },
      { source: 'AP News', verdict: 'No Evidence Found', matchScore: 92, url: 'https://apnews.com' }
    ],
    semanticMetrics: {
      entityMatching: 24,
      sourceCredibility: 15,
      contextualConsistency: 30,
      sentimentBias: 88
    },
    models: [
      { name: 'BERT Classifier', score: 94.5 },
      { name: 'RoBERTa Large', score: 97.2 },
      { name: 'DistilBERT', score: 92.0 },
      { name: 'Ensemble Model', score: 96.4 }
    ]
  },
  {
    id: 'tg-8920',
    title: "NASA's James Webb Space Telescope Observes Water Vapor in Habitable Zone Exoplanet Atmosphere",
    verdict: 'Real',
    confidence: 94.8,
    date: '2026-07-19 11:15',
    snippet: 'Spectroscopic observations confirmed trace water vapor molecules in exoplanet atmosphere atmosphere...',
    language: 'English',
    wordCount: 520,
    explanation: 'Content matches official NASA press releases and corroborated peer-reviewed articles published in Nature Astronomy.',
    evidence: [
      { source: 'NASA Science', verdict: 'Verified Official', matchScore: 99, url: 'https://nasa.gov' },
      { source: 'Reuters', verdict: 'Confirmed Fact', matchScore: 97, url: 'https://reuters.com' },
      { source: 'Nature Astronomy', verdict: 'Peer-Reviewed Source', matchScore: 96, url: 'https://nature.com' }
    ],
    semanticMetrics: {
      entityMatching: 96,
      sourceCredibility: 98,
      contextualConsistency: 95,
      sentimentBias: 12
    },
    models: [
      { name: 'BERT Classifier', score: 93.1 },
      { name: 'RoBERTa Large', score: 96.0 },
      { name: 'DistilBERT', score: 91.5 },
      { name: 'Ensemble Model', score: 94.8 }
    ]
  },
  {
    id: 'tg-8919',
    title: 'Leaked Document Claims Major Tech Giant to Launch Flying Electric Taxis Next Month',
    verdict: 'Uncertain',
    confidence: 64.5,
    date: '2026-07-18 09:45',
    snippet: 'An unverified internal memo surfaced on social media describing regulatory filings for urban air mobility testing...',
    language: 'English',
    wordCount: 280,
    explanation: 'The report contains authentic corporate terminology but references single unverified insider sources with conflicting company statements.',
    evidence: [
      { source: 'TechCrunch', verdict: 'Unconfirmed Rumor', matchScore: 70, url: 'https://techcrunch.com' },
      { source: 'Bloomberg', verdict: 'Developing Story', matchScore: 65, url: 'https://bloomberg.com' }
    ],
    semanticMetrics: {
      entityMatching: 60,
      sourceCredibility: 58,
      contextualConsistency: 62,
      sentimentBias: 45
    },
    models: [
      { name: 'BERT Classifier', score: 62.0 },
      { name: 'RoBERTa Large', score: 66.8 },
      { name: 'DistilBERT', score: 60.5 },
      { name: 'Ensemble Model', score: 64.5 }
    ]
  },
  {
    id: 'tg-8918',
    title: 'Global Central Bank Announces Instant Digital Currency Conversion Platform',
    verdict: 'Real',
    confidence: 91.2,
    date: '2026-07-16 16:20',
    snippet: 'Official monetary policy declaration outlines international settlement standards for CBDC protocols...',
    language: 'English',
    wordCount: 610,
    explanation: 'High alignment with verified financial policy documentation and official press announcements across international central banks.',
    evidence: [
      { source: 'Financial Times', verdict: 'Verified', matchScore: 94, url: 'https://ft.com' },
      { source: 'Wall Street Journal', verdict: 'Confirmed', matchScore: 92, url: 'https://wsj.com' }
    ],
    semanticMetrics: {
      entityMatching: 92,
      sourceCredibility: 95,
      contextualConsistency: 90,
      sentimentBias: 18
    },
    models: [
      { name: 'BERT Classifier', score: 89.5 },
      { name: 'RoBERTa Large', score: 93.0 },
      { name: 'DistilBERT', score: 88.0 },
      { name: 'Ensemble Model', score: 91.2 }
    ]
  },
  {
    id: 'tg-8917',
    title: 'Secret Chemical Spraying System Discovered Inside Commercial Airline Wings',
    verdict: 'Fake',
    confidence: 98.7,
    date: '2026-07-14 20:05',
    snippet: 'Viral conspiracy video recirculates debunked chemtrail claims using modified aircraft maintenance footage...',
    language: 'English',
    wordCount: 410,
    explanation: 'Classic aviation conspiracy claim debunked by civil aviation authorities and atmospheric scientists.',
    evidence: [
      { source: 'PolitiFact', verdict: 'Pants on Fire False', matchScore: 99, url: 'https://politifact.com' },
      { source: 'FactCheck.org', verdict: 'Debunked Conspiracy', matchScore: 98, url: 'https://factcheck.org' }
    ],
    semanticMetrics: {
      entityMatching: 12,
      sourceCredibility: 8,
      contextualConsistency: 18,
      sentimentBias: 95
    },
    models: [
      { name: 'BERT Classifier', score: 98.0 },
      { name: 'RoBERTa Large', score: 99.2 },
      { name: 'DistilBERT', score: 97.5 },
      { name: 'Ensemble Model', score: 98.7 }
    ]
  }
];

export const SAMPLE_ARTICLES = [
  {
    type: 'fake',
    label: 'Sample Fake News Article',
    title: 'Breaking: Miracle Plant Extract Cures All Diseases in 24 Hours, Secret Suppressed by Big Pharma',
    text: `BREAKING NEWS: A revolutionary plant extract discovered deep in the Amazon rainforest has been proven to cure 100% of all chronic illnesses within 24 hours of ingestion! Anonymous whistleblower doctors confirm that pharmaceutical companies have been hiding this miracle cure for decades to profit off patient treatments. Thousands of patients have reported instant recovery after taking one drop. Share this message before it gets taken down by government censors!`
  },
  {
    type: 'real',
    label: 'Sample Real News Article',
    title: 'Global Energy Agency Reports Renewable Power Capacity Grew 50% Year-Over-Year',
    text: `The International Energy Agency (IEA) released its annual renewable energy benchmark report today, confirming that global solar and wind generation capacity expanded by over 50% in the past twelve months. According to data compiled from international energy grid operators, solar photovoltaics accounted for three-quarters of new renewable additions worldwide. Economists attribute the record growth to falling solar panel manufacturing costs and supportive clean energy policies.`
  },
  {
    type: 'uncertain',
    label: 'Sample Mixed / Developing Story',
    title: 'Automaker Rumored to Announce Solid-State Battery Breakthrough for 1,000-Mile EV Range',
    text: `Industry insider reports suggest that an international EV manufacturer may announce commercial production dates for next-generation solid-state battery cells next month. While company executives declined to comment on specific energy density claims, recent patent filings indicate significant progress in electrolyte stability. Analysts urge caution until official third-party laboratory verification testing is made public.`
  }
];

export const apiService = {
  // Get sample preset articles
  getSampleArticles: () => SAMPLE_ARTICLES,

  // Get full analysis history
  getHistory: () => {
    try {
      const stored = localStorage.getItem('truthguard_history');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse history from localStorage', e);
    }
    localStorage.setItem('truthguard_history', JSON.stringify(DEFAULT_HISTORY));
    return DEFAULT_HISTORY;
  },

  // Save new result to history
  saveHistoryItem: (item) => {
    const history = apiService.getHistory();
    const updated = [item, ...history];
    try {
      localStorage.setItem('truthguard_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save item to localStorage', e);
    }
    return updated;
  },

  // Get history item by ID
  getHistoryItemById: (id) => {
    const history = apiService.getHistory();
    return history.find((h) => h.id === id) || history[0];
  },

  // Main AI verification procedure simulator
  verifyArticle: async (text) => {
    // Determine pseudo-verdict based on text analysis
    const lowerText = text.toLowerCase();
    let verdict = 'Real';
    let confidence = 92.4;
    let explanation = 'The submitted article presents factual reporting, verified statistical references, and neutral journalistic tone.';

    const fakeKeywords = ['secret', 'miracle', 'cures all', 'suppressed', 'big pharma', 'whistleblower', 'share before taken down', 'shocking truth', 'instant recovery', '100%'];
    const fakeMatches = fakeKeywords.filter(k => lowerText.includes(k));

    if (fakeMatches.length >= 2 || lowerText.includes('miracle') || lowerText.includes('suppressed')) {
      verdict = 'Fake';
      confidence = Math.min(99.1, 88 + fakeMatches.length * 3.5);
      explanation = `Sensationalist phrasing detected ("${fakeMatches.join('", "')}"). The text relies on emotional triggers, unverified claims, and lacks empirical references or accredited news agency citations.`;
    } else if (lowerText.includes('rumor') || lowerText.includes('insider') || lowerText.includes('unconfirmed') || lowerText.includes('claimed')) {
      verdict = 'Uncertain';
      confidence = 67.8;
      explanation = 'The article contains speculative statements based on single-source unconfirmed reports. Key claims require official corporate or scientific press release confirmation.';
    }

    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Highlights detection for LIME/SHAP display
    const highlightedWords = words.map(word => {
      const clean = word.toLowerCase().replace(/[^a-z]/g, '');
      if (fakeKeywords.some(k => k.includes(clean) && clean.length > 3)) {
        return { text: word, type: 'fake-risk' };
      } else if (['according', 'report', 'confirmed', 'data', 'official', 'research', 'study'].includes(clean)) {
        return { text: word, type: 'real-trust' };
      }
      return { text: word, type: 'neutral' };
    });

    const newItem = {
      id: `tg-${Math.floor(1000 + Math.random() * 9000)}`,
      title: text.slice(0, 75).trim() + (text.length > 75 ? '...' : ''),
      fullText: text,
      verdict,
      confidence: parseFloat(confidence.toFixed(1)),
      date: new Date().toISOString().replace('T', ' ').slice(0, 16),
      language: 'English (Auto-Detected)',
      wordCount,
      explanation,
      highlightedWords,
      evidence: verdict === 'Fake' ? [
        { source: 'Snopes Fact Check', verdict: 'False Claim', matchScore: 96, url: 'https://snopes.com' },
        { source: 'PolitiFact', verdict: 'Pants On Fire', matchScore: 94, url: 'https://politifact.com' },
        { source: 'Reuters Fact Check', verdict: 'No Basis in Fact', matchScore: 91, url: 'https://reuters.com' }
      ] : verdict === 'Real' ? [
        { source: 'Associated Press', verdict: 'Verified Fact', matchScore: 98, url: 'https://apnews.com' },
        { source: 'Reuters', verdict: 'Confirmed Story', matchScore: 97, url: 'https://reuters.com' },
        { source: 'BBC News', verdict: 'Corroborated', matchScore: 95, url: 'https://bbc.com' }
      ] : [
        { source: 'TechCrunch', verdict: 'Developing Story', matchScore: 72, url: 'https://techcrunch.com' },
        { source: 'Bloomberg', verdict: 'Unconfirmed Source', matchScore: 68, url: 'https://bloomberg.com' }
      ],
      semanticMetrics: {
        entityMatching: verdict === 'Real' ? 95 : verdict === 'Fake' ? 18 : 62,
        sourceCredibility: verdict === 'Real' ? 98 : verdict === 'Fake' ? 12 : 55,
        contextualConsistency: verdict === 'Real' ? 92 : verdict === 'Fake' ? 25 : 68,
        sentimentBias: verdict === 'Real' ? 14 : verdict === 'Fake' ? 89 : 48
      },
      models: [
        { name: 'BERT Classifier', score: parseFloat((confidence - 2.5).toFixed(1)) },
        { name: 'RoBERTa Large', score: parseFloat((confidence + 1.8).toFixed(1)) },
        { name: 'DistilBERT', score: parseFloat((confidence - 4.1).toFixed(1)) },
        { name: 'Ensemble Model', score: parseFloat(confidence.toFixed(1)) }
      ]
    };

    // Save to history automatically
    apiService.saveHistoryItem(newItem);
    return newItem;
  }
};
