import React, { useState, useEffect, useCallback, useRef } from 'react';
import MainLayout from '../layout/MainLayout';
import API from '../api';
import { Spinner, Alert, Button, Card, Table, Badge, Row, Col, Container, Form, Dropdown, Modal } from 'react-bootstrap';

import TradingChart from '../components/TradingChart';

const IntradayPage = () => {
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [priceDirection, setPriceDirection] = useState('stable'); // 'up', 'down', 'stable'
  const [chartData, setChartData] = useState([]);
  const [stPeriod, setStPeriod] = useState(10);
  const [stMultiplier, setStMultiplier] = useState(1.5);
  const [effectiveMultiplier, setEffectiveMultiplier] = useState(1.5);
  const [fullScreen, setFullScreen] = useState(false);
  const [paperData, setPaperData] = useState({ balance: 1000000, trades: [], positions: [] });
  const [showPaperTrades, setShowPaperTrades] = useState(true);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [autoTrade, setAutoTrade] = useState(false);
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const chartRef = useRef(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showPerformerModal, setShowPerformerModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [defaultQuantity, setDefaultQuantity] = useState(10);
  const [themeMode, setThemeMode] = useState(localStorage.getItem('mode') || 'light');

  const [selectedTokens, setSelectedTokens] = useState([]);
  const [showChartModal, setShowChartModal] = useState(false);
  const [modalStock, setModalStock] = useState(null);

  const isConnected = status?.ticker_connected;
  const isServiceRunning = status?.success !== false && status?.status !== 'offline';

  const STOCKS_LIST = [
    { "symbol": "NIFTY 50", "token": 256265, "exchange": "NSE" },
    { "symbol": "ADANIENT", "token": 6401, "exchange": "NSE" },
    { "symbol": "ADANIPORTS", "token": 3861249, "exchange": "NSE" },
    { "symbol": "APOLLOHOSP", "token": 40193, "exchange": "NSE" },
    { "symbol": "ASIANPAINT", "token": 60417, "exchange": "NSE" },
    { "symbol": "AXISBANK", "token": 1510401, "exchange": "NSE" },
    { "symbol": "BAJAJ-AUTO", "token": 4267265, "exchange": "NSE" },
    { "symbol": "BAJFINANCE", "token": 81153, "exchange": "NSE" },
    { "symbol": "BAJAJFINSV", "token": 4268801, "exchange": "NSE" },
    { "symbol": "BEL", "token": 98049, "exchange": "NSE" },
    { "symbol": "BHARTIARTL", "token": 2714625, "exchange": "NSE" },
    { "symbol": "CIPLA", "token": 177665, "exchange": "NSE" },
    { "symbol": "COALINDIA", "token": 5215745, "exchange": "NSE" },
    { "symbol": "DRREDDY", "token": 225537, "exchange": "NSE" },
    { "symbol": "EICHERMOT", "token": 232961, "exchange": "NSE" },
    { "symbol": "ETERNAL", "token": 1304833, "exchange": "NSE" },
    { "symbol": "GRASIM", "token": 315393, "exchange": "NSE" },
    { "symbol": "HCLTECH", "token": 1850625, "exchange": "NSE" },
    { "symbol": "HDFCBANK", "token": 341249, "exchange": "NSE" },
    { "symbol": "HDFCLIFE", "token": 119553, "exchange": "NSE" },
    { "symbol": "HINDALCO", "token": 348929, "exchange": "NSE" },
    { "symbol": "HINDUNILVR", "token": 356865, "exchange": "NSE" },
    { "symbol": "ICICIBANK", "token": 1270529, "exchange": "NSE" },
    { "symbol": "ITC", "token": 424961, "exchange": "NSE" },
    { "symbol": "INFY", "token": 408065, "exchange": "NSE" },
    { "symbol": "INDIGO", "token": 2865921, "exchange": "NSE" },
    { "symbol": "JSWSTEEL", "token": 3001089, "exchange": "NSE" },
    { "symbol": "JIOFIN", "token": 4644609, "exchange": "NSE" },
    { "symbol": "KOTAKBANK", "token": 492033, "exchange": "NSE" },
    { "symbol": "LT", "token": 2939649, "exchange": "NSE" },
    { "symbol": "M&M", "token": 519937, "exchange": "NSE" },
    { "symbol": "MARUTI", "token": 2815745, "exchange": "NSE" },
    { "symbol": "MAXHEALTH", "token": 5728513, "exchange": "NSE" },
    { "symbol": "NTPC", "token": 2977281, "exchange": "NSE" },
    { "symbol": "NESTLEIND", "token": 4598529, "exchange": "NSE" },
    { "symbol": "ONGC", "token": 633601, "exchange": "NSE" },
    { "symbol": "POWERGRID", "token": 3834113, "exchange": "NSE" },
    { "symbol": "RELIANCE", "token": 738561, "exchange": "NSE" },
    { "symbol": "SBILIFE", "token": 5582849, "exchange": "NSE" },
    { "symbol": "SHRIRAMFIN", "token": 1102337, "exchange": "NSE" },
    { "symbol": "SBIN", "token": 779521, "exchange": "NSE" },
    { "symbol": "SUNPHARMA", "token": 857857, "exchange": "NSE" },
    { "symbol": "TCS", "token": 2953217, "exchange": "NSE" },
    { "symbol": "TATACONSUM", "token": 878593, "exchange": "NSE" },
    { "symbol": "TMPV", "token": 884737, "exchange": "NSE" },
    { "symbol": "TATASTEEL", "token": 895745, "exchange": "NSE" },
    { "symbol": "TECHM", "token": 3465729, "exchange": "NSE" },
    { "symbol": "TITAN", "token": 897537, "exchange": "NSE" },
    { "symbol": "TRENT", "token": 502785, "exchange": "NSE" },
    { "symbol": "ULTRACEMCO", "token": 2952193, "exchange": "NSE" },
    { "symbol": "WIPRO", "token": 969473, "exchange": "NSE" }
  ];

  const [activeStock, setActiveStock] = useState(STOCKS_LIST[0]); // Default NIFTY 50 index

  const TARGET_USER_ID = "MN0313";

  const fetchStatus = useCallback(async () => {
    try {
      const response = await API.get(`/intraday/status?period=${stPeriod}&multiplier=${stMultiplier}`);
      if (response.data.success) {
        // The /status endpoint returns 'instruments' array.
        // The /supertrend endpoint returns 'results' object.
        // We handle both for robustness.
        let instruments = response.data.instruments || [];
        
        if (instruments.length === 0 && response.data.results) {
          instruments = Object.keys(response.data.results).map(token => ({
            token: Number(token),
            ...response.data.results[token]
          }));
        }
        
        const updatedStatus = { ...response.data, instruments };
        setStatus(updatedStatus);
        
        // Find active stock in results
        const current = instruments.find(inst => inst.token === activeStock.token);
        if (current) {
          if (prevPrice !== null && current.ltp !== prevPrice) {
            setPriceDirection(current.ltp > prevPrice ? 'up' : 'down');
            setTimeout(() => setPriceDirection('stable'), 1000);
          }
          setPrevPrice(current.ltp);
          setLiveData(current);
        }
      } else {
        setStatus({ success: false, status: 'offline' });
      }
    } catch (err) {
      console.error("Failed to fetch intraday status", err);
      setStatus({ success: false, status: 'offline' });
      setLiveData({}); // Clear stale live data on error
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [prevPrice, stPeriod, stMultiplier, activeStock.token]);

  const fetchPaperStatus = useCallback(async () => {
    try {
      const response = await API.get('/paper/status');
      setPaperData(response.data);
    } catch (err) {
      console.error("Failed to fetch paper status", err);
    }
  }, []);

  const updateAlgoQuantity = async (qty) => {
    const val = parseInt(qty) || 1;
    setDefaultQuantity(val);
    try {
      await API.post('/algo/config', { defaultQuantity: val });
    } catch (err) {
      console.error("Failed to update algo quantity");
    }
  };

  const toggleAdaptive = async (enabled) => {
    setAdaptiveMode(enabled);
    try {
      await API.post('/algo/adaptive', { enabled });
    } catch (err) {
      console.error("Failed to toggle adaptive mode");
    }
  };

  const fetchCandles = useCallback(async () => {
    // We fetch candles even if ticker is not connected to show historical/cached data
    try {
      const response = await API.get(`/intraday/candles?token=${activeStock.token}&limit=500&period=${stPeriod}&multiplier=${stMultiplier}&user_id=${TARGET_USER_ID}`);
      if (response.data.success) {
        setChartData(response.data.candles);
      }
    } catch (err) {
      console.error("Failed to fetch candles", err);
      // Clear data on error to avoid showing stale data
      setChartData([]);
    }
  }, [activeStock.token, stPeriod, stMultiplier]);

  const fetchAlgoStatus = async () => {
    try {
      const response = await API.get('/algo/status');
      setAutoTrade(response.data.autoTradingEnabled);
      setAdaptiveMode(response.data.adaptiveMode);
      if (response.data.stPeriod) setStPeriod(response.data.stPeriod);
      if (response.data.stMultiplier) setStMultiplier(response.data.stMultiplier);
      if (response.data.effectiveMultiplier) setEffectiveMultiplier(response.data.effectiveMultiplier);
      if (response.data.defaultQuantity) setDefaultQuantity(response.data.defaultQuantity);
      
      if (response.data.autoTradeStocks) {
        const tokens = response.data.autoTradeStocks
          .map(sym => STOCKS_LIST.find(s => s.symbol === sym)?.token)
          .filter(Boolean);
        setSelectedTokens(tokens);
      }
    } catch (err) {
      console.error("Failed to fetch algo status");
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPaperStatus();
    const statusInterval = setInterval(fetchStatus, 3000);
    const paperInterval = setInterval(fetchPaperStatus, 3000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(paperInterval);
    };
  }, [fetchStatus, fetchPaperStatus]);

  useEffect(() => {
    fetchAlgoStatus();
  }, []);

  useEffect(() => {
    // Clear figures immediately when switching stocks to prevent showing "wrong" data
    setLiveData({});
    setChartData([]); // Clear the chart immediately
    setPrevPrice(null);
    setPriceDirection('stable');
    
    // If engine is already running, trigger a restart for the new stock
    if (isConnected && !starting) {
       const restart = async () => {
         await handleStop();
         // Start with the LATEST activeStock
         setTimeout(handleStart, 600); 
       };
       restart();
    }
  }, [activeStock.token]); // Only trigger when the actual stock selection changes

  useEffect(() => {
    fetchCandles();
    const candleInterval = setInterval(fetchCandles, 10000); // Update chart every 10 seconds
    return () => clearInterval(candleInterval);
  }, [fetchCandles]);

  useEffect(() => {
    const handleEsc = (event) => {
       if (event.keyCode === 27) setFullScreen(false);
    };
    window.addEventListener('keydown', handleEsc);

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const currentMode = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
      setThemeMode(currentMode);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('keydown', handleEsc);
      observer.disconnect();
    };
  }, []);

  const handleStart = async (customTokens = null, customMap = null) => {
    setStarting(true);
    setError(null);
    const tokens = customTokens || [activeStock.token];
    const tokenMap = customMap || { [activeStock.token]: { symbol: activeStock.symbol, exchange: activeStock.exchange } };

    try {
      const response = await API.post('/intraday/start', {
        user_id: TARGET_USER_ID,
        tokens: tokens,
        token_symbol_map: tokenMap,
        period: stPeriod,
        multiplier: stMultiplier
      });
      if (response.data.success) {
        fetchStatus();
      } else {
        setError(response.data.message || "Failed to start intraday service");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Connection to backend failed");
    } finally {
      setStarting(false);
    }
  };

  const handleStartAll = () => {
    // Monitor all stocks in the list (skipping NIFTY 50 index at index 0)
    const allStocks = STOCKS_LIST.slice(1); 
    const tokens = allStocks.map(s => s.token);
    const tokenMap = {};
    allStocks.forEach(s => { tokenMap[s.token] = { symbol: s.symbol, exchange: s.exchange }; });
    
    alert(`Starting Multi-Stock Monitor for ${allStocks.length} stocks. \n\nThis will take about 20-30 seconds to load historical data in the background. The algo will begin trading as soon as data is ready.`);
    
    handleStart(tokens, tokenMap);
  };

  const handleStop = async () => {
    try {
      await API.post('/intraday/stop');
      fetchStatus();
      setLiveData({});
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };

  const handlePaperOrder = async (type) => {
    const tokensToTrade = selectedTokens.length > 0 ? selectedTokens : [activeStock.token];
    
    for (const token of tokensToTrade) {
      const stock = STOCKS_LIST.find(s => s.token === token);
      const stockLiveData = status?.instruments?.find(i => i.token === token) || (token === activeStock.token ? liveData : null);
      
      if (!stockLiveData || !stockLiveData.ltp) {
        console.warn(`No live price for ${stock?.symbol || token}`);
        continue;
      }
      const position = paperData.positions.find(p => p.symbol === stock.symbol);
      let qty = tradeQuantity;

      // Special logic: If we have a position, the SELL button could mean "Close this" or "Short more"
      // Let's keep it simple: manual buttons use the 'tradeQuantity' from the input box.
      
      try {
        const response = await API.post('/paper/order', {
          symbol: stock.symbol,
          exchange: stock.exchange,
          type: type,
          quantity: qty,
          price: stockLiveData.ltp
        });
        if (response.data.success) {
          setPaperData(response.data.data);
        }
      } catch (err) {
        console.error(`Paper order failed for ${stock.symbol}`, err);
      }
    }
  };

  const toggleSelection = async (token) => {
    const stock = STOCKS_LIST.find(s => s.token === token);
    if (!stock) return;

    setSelectedTokens(prev => {
      const newTokens = prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token];
      
      // Sync symbols to backend
      const symbols = newTokens.map(t => STOCKS_LIST.find(s => s.token === t)?.symbol).filter(Boolean);
      API.post('/algo/stocks', { symbols }).catch(err => console.error("Failed to sync auto-trade stocks", err));
      
      return newTokens;
    });
  };

  const handleOpenChart = (stock) => {
    setModalStock(stock);
    setActiveStock(stock); // Switch context for chart fetching
    setShowChartModal(true);
  };

  const handleResetPaper = async () => {
    if (!window.confirm("Are you sure you want to RESET paper trading? This will clear all positions, history, and reset balance to ₹10,00,000.")) {
      return;
    }

    try {
      const response = await API.post('/paper/reset');
      await API.post('/algo/reset'); // Also reset AI memory
      if (response.data.success) {
        setPaperData(response.data.data);
      }
    } catch (err) {
      alert("Failed to reset paper trading");
    }
  };

  const handleToggleAutoTrade = async () => {
    const newState = !autoTrade;
    try {
      const response = await API.post('/algo/toggle', { enabled: newState });
      if (response.data.success) {
        setAutoTrade(newState);
      }
    } catch (err) {
      alert("Failed to toggle auto-trade");
    }
  };

  const handleToggleAdaptive = async () => {
    const newState = !adaptiveMode;
    try {
      const response = await API.post('/algo/adaptive', { enabled: newState });
      if (response.data.success) {
        setAdaptiveMode(newState);
      }
    } catch (err) {
      alert("Failed to toggle adaptive mode");
    }
  };

  const performanceData = React.useMemo(() => {
    const symbolStats = {};
    if (!paperData || !paperData.trades) return { winners: [], losers: [], totalTraded: 0 };

    // 1. Calculate stats for every symbol that has a trade or position
    paperData.trades.forEach(trade => {
      if (!symbolStats[trade.symbol]) symbolStats[trade.symbol] = { realized: 0, unrealized: 0, total: 0, trend: 'NONE', tradesCount: 0 };
      if (trade.profit !== undefined) {
        symbolStats[trade.symbol].realized += trade.profit;
      }
      symbolStats[trade.symbol].tradesCount++;
    });

    if (paperData.positions) {
      paperData.positions.forEach(pos => {
        if (!symbolStats[pos.symbol]) symbolStats[pos.symbol] = { realized: 0, unrealized: 0, total: 0, trend: 'NONE', tradesCount: 0 };
        const instrumentStatus = status?.instruments?.find(i => i.symbol === pos.symbol);
        const currentPrice = instrumentStatus ? instrumentStatus.ltp : (pos.symbol === activeStock?.symbol ? liveData.ltp : pos.avgPrice);
        const unrealized = (currentPrice - pos.avgPrice) * pos.quantity;
        symbolStats[pos.symbol].unrealized += unrealized;
        symbolStats[pos.symbol].trend = instrumentStatus?.trend || 'UP';
      });
    }

    const allPerformers = Object.keys(symbolStats).map(symbol => ({
      symbol,
      ...symbolStats[symbol],
      total: (symbolStats[symbol].realized || 0) + (symbolStats[symbol].unrealized || 0)
    }));

    const winners = allPerformers.filter(p => p.total > 0).sort((a, b) => b.total - a.total);
    const losers = allPerformers.filter(p => p.total <= 0).sort((a, b) => a.total - b.total);

    return { winners, losers, totalTraded: allPerformers.length };
  }, [paperData, status, activeStock, liveData]);

  const calculateTotalPnL = () => {
    const { winners, losers } = performanceData;
    const winTotal = winners.reduce((sum, p) => sum + p.total, 0);
    const lossTotal = losers.reduce((sum, p) => sum + p.total, 0);
    return winTotal + lossTotal;
  };

  const handleDownloadCSV = async () => {
    try {
      // Fetch all candles for the day (limit=0)
      const response = await API.get(`/intraday/candles?token=${activeStock.token}&limit=0&period=${stPeriod}&multiplier=${stMultiplier}`);
      if (response.data.success && response.data.candles) {
        const data = response.data.candles;
        
        // Define CSV headers
        let csvContent = "Time,Open,High,Low,Close,Supertrend,Trend\n";
        
        // Build CSV rows
        data.forEach(row => {
          const st = row.supertrend !== null ? row.supertrend.toFixed(2) : '';
          const trend = row.trend || '';
          csvContent += `${row.time},${row.open},${row.high},${row.low},${row.close},${st},${trend}\n`;
        });
        
        // Create Blob and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${activeStock.symbol}_Supertrend_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error("Failed to download CSV", err);
      alert("Failed to download CSV data. Is the engine running?");
    }
  };

  const handleDownloadReport = () => {
    try {
      const data = paperData.trades;
      let csvContent = "Time,Symbol,Type,Quantity,Price,EntryPrice,ExitPrice,Profit,Reason\n";
      
      [...data].reverse().forEach(t => {
        const time = new Date(t.timestamp).toLocaleString();
        const price = t.price || t.exitPrice || 0;
        const entry = t.entryPrice || '-';
        const profit = t.profit || 0;
        const reason = (t.reason || 'Manual').replace(/,/g, ';'); // Avoid breaking CSV
        csvContent += `${time},${t.symbol},${t.type},${t.quantity},${price},${entry},${t.exitPrice || '-'},${profit},${reason}\n`;
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Algohydrogen_Trade_Report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to generate report");
    }
  };

  const glassStyle = {
    background: themeMode === 'dark' ? 'rgba(23, 23, 23, 0.7)' : '#ffffff',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
    borderRadius: '15px',
    color: themeMode === 'dark' ? '#eee' : '#222'
  };

  const cardHeaderStyle = {
    background: themeMode === 'dark' ? 'rgba(30, 30, 30, 0.9)' : '#f8f9fa',
    borderBottom: `1px solid ${themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
    borderTopLeftRadius: '15px',
    borderTopRightRadius: '15px',
    padding: '15px 20px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    color: themeMode === 'dark' ? '#eee' : '#222'
  };

  if (loading && !status) {
    return (
      <MainLayout>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
          <Spinner animation="grow" variant="primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <style>{`
        body.light-mode {
          --page-bg: #f4f7f6;
          --card-bg: #ffffff;
          --text-main: #212529;
          --text-muted: #6c757d;
          --border-color: rgba(0,0,0,0.08);
          --table-hover: rgba(0,0,0,0.02);
          --stats-bg: linear-gradient(135deg, #ffffff 0%, #f1f3f5 100%);
          --header-bg: #f8f9fa;
          --input-bg: #ffffff;
        }
        body.dark-mode {
          --page-bg: #0d1117;
          --card-bg: #161b22;
          --text-main: #e6edf3;
          --text-muted: #8b949e;
          --border-color: rgba(255,255,255,0.1);
          --table-hover: rgba(255,255,255,0.03);
          --stats-bg: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
          --header-bg: #1a1a1a;
          --input-bg: #0d1117;
        }

        .theme-card {
          background: var(--card-bg) !important;
          color: var(--text-main) !important;
          border: 1px solid var(--border-color) !important;
        }
        .theme-table {
          color: var(--text-main) !important;
          background: transparent !important;
        }
        .theme-table thead th {
          background: var(--header-bg) !important;
          color: var(--text-muted) !important;
          border-bottom: 1px solid var(--border-color) !important;
        }
        .theme-table tbody tr:hover {
          background: var(--table-hover) !important;
        }
        .theme-table td {
          border-bottom: 1px solid var(--border-color) !important;
          color: var(--text-main) !important;
        }
        .stats-bar-theme {
          background: var(--stats-bg) !important;
          border-bottom: 1px solid var(--border-color) !important;
        }
        .theme-input {
          background: var(--input-bg) !important;
          color: var(--text-main) !important;
          border: 1px solid var(--border-color) !important;
        }
        .text-theme-main { color: var(--text-main) !important; }
        .text-theme-muted { color: var(--text-muted) !important; }
      `}</style>
      <Container fluid className="py-4 px-lg-4" style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        {/* Header Section */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold mb-1" style={{ fontSize: '2.2rem', background: 'linear-gradient(45deg, #FF8C00, #FFA500)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Intraday Analytics
            </h1>
            <p className="text-muted mb-0">
              Live Supertrend Tracking • <span className="text-primary">{activeStock.symbol}</span> • User: <span className={`badge ${themeMode === 'dark' ? 'bg-dark border-secondary' : 'bg-light text-dark border-light shadow-sm'}`}>{TARGET_USER_ID}</span>
            </p>
          </div>
          <div className="text-end d-flex align-items-center gap-4">
            {/* Live Scan Summary Widget */}
            {status?.instruments?.length > 0 && (
              <div className="d-flex align-items-center gap-3 px-3 py-2 rounded-3" style={{ 
                background: themeMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', 
                border: `1px solid ${themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}` 
              }}>
                <div className="text-center">
                  <div className="small text-muted fw-bold uppercase mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>SCANNING</div>
                  <div className={`fw-bold ${themeMode === 'dark' ? 'text-white' : 'text-dark'}`}>{status.instruments.length}</div>
                </div>
                <div className="vr opacity-25"></div>
                <div className="text-center">
                  <div className="small text-success fw-bold uppercase mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>UP TRENDS</div>
                  <div className="fw-bold text-success">{status.instruments.filter(i => i.trend === 'UP').length}</div>
                </div>
                <div className="vr opacity-25"></div>
                <div className="text-center">
                  <div className="small text-danger fw-bold uppercase mb-1" style={{ fontSize: '0.6rem', letterSpacing: '0.5px' }}>DOWN TRENDS</div>
                  <div className="fw-bold text-danger">{status.instruments.filter(i => i.trend === 'DOWN').length}</div>
                </div>
              </div>
            )}

            <div>
              <div className={`d-flex align-items-center justify-content-end mb-1`}>
                <div className={`pulse-dot me-2 ${isServiceRunning ? 'bg-success' : 'bg-danger'}`}></div>
                <span className={`fw-bold ${isServiceRunning ? 'text-success' : 'text-danger'}`}>
                  {isServiceRunning ? 'ENGINE RUNNING' : 'ENGINE OFFLINE'}
                </span>
                <a 
                  href="/algo_manual.html" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="ms-3 btn btn-xs btn-outline-info rounded-pill px-2 py-0 fw-bold"
                  style={{ fontSize: '0.6rem', borderStyle: 'dashed' }}
                >
                  <i className="bi bi-book me-1"></i> MANUAL
                </a>
                <Button 
                  variant="link" 
                  className="ms-1 p-0 text-info text-decoration-none"
                  onClick={() => setShowLogicModal(true)}
                  title="View Bot Logic"
                >
                  <i className="bi bi-cpu-fill fs-5"></i>
                </Button>
                <Button 
                  variant="link" 
                  className="ms-2 p-0 text-warning text-decoration-none"
                  onClick={() => setShowChecklistModal(true)}
                  title="Market Checklist"
                >
                  <i className="bi bi-journal-check fs-5"></i>
                </Button>
              </div>
              <small className="text-muted">Last sync: {lastUpdated}</small>
            </div>
          </div>
        </div>

        <Row className="g-4">
          {/* Main Dashboard Area */}
          <Col lg={12} className={fullScreen ? 'full-screen-mode' : ''}>
            <Card style={glassStyle} className={`h-100 shadow-lg border-0 overflow-hidden theme-card ${fullScreen ? 'rounded-0' : ''}`}>
              {/* PREMIUM MASTER HEADER */}
              <div style={cardHeaderStyle} className="d-flex justify-content-between align-items-center flex-wrap py-2 px-3 border-bottom shadow-sm">
                <div className="d-flex align-items-center flex-wrap gap-2">
                  {/* Stock Selector Group */}
                  <div className="d-flex align-items-center pe-2 border-end" style={{ borderColor: 'var(--glass-border) !important' }}>
                    <Dropdown onSelect={(key) => setActiveStock(STOCKS_LIST.find(s => s.symbol === key))}>
                      <Dropdown.Toggle 
                        variant="link" 
                        id="dropdown-stock" 
                        className="p-0 border-0 fw-bold fs-4 text-uppercase text-decoration-none shadow-none d-flex align-items-center"
                        style={{ color: 'var(--text-main)', cursor: 'pointer' }}
                      >
                        {activeStock.symbol}
                        <i className="bi bi-chevron-down ms-2 text-muted" style={{ fontSize: '0.8rem' }}></i>
                      </Dropdown.Toggle>

                      <Dropdown.Menu className="shadow-lg border-0 py-2 theme-card" style={{ maxHeight: '400px', overflowY: 'auto', backdropFilter: 'blur(15px)', zIndex: 10005 }}>
                        <div className="px-3 py-1 text-muted small fw-bold text-uppercase border-bottom mb-2 opacity-50" style={{ fontSize: '0.65rem' }}>Select Instrument</div>
                        {STOCKS_LIST.map(stock => (
                          <Dropdown.Item 
                            key={stock.symbol} 
                            eventKey={stock.symbol}
                            className={`px-3 py-2 ${activeStock.symbol === stock.symbol ? 'bg-primary bg-opacity-25' : ''}`}
                            style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <span>{stock.symbol}</span>
                              <Badge bg={themeMode === 'dark' ? 'dark' : 'light'} className={`ms-3 opacity-50 fw-normal ${themeMode === 'light' ? 'border border-secondary border-opacity-25' : ''}`} style={{ fontSize: '0.6rem' }}>{stock.exchange}</Badge>
                            </div>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  {/* Studies (fx) Group */}
                  <div className="d-flex align-items-center pe-2 border-end" style={{ borderColor: 'var(--glass-border) !important' }}>
                    <Dropdown autoClose="outside">
                      <Dropdown.Toggle 
                        variant="link" 
                        id="dropdown-studies" 
                        className="p-2 text-muted hover-bg-dark rounded text-decoration-none d-flex align-items-center"
                      >
                        <i className="bi bi-function fs-4"></i>
                      </Dropdown.Toggle>

                      <Dropdown.Menu className="shadow-lg border-0 py-3 px-3" style={{ minWidth: '240px', background: 'var(--glass-bg)', backdropFilter: 'blur(15px)', color: 'var(--text-main)', border: '1px solid var(--glass-border) !important' }}>
                        <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2">
                           <span className="fw-bold small text-uppercase opacity-75">Studies</span>
                           <i className="bi bi-gear-fill text-muted small"></i>
                        </div>
                        
                        <div class="mb-3">
                          <label className="text-muted fw-bold mb-2 d-block" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>SUPERTREND SETTINGS</label>
                          <div className="d-flex gap-2 mb-3">
                            <div className="flex-fill p-2 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                              <div className="small text-muted mb-1" style={{ fontSize: '0.6rem' }}>PERIOD</div>
                              <Form.Control 
                                type="number" 
                                value={stPeriod} 
                                onChange={(e) => setStPeriod(Number(e.target.value))}
                                className="bg-transparent border-0 p-0 fw-bold shadow-none text-white"
                                style={{ fontSize: '0.9rem' }}
                              />
                            </div>
                            <div className="flex-fill p-2 rounded" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)' }}>
                              <div className="small text-muted mb-1" style={{ fontSize: '0.6rem' }}>MULTIPLIER</div>
                              <Form.Control 
                                type="number" 
                                step="0.1"
                                value={stMultiplier} 
                                onChange={(e) => setStMultiplier(Number(e.target.value))}
                                className="bg-transparent border-0 p-0 fw-bold shadow-none text-white"
                                style={{ fontSize: '0.9rem' }}
                              />
                            </div>
                          </div>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="w-100 rounded fw-bold py-2 shadow-sm border-0" 
                            style={{ background: 'var(--bs-primary)', fontSize: '0.75rem' }}
                            onClick={async () => {
                              try {
                                await API.post('/algo/settings', { period: stPeriod, multiplier: stMultiplier });
                                fetchCandles();
                                if (isConnected) {
                                  // If engine is running, restart it to apply new params to live stream
                                  handleStop().then(() => setTimeout(handleStart, 500));
                                }
                              } catch (err) {
                                console.error("Failed to save settings", err);
                              }
                            }}
                          >
                            APPLY & SYNC
                          </Button>
                        </div>
                        
                        <div className="algo-controls-group">
                          <div className="qty-input-wrapper mr-3">
                            <span className="qty-label">ALGO QTY:</span>
                            <input 
                              type="number" 
                              className="algo-qty-input" 
                              value={defaultQuantity} 
                              onChange={(e) => updateAlgoQuantity(e.target.value)}
                            />
                          </div>
                          <div className={`adaptive-badge ${adaptiveMode ? 'active' : ''}`}>
                            <div className="toggle-switch small">
                              <input 
                                type="checkbox" 
                                id="adaptive-toggle" 
                                checked={adaptiveMode}
                                onChange={(e) => toggleAdaptive(e.target.checked)}
                              />
                              <label htmlFor="adaptive-toggle"></label>
                            </div>
                            <span className="ml-2">ADAPTIVE ON</span>
                            <span className="ai-multiplier-badge ml-2">AI Active: {effectiveMultiplier.toFixed(1)}x</span>
                          </div>
                        </div>

                        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                           <span className="small text-muted">Supertrend (IST)</span>
                           <Badge bg={isConnected ? "success" : "secondary"} className="opacity-75">Active</Badge>
                        </div>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>

                  {/* Tracking Control Group */}
                  <div className="d-flex align-items-center gap-3">
                    {!isConnected ? (
                      <div className="d-flex gap-2">
                        <Button 
                          variant="success" 
                          size="sm" 
                          className="rounded px-3 fw-bold border-0 shadow-sm transition-all"
                          style={{ background: '#4caf50', fontSize: '0.8rem', height: '32px' }}
                          onClick={() => handleStart()} 
                          disabled={starting || !isServiceRunning}
                        >
                          {starting ? <Spinner size="sm" animation="border" /> : "START ENGINE"}
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm" 
                          className="rounded px-3 fw-bold shadow-sm transition-all border-success text-success btn-highlight-pulse"
                          style={{ fontSize: '0.7rem', height: '32px', background: 'rgba(76, 175, 80, 0.1)' }}
                          onClick={handleStartAll} 
                          disabled={starting || !isServiceRunning}
                        >
                          <i className="bi bi-grid-3x3-gap-fill me-1"></i> MONITOR ALL
                        </Button>
                        <Button 
                          variant="outline-info" 
                          size="sm" 
                          className="rounded px-3 fw-bold shadow-sm transition-all border-info text-info"
                          style={{ fontSize: '0.7rem', height: '32px', background: 'rgba(13, 202, 240, 0.1)' }}
                          onClick={() => setShowPerformanceModal(true)} 
                        >
                          <i className="bi bi-bar-chart-line-fill me-1"></i> PERFORMANCE
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="danger" 
                        size="sm" 
                        className="rounded px-3 fw-bold border-0 shadow-sm transition-all"
                        style={{ background: '#ef5350', fontSize: '0.8rem', height: '32px' }}
                        onClick={handleStop}
                      >
                        STOP
                      </Button>
                    )}
                  </div>

                  {/* Paper Trading Controls */}
                  <div className="d-flex align-items-center gap-2 border-start ps-3" style={{ borderColor: 'var(--glass-border) !important' }}>
                    <div className="d-flex align-items-center bg-dark bg-opacity-25 rounded border border-secondary border-opacity-25 p-1 me-2" style={{ height: '32px' }}>
                      <span className="text-muted small px-2 fw-bold" style={{ fontSize: '0.65rem' }}>QTY</span>
                      <Form.Control 
                        type="number" 
                        value={tradeQuantity} 
                        onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                        className="bg-transparent border-0 p-0 fw-bold shadow-none text-white text-center"
                        style={{ width: '40px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <Button 
                      variant="success" 
                      size="sm" 
                      className="rounded px-3 fw-bold border-0 shadow-sm"
                      style={{ background: '#2e7d32', fontSize: '0.75rem', height: '32px' }}
                      onClick={() => handlePaperOrder('BUY')}
                    >
                      BUY
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm" 
                      className="rounded px-3 fw-bold border-0 shadow-sm"
                      style={{ background: '#c62828', fontSize: '0.75rem', height: '32px' }}
                      onClick={() => handlePaperOrder('SELL')}
                    >
                      SELL
                    </Button>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-4">
                  {/* High Performance Figures */}
                  {liveData.token && (
                    <div className="d-flex align-items-center gap-4">
                      <div className="text-end">
                        <div className={`fw-bold mb-0 lh-1 ${priceDirection === 'up' ? 'text-success' : priceDirection === 'down' ? 'text-danger' : ''}`} style={{ fontSize: '1.5rem' }}>
                          {liveData.ltp.toFixed(2)}
                        </div>
                        <div className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>LTP</div>
                      </div>
                      
                      <div className="text-end border-start ps-4" style={{ borderColor: 'var(--glass-border) !important' }}>
                        <div className={`fw-bold mb-0 lh-1 ${liveData.trend === 'UP' ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1.5rem' }}>
                          {liveData.supertrend?.toFixed(2) || '---'}
                        </div>
                        <div className="text-muted fw-bold" style={{ fontSize: '0.6rem', letterSpacing: '1px' }}>ST LEVEL</div>
                      </div>
                    </div>
                  )}

                  {/* Action Icons */}
                  <div className="d-flex align-items-center gap-1 border-start ps-3" style={{ borderColor: 'var(--glass-border) !important' }}>
                    <Button variant="link" size="sm" className="p-2 text-muted hover-bg-dark transition-all rounded" onClick={handleDownloadCSV} title="Download CSV Data">
                      <i className="bi bi-download fs-5"></i>
                    </Button>
                    <Button variant="link" size="sm" className="p-2 text-muted hover-bg-dark transition-all rounded" onClick={() => chartRef.current?.zoomIn()} title="Zoom In">
                      <i className="bi bi-plus-lg fs-5"></i>
                    </Button>
                    <Button variant="link" size="sm" className="p-2 text-muted hover-bg-dark transition-all rounded" onClick={() => chartRef.current?.zoomOut()} title="Zoom Out">
                      <i className="bi bi-dash-lg fs-5"></i>
                    </Button>
                    <Button variant="link" size="sm" className={`p-2 text-decoration-none transition-all rounded ${fullScreen ? 'text-primary bg-primary bg-opacity-10' : 'text-muted hover-bg-dark'}`} onClick={() => setFullScreen(!fullScreen)} title="Toggle Full Screen (Esc to exit)">
                      <i className={`bi ${fullScreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'} fs-5`}></i>
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Pro Paper Trading Status Bar */}
              <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-3" 
                style={{ 
                  background: themeMode === 'dark' 
                    ? 'linear-gradient(135deg, rgba(13, 17, 23, 0.95) 0%, rgba(22, 27, 34, 0.9) 100%)' 
                    : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                  backdropFilter: 'blur(20px)',
                  borderBottom: `1px solid ${themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'} !important`,
                  boxShadow: themeMode === 'dark' ? '0 4px 30px rgba(0, 0, 0, 0.5)' : '0 4px 15px rgba(0, 0, 0, 0.05)'
                }}>
                
                <div className="d-flex align-items-center gap-4">
                  {/* Total Equity Block */}
                  <div className="d-flex flex-column pe-4 border-end" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.15) !important' : 'rgba(0,0,0,0.1) !important' }}>
                    <span className="fw-bold mb-1" style={{ color: '#00bcd4', fontSize: '0.7rem', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Total Equity (Live)</span>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-graph-up-arrow me-2 fs-4" style={{ color: '#00bcd4' }}></i>
                      <span className="fw-bolder" style={{ color: themeMode === 'dark' ? '#ffffff' : '#212529', fontSize: '1.6rem', fontFamily: 'monospace' }}>
                        ₹{(paperData.balance + calculateTotalPnL()).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Balance Block */}
                  <div className="d-flex flex-column">
                    <span className="fw-bold mb-1" style={{ color: '#ffc107', fontSize: '0.65rem', letterSpacing: '1.2px', textTransform: 'uppercase', opacity: '0.9' }}>Available Fund</span>
                    <div className="d-flex align-items-center">
                      <i className="bi bi-wallet2 me-2 fs-5" style={{ color: '#ffc107' }}></i>
                      <span className="fw-bold" style={{ color: '#ffc107', fontSize: '1.25rem', fontFamily: 'monospace', textShadow: '0 0 15px rgba(255, 193, 7, 0.4)' }}>
                        ₹{(paperData.availableMargin || paperData.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Positions Block */}
                  <div className="d-flex flex-column border-start ps-4" style={{ borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.15) !important' : 'rgba(0,0,0,0.1) !important' }}>
                    <span className="text-warning fw-bold mb-1 opacity-75" style={{ fontSize: '0.65rem', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Active Positions</span>
                    <div className="d-flex align-items-center">
                      <i className={`bi bi-layers me-2 fs-5 ${paperData.positions.length > 0 ? 'text-warning' : 'text-muted opacity-50'}`}></i>
                      <span className={`fw-bold ${paperData.positions.length > 0 ? 'text-warning' : (themeMode === 'dark' ? 'text-white' : 'text-dark')}`} style={{ fontSize: '1.25rem', fontFamily: 'monospace' }}>
                        {paperData.positions.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-5">
                  {/* Real-time P&L Block */}
                  <div className="d-flex flex-column text-end">
                    <span className="fw-bold mb-1" style={{ color: calculateTotalPnL() >= 0 ? '#00ff00' : '#ff3131', fontSize: '0.7rem', letterSpacing: '1.2px', textTransform: 'uppercase' }}>
                      <div className="stat-card p&l">
                        <span className="stat-label">UNREALIZED P&L</span>
                        <div className={`stat-value ${paperData.unrealizedPnl >= 0 ? 'up' : 'down'}`}>
                          {paperData.unrealizedPnl >= 0 ? '▲' : '▼'} ₹{Math.abs(paperData.unrealizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </span>
                    <div className="d-flex align-items-center justify-content-end">
                      <i className={`bi ${calculateTotalPnL() >= 0 ? 'bi-caret-up-fill' : 'bi-caret-down-fill'} me-2 fs-4`} style={{ color: calculateTotalPnL() >= 0 ? '#00ff00' : '#ff3131' }}></i>
                      <span className="fw-bold" style={{ 
                        color: calculateTotalPnL() >= 0 ? '#00ff00' : '#ff3131', 
                        fontSize: '1.6rem', 
                        fontFamily: 'monospace', 
                        textShadow: themeMode === 'dark' 
                          ? (calculateTotalPnL() >= 0 ? '0 0 20px rgba(0, 255, 0, 0.6)' : '0 0 20px rgba(255, 49, 49, 0.6)')
                          : 'none'
                      }}>
                        {calculateTotalPnL() >= 0 ? '+' : ''}₹{calculateTotalPnL().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Actions Group */}
                  <div className="d-flex align-items-center gap-3">
                    {/* Algo Quantity Box */}
                    <div className={`d-flex align-items-center ${themeMode === 'dark' ? 'bg-dark bg-opacity-25' : 'bg-light'} rounded-pill px-3 py-1 border border-secondary border-opacity-25 shadow-sm`} style={{ height: '36px' }}>
                      <span className="text-muted me-2 fw-bold" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>ALGO QTY:</span>
                      <input 
                        type="number" 
                        value={defaultQuantity} 
                        onChange={(e) => updateAlgoQuantity(e.target.value)}
                        className="bg-transparent border-0 text-info fw-bold"
                        style={{ width: '45px', fontSize: '0.85rem', outline: 'none' }}
                      />
                    </div>

                    {/* Auto-Trade Toggle */}
                    <div className={`d-flex align-items-center ${themeMode === 'dark' ? 'bg-dark bg-opacity-25' : 'bg-light'} rounded-pill px-3 py-1 border border-secondary border-opacity-25 shadow-sm`} style={{ height: '36px' }}>
                      <span className={`me-2 fw-bold ${autoTrade ? 'text-success' : 'text-muted'}`} style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>
                        {autoTrade ? 'FULL AUTO ON' : 'AUTO OFF'}
                      </span>
                      <Form.Check 
                        type="switch"
                        id="auto-trade-switch"
                        checked={autoTrade}
                        onChange={handleToggleAutoTrade}
                        className="custom-switch"
                      />
                    </div>

                    {/* Adaptive Mode Toggle */}
                    <div className={`d-flex align-items-center ${themeMode === 'dark' ? 'bg-dark bg-opacity-25' : 'bg-light'} rounded-pill px-3 py-1 border border-secondary border-opacity-25 shadow-sm`} style={{ height: '36px' }}>
                      <Form.Check 
                        type="switch"
                        id="adaptive-switch"
                        label={
                          <span style={{ fontSize: '0.65rem', letterSpacing: '1px' }} className={adaptiveMode ? 'text-info' : 'text-muted'}>
                            ADAPTIVE {adaptiveMode ? 'ON' : 'OFF'}
                            {adaptiveMode && (
                              <Badge bg="info" className="ms-2" style={{ fontSize: '0.6rem' }}>
                                AI: {effectiveMultiplier.toFixed(1)}x
                              </Badge>
                            )}
                          </span>
                        }
                        checked={adaptiveMode}
                        onChange={handleToggleAdaptive}
                        className="custom-switch"
                      />
                    </div>

                    <Button 
                      variant="outline-danger" 
                      size="sm" 
                      className="rounded-pill px-3 py-1 fw-bold transition-all" 
                      style={{ fontSize: '0.7rem', border: '1px solid rgba(220, 53, 69, 0.4)', height: '32px' }} 
                      onClick={handleResetPaper}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i> RESET
                    </Button>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="p-2 text-muted text-decoration-none hover-bg-dark rounded-circle" 
                      onClick={() => setShowPaperTrades(!showPaperTrades)}
                      title={showPaperTrades ? 'Hide Details' : 'Show Details'}
                    >
                      <i className={`bi ${showPaperTrades ? 'bi-chevron-up' : 'bi-chevron-down'} fs-5`}></i>
                    </Button>
                  </div>
                </div>
              </div>

              <Card.Body className="p-0 overflow-auto" style={{ height: '600px' }}>
                <Table responsive hover className="mb-0 bg-transparent align-middle dense-table theme-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr className="text-muted small uppercase">
                      <th style={{ width: '40px' }}>
                        <Form.Check 
                          type="checkbox"
                          checked={selectedTokens.length === STOCKS_LIST.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedTokens(STOCKS_LIST.map(s => s.token));
                            else setSelectedTokens([]);
                          }}
                        />
                      </th>
                      <th>Instrument</th>
                      <th className="text-end">LTP</th>
                      <th className="text-end">Chg %</th>
                      <th className="text-end">Volume</th>
                      <th className="text-center">Trend</th>
                      <th className="text-center">Signal</th>
                      <th className="text-end">Supertrend</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STOCKS_LIST.map((stock, idx) => {
                      const inst = status?.instruments?.find(i => Number(i.token) === Number(stock.token));
                      const isSelected = selectedTokens.includes(stock.token);
                      const diff = inst?.ltp && inst?.supertrend ? ((inst.ltp - inst.supertrend) / inst.supertrend * 100).toFixed(2) : '---';
                      const chgPercent = inst?.ltp && inst?.prev_close ? (((inst.ltp - inst.prev_close) / inst.prev_close) * 100).toFixed(2) : '0.00';
                      
                      return (
                        <tr key={stock.token} className={isSelected ? 'bg-primary bg-opacity-10' : ''}>
                          <td>
                            <Form.Check 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelection(stock.token)}
                            />
                          </td>
                          <td className="fw-bold">
                            <div>{stock.symbol}</div>
                            <div className="text-muted" style={{ fontSize: '0.65rem' }}>{stock.exchange}</div>
                          </td>
                          <td className="text-end fw-bold">
                            {inst ? (
                              <span className={parseFloat(chgPercent) >= 0 ? 'text-success' : 'text-danger'}>
                                {inst.ltp.toFixed(2)}
                              </span>
                            ) : '---'}
                          </td>
                          <td className={`text-end small ${parseFloat(chgPercent) >= 0 ? 'text-success' : 'text-danger'}`}>
                            {parseFloat(chgPercent) > 0 ? '+' : ''}{chgPercent}%
                          </td>
                          <td className="text-end text-muted small">
                            {inst?.volume ? (inst.volume > 1000000 ? (inst.volume/1000000).toFixed(1)+'M' : (inst.volume/1000).toFixed(1)+'K') : '---'}
                          </td>
                          <td className="text-center">
                            {inst?.trend ? (
                              <Badge bg={inst.trend === 'UP' ? 'success' : 'danger'} className="px-2 py-1">
                                {inst.trend}
                              </Badge>
                            ) : <Badge bg="secondary" className="opacity-50">NONE</Badge>}
                          </td>
                          <td className="text-center">
                            {inst?.ltp && inst?.supertrend ? (
                              <Badge bg={inst.ltp > inst.supertrend ? 'success' : 'danger'} pill className="pulse-op" style={{ fontSize: '0.6rem' }}>
                                {inst.ltp > inst.supertrend ? 'BUY' : 'SELL'}
                              </Badge>
                            ) : '---'}
                          </td>
                          <td className="text-end">
                            {inst?.supertrend ? inst.supertrend.toFixed(1) : '---'}
                          </td>
                          <td className="text-center">
                            <Button 
                              variant="outline-info" 
                              size="sm" 
                              className="p-1 px-2 border-0"
                              onClick={() => handleOpenChart(stock)}
                              title="View Chart"
                            >
                              <i className="bi bi-graph-up fs-6"></i>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {showPaperTrades && (
          <Row className="mt-4 g-3">
            {/* Top 5 Performers Column */}
            <Col lg={4}>
              <Card style={glassStyle} className="shadow-lg border-0 h-100 theme-card">
                <div style={cardHeaderStyle} className="py-2 d-flex justify-content-between align-items-center">
                   <span>Top 5 Performers</span>
                   <Badge bg="primary" className="opacity-75">Analytics</Badge>
                </div>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0 bg-transparent theme-table">
                    <thead>
                      <tr className="text-muted small uppercase">
                        <th>Stock</th>
                        <th>Total P&L</th>
                        <th className="text-center">Logic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.winners.length === 0 ? (
                        <tr><td colSpan="3" className="text-center py-4 text-muted">Awaiting trade data...</td></tr>
                      ) : (
                        performanceData.winners.slice(0, 5).map((perf, idx) => (
                          <tr key={idx}>
                            <td className="fw-bold">{perf.symbol}</td>
                            <td className={perf.total >= 0 ? 'text-success' : 'text-danger'}>
                              ₹{perf.total.toFixed(2)}
                            </td>
                            <td className="text-center">
                              <Button 
                                variant="link" 
                                size="sm" 
                                className="p-0 text-info" 
                                onClick={() => { setSelectedPerformer(perf); setShowPerformerModal(true); }}
                              >
                                <i className="bi bi-info-circle-fill"></i>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            {/* Active Positions Column */}
            <Col lg={4}>
              <Card style={glassStyle} className="shadow-lg border-0 h-100 theme-card">
                <div style={cardHeaderStyle} className="py-2">Active Positions</div>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0 bg-transparent theme-table">
                    <thead>
                      <tr className="text-muted small uppercase">
                        <th>Symbol</th>
                        <th>Qty</th>
                        <th>LTP</th>
                        <th className="text-center">Logic</th>
                        <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperData.positions.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-4 text-muted">No active positions</td></tr>
                      ) : (
                        paperData.positions.map((pos, idx) => {
                          const instrumentStatus = status?.instruments?.find(i => i.symbol === pos.symbol);
                          const currentLtp = instrumentStatus ? instrumentStatus.ltp : (pos.symbol === activeStock.symbol ? liveData.ltp : pos.avgPrice);
                          const pnl = (currentLtp - pos.avgPrice) * pos.quantity;
                          return (
                            <tr key={idx}>
                              <td className="fw-bold">{pos.symbol}</td>
                              <td>{pos.quantity}</td>
                              <td>{(currentLtp || 0).toFixed(2)}</td>
                              <td className="text-center">
                                <Button 
                                  variant="link" 
                                  className="p-0 text-info" 
                                  onClick={() => {
                                    setSelectedTrade({ ...pos, timestamp: pos.entryTime, type: pos.quantity > 0 ? 'BUY' : 'SELL' });
                                    setShowReasonModal(true);
                                  }}
                                >
                                  <i className="bi bi-info-circle"></i>
                                </Button>
                              </td>
                              <td className={(pnl || 0) >= 0 ? 'text-success' : 'text-danger'}>
                                ₹{(pnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            {/* Trade History Column */}
            <Col lg={4}>
              <Card style={glassStyle} className="shadow-lg border-0 h-100 theme-card">
                <div style={cardHeaderStyle} className="py-2 d-flex justify-content-between align-items-center">
                  <span>Trade History</span>
                  <Button variant="outline-info" size="sm" className="px-2 py-0 fw-bold" style={{ fontSize: '0.65rem' }} onClick={handleDownloadReport}>
                    <i className="bi bi-file-earmark-arrow-down me-1"></i> CSV
                  </Button>
                </div>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0 bg-transparent theme-table">
                    <thead>
                      <tr className="text-muted small uppercase">
                        <th>Time</th>
                         <th>Stock</th>
                         <th>Type</th>
                         <th className="text-center">Logic</th>
                         <th>P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperData.trades.length === 0 ? (
                        <tr><td colSpan="5" className="text-center py-4 text-muted">No history</td></tr>
                      ) : (
                        [...paperData.trades].reverse().slice(0, 15).map((trade, idx) => (
                          <tr key={idx}>
                            <td className="small text-muted">{new Date(trade.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                            <td className="fw-bold">{trade.symbol}</td>
                            <td>
                              <Badge bg={trade.type === 'BUY' ? 'success' : 'danger'} className="px-2 py-1" style={{ fontSize: '0.6rem' }}>
                                {trade.type}
                              </Badge>
                            </td>
                            <td className="text-center">
                              <Button 
                                variant="link" 
                                className="p-0 text-info" 
                                onClick={() => {
                                  setSelectedTrade(trade);
                                  setShowReasonModal(true);
                                }}
                              >
                                <i className="bi bi-info-circle"></i>
                              </Button>
                            </td>
                            <td className={(trade.profit || 0) >= 0 ? 'text-success' : 'text-danger'}>
                              {trade.type === 'SELL' ? (trade.profit || 0).toFixed(1) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* CSS for Premium Effects */}
         <style>{`
          :root {
            --glass-bg: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --card-header-bg: rgba(255, 255, 255, 0.03);
            --text-main: #ffffff;
            --box-bg: rgba(0, 0, 0, 0.25);
            --input-bg: rgba(0, 0, 0, 0.2);
          }

          body.dark-mode {
            --glass-bg: #ffffff;
            --glass-border: #e0e0e0;
            --card-header-bg: #f8f9fb;
            --text-main: #1a1a1a;
            --box-bg: #f1f3f5;
            --input-bg: #ffffff;
          }

          .glass-panel {
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 15px;
          }

          body.dark-mode .bg-dark {
            background-color: var(--input-bg) !important;
            color: var(--text-main) !important;
            border: 1px solid #dee2e6 !important;
          }

          body.dark-mode .bg-black.bg-opacity-25 {
            background-color: var(--box-bg) !important;
            border-color: #dee2e6 !important;
          }

          body.dark-mode .text-white {
            color: var(--text-main) !important;
          }

          body.dark-mode .text-muted {
            color: #6c757d !important;
          }

          .pulse-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
            box-shadow: 0 0 0 rgba(0, 0, 0, 0.2);
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(25, 135, 84, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(25, 135, 84, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(25, 135, 84, 0); }
          }
          .pulse-infinite {
            animation: pulse-op 2s infinite;
          }
          @keyframes pulse-op {
            0% { opacity: 0.1; }
            50% { opacity: 0.3; }
            100% { opacity: 0.1; }
          }
          .btn-highlight-pulse {
            animation: btn-glow 2s infinite;
            border-width: 2px !important;
          }
          @keyframes btn-glow {
            0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7); transform: scale(1); }
            50% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); transform: scale(1.05); }
            100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); transform: scale(1); }
          }
          .hover-bg-dark:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
          }
          body.dark-mode .hover-bg-dark:hover {
            background-color: rgba(0, 0, 0, 0.05) !important;
          }
          .transition-all {
            transition: all 0.3s ease;
          }
          body.dark-mode {
            background-color: #f4f7f6 !important;
          }
          body.dark-mode .main-wrapper.dashboard-section {
            background-color: #f4f7f6 !important;
          }

          .full-screen-mode {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 10000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .full-screen-mode .card {
            height: 100vh !important;
            border-radius: 0 !important;
          }

          .dense-table td, .dense-table th {
            padding: 8px 12px !important;
            font-size: 0.85rem !important;
          }
          .dense-table tr:hover {
            background-color: rgba(255,255,255,0.05) !important;
          }
          .chart-modal .modal-content {
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 0 40px rgba(0,0,0,0.8);
          }
        `}</style>
      {/* Chart Modal */}
      <Modal 
        show={showChartModal} 
        onHide={() => setShowChartModal(false)} 
        centered 
        size="xl"
        fullscreen="lg-down"
        className="chart-modal"
      >
        <Modal.Header closeButton style={{ background: '#1a1a1a', borderBottom: '1px solid #333', color: 'white' }}>
          <Modal.Title className="fw-bold">
            <i className="bi bi-graph-up-arrow me-2 text-primary"></i>
            {modalStock?.symbol} Live Chart
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: '#121212', padding: 0 }}>
          <div style={{ height: '70vh' }}>
            {chartData.length > 0 ? (
              <TradingChart 
                ref={chartRef}
                data={chartData} 
                supertrendData={chartData} 
                symbol={modalStock?.symbol} 
                height="70vh"
              />
            ) : (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted py-5">
                <Spinner animation="border" variant="primary" className="mb-3" />
                <p>Loading historical candles for {modalStock?.symbol}...</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: '#1a1a1a', borderTop: '1px solid #333' }}>
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div className="d-flex gap-3 text-muted small">
              <span>Period: <b>{stPeriod}</b></span>
              <span>Multiplier: <b>{stMultiplier}</b></span>
            </div>
            <Button variant="secondary" onClick={() => setShowChartModal(false)}>Close</Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Trade Logic Reason Modal */}
      <Modal show={showReasonModal} onHide={() => setShowReasonModal(false)} centered size="md" className="trade-logic-modal">
        <Modal.Header closeButton style={{ background: '#1a1a1a', borderBottom: '1px solid #333', color: 'white' }}>
          <Modal.Title className="fw-bold">
            <i className="bi bi-cpu me-2 text-info"></i>
            Trade Logic: {selectedTrade?.symbol}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: '#121212', color: '#e0e0e0', padding: '25px' }}>
          {selectedTrade && (
            <div className="trade-detail-content">
              <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div>
                  <div className="small text-muted uppercase fw-bold mb-1" style={{ letterSpacing: '1px' }}>Action</div>
                  <Badge bg={selectedTrade.type === 'BUY' ? 'success' : 'danger'} className="fs-5 px-3">
                    {selectedTrade.type}
                  </Badge>
                </div>
                <div className="text-end">
                  <div className="small text-muted uppercase fw-bold mb-1" style={{ letterSpacing: '1px' }}>Time Executed</div>
                  <div className="fw-bold fs-5">{new Date(selectedTrade.timestamp || selectedTrade.entryTime).toLocaleTimeString()}</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="d-flex align-items-center gap-3">
                <Badge bg="light" text="dark" className="px-3 py-2 rounded-pill shadow-sm" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>
                  User: <span className="fw-bold">{TARGET_USER_ID}</span>
                </Badge>
              </div>
                <label className="text-info fw-bold mb-2 d-flex align-items-center" style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>
                  <i className="bi bi-info-circle me-2"></i> EXECUTION REASON
                </label>
                <div className="p-3 rounded border border-info border-opacity-25" style={{ background: 'rgba(0, 188, 212, 0.05)', fontSize: '1rem', lineHeight: '1.6' }}>
                  {selectedTrade.reason || "Manual order execution from dashboard controls."}
                </div>
              </div>

              <Row className="g-3">
                <Col xs={6}>
                  <div className="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-25">
                    <div className="small text-muted mb-1">Execution Price</div>
                    <div className="fw-bold text-white">₹{(selectedTrade.price || selectedTrade.avgPrice || selectedTrade.exitPrice || 0).toFixed(2)}</div>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-25">
                    <div className="small text-muted mb-1">Quantity</div>
                    <div className="fw-bold text-white">{Math.abs(selectedTrade.quantity)} Shares</div>
                  </div>
                </Col>
                {selectedTrade.type === 'SELL' && (
                  <>
                    <Col xs={6}>
                      <div className="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-25">
                        <div className="small text-muted mb-1">Entry Price</div>
                        <div className="fw-bold text-white">₹{selectedTrade.entryPrice?.toFixed(2)}</div>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="p-2 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-25">
                        <div className="small text-muted mb-1">Total P&L</div>
                        <div className={`fw-bold ${selectedTrade.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                          ₹{selectedTrade.profit?.toFixed(2)}
                        </div>
                      </div>
                    </Col>
                  </>
                )}
              </Row>
              
              <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 text-center">
                 <p className="text-muted small mb-0">This trade was based on the <b>Supertrend ({stPeriod}, {stMultiplier})</b> indicator strategy.</p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer style={{ background: '#1a1a1a', borderTop: '1px solid #333' }}>
          <Button variant="secondary" onClick={() => setShowReasonModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
      {/* Performer Logic Modal */}
      <Modal show={showPerformerModal} onHide={() => setShowPerformerModal(false)} centered size="md">
        <Modal.Header closeButton className="border-bottom-0">
          <Modal.Title className="fw-bold text-success">
            <i className="bi bi-graph-up-arrow me-2"></i>
            Performance Insight: {selectedPerformer?.symbol}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0 px-4 pb-4">
          {selectedPerformer && (
            <div>
              <div className="mb-4 text-center">
                <div className="display-6 fw-bold text-success mb-1">₹{selectedPerformer.total.toFixed(2)}</div>
                <div className="text-muted small uppercase">Total Accumulated Profit</div>
              </div>

              <div className="p-3 rounded border border-success border-opacity-25 mb-4" style={{ background: 'rgba(40, 167, 69, 0.05)' }}>
                <h6 className="fw-bold text-success mb-2">Why is this a Top Performer?</h6>
                <p className="small mb-0" style={{ lineHeight: '1.6' }}>
                  {selectedPerformer.symbol} has shown strong momentum with a sustained <b>{selectedPerformer.trend}</b> trend. 
                  The algo has executed <b>{selectedPerformer.tradesCount} trades</b> for this stock, successfully capturing price swings.
                  {selectedPerformer.realized > 0 ? ` Realized profit of ₹${selectedPerformer.realized.toFixed(2)} has already been booked.` : ''}
                  {selectedPerformer.unrealized > 0 ? ` Currently holding an unrealized gain of ₹${selectedPerformer.unrealized.toFixed(2)}.` : ''}
                </p>
              </div>

              <div className="d-flex justify-content-between x-small text-muted border-top pt-3">
                 <span>Strategy: Supertrend Adaptive</span>
                 <span>Status: {selectedPerformer.trend === 'UP' ? 'Bullish' : 'Neutral'}</span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPerformerModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Performance Summary Modal */}
      <Modal show={showPerformanceModal} onHide={() => setShowPerformanceModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-info"><i className="bi bi-bar-chart-line-fill me-2"></i> Today's Activity Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3 mb-4">
            <Col md={4}>
              <div className="p-3 rounded border border-secondary bg-dark bg-opacity-50 h-100 text-center">
                <div className="text-muted small uppercase fw-bold mb-1">Total Stocks Traded</div>
                <h3 className="mb-0 text-white fw-bold">{performanceData.totalTraded}</h3>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-3 rounded border border-secondary bg-dark bg-opacity-50 h-100 text-center">
                <div className="text-muted small uppercase fw-bold mb-1">Active Positions</div>
                <h3 className="mb-0 text-warning fw-bold">{paperData.positions.length}</h3>
              </div>
            </Col>
            <Col md={4}>
              <div className="p-3 rounded border border-secondary bg-dark bg-opacity-50 h-100 text-center">
                <div className="text-muted small uppercase fw-bold mb-1">Net P&L (Live)</div>
                <h3 className={`mb-0 fw-bold ${calculateTotalPnL() >= 0 ? 'text-success' : 'text-danger'}`}>
                  ₹{calculateTotalPnL().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
              </div>
            </Col>
          </Row>

          <h6 className="fw-bold mb-3 border-bottom pb-2 text-success">Profit Makers ({performanceData.winners.length})</h6>
          <Table responsive variant="dark" hover className="dense-table mb-4">
            <thead>
              <tr className="text-muted small">
                <th>Symbol</th>
                <th className="text-end">Realized</th>
                <th className="text-end">Unrealized</th>
                <th className="text-end">Total P&L</th>
                <th className="text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.winners.map(p => (
                <tr key={p.symbol}>
                  <td className="fw-bold">{p.symbol}</td>
                  <td className={`text-end ${p.realized >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.realized.toFixed(2)}</td>
                  <td className={`text-end ${p.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.unrealized.toFixed(2)}</td>
                  <td className={`text-end fw-bold ${p.total >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.total.toFixed(2)}</td>
                  <td className="text-center">
                    <Badge bg={p.trend === 'UP' ? 'success' : 'danger'}>{p.trend}</Badge>
                  </td>
                </tr>
              ))}
              {performanceData.winners.length === 0 && <tr><td colSpan="5" className="text-center text-muted small py-3">No winning trades yet</td></tr>}
            </tbody>
          </Table>

          <h6 className="fw-bold mb-3 border-bottom pb-2 text-danger">Loss Makers ({performanceData.losers.length})</h6>
          <Table responsive variant="dark" hover className="dense-table mb-0">
            <thead>
              <tr className="text-muted small">
                <th>Symbol</th>
                <th className="text-end">Realized</th>
                <th className="text-end">Unrealized</th>
                <th className="text-end">Total P&L</th>
                <th className="text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              {performanceData.losers.map(p => (
                <tr key={p.symbol}>
                  <td className="fw-bold">{p.symbol}</td>
                  <td className={`text-end ${p.realized >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.realized.toFixed(2)}</td>
                  <td className={`text-end ${p.unrealized >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.unrealized.toFixed(2)}</td>
                  <td className={`text-end fw-bold ${p.total >= 0 ? 'text-success' : 'text-danger'}`}>₹{p.total.toFixed(2)}</td>
                  <td className="text-center">
                    <Badge bg={p.trend === 'UP' ? 'success' : 'danger'}>{p.trend}</Badge>
                  </td>
                </tr>
              ))}
              {performanceData.losers.length === 0 && <tr><td colSpan="5" className="text-center text-muted small py-3">No losing trades yet</td></tr>}
            </tbody>
          </Table>
          
          <div className="text-end mt-4">
            <Button variant="outline-primary" size="sm" onClick={handleDownloadReport}>
              <i className="bi bi-file-earmark-excel me-1"></i> DOWNLOAD EXCEL REPORT
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Bot Logic Explanation Modal */}
      <Modal show={showLogicModal} onHide={() => setShowLogicModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom-0">
          <Modal.Title className="text-info"><i className="bi bi-cpu-fill me-2"></i> Algohydrogen Bot Intelligence</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0 px-4 pb-4">
          <div className="logic-diagram mb-4">
            <div className="d-flex flex-column align-items-center gap-3">
              <div className="logic-step p-3 rounded border border-info w-75 text-center bg-dark">
                <h6 className="text-info fw-bold mb-1">STEP 1: TREND DETECTION</h6>
                <small>Bot uses <b>Supertrend (10, 1.5)</b> on 1-min candles to identify primary direction.</small>
              </div>
              <i className="bi bi-arrow-down fs-4 text-muted"></i>
              <div className="logic-step p-3 rounded border border-warning w-75 text-center bg-dark">
                <h6 className="text-warning fw-bold mb-1">STEP 2: WHIPSAW PROTECTION</h6>
                <small><b>Adaptive Mode</b> monitors trend flip frequency. If noise is detected, it increases the multiplier up to <b>5.0</b> automatically.</small>
              </div>
              <i className="bi bi-arrow-down fs-4 text-muted"></i>
              <div className="logic-step p-3 rounded border border-success w-75 text-center bg-dark">
                <h6 className="text-success fw-bold mb-1">STEP 3: RSI SIGNAL FILTER</h6>
                <small>Bot checks <b>RSI (14)</b>. It skips BUY if RSI {'>'} 70 (Overbought) and skips SELL if RSI {'<'} 30 (Oversold).</small>
              </div>
              <i className="bi bi-arrow-down fs-4 text-muted"></i>
              <div className="logic-step p-3 rounded border border-primary w-75 text-center bg-dark shadow-lg">
                <h6 className="text-primary fw-bold mb-1">STEP 4: EXECUTION</h6>
                <small>Orders are placed only when all filters pass. Margin is calculated at <b>5x leverage</b> for paper trading.</small>
              </div>
            </div>
          </div>

          <div className="p-3 rounded bg-secondary bg-opacity-10 border border-secondary mt-4">
             <h6 className="fw-bold text-white"><i className="bi bi-info-circle me-2"></i> How the Bot "Thinks"</h6>
             <div className="row g-3">
               <div className="col-md-6">
                 <div className="small fw-bold text-info mb-1 uppercase">Automatic Logic</div>
                 <ul className="small text-muted ps-3 mb-0">
                   <li className="mb-1">Filters trends using RSI and Volatility.</li>
                   <li className="mb-1">Auto-scales quantities based on settings.</li>
                   <li>Closes and reverses positions instantly.</li>
                 </ul>
               </div>
               <div className="col-md-6">
                 <div className="small fw-bold text-warning mb-1 uppercase">Manual Interaction</div>
                 <ul className="small text-muted ps-3 mb-0">
                   <li className="mb-1">You can override any auto-trade at any time.</li>
                   <li className="mb-1">"Create New Trade" bypasses filters for instant entry.</li>
                   <li>"Close Existing" locks the stock from auto-re-entry.</li>
                 </ul>
               </div>
             </div>
          </div>

          <div className="mt-4 pt-3 border-top border-secondary">
             <h6 className="fw-bold text-info mb-3"><i className="bi bi-lightbulb me-2"></i> User Guidelines (Best Practices)</h6>
             <div className="row g-3">
               <div className="col-md-6">
                 <div className="p-3 rounded bg-dark border border-info border-opacity-25 h-100">
                    <div className="small fw-bold text-info mb-2">🤖 AUTO MODE TIPS</div>
                    <ul className="x-small text-muted ps-3 mb-0">
                      <li className="mb-2">Use <b>Adaptive Mode ON</b> during sideways markets to reduce noise.</li>
                      <li className="mb-2">Check the <b>Performance Modal</b> every 2 hours to monitor net P&L.</li>
                      <li>Set <b>Algo Quantity</b> to a safe level (e.g. 10-50) before going Full Auto.</li>
                    </ul>
                 </div>
               </div>
               <div className="col-md-6">
                 <div className="p-3 rounded bg-dark border border-warning border-opacity-25 h-100">
                    <div className="small fw-bold text-warning mb-2">🖐️ MANUAL MODE TIPS</div>
                    <ul className="x-small text-muted ps-3 mb-0">
                      <li className="mb-2">Use <b>Manual Entry</b> for news-based breakouts that indicators might miss.</li>
                      <li className="mb-2">If you see a trend reversal coming, use <b>Close Existing</b> ahead of the bot.</li>
                      <li>Always use <b>Reset</b> at the end of the day to clear the trade history.</li>
                    </ul>
                 </div>
               </div>
             </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top-0">
          <Button variant="outline-info" size="sm" onClick={() => setShowLogicModal(false)}>Got it, I'm ready!</Button>
        </Modal.Footer>
      </Modal>

      {/* Market Checklist Modal */}
      <Modal show={showChecklistModal} onHide={() => setShowChecklistModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom-0">
          <Modal.Title className="text-warning"><i className="bi bi-journal-check me-2"></i> Algohydrogen Market Routines</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0 px-4 pb-4">
          <div className="row g-4">
            <div className="col-md-6">
              <div className="p-3 rounded border border-info border-opacity-50 h-100 bg-dark bg-opacity-25">
                <h6 className="text-info fw-bold mb-3 d-flex align-items-center">
                  <Badge bg="info" className="me-2">AM</Badge> PRE-MARKET (9:00 - 9:15)
                </h6>
                <ul className="small text-muted ps-3">
                  <li className="mb-2 text-white"><b>Clear Session:</b> Click the <span className="text-danger">RESET</span> button to clear previous day's trades.</li>
                  <li className="mb-2 text-white"><b>Verify Connection:</b> Ensure "ENGINE RUNNING" is green and Ticker is active.</li>
                  <li className="mb-2 text-white"><b>Setup Stocks:</b> Add your top stocks to the "Auto-Trade" list.</li>
                  <li className="mb-2 text-white"><b>Margin Check:</b> Ensure your paper balance is sufficient for the day.</li>
                  <li className="text-white"><b>Logic Review:</b> Verify RSI and Adaptive settings are correct.</li>
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="p-3 rounded border border-success border-opacity-50 h-100 bg-dark bg-opacity-25">
                <h6 className="text-success fw-bold mb-3 d-flex align-items-center">
                  <Badge bg="success" className="me-2">PM</Badge> POST-MARKET (3:30 - 4:00)
                </h6>
                <ul className="small text-muted ps-3">
                  <li className="mb-2 text-white"><b>Stop Engine:</b> Turn off "Auto-Trade" to prevent after-market noise.</li>
                  <li className="mb-2 text-white"><b>Close Positions:</b> Manually close any overnight positions if needed.</li>
                  <li className="mb-2 text-white"><b>Export Report:</b> Use the <span className="text-primary">PERFORMANCE</span> modal to download your Daily Excel.</li>
                  <li className="mb-2 text-white"><b>Review Logic:</b> Check "Bottom Performers" to see if any stocks need blacklisting.</li>
                  <li className="text-white"><b>System Backup:</b> Changes are auto-saved, but verify GitHub is updated.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 rounded bg-secondary bg-opacity-10 border border-secondary text-center">
            <p className="small text-muted mb-0 italic">"Consistency is the key to algorithmic success. Follow the routine, trust the logic."</p>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top-0">
          <Button variant="outline-warning" size="sm" onClick={() => setShowChecklistModal(false)}>Understood!</Button>
        </Modal.Footer>
      </Modal>
    </Container>
    </MainLayout>
  );
};

export default IntradayPage;
