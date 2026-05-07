import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Alert, Spinner } from 'react-bootstrap';

import '../assets/css/style.css';
import '../assets/css/responsive.css';
import logo from '../assets/images/logo/dhruti-logo-1.png';

const LoginPage = () => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!userId.trim() || !password) {
      setMessage('Enter user ID and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', {
        userId: userId.trim(),
        password,
      });
      const token = res.data?.token ?? res.data?.data?.token;
      if (!token) {
        setMessage(res.data?.message || 'Login failed: no token received.');
        return;
      }
      login(token);
      navigate('/');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div className="user-authentication-wrapper">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xl-6 col-lg-7 col-md-10">
            <div className="user-authentication-wrap-box">
              <div className="brand-logo-wrap text-center mb-md-5 mb-5">
                <img src={logo} alt="Dhruti Algo" />
              </div>

              {message && <Alert variant="info">{message}</Alert>}

              <div className="row">
                <div className="col-md-12">
                  <div className="mb-4">
                    <label className="mb-3">User ID</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="User ID"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      autoComplete="username"
                    />
                  </div>
                </div>
                <div className="col-md-12">
                  <div className="mb-4">
                    <label className="mb-3">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <div className="col-md-12">
                  <div className="mt-3">
                    <button
                      className="theme-btn primary w-100 text-center"
                      type="button"
                      onClick={handleLogin}
                      disabled={loading}
                    >
                      {loading ? <Spinner size="sm" animation="border" /> : 'Login'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
