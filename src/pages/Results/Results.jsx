import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import ResultCard from '../../components/ResultCard/ResultCard';
import ConfidenceChart from '../../components/ConfidenceChart/ConfidenceChart';
import { apiService } from '../../services/api';
import { FaSearch, FaHistory, FaShareAlt, FaDownload } from 'react-icons/fa';
import './Results.css';

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Load from location state or fallback to default history item
  const historyList = apiService.getHistory();
  const currentResult = location.state?.result || historyList[0];

  if (!currentResult) {
    return (
      <div className="results-page" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>No Verification Result Found</h2>
        <p style={{ color: 'var(--text-muted)', margin: '16px 0 24px' }}>Submit an article to inspect its credibility.</p>
        <Link to="/verify" className="btn btn-primary">
          <FaSearch /> Verify News Now
        </Link>
      </div>
    );
  }

  return (
    <div className="results-page">
      <div className="results-page-header">
        <div>
          <h1 className="results-page-title">Analytics & Verification Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Detailed breakdown of NLP classifications, feature importance highlights, and corroborating evidence.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => alert('Report saved to PDF export!')}>
            <FaDownload /> Export PDF
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => alert('Verification link copied to clipboard!')}>
            <FaShareAlt /> Share Report
          </button>
        </div>
      </div>

      <div className="results-grid-layout">
        <div className="results-left">
          <ResultCard result={currentResult} />
        </div>

        <div className="results-right">
          <ConfidenceChart
            score={currentResult.confidence}
            verdict={currentResult.verdict}
            models={currentResult.models}
          />
        </div>
      </div>

      <div className="results-actions-bar">
        <div style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>
          Showing analysis for: <strong>{currentResult.id}</strong>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <Link to="/verify" className="btn btn-primary">
            <FaSearch /> Verify Another Article
          </Link>
          <Link to="/history" className="btn btn-secondary">
            <FaHistory /> View Verification History
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Results;
