import React, { useState } from 'react';
import { FaEnvelope, FaMapMarkerAlt, FaUniversity, FaGithub, FaPaperPlane, FaCheckCircle } from 'react-icons/fa';
import './Contact.css';

const Contact = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 4000);
  };

  return (
    <div className="contact-page animate-fade-in">
      <div className="glass-card contact-info-card">
        <div>
          <span className="section-tag">Get in Touch</span>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '12px' }}>Contact the Research Team</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Have questions about TruthGuard AI algorithms or interested in collaboration? Reach out to us.
          </p>
        </div>

        <div className="contact-item-row">
          <div className="contact-icon-box"><FaUniversity /></div>
          <div>
            <strong>Department of Computer Science & Engineering</strong>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>AI & Machine Learning Research Lab</p>
          </div>
        </div>

        <div className="contact-item-row">
          <div className="contact-icon-box"><FaMapMarkerAlt /></div>
          <div>
            <strong>University Campus</strong>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Tech Park Building, Block B</p>
          </div>
        </div>

        <div className="contact-item-row">
          <div className="contact-icon-box"><FaEnvelope /></div>
          <div>
            <strong>Email Support</strong>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>contact@truthguard-ai.org</p>
          </div>
        </div>

        <div className="contact-item-row">
          <div className="contact-icon-box"><FaGithub /></div>
          <div>
            <strong>Open Source Repository</strong>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>github.com/truthguard-ai/frontend</p>
          </div>
        </div>
      </div>

      <div className="glass-card contact-form-card">
        <h2>Send Us a Message</h2>

        {submitted && (
          <div className="success-toast">
            <FaCheckCircle style={{ fontSize: '1.3rem' }} />
            <span>Thank you! Your message has been transmitted to the research team.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Your Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Alex Morgan"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input
              type="email"
              className="form-input"
              placeholder="alex@university.edu"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              className="form-input"
              placeholder="Dataset Inquiry / Bug Report / Collaboration"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Message *</label>
            <textarea
              className="form-textarea"
              placeholder="Write your message details here..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
            <FaPaperPlane /> Send Message
          </button>
        </form>
      </div>
    </div>
  );
};

export default Contact;
