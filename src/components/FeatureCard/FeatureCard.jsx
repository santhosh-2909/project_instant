import React from 'react';
import { FaBrain, FaCheckDouble, FaChartPie, FaLightbulb } from 'react-icons/fa';
import './FeatureCard.css';

const FEATURES_DATA = [
  {
    icon: <FaBrain />,
    title: 'AI Detection',
    description: 'Deep neural network classifiers analyze syntactic structure, linguistic tone, and clickbait patterns in milliseconds.'
  },
  {
    icon: <FaCheckDouble />,
    title: 'Real-Time Fact Checking',
    description: 'Cross-references submitted claims against live news feeds, Reuters, AP News, and accredited global databases.'
  },
  {
    icon: <FaChartPie />,
    title: 'Confidence Score',
    description: 'Weighted consensus metric combining predictions from BERT, RoBERTa, and DistilBERT model ensembles.'
  },
  {
    icon: <FaLightbulb />,
    title: 'Explainable Results',
    description: 'Transparent LIME/SHAP highlight analysis detailing why an article was classified as Authentic, Fake, or Suspicious.'
  }
];

const FeatureCard = () => {
  return (
    <section className="features-section">
      <div className="section-header">
        <span className="section-tag">Core Capabilities</span>
        <h2 className="section-title">Built for Modern Truth Verification</h2>
        <p className="section-subtitle">
          Engineered with state-of-the-art Natural Language Processing to combat digital misinformation effectively.
        </p>
      </div>

      <div className="features-grid">
        {FEATURES_DATA.map((feature, idx) => (
          <div key={idx} className="glass-card feature-card">
            <div className="feature-icon-wrapper">
              {feature.icon}
            </div>
            <h3 className="feature-card-title">{feature.title}</h3>
            <p className="feature-card-desc">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeatureCard;
