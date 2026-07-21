import React from 'react';
import { Link } from 'react-router-dom';
import Hero from '../../components/Hero/Hero';
import FeatureCard from '../../components/FeatureCard/FeatureCard';
import Timeline from '../../components/Timeline/Timeline';
import Stats from '../../components/Stats/Stats';
import { FaRocket, FaShieldAlt } from 'react-icons/fa';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <Hero />
      <FeatureCard />
      <Timeline />
      <Stats />

      {/* CTA Section */}
      <section className="cta-section">
        <div className="glass-card cta-box">
          <div className="logo-icon-wrapper" style={{ width: '60px', height: '60px', fontSize: '2rem' }}>
            <FaShieldAlt />
          </div>
          <h2 className="cta-title">Ready to Test News Authenticity?</h2>
          <p className="cta-desc">
            Protect yourself and your community from viral misinformation. Experience real-time transformer NLP analysis today.
          </p>
          <Link to="/verify" className="btn btn-primary btn-lg">
            <FaRocket /> Start Verification Now
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
