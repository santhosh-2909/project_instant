import React from 'react';
import { Link } from 'react-router-dom';
import { FaShieldAlt, FaGithub, FaTwitter, FaLinkedin, FaDiscord, FaHeart } from 'react-icons/fa';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <div className="logo-icon-wrapper">
              <FaShieldAlt />
            </div>
            <span>TruthGuard AI</span>
          </Link>
          <p className="footer-desc">
            An advanced AI-powered platform for real-time fake news detection, semantic similarity matching, and transparent fact-checking verification.
          </p>
          <div className="footer-tech-stack">
            <span className="tech-tag">React 19</span>
            <span className="tech-tag">Vite</span>
            <span className="tech-tag">BERT / NLP</span>
            <span className="tech-tag">PyTorch</span>
            <span className="tech-tag">FastAPI</span>
          </div>
        </div>

        <div>
          <h4 className="footer-column-title">Navigation</h4>
          <ul className="footer-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/verify">Verify News</Link></li>
            <li><Link to="/history">Verification History</Link></li>
            <li><Link to="/about">About TruthGuard</Link></li>
            <li><Link to="/contact">Contact Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="footer-column-title">Resources</h4>
          <ul className="footer-links">
            <li><Link to="/about#pipeline">AI Pipeline</Link></li>
            <li><Link to="/about#metrics">Accuracy Benchmark</Link></li>
            <li><Link to="/verify">Try Sample Articles</Link></li>
            <li><a href="https://github.com" target="_blank" rel="noreferrer">Documentation</a></li>
          </ul>
        </div>

        <div>
          <h4 className="footer-column-title">Connect</h4>
          <div className="social-links">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="GitHub">
              <FaGithub />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="Twitter">
              <FaTwitter />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="LinkedIn">
              <FaLinkedin />
            </a>
            <a href="https://discord.com" target="_blank" rel="noreferrer" className="social-icon" aria-label="Discord">
              <FaDiscord />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Truth-Guard AI System. Final Year Engineering Capstone Project.</p>
        <p>Built with <FaHeart style={{ color: '#EF4444', verticalAlign: 'middle' }} /> for Fake News Detection</p>
      </div>
    </footer>
  );
};

export default Footer;
