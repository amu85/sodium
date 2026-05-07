import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { AuthProvider, AuthContext } from './context/AuthContext';
import UsersPage from './pages/UsersPage';
import ConfigurationPage from './pages/ConfigurationPage';
import { ConfigProvider } from './context/ConfigContext';
import OrdersPage from './pages/OrdersPage';
import CreateNewTradePage from './pages/CreateNewTradePage';
import CloseExistingPage from './pages/CloseExistingPage';
import HealthcheckPage from './pages/HealthcheckPage';
import QuantityFreezeLimitsPage from './pages/QuantityFreezeLimitsPage';
import AlgoPage from './pages/AlgoPage';
import MonitoringPage from './pages/MonitoringPage';
import AnalysisPage from './pages/AnalysisPage';
import IntradayPage from './pages/IntradayPage';

const PrivateRoute = ({ children }) => {
  const { isLoggedIn } = React.useContext(AuthContext);
  return isLoggedIn ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { isLoggedIn } = React.useContext(AuthContext);
  return isLoggedIn ? <Navigate to="/" /> : children;
};

function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <Router>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

            {/* Private routes */}
            <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
            <Route path="/healthcheck" element={<PrivateRoute><HealthcheckPage /></PrivateRoute>} />
            <Route path="/create-new-trade" element={<PrivateRoute><CreateNewTradePage /></PrivateRoute>} />
            <Route path="/close-existing" element={<PrivateRoute><CloseExistingPage /></PrivateRoute>} />
            <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
            <Route path="/algo" element={<PrivateRoute><AlgoPage /></PrivateRoute>} />
            <Route path="/config" element={<PrivateRoute><ConfigurationPage /></PrivateRoute>} />
            <Route path="/quantity-freeze-limits" element={<PrivateRoute><QuantityFreezeLimitsPage /></PrivateRoute>} />
            <Route path="/monitoring" element={<PrivateRoute><MonitoringPage /></PrivateRoute>} />
            <Route path="/analysis" element={<PrivateRoute><AnalysisPage /></PrivateRoute>} />
            <Route path="/intraday" element={<PrivateRoute><IntradayPage /></PrivateRoute>} />

            {/* Catch-all: Redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;
