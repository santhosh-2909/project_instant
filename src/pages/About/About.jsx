import React from 'react';
import { FaShieldAlt, FaLightbulb, FaBrain, FaDatabase, FaCogs, FaArrowRight, FaRocket, FaCheckCircle } from 'react-icons/fa';
import './About.css';

const TECH_STACK = [
  { name: 'React 19', category: 'Frontend UI', icon: <FaCogs /> },
  { name: 'Vite', category: 'Build System', icon: <FaRocket /> },
  { name: 'BERT Transformer', category: 'NLP Classification', icon: <FaBrain /> },
  { name: 'PyTorch / Python', category: 'Deep Learning Core', icon: <FaBrain /> },
  { name: 'FastAPI Backend', category: 'REST Microservices', icon: <FaDatabase /> },
  { name: 'SHAP / LIME', category: 'Explainable AI', icon: <FaLightbulb /> }
];

const About = () => {
  return (
    <div className="about-page animate-fade-in">
      {/* Hero */}
      <div className="about-hero">
        <h1 className="about-hero-title">About TruthGuard AI</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          An engineering capstone project designed to bring transparency, explainability, and multi-source verification to digital news streams.
        </p>
      </div>

      {/* Problem & Objectives */}
      <div className="about-grid-2">
        <div className="glass-card about-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaShieldAlt style={{ color: 'var(--error)' }} /> Problem Statement
          </h2>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.7' }}>
            The rapid proliferation of AI-generated content, sensationalized clickbait, and coordinated disinformation campaigns threatens public trust. Traditional fact-checking manual workflows struggle to scale against the volume of digital media generated every second.
          </p>
        </div>

        <div className="glass-card about-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FaLightbulb style={{ color: 'var(--success)' }} /> Primary Objectives
          </h2>
          <ul style={{ color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
            <li>Build automated transformer models capable of detecting non-factual claims.</li>
            <li>Provide human-interpretable (LIME/SHAP) explanations for classification decisions.</li>
            <li>Cross-reference text against accredited international news databases in real time.</li>
            <li>Deliver an intuitive, responsive web application suitable for academic demonstration.</li>
          </ul>
        </div>
      </div>

      {/* Interactive AI Pipeline Flow Diagram */}
      <div className="glass-card pipeline-flow-box" id="pipeline">
        <div style={{ textAlign: 'center' }}>
          <span className="section-tag">System Architecture</span>
          <h2>End-to-End AI Inspection Pipeline</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
            Data transformation lifecycle from raw user input to explainable verification output.
          </p>
        </div>

        <div className="diagram-nodes-row">
          <div className="node-item">
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>STAGE 1</span>
            <strong>Input Article</strong>
          </div>
          <FaArrowRight className="node-arrow" />
          
          <div className="node-item">
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>STAGE 2</span>
            <strong>Tokenization</strong>
          </div>
          <FaArrowRight className="node-arrow" />

          <div className="node-item">
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>STAGE 3</span>
            <strong>BERT Model</strong>
          </div>
          <FaArrowRight className="node-arrow" />

          <div className="node-item">
            <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>STAGE 4</span>
            <strong>Vector Search</strong>
          </div>
          <FaArrowRight className="node-arrow" />

          <div className="node-item" style={{ borderColor: 'var(--success)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>FINAL</span>
            <strong>Verdict & Report</strong>
          </div>
        </div>
      </div>

      {/* Technologies Used Grid */}
      <div>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="section-tag">Tech Stack</span>
          <h2>Technologies & Frameworks</h2>
        </div>

        <div className="tech-grid-container">
          {TECH_STACK.map((tech, idx) => (
            <div key={idx} className="tech-box-item glass-card">
              <div className="tech-icon">{tech.icon}</div>
              <h3 style={{ fontSize: '1.1rem' }}>{tech.name}</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{tech.category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Future Roadmap */}
      <div className="glass-card about-card">
        <h2>Future Enhancements & Roadmap</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '16px' }}>
          <div>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Phase 1 (Multimodal)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Deepfake image and manipulated video detection integration using vision transformers.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Phase 2 (Browser Plugin)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Chrome extension for automatic inline news feed credibility badges on social media.</p>
          </div>
          <div>
            <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Phase 3 (Live API)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Public developer API for automated fact-checking pipelines in journalism newsrooms.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
