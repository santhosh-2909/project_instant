import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaLightbulb, FaExternalLinkAlt, FaSlidersH, FaFileAlt } from 'react-icons/fa';
import './ResultCard.css';

const ResultCard = ({ result }) => {
  if (!result) return null;

  const { verdict, title, date, wordCount, explanation, highlightedWords, evidence, semanticMetrics } = result;

  const verdictIcon = {
    Real: <FaCheckCircle />,
    Fake: <FaTimesCircle />,
    Uncertain: <FaExclamationTriangle />
  }[verdict];

  const verdictClass = verdict.toLowerCase();

  return (
    <div className="result-card-container animate-fade-in">
      {/* Verdict Banner */}
      <div className="glass-card verdict-banner-card">
        <div className={`verdict-icon-box ${verdictClass}`}>
          {verdictIcon}
        </div>

        <div className="verdict-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className={`badge badge-${verdictClass}`}>
              {verdict === 'Real' ? 'Authentic News' : verdict === 'Fake' ? 'Fake News Detected' : 'Uncertain / Debatable'}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-subtle)' }}>ID: {result.id}</span>
          </div>

          <h2 className="verdict-article-title">{title}</h2>

          <div className="verdict-meta-row">
            <span>Verified: {date}</span>
            <span>•</span>
            <span>{wordCount || 320} Words</span>
            <span>•</span>
            <span>NLP Analysis Complete</span>
          </div>
        </div>
      </div>

      {/* AI Explanation & LIME Highlight Section */}
      <div className="glass-card explanation-card">
        <h3 className="section-subheading">
          <FaLightbulb style={{ color: 'var(--warning)' }} /> AI Decision Rationale & Feature Highlights
        </h3>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
          {explanation}
        </p>

        {highlightedWords && highlightedWords.length > 0 && (
          <div>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-subtle)', marginBottom: '8px' }}>
              LIME/SHAP Keyword Feature Importance:
            </h4>
            <div className="highlighted-text-box">
              {highlightedWords.map((w, idx) => {
                if (w.type === 'fake-risk') {
                  return <span key={idx} className="hl-word-fake-risk">{w.text} </span>;
                } else if (w.type === 'real-trust') {
                  return <span key={idx} className="hl-word-real-trust">{w.text} </span>;
                }
                return <span key={idx}>{w.text} </span>;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cross-Check Evidence Cards */}
      <div className="glass-card explanation-card">
        <h3 className="section-subheading">
          <FaFileAlt style={{ color: 'var(--primary)' }} /> Trusted Source Cross-Check Matches
        </h3>

        <div className="evidence-grid">
          {evidence && evidence.map((ev, idx) => (
            <div key={idx} className="evidence-card-item">
              <div className="evidence-source-name">
                <span>{ev.source}</span>
                <a href={ev.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem' }}>
                  <FaExternalLinkAlt />
                </a>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Verdict: <strong>{ev.verdict}</strong>
              </div>
              <div className="metric-bar-item" style={{ marginTop: 'auto' }}>
                <div className="metric-bar-label" style={{ fontSize: '0.75rem' }}>
                  <span>Similarity Match</span>
                  <span>{ev.matchScore}%</span>
                </div>
                <div className="model-bar-track">
                  <div className="model-bar-fill" style={{ width: `${ev.matchScore}%`, background: 'var(--primary)' }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Semantic Metrics Breakdown */}
      <div className="glass-card explanation-card">
        <h3 className="section-subheading">
          <FaSlidersH style={{ color: 'var(--primary)' }} /> Semantic Analysis Metrics
        </h3>

        <div className="semantic-metrics-grid">
          <div className="metric-bar-item">
            <div className="metric-bar-label">
              <span>Entity Matching</span>
              <span>{semanticMetrics?.entityMatching || 88}%</span>
            </div>
            <div className="model-bar-track">
              <div className="model-bar-fill" style={{ width: `${semanticMetrics?.entityMatching || 88}%`, background: 'var(--primary)' }}></div>
            </div>
          </div>

          <div className="metric-bar-item">
            <div className="metric-bar-label">
              <span>Source Credibility Score</span>
              <span>{semanticMetrics?.sourceCredibility || 92}%</span>
            </div>
            <div className="model-bar-track">
              <div className="model-bar-fill" style={{ width: `${semanticMetrics?.sourceCredibility || 92}%`, background: 'var(--success)' }}></div>
            </div>
          </div>

          <div className="metric-bar-item">
            <div className="metric-bar-label">
              <span>Contextual Consistency</span>
              <span>{semanticMetrics?.contextualConsistency || 85}%</span>
            </div>
            <div className="model-bar-track">
              <div className="model-bar-fill" style={{ width: `${semanticMetrics?.contextualConsistency || 85}%`, background: 'var(--primary)' }}></div>
            </div>
          </div>

          <div className="metric-bar-item">
            <div className="metric-bar-label">
              <span>Sensationalism & Sentiment Bias</span>
              <span>{semanticMetrics?.sentimentBias || 18}%</span>
            </div>
            <div className="model-bar-track">
              <div className="model-bar-fill" style={{ width: `${semanticMetrics?.sentimentBias || 18}%`, background: 'var(--warning)' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;
