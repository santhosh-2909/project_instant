import React from 'react';
import { FaBullseye, FaCheckDouble, FaHistory, FaAward } from 'react-icons/fa';
import './Stats.css';

const STATS_DATA = [
  {
    icon: <FaBullseye />,
    number: '92.4%',
    label: 'Accuracy',
    desc: 'Tested on WELFake & ISOT datasets'
  },
  {
    icon: <FaCheckDouble />,
    number: '90.1%',
    label: 'Precision',
    desc: 'Low false positive detection rate'
  },
  {
    icon: <FaHistory />,
    number: '91.5%',
    label: 'Recall',
    desc: 'High true claim retrieval rate'
  },
  {
    icon: <FaAward />,
    number: '90.8%',
    label: 'F1 Score',
    desc: 'Harmonic balance of performance'
  }
];

const Stats = () => {
  return (
    <section className="stats-section">
      <div className="stats-card-wrapper glass-card">
        <div className="stats-grid">
          {STATS_DATA.map((stat, idx) => (
            <div key={idx} className="stat-item">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-desc">{stat.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
