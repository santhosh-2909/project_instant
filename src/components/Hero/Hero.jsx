import React from 'react';
import { Link } from 'react-router-dom';
import { FaShieldAlt, FaRocket, FaInfoCircle, FaCheckCircle, FaRobot, FaLock } from 'react-icons/fa';
import './Hero.css';

const Hero = () => {
  return (
    <section className="hero-section animate-fade-in">
      <div className="hero-content">
        <div className="hero-badge">
          <span className="pulse-dot"></span>
          Next-Gen AI Misinformation Defense
        </div>

        <h1 className="hero-title">
          AI-Powered Fake News Verification
        </h1>

        <p className="hero-subtitle">
          Instantly detect clickbait, propaganda, and synthetic news with deep learning NLP transformers, multi-source semantic comparison, and explainable fact-checking score metrics.
        </p>

        <div className="hero-buttons">
          <Link to="/verify" className="btn btn-primary btn-lg">
            <FaRocket /> Verify News Now
          </Link>
          <Link to="/about" className="btn btn-outline btn-lg">
            <FaInfoCircle /> How System Works
          </Link>
        </div>

        <div className="hero-stats-row">
          <div className="hero-mini-stat">
            <h4>92.4%</h4>
            <p>Detection Accuracy</p>
          </div>
          <div className="hero-mini-stat">
            <h4>&lt; 1.5s</h4>
            <p>Processing Speed</p>
          </div>
          <div className="hero-mini-stat">
            <h4>4+ AI</h4>
            <p>Transformer Models</p>
          </div>
        </div>
      </div>

      <div className="hero-visual">
        <div className="ai-graphic-card">
          <div className="orb-background"></div>
          
          <div className="floating-badge badge-top-right">
            <FaCheckCircle style={{ color: '#22C55E' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>Status Verdict</div>
              <div>Authentic News (94.8%)</div>
            </div>
          </div>

          <div className="scanner-circle"></div>

          <div className="shield-core">
            <FaShieldAlt />
          </div>

          <div className="floating-badge badge-bottom-left">
            <FaRobot style={{ color: '#3B82F6' }} />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>NLP Model</div>
              <div>RoBERTa + BERT Ensemble</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
