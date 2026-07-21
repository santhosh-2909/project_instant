import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { FaSearch, FaFilter, FaEye, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';
import '../History/History.css';
import '../../components/Common/Common.css';

const History = () => {
  const navigate = useNavigate();
  const [historyList, setHistoryList] = useState(() => apiService.getHistory());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVerdict, setFilterVerdict] = useState('All');
  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const filteredHistory = historyList.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.snippet && item.snippet.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesVerdict = filterVerdict === 'All' || item.verdict.toLowerCase() === filterVerdict.toLowerCase();
    return matchesSearch && matchesVerdict;
  });

  const handleViewDetails = (item) => {
    navigate('/results', { state: { result: item } });
  };

  return (
    <div className="history-page">
      <div className="history-page-header">
        <h1 className="history-page-title">Verification Archive & History</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Review prior AI news classifications, probability scores, and evidence logs.
        </p>
      </div>

      <div className="history-toolbar">
        <div className="search-input-wrapper">
          <FaSearch />
          <input
            type="text"
            className="history-search-input"
            placeholder="Search article titles or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          {['All', 'Real', 'Fake', 'Uncertain'].map((v) => (
            <button
              key={v}
              className={`filter-btn ${filterVerdict === v ? 'active' : ''}`}
              onClick={() => setFilterVerdict(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card history-table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Article Title Snippet</th>
              <th>AI Verdict</th>
              <th>Confidence</th>
              <th>Timestamp</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => {
                const verdictClass = item.verdict.toLowerCase();
                return (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-subtle)', fontWeight: '600' }}>{item.id}</td>
                    <td className="article-cell-title" title={item.title}>{item.title}</td>
                    <td>
                      <span className={`badge badge-${verdictClass}`}>
                        {item.verdict}
                      </span>
                    </td>
                    <td style={{ fontWeight: '700' }}>{item.confidence}%</td>
                    <td style={{ color: 'var(--text-muted)' }}>{item.date}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleViewDetails(item)}
                        style={{ padding: '6px 12px' }}
                      >
                        <FaEye /> View Report
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No historical verification logs match your filter query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-wrapper">
        <span>Showing {filteredHistory.length} of {historyList.length} articles</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" disabled>Previous</button>
          <button className="btn btn-secondary btn-sm" disabled>Page 1 of 1</button>
          <button className="btn btn-secondary btn-sm" disabled>Next</button>
        </div>
      </div>

      {/* Details Quick Modal */}
      {selectedModalItem && (
        <div className="modal-backdrop" onClick={() => setSelectedModalItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedModalItem(null)}>
              <FaTimes />
            </button>
            <h3>{selectedModalItem.title}</h3>
            <div style={{ margin: '16px 0' }}>
              <span className={`badge badge-${selectedModalItem.verdict.toLowerCase()}`}>
                Verdict: {selectedModalItem.verdict} ({selectedModalItem.confidence}%)
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>{selectedModalItem.explanation}</p>
            <div style={{ marginTop: '24px', textAlign: 'right' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleViewDetails(selectedModalItem)}>
                Open Full Analytics <FaExternalLinkAlt style={{ marginLeft: '6px' }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;
