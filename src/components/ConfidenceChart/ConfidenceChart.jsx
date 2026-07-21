import React from 'react';
import { FaChartBar } from 'react-icons/fa';
import './ConfidenceChart.css';

const ConfidenceChart = ({ score = 94.8, verdict = 'Real', models = [] }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorMap = {
    Real: 'var(--success)',
    Fake: 'var(--error)',
    Uncertain: 'var(--warning)'
  };

  const currentColor = colorMap[verdict] || 'var(--primary)';

  const defaultModels = [
    { name: 'BERT Classifier', score: (score - 2.1).toFixed(1) },
    { name: 'RoBERTa Large', score: (score + 1.5).toFixed(1) },
    { name: 'DistilBERT', score: (score - 3.8).toFixed(1) },
    { name: 'Ensemble Model', score: score.toFixed(1) }
  ];

  const modelData = models.length > 0 ? models : defaultModels;

  return (
    <div className="glass-card confidence-chart-card">
      <h3 className="chart-header-title">
        <FaChartBar style={{ color: currentColor }} /> AI Confidence & Model Consensus
      </h3>

      <div className="gauge-container" style={{ position: 'relative' }}>
        <svg className="svg-gauge" viewBox="0 0 160 160">
          <circle
            className="gauge-bg"
            cx="80"
            cy="80"
            r={radius}
          />
          <circle
            className="gauge-fill"
            cx="80"
            cy="80"
            r={radius}
            style={{
              stroke: currentColor,
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset
            }}
          />
        </svg>

        <div className="gauge-text-overlay">
          <span className="gauge-number" style={{ color: currentColor }}>
            {score}%
          </span>
          <span className="gauge-label">Confidence</span>
        </div>
      </div>

      <div className="models-chart-list">
        <h4 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Transformer Model Probability Breakdown
        </h4>
        {modelData.map((m, idx) => (
          <div key={idx} className="model-bar-item">
            <div className="model-bar-header">
              <span>{m.name}</span>
              <span style={{ color: currentColor }}>{m.score}%</span>
            </div>
            <div className="model-bar-track">
              <div
                className="model-bar-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, m.score))}%`,
                  background: currentColor
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfidenceChart;
