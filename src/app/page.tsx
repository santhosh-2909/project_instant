'use client';

import React, { useState, useEffect } from 'react';

type User = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export default function App() {
  // Navigation & Session States
  const [authState, setAuthState] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'check-news' | 'profile' | 'news-retrieve' | 'news-verify' | 'history' | 'evidence' | 'feedback' | 'reports' | 'admin'>('check-news');

  // Loading & Feedback Alert States
  const [loading, setLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning'; message: string } | null>(null);

  // References Data (Loaded on mount/auth)
  const [references, setReferences] = useState<{
    countries: Array<{ countryId: number; countryName: string }>;
    categories: Array<{ categoryId: number; categoryName: string }>;
    sources: Array<{ sourceId: number; sourceName: string; websiteURL: string }>;
    languages: Array<{ languageId: number; languageName: string }>;
    securityQuestions: Array<{ securityQuestionId: number; question: string }>;
  }>({
    countries: [],
    categories: [],
    sources: [],
    languages: [],
    securityQuestions: [],
  });

  // Dependent Location States (Registration/Profile)
  const [registerStates, setRegisterStates] = useState<Array<{ stateId: number; stateName: string }>>([]);
  const [registerCities, setRegisterCities] = useState<Array<{ cityId: number; cityName: string }>>([]);
  
  // Profile update location states
  const [profileStates, setProfileStates] = useState<Array<{ stateId: number; stateName: string }>>([]);
  const [profileCities, setProfileCities] = useState<Array<{ cityId: number; cityName: string }>>([]);

  // Form input states
  // 1. Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 2. Register
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regCountry, setRegCountry] = useState('');
  const [regState, setRegState] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSecQuestion, setRegSecQuestion] = useState('');
  const [regSecAnswer, setRegSecAnswer] = useState('');

  // 3. Reset Password
  const [resetEmail, setResetEmail] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  // 4. Profile Edit
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    mobileNumber: '',
    countryId: 0,
    stateId: 0,
    cityId: 0,
  });

  // 5. News Search & Verification
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchSource, setSearchSource] = useState('');
  const [searchLanguage, setSearchLanguage] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);

  // Verification flow states
  const [verificationProgress, setVerificationProgress] = useState<number>(0);
  const [verificationStep, setVerificationStep] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [evidenceData, setEvidenceData] = useState<{ supporting: any[]; contradicting: any[] }>({
    supporting: [],
    contradicting: [],
  });

  // 10. Check News (User upload) states
  const [checkNewsTitle, setCheckNewsTitle] = useState('');
  const [checkNewsContent, setCheckNewsContent] = useState('');
  const [checkNewsUrl, setCheckNewsUrl] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [checkStep, setCheckStep] = useState(0);
  const [checkResult, setCheckResult] = useState<any | null>(null);
  const [checkHistory, setCheckHistory] = useState<any[]>([]);

  // 6. Verification History
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // 7. Feedback Form
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackType, setFeedbackType] = useState('Suggestions');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [userFeedbacks, setUserFeedbacks] = useState<any[]>([]);

  // Feedback Review (Admin Only)
  const [adminFeedbacks, setAdminFeedbacks] = useState<any[]>([]);
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});

  // 8. Report Generator
  const [selectedReportType, setSelectedReportType] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportCategory, setReportCategory] = useState('All');
  const [reportSource, setReportSource] = useState('All');
  const [reportStatus, setReportStatus] = useState('All');
  const [generatedReport, setGeneratedReport] = useState<any | null>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [reportTypesList, setReportTypesList] = useState<any[]>([]);

  // 9. Admin Panel States
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<{ totalRequests: number; apiLimit: number }>({
    totalRequests: 15230,
    apiLimit: 20000,
  });

  // Load baseline reference data on mount
  useEffect(() => {
    fetchReferences();
    checkAuthSession();
  }, []);

  // Fetch States when Country changes in Register
  useEffect(() => {
    if (regCountry) {
      fetchStates(Number(regCountry), 'register');
    } else {
      setRegisterStates([]);
      setRegisterCities([]);
    }
  }, [regCountry]);

  // Fetch Cities when State changes in Register
  useEffect(() => {
    if (regState) {
      fetchCities(Number(regState), 'register');
    } else {
      setRegisterCities([]);
    }
  }, [regState]);

  // Fetch States when Country changes in Profile
  useEffect(() => {
    if (profileData.countryId) {
      fetchStates(profileData.countryId, 'profile');
    }
  }, [profileData.countryId]);

  // Fetch Cities when State changes in Profile
  useEffect(() => {
    if (profileData.stateId) {
      fetchCities(profileData.stateId, 'profile');
    }
  }, [profileData.stateId]);

  // Alert dismiss helper
  const triggerAlert = (type: 'success' | 'danger' | 'warning', message: string) => {
    setAlert({ type, message });
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

  // Helper: Fetch Reference Tables
  const fetchReferences = async () => {
    try {
      const res = await fetch('/api/news/sources');
      const data = await res.json();
      if (res.ok) {
        setReferences({
          countries: data.countries || [],
          categories: data.categories || [],
          sources: data.sources || [],
          languages: data.languages || [],
          securityQuestions: data.securityQuestions || [],
        });
      }
    } catch (err) {
      console.error('Error loading references:', err);
    }
  };

  // Helper: Fetch states dynamically
  const fetchStates = async (countryId: number, type: 'register' | 'profile') => {
    try {
      const res = await fetch(`/api/news/sources?countryId=${countryId}`);
      const data = await res.json();
      if (res.ok) {
        if (type === 'register') {
          setRegisterStates(data.states || []);
        } else {
          setProfileStates(data.states || []);
        }
      }
    } catch (err) {
      console.error('Error fetching states:', err);
    }
  };

  // Helper: Fetch cities dynamically
  const fetchCities = async (stateId: number, type: 'register' | 'profile') => {
    try {
      const res = await fetch(`/api/news/sources?stateId=${stateId}`);
      const data = await res.json();
      if (res.ok) {
        if (type === 'register') {
          setRegisterCities(data.cities || []);
        } else {
          setProfileCities(data.cities || []);
        }
      }
    } catch (err) {
      console.error('Error fetching cities:', err);
    }
  };

  // Check auth session
  const checkAuthSession = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const profile = await res.json();
        setUser({
          userId: profile.userId,
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          role: profile.role.roleName,
        });
        // Set profile form data
        setProfileData({
          firstName: profile.firstName,
          lastName: profile.lastName,
          mobileNumber: profile.mobileNumber,
          countryId: profile.countryId,
          stateId: profile.stateId,
          cityId: profile.cityId,
        });
        loadDashboardData(profile.role.roleName);
      }
    } catch (err) {
      console.log('No active session.');
    }
  };

  // Load screen data depending on roles
  const loadDashboardData = async (roleName: string) => {
    setLoading(true);
    try {
      // 1. Fetch News list
      const newsRes = await fetch('/api/news/fetch');
      const newsData = await newsRes.json();
      if (newsRes.ok) setArticles(newsData.articles || []);

      // 2. Fetch feedback list
      const feedRes = await fetch('/api/feedback');
      const feedData = await feedRes.json();
      if (feedRes.ok) {
        if (roleName === 'Admin') {
          setAdminFeedbacks(feedData.feedbacks || []);
        } else {
          setUserFeedbacks(feedData.feedbacks || []);
        }
      }

      // 3. Fetch verification logs / reports config (if Admin)
      if (roleName === 'Admin') {
        const repRes = await fetch('/api/reports');
        const repData = await repRes.json();
        if (repRes.ok) {
          setReportHistory(repData.reportHistory || []);
          setReportTypesList(repData.reportTypes || []);
        }

        // Simulating loading admin statistics
        const usrRes = await fetch('/api/reports?reportTypeId=3'); // fetch user activity report mockup
        const usrData = await usrRes.json();
        if (usrRes.ok) {
          setSystemUsers(usrData.reportHistory || []); // dummy placeholder
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auth Operations
  // 1. Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      triggerAlert('danger', 'Email and password cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        // Pre-fill profile
        setProfileData({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          mobileNumber: '', // will be loaded in checkAuthSession
          countryId: 0,
          stateId: 0,
          cityId: 0,
        });
        checkAuthSession();
        triggerAlert('success', data.message);
        setActiveTab('check-news');
      } else {
        triggerAlert('danger', data.error || 'Login failed.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
      setUser(null);
      triggerAlert('success', 'Logged out successfully.');
      setAuthState('login');
      // Reset forms
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      triggerAlert('danger', 'Logout failed.');
    }
  };

  // 3. Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regPassword !== regConfirmPassword) {
      triggerAlert('danger', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: regFirstName,
          lastName: regLastName,
          email: regEmail,
          password: regPassword,
          mobileNumber: regMobile,
          countryId: regCountry,
          stateId: regState,
          cityId: regCity,
          securityQuestionId: regSecQuestion,
          securityAnswer: regSecAnswer,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        setAuthState('login');
        // Clear registration form
        setRegFirstName('');
        setRegLastName('');
        setRegEmail('');
        setRegMobile('');
        setRegCountry('');
        setRegState('');
        setRegCity('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegSecQuestion('');
        setRegSecAnswer('');
      } else {
        triggerAlert('danger', data.error || 'Registration failed.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to submit registration request.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetNewPassword !== resetConfirmPassword) {
      triggerAlert('danger', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          securityAnswer: resetAnswer,
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', 'Password reset successful. Please login.');
        setAuthState('login');
        setResetEmail('');
        setResetAnswer('');
        setResetNewPassword('');
        setResetConfirmPassword('');
      } else {
        triggerAlert('danger', data.error || 'Password reset failed.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // Profile update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        if (user) {
          setUser({ ...user, firstName: profileData.firstName, lastName: profileData.lastName });
        }
      } else {
        triggerAlert('danger', data.error || 'Failed to update profile.');
      }
    } catch (err) {
      triggerAlert('danger', 'Unable to reach profile API.');
    } finally {
      setLoading(false);
    }
  };

  // News search retrieval
  const handleNewsSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKeyword) params.append('keyword', searchKeyword);
      if (searchCategory) params.append('categoryId', searchCategory);
      if (searchSource) params.append('sourceId', searchSource);
      if (searchLanguage) params.append('languageId', searchLanguage);
      if (searchCountry) params.append('countryId', searchCountry);
      if (searchDate) params.append('date', searchDate);

      const res = await fetch(`/api/news/fetch?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setArticles(data.articles || []);
        triggerAlert('success', `Found ${data.count} news articles.`);
      } else {
        triggerAlert('danger', data.error || 'No news articles found.');
      }
    } catch (err) {
      triggerAlert('danger', 'Unable to fetch news.');
    } finally {
      setLoading(false);
    }
  };

  // Clear news search
  const clearNewsSearch = () => {
    setSearchKeyword('');
    setSearchCategory('');
    setSearchSource('');
    setSearchLanguage('');
    setSearchCountry('');
    setSearchDate('');
    handleNewsSearch();
  };

  // Run News Verification Pipeline
  const handleVerifyNews = async (articleId: string) => {
    setIsVerifying(true);
    setVerificationStep(1);
    setVerificationProgress(20);
    setVerificationResult(null);
    setEvidenceData({ supporting: [], contradicting: [] });
    setActiveTab('news-verify');

    // Steps simulation for premium micro-animation feel
    const steps = [
      { step: 1, prog: 20 }, // Sending article to AI model
      { step: 2, prog: 40 }, // Generating Embeddings
      { step: 3, prog: 60 }, // Retrieving Evidence
      { step: 4, prog: 80 }, // LLM Analysis
      { step: 5, prog: 100 }, // Finalizing Result
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setVerificationStep(steps[i].step);
      setVerificationProgress(steps[i].prog);
    }

    try {
      const res = await fetch('/api/news/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();

      if (res.ok) {
        setVerificationResult(data);
        triggerAlert('success', data.message);
        
        // Load evidence
        const evRes = await fetch(`/api/evidence?articleId=${articleId}`);
        const evData = await evRes.json();
        if (evRes.ok) {
          setEvidenceData({
            supporting: evData.supporting || [],
            contradicting: evData.contradicting || [],
          });
        }
      } else {
        triggerAlert('danger', data.error || 'Verification failed.');
        setIsVerifying(false);
      }
    } catch (err) {
      triggerAlert('danger', 'Verification request failed. Please check internet connection.');
      setIsVerifying(false);
    } finally {
      setIsVerifying(false);
    }
  };

  // Check News - Direct user submission
  const handleCheckNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkNewsTitle && !checkNewsContent) {
      triggerAlert('danger', 'Please provide a news headline or content to verify.');
      return;
    }
    setIsChecking(true);
    setCheckStep(1);
    setCheckProgress(10);
    setCheckResult(null);

    // Animated pipeline steps
    const steps = [
      { step: 1, prog: 15 },
      { step: 2, prog: 35 },
      { step: 3, prog: 55 },
      { step: 4, prog: 75 },
      { step: 5, prog: 90 },
    ];
    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setCheckStep(steps[i].step);
      setCheckProgress(steps[i].prog);
    }

    try {
      const res = await fetch('/api/news/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: checkNewsTitle,
          content: checkNewsContent,
          url: checkNewsUrl,
        }),
      });
      const data = await res.json();
      setCheckProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 400));

      if (res.ok) {
        setCheckResult(data);
        // Add to history
        setCheckHistory((prev) => [data, ...prev].slice(0, 10));
        triggerAlert('success', 'Analysis complete!');
      } else {
        triggerAlert('danger', data.error || 'Analysis failed.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to connect to the verification engine.');
    } finally {
      setIsChecking(false);
      setCheckStep(0);
      setCheckProgress(0);
    }
  };

  const resetCheckNews = () => {
    setCheckNewsTitle('');
    setCheckNewsContent('');
    setCheckNewsUrl('');
    setCheckResult(null);
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationResult) return;
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: selectedArticle.articleId,
          verificationId: verificationResult.historyId,
          rating: Number(feedbackRating),
          feedbackDescription: feedbackComments,
          feedbackTypeName: feedbackType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        setFeedbackComments('');
        // Reload feedback logs
        loadDashboardData(user?.role || '');
      } else {
        triggerAlert('danger', data.error || 'Unable to save feedback.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to submit feedback.');
    } finally {
      setLoading(false);
    }
  };

  // Admin Resolve Feedback
  const handleResolveFeedback = async (feedbackId: string, status: 'Reviewed' | 'Resolved') => {
    const text = resolutionText[feedbackId] || '';
    if (!text) {
      triggerAlert('warning', 'Resolution description cannot be empty.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackId,
          resolutionDescription: text,
          resolutionStatus: status,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerAlert('success', data.message);
        // Clear resolution input
        setResolutionText({ ...resolutionText, [feedbackId]: '' });
        loadDashboardData(user?.role || '');
      } else {
        triggerAlert('danger', data.error || 'Failed to update resolution status.');
      }
    } catch (err) {
      triggerAlert('danger', 'Failed to connect to feedback resolution API.');
    } finally {
      setLoading(false);
    }
  };

  // Generate Report (Admin only)
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportType) {
      triggerAlert('danger', 'Report Type is mandatory.');
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('reportTypeId', selectedReportType);
      if (reportStartDate) params.append('startDate', reportStartDate);
      if (reportEndDate) params.append('endDate', reportEndDate);
      if (reportCategory) params.append('newsCategory', reportCategory);
      if (reportSource) params.append('newsSource', reportSource);
      if (reportStatus) params.append('verificationStatus', reportStatus);

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setGeneratedReport(data);
        triggerAlert('success', 'Report generated successfully.');
        loadDashboardData(user?.role || ''); // refresh report logs
      } else {
        triggerAlert('danger', data.error || 'Failed to generate report.');
      }
    } catch (err) {
      triggerAlert('danger', 'Report generation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Mock report download (PDF/Excel)
  const downloadReport = (format: 'PDF' | 'Excel') => {
    if (!generatedReport) return;
    triggerAlert('success', `Report exported successfully as ${format}. Download started.`);
  };

  // ----------------------------------------------------
  // RENDER AUTHENTICATION SCREENS
  // ----------------------------------------------------
  if (!user) {
    return (
      <div className="auth-container">
        {alert && (
          <div style={{ position: 'fixed', top: '24px', zIndex: 1000 }} className={`alert alert-${alert.type} slide-up`}>
            {alert.message}
          </div>
        )}
        
        {authState === 'login' && (
          <div className="auth-card glass slide-up">
            <div className="auth-header">
              <div className="avatar" style={{ width: '48px', height: '48px', margin: '0 auto 16px', fontSize: '1.25rem' }}>🛡️</div>
              <h2 className="auth-title">Fake News Detection System</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Login to access the verification engine</p>
            </div>
            
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: 'var(--primary)' }} /> Remember Me
                </label>
                <span
                  style={{ color: 'var(--primary)', cursor: 'pointer', fontSize: '0.875rem' }}
                  onClick={() => setAuthState('forgot-password')}
                >
                  Forgot Password?
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Authenticating...' : 'Login'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setLoginEmail('');
                    setLoginPassword('');
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
            
            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Don't have an account?{' '}
              <span
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setAuthState('register')}
              >
                Register
              </span>
            </p>
          </div>
        )}

        {authState === 'register' && (
          <div className="auth-card glass slide-up" style={{ maxWidth: '640px' }}>
            <div className="auth-header">
              <h2 className="auth-title">Create Account</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Join the community to verify news and share facts</p>
            </div>
            
            <form onSubmit={handleRegister}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter first name"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter last name"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number (10 digits) *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    className="form-control"
                    placeholder="Enter mobile number"
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Country *</label>
                  <select
                    className="form-control"
                    value={regCountry}
                    onChange={(e) => setRegCountry(e.target.value)}
                    required
                  >
                    <option value="">Select country</option>
                    {references.countries.map((c) => (
                      <option key={c.countryId} value={c.countryId}>
                        {c.countryName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>State *</label>
                  <select
                    className="form-control"
                    value={regState}
                    onChange={(e) => setRegState(e.target.value)}
                    required
                    disabled={!regCountry}
                  >
                    <option value="">Select state</option>
                    {registerStates.map((s) => (
                      <option key={s.stateId} value={s.stateId}>
                        {s.stateName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>City *</label>
                <select
                  className="form-control"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  required
                  disabled={!regState}
                >
                  <option value="">Select city</option>
                  {registerCities.map((c) => (
                    <option key={c.cityId} value={c.cityId}>
                      {c.cityName}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Min 8 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Confirm Password *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Repeat password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Security Question *</label>
                <select
                  className="form-control"
                  value={regSecQuestion}
                  onChange={(e) => setRegSecQuestion(e.target.value)}
                  required
                >
                  <option value="">Select question</option>
                  {references.securityQuestions.map((q) => (
                    <option key={q.securityQuestionId} value={q.securityQuestionId}>
                      {q.question}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '32px' }}>
                <label>Security Answer *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter your security answer"
                  value={regSecAnswer}
                  onChange={(e) => setRegSecAnswer(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Register'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setRegFirstName('');
                    setRegLastName('');
                    setRegEmail('');
                    setRegMobile('');
                    setRegCountry('');
                    setRegState('');
                    setRegCity('');
                    setRegPassword('');
                    setRegConfirmPassword('');
                    setRegSecQuestion('');
                    setRegSecAnswer('');
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
            
            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <span
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setAuthState('login')}
              >
                Login
              </span>
            </p>
          </div>
        )}

        {authState === 'forgot-password' && (
          <div className="auth-card glass slide-up">
            <div className="auth-header">
              <h2 className="auth-title">Reset Password</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Provide details to verify your identity</p>
            </div>
            
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>Registered Email Address *</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Security Answer *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Answer your security question"
                  value={resetAnswer}
                  onChange={(e) => setResetAnswer(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 8 characters"
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '32px' }}>
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repeat new password"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  Submit
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAuthState('login')}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER APPLICATION DASHBOARD
  // ----------------------------------------------------
  return (
    <div className="app-container">
      {/* Alert Component */}
      {alert && (
        <div style={{ position: 'fixed', top: '24px', right: '32px', zIndex: 1000, maxWidth: '400px' }} className={`alert alert-${alert.type} slide-up`}>
          {alert.message}
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <span>🛡️</span> Fake News Detector
        </div>
        
        <ul className="sidebar-menu">
          <li>
            <button
              onClick={() => setActiveTab('check-news')}
              className={`nav-link btn-secondary ${activeTab === 'check-news' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              🔎 Check News
            </button>
          </li>
          <li>
            <button
              onClick={() => { setActiveTab('dashboard'); loadDashboardData(user.role); }}
              className={`nav-link btn-secondary ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              📊 Home Dashboard
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('profile')}
              className={`nav-link btn-secondary ${activeTab === 'profile' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              👤 My Profile
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('news-retrieve')}
              className={`nav-link btn-secondary ${activeTab === 'news-retrieve' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              📰 News Retrieval
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`nav-link btn-secondary ${activeTab === 'evidence' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              🔍 Trusted Sources
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`nav-link btn-secondary ${activeTab === 'feedback' ? 'active' : ''}`}
              style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              💬 Feedback Forum
            </button>
          </li>
          {user.role === 'Admin' && (
            <>
              <li>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`nav-link btn-secondary ${activeTab === 'reports' ? 'active' : ''}`}
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  📈 Reports Panel
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`nav-link btn-secondary ${activeTab === 'admin' ? 'active' : ''}`}
                  style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  ⚙️ Admin Center
                </button>
              </li>
            </>
          )}
        </ul>

        <div className="sidebar-footer">
          <button className="btn btn-secondary btn-disabled" style={{ width: '100%', padding: '8px' }}>
            v1.0.0
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="main-wrapper">
        <header className="header">
          <div className="header-title">
            {activeTab === 'check-news' && '🛡️ Fake News Detection Engine'}
            {activeTab === 'dashboard' && 'Welcome back, ' + user.firstName}
            {activeTab === 'profile' && 'Profile Management'}
            {activeTab === 'news-retrieve' && 'News Article Retrieval'}
            {activeTab === 'news-verify' && 'AI Verification Pipeline'}
            {activeTab === 'evidence' && 'Trusted Evidence sources'}
            {activeTab === 'feedback' && 'User Feedback Forum'}
            {activeTab === 'reports' && 'Analytical Reports Dashboard'}
            {activeTab === 'admin' && 'System Administration'}
          </div>
          
          <div className="user-profile-menu" onClick={handleLogout}>
            <div className="avatar">{user.firstName[0]}</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.firstName} {user.lastName}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.role}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>🚪</span>
          </div>
        </header>

        <main className="content-body slide-up">
          {/* 0. CHECK NEWS VIEW - PRIMARY FEATURE */}
          {activeTab === 'check-news' && (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              {!checkResult && !isChecking && (
                <div>
                  {/* Hero Section */}
                  <div className="glass" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.08) 100%)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Paste Your News. Get the Truth.</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto' }}>
                      Submit any news headline or article content and our AI-powered engine will analyze it for authenticity.
                    </p>
                  </div>

                  {/* Input Form */}
                  <div className="glass" style={{ padding: '32px' }}>
                    <form onSubmit={handleCheckNews}>
                      <div className="form-group">
                        <label style={{ fontSize: '1rem', fontWeight: 600 }}>News Headline / Title *</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Scientists discover new species in the Amazon rainforest"
                          value={checkNewsTitle}
                          onChange={(e) => setCheckNewsTitle(e.target.value)}
                          style={{ fontSize: '1.05rem', padding: '14px 16px' }}
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontSize: '1rem', fontWeight: 600 }}>Full Article Content</label>
                        <textarea
                          rows={8}
                          className="form-control"
                          placeholder="Paste the full news article content here for a more accurate analysis...\n\nThe more context you provide, the better the AI can assess the credibility of the news."
                          value={checkNewsContent}
                          onChange={(e) => setCheckNewsContent(e.target.value)}
                          style={{ fontSize: '0.95rem', padding: '14px 16px', lineHeight: '1.6', resize: 'vertical' }}
                        ></textarea>
                      </div>

                      <div className="form-group">
                        <label>Source URL <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                        <input
                          type="url"
                          className="form-control"
                          placeholder="https://example.com/article"
                          value={checkNewsUrl}
                          onChange={(e) => setCheckNewsUrl(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '14px', fontSize: '1.05rem', fontWeight: 600 }} disabled={isChecking || (!checkNewsTitle && !checkNewsContent)}>
                          🛡️ Analyze Authenticity
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '14px 24px' }} onClick={resetCheckNews}>
                          Clear
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* History Section */}
                  {checkHistory.length > 0 && (
                    <div className="glass" style={{ padding: '24px', marginTop: '24px' }}>
                      <h3 style={{ marginBottom: '16px' }}>Recent Checks</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {checkHistory.map((item, idx) => (
                          <div
                            key={idx}
                            onClick={() => setCheckResult(item)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '14px 18px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px',
                              border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'var(--transition)',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--card-hover-border)')}
                            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                          >
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</span>
                              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {new Date(item.analyzedAt).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: item.result === 'Likely Real' ? 'var(--success)' : item.result === 'Likely Fake' ? 'var(--error)' : 'var(--warning)' }}>
                                {item.confidenceScore}%
                              </span>
                              <span className={`badge ${item.result === 'Likely Real' ? 'badge-real' : item.result === 'Likely Fake' ? 'badge-fake' : 'badge-warning'}`}>
                                {item.result}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Checking Animation */}
              {isChecking && (
                <div className="glass" style={{ padding: '48px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }}>🔬</div>
                  <h3 style={{ marginBottom: '8px', fontSize: '1.4rem' }}>Analyzing News Authenticity</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Our AI engine is cross-referencing your submission...</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px', margin: '0 auto', textAlign: 'left' }}>
                    {[
                      { s: 1, label: 'Preprocessing content & extracting claims' },
                      { s: 2, label: 'Generating semantic embeddings' },
                      { s: 3, label: 'Querying trusted news databases' },
                      { s: 4, label: 'Running AI credibility analysis' },
                      { s: 5, label: 'Computing confidence score' },
                    ].map((item) => (
                      <div key={item.s} style={{ display: 'flex', alignItems: 'center', gap: '14px', opacity: checkStep >= item.s ? 1 : 0.3, transition: 'all 0.4s ease' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700,
                          background: checkStep > item.s ? 'var(--success)' : checkStep === item.s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                          color: checkStep >= item.s ? '#fff' : 'var(--text-muted)',
                          transition: 'all 0.3s ease',
                        }}>
                          {checkStep > item.s ? '✓' : item.s}
                        </div>
                        <span style={{ fontSize: '0.95rem', fontWeight: checkStep === item.s ? 600 : 400 }}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', margin: '32px 0 0' }}>
                    <div style={{ width: `${checkProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', transition: 'width 0.4s ease', borderRadius: '4px' }}></div>
                  </div>
                </div>
              )}

              {/* Result Display */}
              {checkResult && !isChecking && (
                <div>
                  {/* Verdict Hero */}
                  <div className="glass" style={{
                    padding: '40px', textAlign: 'center', marginBottom: '24px',
                    background: checkResult.result === 'Likely Real'
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.02) 100%)'
                      : checkResult.result === 'Likely Fake'
                        ? 'linear-gradient(135deg, rgba(244,63,94,0.1) 0%, rgba(244,63,94,0.02) 100%)'
                        : 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)',
                    borderColor: checkResult.result === 'Likely Real' ? 'rgba(16,185,129,0.3)' : checkResult.result === 'Likely Fake' ? 'rgba(244,63,94,0.3)' : 'rgba(245,158,11,0.3)',
                  }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>
                      {checkResult.result === 'Likely Real' ? '✅' : checkResult.result === 'Likely Fake' ? '❌' : '⚠️'}
                    </div>
                    <span className={`badge ${checkResult.result === 'Likely Real' ? 'badge-real' : checkResult.result === 'Likely Fake' ? 'badge-fake' : 'badge-warning'}`} style={{ fontSize: '1.2rem', padding: '8px 24px', marginBottom: '16px', display: 'inline-block' }}>
                      {checkResult.result}
                    </span>

                    {/* Confidence Gauge */}
                    <div style={{ margin: '24px auto 0', width: '140px', height: '140px' }}>
                      <div className="verification-gauge" style={{
                        borderColor: checkResult.result === 'Likely Real' ? 'var(--success)' : checkResult.result === 'Likely Fake' ? 'var(--error)' : 'var(--warning)',
                        width: '140px', height: '140px',
                      }}>
                        <span className="gauge-value" style={{ fontSize: '2rem' }}>{checkResult.confidenceScore}%</span>
                        <span className="gauge-label">Confidence</span>
                      </div>
                    </div>

                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '16px' }}>
                      Analyzed: <strong>{checkResult.title}</strong>
                    </p>
                  </div>

                  {/* Explanation */}
                  <div className="glass" style={{ padding: '28px', marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '14px' }}>📋 AI Analysis Explanation</h3>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.7', color: 'var(--text-main)', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--card-border)' }}>
                      {checkResult.explanation}
                    </p>
                  </div>

                  {/* Key Factors */}
                  {checkResult.keyFactors && checkResult.keyFactors.length > 0 && (
                    <div className="glass" style={{ padding: '28px', marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '14px' }}>🔑 Key Decision Factors</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {checkResult.keyFactors.map((factor: string, idx: number) => (
                          <div key={idx} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px',
                            background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--card-border)',
                          }}>
                            <span style={{
                              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700,
                              background: checkResult.result === 'Likely Real' ? 'rgba(16,185,129,0.15)' : checkResult.result === 'Likely Fake' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)',
                              color: checkResult.result === 'Likely Real' ? 'var(--success)' : checkResult.result === 'Likely Fake' ? 'var(--error)' : 'var(--warning)',
                            }}>{idx + 1}</span>
                            <span style={{ fontSize: '0.9rem' }}>{factor}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evidence */}
                  {checkResult.evidence && checkResult.evidence.length > 0 && (
                    <div className="glass" style={{ padding: '28px', marginBottom: '24px' }}>
                      <h3 style={{ marginBottom: '14px' }}>📰 Cross-Reference Evidence</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {checkResult.evidence.map((ev: any, idx: number) => (
                          <div key={idx} style={{
                            padding: '16px', borderRadius: '10px',
                            background: ev.type === 'Supporting' ? 'rgba(16,185,129,0.04)' : 'rgba(244,63,94,0.04)',
                            border: `1px solid ${ev.type === 'Supporting' ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{ev.type === 'Supporting' ? '✅' : '❌'}</span>
                                <strong style={{ fontSize: '0.9rem' }}>{ev.source}</strong>
                                <span className={`badge ${ev.type === 'Supporting' ? 'badge-real' : 'badge-fake'}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                  {ev.type}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: ev.type === 'Supporting' ? 'var(--success)' : 'var(--error)' }}>
                                {(ev.similarity * 100).toFixed(0)}% match
                              </span>
                            </div>
                            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{ev.title}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{ev.snippet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '14px', fontSize: '1rem' }} onClick={resetCheckNews}>
                      🔄 Check Another News
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '14px 24px' }} onClick={() => setActiveTab('dashboard')}>
                      📊 Dashboard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 1. DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div>
              <div className="stats-grid">
                <div className="stat-card glass">
                  <span className="stat-title">Articles Catalogued</span>
                  <span className="stat-value">{articles.length}</span>
                  <span className="stat-desc">Retrieved from verified API feeds</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-title">AI Verifications</span>
                  <span className="stat-value">
                    {articles.filter((a) => a.status === 'Verified').length}
                  </span>
                  <span className="stat-desc">Completeness verification runs</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-title">Pending Review</span>
                  <span className="stat-value">
                    {articles.filter((a) => a.status !== 'Verified').length}
                  </span>
                  <span className="stat-desc">Awaiting authenticity check</span>
                </div>
              </div>

              <div className="glass" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Catalogued News Stream</h3>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div className="spinner"></div></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Headline</th>
                          <th>Publisher</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.map((art) => (
                          <tr key={art.articleId}>
                            <td style={{ fontWeight: 500 }}>{art.title}</td>
                            <td>{art.source.sourceName}</td>
                            <td>{art.category.categoryName}</td>
                            <td>
                              <span className={`badge ${art.status === 'Verified' ? 'badge-real' : 'badge-warning'}`}>
                                {art.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedArticle(art);
                                  handleVerifyNews(art.articleId);
                                }}
                              >
                                {art.status === 'Verified' ? 'View Report' : 'Verify'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. PROFILE VIEW */}
          {activeTab === 'profile' && (
            <div className="glass" style={{ padding: '32px', maxWidth: '640px', margin: '0 auto' }}>
              <h3 style={{ marginBottom: '24px' }}>Update Profile Details</h3>
              <form onSubmit={handleUpdateProfile}>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Email (Read-only)</label>
                  <input
                    type="email"
                    className="form-control"
                    value={user.email}
                    disabled
                    style={{ opacity: 0.6 }}
                  />
                </div>

                <div className="form-group">
                  <label>Mobile Number (10 digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    className="form-control"
                    value={profileData.mobileNumber}
                    onChange={(e) => setProfileData({ ...profileData, mobileNumber: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Country</label>
                    <select
                      className="form-control"
                      value={profileData.countryId}
                      onChange={(e) => setProfileData({ ...profileData, countryId: Number(e.target.value) })}
                      required
                    >
                      {references.countries.map((c) => (
                        <option key={c.countryId} value={c.countryId}>
                          {c.countryName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <select
                      className="form-control"
                      value={profileData.stateId}
                      onChange={(e) => setProfileData({ ...profileData, stateId: Number(e.target.value) })}
                      required
                    >
                      {profileStates.map((s) => (
                        <option key={s.stateId} value={s.stateId}>
                          {s.stateName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>City</label>
                  <select
                    className="form-control"
                    value={profileData.cityId}
                    onChange={(e) => setProfileData({ ...profileData, cityId: Number(e.target.value) })}
                    required
                  >
                    {profileCities.map((c) => (
                      <option key={c.cityId} value={c.cityId}>
                        {c.cityName}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save Changes
                </button>
              </form>
            </div>
          )}

          {/* 3. NEWS RETRIEVAL VIEW */}
          {activeTab === 'news-retrieve' && (
            <div>
              <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
                <form onSubmit={handleNewsSearch}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Keyword / Headline Search</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search keywords..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        className="form-control"
                        value={searchCategory}
                        onChange={(e) => setSearchCategory(e.target.value)}
                      >
                        <option value="">All Categories</option>
                        {references.categories.map((c) => (
                          <option key={c.categoryId} value={c.categoryId}>{c.categoryName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Source Publisher</label>
                      <select
                        className="form-control"
                        value={searchSource}
                        onChange={(e) => setSearchSource(e.target.value)}
                      >
                        <option value="">All Sources</option>
                        {references.sources.map((s) => (
                          <option key={s.sourceId} value={s.sourceId}>{s.sourceName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Publish Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '24px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary" onClick={clearNewsSearch}>
                      Clear
                    </button>
                    <button type="submit" className="btn btn-primary">
                      🔍 Retrieve News
                    </button>
                  </div>
                </form>
              </div>

              <div className="glass" style={{ padding: '24px' }}>
                <h3>Search Results</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Headline</th>
                        <th>Source</th>
                        <th>Category</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {articles.length === 0 ? (
                        <tr><td colSpan={5} style={{ textAlign: 'center' }}>No articles match the criteria.</td></tr>
                      ) : (
                        articles.map((art) => (
                          <tr key={art.articleId}>
                            <td style={{ fontWeight: 500 }}>{art.title}</td>
                            <td>{art.source.sourceName}</td>
                            <td>{art.category.categoryName}</td>
                            <td>
                              <span className={`badge ${art.status === 'Verified' ? 'badge-real' : 'badge-warning'}`}>
                                {art.status}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setSelectedArticle(art);
                                  handleVerifyNews(art.articleId);
                                }}
                              >
                                {art.status === 'Verified' ? 'View Details' : 'Verify'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 4. VERIFICATION WORKFLOW VIEW */}
          {activeTab === 'news-verify' && (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              {isVerifying ? (
                <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                  <h3 style={{ marginBottom: '16px' }}>Fact-Checking Pipeline Initiated</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Semantic comparisons and AI analysis are active.</p>
                  
                  <div className="verification-progress-list">
                    <div className={`progress-step ${verificationStep >= 1 ? 'completed' : ''} ${verificationStep === 1 ? 'active' : ''}`}>
                      <div className="step-indicator">1</div>
                      <span>Initializing Connection to Language Model</span>
                    </div>
                    <div className={`progress-step ${verificationStep >= 2 ? 'completed' : ''} ${verificationStep === 2 ? 'active' : ''}`}>
                      <div className="step-indicator">2</div>
                      <span>Generating Document Semantic Embeddings</span>
                    </div>
                    <div className={`progress-step ${verificationStep >= 3 ? 'completed' : ''} ${verificationStep === 3 ? 'active' : ''}`}>
                      <div className="step-indicator">3</div>
                      <span>Querying Evidence Repository in Vector DB</span>
                    </div>
                    <div className={`progress-step ${verificationStep >= 4 ? 'completed' : ''} ${verificationStep === 4 ? 'active' : ''}`}>
                      <div className="step-indicator">4</div>
                      <span>Running LLM Contradiction/Support Scoring</span>
                    </div>
                    <div className={`progress-step ${verificationStep >= 5 ? 'completed' : ''} ${verificationStep === 5 ? 'active' : ''}`}>
                      <div className="step-indicator">5</div>
                      <span>Formatting Result and Confidence Threshold</span>
                    </div>
                  </div>
                  
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', margin: '24px 0' }}>
                    <div style={{ width: `${verificationProgress}%`, height: '100%', background: 'linear-gradient(to right, var(--primary), var(--secondary))', transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
              ) : verificationResult ? (
                <div className="glass" style={{ padding: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2>Verification Outcome</h2>
                    <span className={`badge ${verificationResult.result === 'Likely Real' ? 'badge-real' : verificationResult.result === 'Likely Fake' ? 'badge-fake' : 'badge-warning'}`} style={{ fontSize: '1rem', padding: '6px 16px' }}>
                      {verificationResult.result}
                    </span>
                  </div>

                  <div className="grid-2" style={{ marginBottom: '32px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="verification-gauge" style={{ borderColor: verificationResult.result === 'Likely Real' ? 'var(--success)' : verificationResult.result === 'Likely Fake' ? 'var(--error)' : 'var(--warning)' }}>
                        <span className="gauge-value">{verificationResult.confidenceScore}%</span>
                        <span className="gauge-label">Confidence</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>AI Logic Explanation:</h4>
                      <p style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '0.95rem' }}>
                        {verificationResult.explanation}
                      </p>
                    </div>
                  </div>

                  <h3 style={{ marginBottom: '16px' }}>Semantic Evidence Repository Matching</h3>
                  
                  <div className="grid-2" style={{ marginBottom: '32px' }}>
                    <div>
                      <h4 style={{ color: 'var(--success)', marginBottom: '12px' }}>Supporting Evidence ({evidenceData.supporting.length})</h4>
                      {evidenceData.supporting.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No direct supporting claims found.</p>
                      ) : (
                        evidenceData.supporting.map((ev, i) => (
                          <div key={i} style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <strong style={{ fontSize: '0.9rem' }}>{ev.sourceName}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>{(ev.similarityScore * 100).toFixed(0)}% Match</span>
                            </div>
                            <span style={{ fontSize: '0.85rem', display: 'block', fontWeight: 600 }}>{ev.evidenceTitle}</span>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{ev.evidenceContent}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div>
                      <h4 style={{ color: 'var(--error)', marginBottom: '12px' }}>Contradicting Evidence ({evidenceData.contradicting.length})</h4>
                      {evidenceData.contradicting.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No contradicting statements found.</p>
                      ) : (
                        evidenceData.contradicting.map((ev, i) => (
                          <div key={i} style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '8px', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <strong style={{ fontSize: '0.9rem' }}>{ev.sourceName}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--error)' }}>{(ev.similarityScore * 100).toFixed(0)}% Match</span>
                            </div>
                            <span style={{ fontSize: '0.85rem', display: 'block', fontWeight: 600 }}>{ev.evidenceTitle}</span>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{ev.evidenceContent}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Feedback Form Section */}
                  <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>Feedback Submission</h3>
                    <form onSubmit={handleSubmitFeedback}>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Rate System Accuracy *</label>
                          <select className="form-control" value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}>
                            <option value="5">⭐⭐⭐⭐⭐ (Highly Accurate)</option>
                            <option value="4">⭐⭐⭐⭐ (Accurate)</option>
                            <option value="3">⭐⭐⭐ (Neutral)</option>
                            <option value="2">⭐⭐ (Needs Work)</option>
                            <option value="1">⭐ (Incorrect)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Category *</label>
                          <select className="form-control" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
                            <option value="Incorrect Result">Incorrect Result</option>
                            <option value="Unclear Explanation">Unclear Explanation</option>
                            <option value="Suggestions">Suggestions</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Explain your rating *</label>
                        <textarea
                          rows={3}
                          className="form-control"
                          placeholder="Your comments..."
                          value={feedbackComments}
                          onChange={(e) => setFeedbackComments(e.target.value)}
                          required
                        ></textarea>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('dashboard')}>
                          Back to Dashboard
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                          Submit Feedback
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="glass" style={{ padding: '32px', textAlign: 'center' }}>
                  <p>Select a news article from the home dashboard or search list to trigger verification.</p>
                  <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setActiveTab('dashboard')}>
                    Browse Articles
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. EVIDENCE SOURCES VIEW */}
          {activeTab === 'evidence' && (
            <div>
              <div className="glass" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Trusted News Publications</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Source Name</th>
                        <th>Type</th>
                        <th>Reliability Index</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {references.sources.map((src) => (
                        <tr key={src.sourceId}>
                          <td style={{ fontWeight: 500 }}>{src.sourceName}</td>
                          <td>Mainstream</td>
                          <td>
                            <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>95%</span>
                          </td>
                          <td>
                            <span className="badge badge-real">Active</span>
                          </td>
                          <td>
                            <a href={src.websiteURL} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                              Visit Site
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 6. FEEDBACK VIEW */}
          {activeTab === 'feedback' && (
            <div>
              <div className="glass" style={{ padding: '24px' }}>
                <h3>Feedback Activity Logs</h3>
                {user.role === 'Admin' ? (
                  // Admin View
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Article</th>
                          <th>Category</th>
                          <th>Rating</th>
                          <th>Comments</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminFeedbacks.length === 0 ? (
                          <tr><td colSpan={7} style={{ textAlign: 'center' }}>No feedback submitted yet.</td></tr>
                        ) : (
                          adminFeedbacks.map((fb) => (
                            <tr key={fb.feedbackId}>
                              <td>{fb.user.firstName} {fb.user.lastName}</td>
                              <td>{fb.article.title}</td>
                              <td>{fb.feedbackType.feedbackTypeName}</td>
                              <td>{fb.rating}/5</td>
                              <td>{fb.feedbackDescription}</td>
                              <td>
                                <span className={`badge ${fb.status === 'Resolved' ? 'badge-real' : fb.status === 'Reviewed' ? 'badge-info' : 'badge-warning'}`}>
                                  {fb.status}
                                </span>
                              </td>
                              <td>
                                {fb.status !== 'Resolved' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <input
                                      type="text"
                                      placeholder="Resolution text..."
                                      className="form-control"
                                      style={{ padding: '6px', fontSize: '0.85rem' }}
                                      value={resolutionText[fb.feedbackId] || ''}
                                      onChange={(e) => setResolutionText({ ...resolutionText, [fb.feedbackId]: e.target.value })}
                                    />
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                      onClick={() => handleResolveFeedback(fb.feedbackId, 'Resolved')}
                                    >
                                      Mark Resolved
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // User View
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Article Title</th>
                          <th>Feedback Category</th>
                          <th>Rating</th>
                          <th>My Comments</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userFeedbacks.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center' }}>You have not submitted any feedback.</td></tr>
                        ) : (
                          userFeedbacks.map((fb) => (
                            <tr key={fb.feedbackId}>
                              <td>{fb.article.title}</td>
                              <td>{fb.feedbackType.feedbackTypeName}</td>
                              <td>{fb.rating}/5</td>
                              <td>{fb.feedbackDescription}</td>
                              <td>
                                <span className={`badge ${fb.status === 'Resolved' ? 'badge-real' : 'badge-warning'}`}>
                                  {fb.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 7. REPORTS PANEL (Admin only) */}
          {activeTab === 'reports' && user.role === 'Admin' && (
            <div>
              <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Filter Report Analytics</h3>
                <form onSubmit={handleGenerateReport}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Report Type *</label>
                      <select className="form-control" value={selectedReportType} onChange={(e) => setSelectedReportType(e.target.value)} required>
                        <option value="">Select report type</option>
                        {reportTypesList.map((rt) => (
                          <option key={rt.reportTypeId} value={rt.reportTypeId}>{rt.reportName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Category Filter</label>
                      <select className="form-control" value={reportCategory} onChange={(e) => setReportCategory(e.target.value)}>
                        <option value="All">All Categories</option>
                        {references.categories.map((c) => (
                          <option key={c.categoryId} value={c.categoryName}>{c.categoryName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '12px' }}>
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="date" className="form-control" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input type="date" className="form-control" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', marginTop: '24px', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary">
                      Generate Report
                    </button>
                  </div>
                </form>
              </div>

              {generatedReport && (
                <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3>{generatedReport.reportName}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => downloadReport('PDF')}>Export PDF</button>
                      <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => downloadReport('Excel')}>Export Excel</button>
                    </div>
                  </div>

                  <div className="stats-grid">
                    <div className="stat-card glass" style={{ background: 'rgba(255,255,255,0.01)' }}>
                      <span className="stat-title">Total Verified</span>
                      <span className="stat-value">{generatedReport.data.summary.totalVerified}</span>
                    </div>
                    <div className="stat-card glass" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                      <span className="stat-title">Likely Real</span>
                      <span className="stat-value" style={{ color: 'var(--success)' }}>{generatedReport.data.summary.realCount}</span>
                    </div>
                    <div className="stat-card glass" style={{ background: 'rgba(244, 63, 94, 0.05)' }}>
                      <span className="stat-title">Likely Fake</span>
                      <span className="stat-value" style={{ color: 'var(--error)' }}>{generatedReport.data.summary.fakeCount}</span>
                    </div>
                    <div className="stat-card glass" style={{ background: 'rgba(245, 158, 11, 0.05)' }}>
                      <span className="stat-title">Avg Confidence</span>
                      <span className="stat-value" style={{ color: 'var(--primary)' }}>{generatedReport.data.summary.avgConfidence}%</span>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div>
                      <h4>Category Breakdown</h4>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Verified Articles</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(generatedReport.data.summary.categoryBreakdown).map(([cat, val]: any) => (
                              <tr key={cat}>
                                <td>{cat}</td>
                                <td>{val}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4>Report Summary Details</h4>
                      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)', marginTop: '16px' }}>
                        <p style={{ marginBottom: '8px' }}><strong>Generated On:</strong> {new Date(generatedReport.generatedDate).toLocaleString()}</p>
                        <p style={{ marginBottom: '8px' }}><strong>Category Filter:</strong> {generatedReport.filter.category}</p>
                        <p style={{ marginBottom: '8px' }}><strong>Source Filter:</strong> {generatedReport.filter.source}</p>
                        <p style={{ marginBottom: '8px' }}><strong>Pending Manual Logs:</strong> {generatedReport.data.summary.manualCount} articles</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass" style={{ padding: '24px' }}>
                <h3>Report Generation logs</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Report Name</th>
                        <th>Generated Date</th>
                        <th>Format</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportHistory.map((rep) => (
                        <tr key={rep.reportId}>
                          <td style={{ fontWeight: 500 }}>{rep.reportName}</td>
                          <td>{new Date(rep.generatedDate).toLocaleString()}</td>
                          <td>{rep.reportFormat}</td>
                          <td>
                            <span className="badge badge-real">{rep.reportStatus}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 8. ADMIN DASHBOARD VIEW (Admin only) */}
          {activeTab === 'admin' && user.role === 'Admin' && (
            <div>
              <div className="stats-grid">
                <div className="stat-card glass">
                  <span className="stat-title">Platform Users</span>
                  <span className="stat-value">{references.countries.length + 5}</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-title">API Requests Today</span>
                  <span className="stat-value">{systemLogs.totalRequests.toLocaleString()}</span>
                  <span className="stat-desc">Limit: {systemLogs.apiLimit.toLocaleString()}</span>
                </div>
                <div className="stat-card glass">
                  <span className="stat-title">System Status</span>
                  <span className="stat-value" style={{ color: 'var(--success)' }}>Online</span>
                </div>
              </div>

              <div className="glass" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '16px' }}>Manage System Accounts</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Account Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 500 }}>Admin User</td>
                        <td>admin@fakenewsdetection.com</td>
                        <td>Admin</td>
                        <td><span className="badge badge-real">Active</span></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 500 }}>John Doe</td>
                        <td>john.doe@gmail.com</td>
                        <td>Regular User</td>
                        <td><span className="badge badge-real">Active</span></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 500 }}>Jane Smith</td>
                        <td>jane.smith@yahoo.com</td>
                        <td>Regular User</td>
                        <td><span className="badge badge-warning">Inactive</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
