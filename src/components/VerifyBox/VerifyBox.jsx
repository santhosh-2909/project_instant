import React, { useState } from 'react';
import { FaSearch, FaGlobe, FaMagic, FaTrash } from 'react-icons/fa';
import { apiService } from '../../services/api';
import './VerifyBox.css';

const VerifyBox = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const sampleArticles = apiService.getSampleArticles();

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  const handleSampleClick = (sampleText) => {
    setText(sampleText);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text);
  };

  return (
    <div className="glass-card verify-box-card">
      <div className="verify-box-header">
        <h2 className="verify-box-title">
          <FaMagic style={{ color: 'var(--primary)' }} /> AI News Inspection
        </h2>
        <span className="language-pill">
          <FaGlobe style={{ marginRight: '6px' }} /> Detected: English (Auto)
        </span>
      </div>

      <div className="sample-buttons-row">
        <span className="sample-btn-label">Try Preset Samples:</span>
        <button className="sample-chip" onClick={() => handleSampleClick(sampleArticles[0].text)}>
          🚨 Sample Fake News
        </button>
        <button className="sample-chip" onClick={() => handleSampleClick(sampleArticles[1].text)}>
          ✅ Sample Real News
        </button>
        <button className="sample-chip" onClick={() => handleSampleClick(sampleArticles[2].text)}>
          ⚠️ Sample Developing Story
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="textarea-container">
          <textarea
            className="verify-textarea"
            placeholder="Paste news headline, article excerpt, social media post, or claim text here to analyze credibility..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="textarea-footer">
          <div className="counter-group">
            <span>Words: <strong>{wordCount}</strong></span>
            <span>Characters: <strong>{charCount}</strong></span>
          </div>

          {text && (
            <button 
              type="button" 
              onClick={() => setText('')} 
              style={{ color: 'var(--error)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FaTrash /> Clear Text
            </button>
          )}
        </div>

        <button 
          type="submit" 
          className="btn btn-primary verify-submit-btn" 
          disabled={!text.trim()}
          style={{ marginTop: '24px', opacity: text.trim() ? 1 : 0.6 }}
        >
          <FaSearch /> Verify News Article
        </button>
      </form>
    </div>
  );
};

export default VerifyBox;
