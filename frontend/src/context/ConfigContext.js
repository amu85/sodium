import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import API from '../api';
import { AuthContext } from './AuthContext';
import { toast } from 'react-toastify';

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const { token, logout } = useContext(AuthContext);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(() => {
    if (!token) return;

    API.get('/config', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setConfig(res.data);
        setLoading(false);
      })
      .catch(() => {
        // toast.error('Failed to load configuration');
        // setLoading(false);
        toast.error('Session expired. Logging out...');
        setTimeout(() => {
          logout();
        }, 2000);
        return false;
      });
  }, [token, logout]);

  const updateConfig = (newConfig) => {
    setConfig(newConfig);
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return (
    <ConfigContext.Provider value={{ config, fetchConfig, updateConfig, loading }}>
      {children}
    </ConfigContext.Provider>
  );
};