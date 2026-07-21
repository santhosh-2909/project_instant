import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { FaShieldAlt, FaSun, FaMoon, FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
          <div className="logo-icon-wrapper">
            <FaShieldAlt />
          </div>
          <span className="logo-text">Truth<span>Guard</span></span>
        </Link>

        <div className={`navbar-links-wrapper ${mobileMenuOpen ? 'open' : ''}`}>
          <ul className="navbar-links">
            <li>
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end onClick={closeMobileMenu}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/verify" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                Verify
              </NavLink>
            </li>
            <li>
              <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                History
              </NavLink>
            </li>
            <li>
              <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                About
              </NavLink>
            </li>
            <li>
              <NavLink to="/contact" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                Contact
              </NavLink>
            </li>
          </ul>

          <div className="navbar-actions-mobile">
            <Link to="/verify" className="btn btn-primary btn-sm" onClick={closeMobileMenu} style={{ width: '100%' }}>
              <FaSearch /> Verify News
            </Link>
          </div>
        </div>

        <div className="navbar-actions">
          <button 
            className="theme-toggle-btn" 
            onClick={toggleTheme} 
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <FaSun style={{ color: '#F59E0B' }} /> : <FaMoon style={{ color: '#3B82F6' }} />}
          </button>

          <Link to="/verify" className="btn btn-primary btn-sm desktop-only">
            <FaSearch /> Verify News
          </Link>

          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
