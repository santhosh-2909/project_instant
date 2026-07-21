import React, { useState, useEffect } from 'react';
import { FaRobot, FaCheckCircle, FaSpinner, FaCircleNotch } from 'react-icons/fa';
import './Loader.css';

const STEPS = [
  { id: 1, label: 'Text Preprocessing & Cleaning (Tokenization & Stopwords)' },
  { id: 2, label: 'Machine Learning Classification (BERT / Transformer Models)' },
  { id: 3, label: 'Semantic Similarity & NLP Vector Alignment' },
  { id: 4, label: 'Fact Check Verification & Accredited Database Lookup' }
];

const Loader = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 400);
          return 100;
        }
        const next = prev + 25;
        if (next > 25 && next <= 50) setCurrentStep(2);
        else if (next > 50 && next <= 75) setCurrentStep(3);
        else if (next > 75) setCurrentStep(4);
        return next;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="glass-card ai-loader-container animate-fade-in">
      <div className="radar-wrapper">
        <div className="radar-ring"></div>
        <FaRobot className="radar-core-icon" />
      </div>

      <div>
        <h2 className="loader-title">Analyzing News Credibility...</h2>
        <p className="loader-subtitle">Please wait while TruthGuard AI executes multi-layered verification.</p>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="steps-list">
        {STEPS.map((step) => {
          const isDone = currentStep > step.id || progress === 100;
          const isCurrent = currentStep === step.id && progress < 100;

          return (
            <div 
              key={step.id} 
              className={`loader-step-item ${isDone ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
            >
              <div className="step-info">
                <span>{step.label}</span>
              </div>
              <div className="step-status-icon">
                {isDone ? (
                  <FaCheckCircle style={{ color: 'var(--success)' }} />
                ) : isCurrent ? (
                  <FaSpinner className="spin-icon" style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <FaCircleNotch style={{ color: 'var(--text-subtle)' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Loader;
