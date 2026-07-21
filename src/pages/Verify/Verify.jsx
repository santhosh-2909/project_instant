import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VerifyBox from '../../components/VerifyBox/VerifyBox';
import Loader from '../../components/Loader/Loader';
import { apiService } from '../../services/api';
import './Verify.css';

const Verify = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const navigate = useNavigate();

  const handleVerifySubmit = (text) => {
    setPendingText(text);
    setIsProcessing(true);
  };

  const handleCompleteProcessing = async () => {
    const result = await apiService.verifyArticle(pendingText);
    navigate('/results', { state: { result } });
  };

  return (
    <div className="verify-page">
      {!isProcessing ? (
        <>
          <div className="verify-page-header">
            <h1 className="verify-page-title">AI Fake News Verification</h1>
            <p className="verify-page-subtitle">
              Paste any article excerpt, social media claim, or news report to evaluate its credibility using transformer neural networks.
            </p>
          </div>
          <VerifyBox onSubmit={handleVerifySubmit} />
        </>
      ) : (
        <Loader onComplete={handleCompleteProcessing} />
      )}
    </div>
  );
};

export default Verify;
