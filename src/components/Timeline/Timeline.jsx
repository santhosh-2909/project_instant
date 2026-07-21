import React from 'react';
import './Timeline.css';

const TIMELINE_STEPS = [
  {
    step: '01',
    title: 'User Input',
    desc: 'User pastes news text, headline, or article URL into the verification box.'
  },
  {
    step: '02',
    title: 'Text Preprocessing',
    desc: 'Linguistic cleaning, tokenization, lemmatization, and metadata extraction.'
  },
  {
    step: '03',
    title: 'ML Classification',
    desc: 'Fine-tuned BERT and RoBERTa transformers classify probability vectors.'
  },
  {
    step: '04',
    title: 'Semantic Analysis',
    desc: 'Vector embeddings analyze contextual consistency and sentiment bias.'
  },
  {
    step: '05',
    title: 'Fact Check APIs',
    desc: 'Live querying against verified news archives, Snopes, and Reuters API.'
  },
  {
    step: '06',
    title: 'Final Verdict',
    desc: 'Synthesizes scores into Authentic, Fake, or Uncertain with LIME explanations.'
  }
];

const Timeline = () => {
  return (
    <section className="timeline-section">
      <div className="section-header">
        <span className="section-tag">AI Pipeline Workflow</span>
        <h2 className="section-title">How TruthGuard Verifies Content</h2>
        <p className="section-subtitle">
          From raw text submission to explainable verification, follow our multi-stage AI inspection process.
        </p>
      </div>

      <div className="timeline-container">
        {TIMELINE_STEPS.map((item, idx) => (
          <div key={idx} className="glass-card timeline-card">
            <div className="timeline-step-badge">{item.step}</div>
            <h3 className="timeline-title">{item.title}</h3>
            <p className="timeline-desc">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Timeline;
