# Truth-Guard AI Fake News Verification System - Frontend

A modern, responsive React + Vite frontend for **Truth-Guard** – an AI-Powered Fake News Verification System.

The project features a premium glassmorphic dark theme aesthetic inspired by ChatGPT, Perplexity AI, Vercel, and Stripe Dashboard, complete with interactive AI processing states, analytical results charts, searchable verification history, and responsive layout grids.

## 🚀 Tech Stack

- **Framework**: React 19 (Functional Components & Hooks)
- **Build Tool**: Vite
- **Styling**: Vanilla CSS3 + Custom Theme System (Light / Dark mode toggle)
- **Routing**: React Router (`react-router-dom` v7)
- **Icons**: React Icons (`react-icons` v5)

## 📁 Key Folder Structure

- `src/components/`: Reusable interface components (Navbar, Footer, Hero, FeatureCard, Timeline, Stats, VerifyBox, Loader, ResultCard, ConfidenceChart).
- `src/pages/`: Main navigation views (Home, Verify, Results, History, About, Contact).
- `src/services/api.js`: Verification simulation logic, LIME explanation engine, and local storage state sync.
- `src/context/ThemeContext.jsx`: Theme Provider for Light/Dark mode.

## 🛠️ Getting Started

First, install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Build the production distribution:

```bash
npm run build
```
