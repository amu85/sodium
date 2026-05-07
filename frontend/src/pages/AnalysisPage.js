import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Table, Form, Button, Dropdown, Spinner, Modal } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast, ToastContainer } from 'react-toastify';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';

const AnalysisPage = () => {
    const { token } = useContext(AuthContext);
    const navigate = useNavigate();
    
    // Decode token to get userId
    const userPayload = React.useMemo(() => {
        if (!token) return null;
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    }, [token]);

    const userId = userPayload?.userId || 'admin';

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stocks, setStocks] = useState([]);
    const [watchlist, setWatchlist] = useState([]);
    const [viewMode, setViewMode] = useState('Analysis'); // 'Analysis' or 'Watchlist'
    const [stats, setStats] = useState({ total: 0, verified: 0, notFound: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All Stocks');
    const [pageSize, setPageSize] = useState(50);
    const [activeIndicator, setActiveIndicator] = useState(null);
    const [supertrendData, setSupertrendData] = useState({});
    const [fetchingIndicator, setFetchingIndicator] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStocks, setSelectedStocks] = useState([]);

    // Trade Modal States
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [tradeParams, setTradeParams] = useState({
        quantity: 1,
        product: 'CNC',
        orderType: 'MARKET',
        transactionType: 'BUY'
    });
    const [targetUsers, setTargetUsers] = useState([]);
    const { users, fetchUsers } = useUsers(localStorage.getItem('token'), false);

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

    const fetchAnalysis = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/zerodha/analyze-stocks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setStocks(response.data.results);
                setStats(response.data.stats);
            }
        } catch (error) {
            console.error('Error fetching analysis:', error);
            toast.error('Failed to load stock analysis');
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshInstruments = async () => {
        if (!userId) {
            toast.error('User session not found');
            return;
        }
        try {
            setRefreshing(true);
            const token = localStorage.getItem('token');
            // Use MN0313 if admin, as admin doesn't have kite session
            const kiteUserId = userId === 'admin' ? 'MN0313' : userId;
            const response = await axios.get(`${API_BASE_URL}/zerodha/get-instruments-from-kite?user_id=${kiteUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                toast.success('Instruments refreshed successfully');
                fetchAnalysis();
            }
        } catch (error) {
            console.error('Error refreshing instruments:', error);
            toast.error('Failed to refresh instruments');
        } finally {
            setRefreshing(false);
        }
    };

    const fetchWatchlist = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/zerodha/get-watchlist`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setWatchlist(response.data.watchlist);
            }
        } catch (error) {
            console.error('Error fetching watchlist:', error);
        }
    };

    useEffect(() => {
        fetchAnalysis();
        fetchWatchlist();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (users.length > 0) {
            setTargetUsers(users.map(u => u.id));
        }
    }, [users]);

    const handleAddToWatchlist = async () => {
        if (selectedStocks.length === 0) return;

        const stockList = selectedStocks.join(', ');
        const confirmMsg = `Are you sure you want to add ${selectedStocks.length} stock${selectedStocks.length > 1 ? 's' : ''} (${stockList}) in watch list?`;
        if (window.confirm(confirmMsg)) {
            try {
                const newWatchlist = [...watchlist, ...selectedStocks];
                const token = localStorage.getItem('token');
                await axios.post(`${API_BASE_URL}/zerodha/update-watchlist`, {
                    watchlist: newWatchlist
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setWatchlist(newWatchlist);
                setSelectedStocks([]);
                toast.success('Added to watchlist');
            } catch (error) {
                toast.error('Failed to update watchlist');
            }
        }
    };

    const handleRemoveFromWatchlist = async () => {
        if (selectedStocks.length === 0) return;

        const stockList = selectedStocks.join(', ');
        const confirmMsg = `Are you sure you want to remove ${selectedStocks.length} stock${selectedStocks.length > 1 ? 's' : ''} (${stockList}) from watch list?`;
        if (window.confirm(confirmMsg)) {
            try {
                const newWatchlist = watchlist.filter(s => !selectedStocks.includes(s));
                const token = localStorage.getItem('token');
                await axios.post(`${API_BASE_URL}/zerodha/update-watchlist`, {
                    watchlist: newWatchlist
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setWatchlist(newWatchlist);
                setSelectedStocks([]);
                toast.success('Removed from watchlist');
            } catch (error) {
                toast.error('Failed to update watchlist');
            }
        }
    };

    const handleExecuteOrders = async () => {
        if (selectedStocks.length === 0 || targetUsers.length === 0) {
            toast.error('Select stocks and users to trade');
            return;
        }

        setExecuting(true);
        try {
            const token = localStorage.getItem('token');
            const selectedInstruments = stocks.filter(s => selectedStocks.includes(s.symbol));
            
            // Format instruments for API
            const instruments = selectedInstruments.map(inst => ({
                exchange: inst.exchange || 'NSE',
                instrument_token: inst.instrumentToken,
                tradingsymbol: inst.symbol,
                type: tradeParams.transactionType.toLowerCase()
            }));

            // Format users/slices for API
            const slicedOrders = [];
            targetUsers.forEach(userId => {
                const user = users.find(u => u.id === userId);
                selectedInstruments.forEach(inst => {
                    slicedOrders.push({
                        id: user.id,
                        name: user.name,
                        tradeMode: "1", // Quantity mode
                        orderType: tradeParams.orderType.toLowerCase(),
                        instrument: inst.symbol,
                        qty: tradeParams.quantity,
                        sliceNo: 1,
                        totalSlices: 1,
                        limit_price: 0, // Market order
                        orderAmount: 0,
                        product: tradeParams.product
                    });
                });
            });

            const response = await axios.post(`${API_BASE_URL}/zerodha/execute-order`, {
                users: slicedOrders,
                instruments: instruments
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                toast.success('Orders executed successfully! Redirecting to Orders page...');
                setTimeout(() => {
                    setShowTradeModal(false);
                    navigate('/orders');
                }, 2000);
            } else {
                toast.error('Failed to execute some orders');
            }
        } catch (error) {
            console.error('Trade execution error:', error);
            toast.error(error.response?.data?.message || 'Failed to execute orders');
        } finally {
            setExecuting(false);
        }
    };

    const filteredStocks = stocks.filter(stock => {
        const isInWatchlist = watchlist.includes(stock.symbol);
        
        // Mutual exclusivity: only show stocks NOT in watchlist when in Analysis mode
        // Only show stocks IN watchlist when in Watchlist mode
        if (viewMode === 'Analysis' && isInWatchlist) return false;
        if (viewMode === 'Watchlist' && !isInWatchlist) return false;

        const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             stock.companyName.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (filterType === 'Verified') return matchesSearch && stock.status === 'Verified';
        if (filterType === 'Not Found') return matchesSearch && stock.status === 'Not Found';
        return matchesSearch;
    });

    const paginatedStocks = filteredStocks.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const toggleStockSelection = (symbol) => {
        setSelectedStocks(prev => 
            prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
        );
    };

    const handleIndicatorSelect = async (indicator) => {
        if (indicator === 'Supertrend') {
            setActiveIndicator('Supertrend');
            fetchSupertrendData(paginatedStocks);
        } else {
            setActiveIndicator(null);
        }
    };

    const fetchSupertrendData = async (stocksToFetch) => {
        const tokens = stocksToFetch
            .filter(s => s.status === 'Verified' && s.instrumentToken)
            .map(s => s.instrumentToken);
        
        if (tokens.length === 0) return;

        try {
            setFetchingIndicator(true);
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_BASE_URL}/zerodha/fetch-supertrend`, {
                tokens,
                userId: userId === 'admin' ? 'MN0313' : userId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const newData = { ...supertrendData };
                response.data.results.forEach(res => {
                    newData[res.instrumentToken] = res;
                });
                setSupertrendData(newData);
            }
        } catch (error) {
            console.error('Error fetching Supertrend:', error);
            toast.error('Failed to fetch Supertrend values');
        } finally {
            setFetchingIndicator(false);
        }
    };

    useEffect(() => {
        if (activeIndicator === 'Supertrend') {
            fetchSupertrendData(paginatedStocks);
        }
    }, [currentPage, pageSize, activeIndicator]);

    return (
        <MainLayout>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h4 className="fw-bold text-dark">Stock Analysis</h4>
                <div className="d-flex gap-2">
                    <Button 
                        variant={viewMode === 'Analysis' ? "primary" : "outline-primary"} 
                        size="sm"
                        onClick={() => { setViewMode('Analysis'); setSelectedStocks([]); }}
                    >
                        Analysis List
                    </Button>
                    <Button 
                        variant={viewMode === 'Watchlist' ? "warning" : "outline-warning"} 
                        size="sm"
                        onClick={() => { setViewMode('Watchlist'); setSelectedStocks([]); }}
                        className="d-flex align-items-center"
                    >
                        <i className="bi bi-star-fill me-1"></i> Watchlist <span className="ms-1 badge bg-light text-dark">{watchlist.length}</span>
                    </Button>
                    <Button variant="outline-secondary" size="sm">
                        <i className="bi bi-gear"></i>
                    </Button>
                </div>
            </div>

            <Row className="mb-4 g-3">
                <Col md={3}>
                    <Card className="bg-white border-0 shadow-sm h-100">
                        <Card.Body>
                            <div className="text-muted small mb-1 text-uppercase fw-bold">Total Stocks</div>
                            <h2 className="mb-0 fw-bold text-dark">{stats.total}</h2>
                            <div className="text-secondary small">In screener list</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-white border-0 shadow-sm h-100 border-start border-4 border-success">
                        <Card.Body>
                            <div className="text-success small mb-1 text-uppercase fw-bold">
                                <i className="bi bi-check-circle-fill me-1"></i> Verified on Zerodha
                            </div>
                            <h2 className="mb-0 fw-bold text-dark">{stats.verified}</h2>
                            <div className="text-secondary small">NSE instrument match</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-white border-0 shadow-sm h-100 border-start border-4 border-danger">
                        <Card.Body>
                            <div className="text-danger small mb-1 text-uppercase fw-bold">
                                <i className="bi bi-x-circle-fill me-1"></i> Not Found
                            </div>
                            <h2 className="mb-0 fw-bold text-dark">{stats.notFound}</h2>
                            <div className="text-secondary small">Symbol mismatch</div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="bg-white border-0 shadow-sm h-100 border-start border-4 border-warning">
                        <Card.Body>
                            <div className="text-warning small mb-1 text-uppercase fw-bold">Selected</div>
                            <h2 className="mb-0 fw-bold text-dark">{selectedStocks.length}</h2>
                            <div className="text-secondary small">Ready for watchlist</div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="bg-white border-0 shadow-sm">
                <Card.Body>
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
                        <div className="d-flex align-items-center position-relative" style={{ minWidth: '300px' }}>
                            <i className="bi bi-search position-absolute ms-3 text-muted"></i>
                            <Form.Control 
                                type="text" 
                                placeholder="Search symbol or name..." 
                                className="ps-5 bg-light border-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="d-flex gap-2 align-items-center">
                            <Form.Select 
                                size="sm" 
                                className="bg-light border-0"
                                style={{ width: '150px' }}
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option>All Stocks</option>
                                <option>Verified</option>
                                <option>Not Found</option>
                            </Form.Select>
                            
                            <Form.Select size="sm" className="bg-light border-0" style={{ width: '120px' }}>
                                <option>All Types</option>
                                <option>EQ</option>
                                <option>F&O</option>
                            </Form.Select>
                            
                            <Form.Select 
                                size="sm" 
                                className="bg-light border-0"
                                style={{ width: '100px' }}
                                value={pageSize}
                                onChange={(e) => setPageSize(parseInt(e.target.value))}
                            >
                                <option value="50">50 / page</option>
                                <option value="100">100 / page</option>
                                <option value="200">200 / page</option>
                            </Form.Select>

                            <Button 
                                variant="outline-primary" 
                                size="sm" 
                                className="d-flex align-items-center"
                                onClick={() => fetchAnalysis()}
                                disabled={loading}
                            >
                                <i className="bi bi-arrow-repeat me-1"></i>
                                Refresh Analysis
                            </Button>

                            <Button 
                                variant="outline-primary" 
                                size="sm" 
                                className="d-flex align-items-center"
                                onClick={handleRefreshInstruments}
                                disabled={refreshing}
                            >
                                {refreshing ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-download me-1"></i>}
                                Sync Instruments
                            </Button>

                            <Dropdown>
                                <Dropdown.Toggle variant="outline-primary" size="sm" id="dropdown-indicators">
                                    {fetchingIndicator ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-graph-up me-1"></i>}
                                    {activeIndicator || 'Indicators'}
                                </Dropdown.Toggle>
                                <Dropdown.Menu>
                                    <Dropdown.Item onClick={() => handleIndicatorSelect('Supertrend')}>Supertrend</Dropdown.Item>
                                    <Dropdown.Item onClick={() => handleIndicatorSelect(null)}>None</Dropdown.Item>
                                    <Dropdown.Divider />
                                    <Dropdown.Item href="#/action-1">RSI</Dropdown.Item>
                                    <Dropdown.Item href="#/action-2">MACD</Dropdown.Item>
                                </Dropdown.Menu>
                            </Dropdown>

                            {viewMode === 'Analysis' ? (
                                <Button 
                                    variant="warning" 
                                    size="sm" 
                                    className="d-flex align-items-center"
                                    onClick={handleAddToWatchlist}
                                    disabled={selectedStocks.length === 0}
                                >
                                    <i className="bi bi-star-fill me-1"></i> Add to Watchlist ({selectedStocks.length})
                                </Button>
                            ) : (
                                <Button 
                                    variant="danger" 
                                    size="sm" 
                                    className="d-flex align-items-center"
                                    onClick={handleRemoveFromWatchlist}
                                    disabled={selectedStocks.length === 0}
                                >
                                    <i className="bi bi-trash me-1"></i> Remove from Watchlist ({selectedStocks.length})
                                </Button>
                            )}

                            <Button 
                                variant="success" 
                                size="sm" 
                                className="d-flex align-items-center"
                                onClick={() => setShowTradeModal(true)}
                                disabled={selectedStocks.length === 0}
                            >
                                <i className="bi bi-lightning-fill me-1"></i> Trade ({selectedStocks.length})
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 text-muted">Analyzing stocks...</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="align-middle">
                                <thead className="bg-light">
                                    {activeIndicator === 'Supertrend' ? (
                                        <tr>
                                            <th><Form.Check type="checkbox" /></th>
                                            <th className="text-uppercase small fw-bold text-muted">Name</th>
                                            <th className="text-uppercase small fw-bold text-muted">Trading Symbol</th>
                                            <th className="text-uppercase small fw-bold text-muted">Instrument Token</th>
                                            <th className="text-uppercase small fw-bold text-muted">Supertrend Value</th>
                                            <th className="text-uppercase small fw-bold text-muted">Trend</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th><Form.Check type="checkbox" /></th>
                                            <th className="text-uppercase small fw-bold text-muted">Symbol</th>
                                            <th className="text-uppercase small fw-bold text-muted">Company Name</th>
                                            <th className="text-uppercase small fw-bold text-muted">CSV Price</th>
                                            <th className="text-uppercase small fw-bold text-muted">Status</th>
                                            <th className="text-uppercase small fw-bold text-muted">Instrument Token</th>
                                            <th className="text-uppercase small fw-bold text-muted">Lot Size</th>
                                            <th className="text-uppercase small fw-bold text-muted">Tick</th>
                                            <th className="text-uppercase small fw-bold text-muted">Type</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {paginatedStocks.map((stock, index) => {
                                        const st = supertrendData[stock.instrumentToken];
                                        return (
                                            <tr key={index}>
                                                <td>
                                                    <Form.Check 
                                                        type="checkbox" 
                                                        checked={selectedStocks.includes(stock.symbol)}
                                                        onChange={() => toggleStockSelection(stock.symbol)}
                                                    />
                                                </td>
                                                {activeIndicator === 'Supertrend' ? (
                                                    <>
                                                        <td>{stock.companyName}</td>
                                                        <td className="text-primary fw-bold">{stock.symbol}</td>
                                                        <td className="text-muted small">{stock.instrumentToken}</td>
                                                        <td className="fw-bold">{st ? st.supertrend : (fetchingIndicator ? '...' : 'N/A')}</td>
                                                        <td>
                                                            {st ? (
                                                                <span className={`badge ${st.trend === 'UP' ? 'bg-success' : 'bg-danger'} text-white`}>
                                                                    {st.trend}
                                                                </span>
                                                            ) : (fetchingIndicator ? '...' : 'N/A')}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>
                                                            <span className="text-primary fw-bold" style={{ cursor: 'pointer' }}>
                                                                {stock.symbol}
                                                            </span>
                                                        </td>
                                                        <td>{stock.companyName}</td>
                                                        <td>₹{parseFloat(stock.csvPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                                        <td>
                                                            {stock.status === 'Verified' ? (
                                                                <span className="badge bg-success-light text-success px-2 py-1">
                                                                    <i className="bi bi-check-circle-fill me-1"></i> Verified
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-danger-light text-danger px-2 py-1">
                                                                    <i className="bi bi-x-circle-fill me-1"></i> Not Found
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="text-muted">{stock.instrumentToken}</td>
                                                        <td>{stock.lotSize}</td>
                                                        <td>{stock.tick}</td>
                                                        <td>
                                                            <span className="badge bg-light text-dark border">{stock.type}</span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    )}
                    
                    {!loading && filteredStocks.length > pageSize && (
                        <div className="d-flex justify-content-between align-items-center mt-4">
                            <div className="text-muted small">
                                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredStocks.length)} of {filteredStocks.length} entries
                            </div>
                            <div className="d-flex gap-1">
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                >
                                    Previous
                                </Button>
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    disabled={currentPage * pageSize >= filteredStocks.length}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <style dangerouslySetInnerHTML={{ __html: `
                .bg-success-light { background-color: #e8f5e9; }
                .bg-danger-light { background-color: #ffebee; }
                .card { border-radius: 8px; border: 1px solid #eee; }
                .table thead th { border-top: none; }
            `}} />
            {/* Trade Modal */}
            <Modal show={showTradeModal} onHide={() => setShowTradeModal(false)} centered size="lg">
                <Modal.Header closeButton className="bg-success text-white">
                    <Modal.Title><i className="bi bi-lightning-fill me-2"></i> Execute Trades</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4">
                    <div className="row g-4">
                        <div className="col-md-6">
                            <h6 className="fw-bold mb-3">Order Details</h6>
                            <Form.Group className="mb-3">
                                <Form.Label>Quantity per Stock</Form.Label>
                                <Form.Control 
                                    type="number" 
                                    value={tradeParams.quantity} 
                                    onChange={(e) => setTradeParams({...tradeParams, quantity: parseInt(e.target.value) || 1})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Transaction Type</Form.Label>
                                <Form.Select 
                                    value={tradeParams.transactionType} 
                                    onChange={(e) => setTradeParams({...tradeParams, transactionType: e.target.value})}
                                >
                                    <option value="BUY">BUY</option>
                                    <option value="SELL">SELL</option>
                                    <option value="SUPERTREND">SUPERTREND</option>
                                    <option value="TEMA">TEMA</option>
                                    <option value="EMA">EMA</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Product</Form.Label>
                                <Form.Select 
                                    value={tradeParams.product} 
                                    onChange={(e) => setTradeParams({...tradeParams, product: e.target.value})}
                                >
                                    <option value="CNC">CNC (Delivery)</option>
                                    <option value="MIS">MIS (Intraday)</option>
                                    <option value="NRML">NRML (Carry forward)</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Order Type</Form.Label>
                                <Form.Select 
                                    value={tradeParams.orderType} 
                                    onChange={(e) => setTradeParams({...tradeParams, orderType: e.target.value})}
                                >
                                    <option value="MARKET">MARKET</option>
                                    <option value="LIMIT">LIMIT (LTP)</option>
                                </Form.Select>
                            </Form.Group>
                        </div>
                        <div className="col-md-6">
                            <h6 className="fw-bold mb-3">Target Accounts</h6>
                            <div className="border rounded p-2 bg-light" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                {users.map(user => (
                                    <Form.Check 
                                        key={user.id}
                                        type="checkbox"
                                        label={`${user.name} (${user.user_id})`}
                                        checked={targetUsers.includes(user.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setTargetUsers([...targetUsers, user.id]);
                                            } else {
                                                setTargetUsers(targetUsers.filter(id => id !== user.id));
                                            }
                                        }}
                                        className="mb-2"
                                    />
                                ))}
                            </div>
                            <div className="mt-3 small text-muted">
                                Total selected stocks: <strong>{selectedStocks.length}</strong><br/>
                                Total accounts: <strong>{targetUsers.length}</strong><br/>
                                Total orders to place: <strong>{selectedStocks.length * targetUsers.length}</strong>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-light border-start border-4 border-warning rounded">
                        <i className="bi bi-info-circle-fill me-2 text-warning"></i>
                        Selected Stocks: <span className="fw-bold">{selectedStocks.join(', ')}</span>
                    </div>
                </Modal.Body>
                <Modal.Footer className="bg-light">
                    <Button variant="secondary" onClick={() => setShowTradeModal(false)}>Cancel</Button>
                    <Button 
                        variant="success" 
                        onClick={handleExecuteOrders}
                        disabled={executing || targetUsers.length === 0}
                        className="px-4 fw-bold"
                    >
                        {executing ? (
                            <><Spinner size="sm" animation="border" className="me-2" /> Executing...</>
                        ) : (
                            <><i className="bi bi-check-circle me-2"></i> Confirm & Execute</>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </MainLayout>
    );
};

export default AnalysisPage;
