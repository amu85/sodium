import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Table, Button, Spinner } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';
import Select from 'react-select';

const CloseExistingPage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const [loading, setLoading] = useState(false);
  const [loadingUserFund, setLoadingUserFund] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectAllUsers, setSelectAllUsers] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    instrumentTypes: {},
    names: {},
    expiries: {},
  });
  const [filters, setFilters] = useState({
    userId: '',
    instrumentType: '',
    instrumentName: '',
    instrumentExpiry: ''
  });
  const [tempFilters, setTempFilters] = useState(filters);
  const [showReview, setShowReview] = useState(false);
  const [orderType, setOrderType] = useState("market"); // "market" | "limit"
  const [limitPrices, setLimitPrices] = useState({});
  const [quantities, setQuantities] = useState({});
  const [proceedLoading, setProceedLoading] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);
  const [qtyErrors, setQtyErrors] = useState({});
  const [freezeLimits, setFreezeLimits] = useState({});
  const [sliceCounts, setSliceCounts] = useState({});

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchUserBasedInstrumentOptions = useCallback(async (users) => {
  setLoading(true);

  // Collect all tradingsymbols from holdings + positions
  const tradingsymbols = new Set();
    users.forEach(user => {
      user?.holdings?.forEach(h => {
        const qty = (h.quantity || 0) + (h.t1_quantity || 0);
        if (qty !== 0) tradingsymbols.add(h.tradingsymbol);
      });
      user?.positions?.net?.forEach(p => {
        if (p.quantity !== 0) tradingsymbols.add(p.tradingsymbol);
      });
    });

    try {
      const res = await API.get('/zerodha/user-instrument-options', {
        headers: { Authorization: `Bearer ${token}` },
        params: { tradingsymbols: Array.from(tradingsymbols) },
      });
      setFilterOptions(res.data.uniqueOptions);
    } catch (err) {
      toast.error('Failed to load user instrument options');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (users.length > 0) {
      fetchUserBasedInstrumentOptions(users);
    }
  }, [users, fetchUserBasedInstrumentOptions]);

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const filteredUsers = useMemo(() => {
    let allowedTS = null;

    if (filters.instrumentType) {
      allowedTS = new Set(filterOptions.instrumentTypes[filters.instrumentType] || []);
    }
    if (filters.name) {
      const tsForName = new Set(filterOptions.names[filters.name] || []);
      allowedTS = allowedTS
        ? new Set([...allowedTS].filter(ts => tsForName.has(ts)))
        : tsForName;
    }
    if (filters.expiry) {
      const tsForExp = new Set(filterOptions.expiries[filters.expiry] || []);
      allowedTS = allowedTS
        ? new Set([...allowedTS].filter(ts => tsForExp.has(ts)))
        : tsForExp;
    }

    return users.map(user => {
      // filter by user
      if (filters.userId && String(user.id) !== filters.userId) return null;

      // filter holdings
      const holdings = user?.holdings?.filter(h => {
        const qty = (h.quantity || 0) + (h.t1_quantity || 0);
        if (qty === 0) return false;

        if (allowedTS && !allowedTS.has(h.tradingsymbol)) return false;
        return true;
      }) || [];

      // filter positions
      const positions = user?.positions?.net?.filter(p => {
        if (p.quantity === 0) return false;

        if (allowedTS && !allowedTS.has(p.tradingsymbol)) return false;
        return true;
      }) || [];

      // if nothing left, skip user
      if (holdings.length === 0 && positions.length === 0) return null;

      return { ...user, holdings, positions: { net: positions } };
    }).filter(Boolean);
  }, [users, filters, filterOptions]);

  // Get User Fund
  const getUserFunds = useCallback(() => {
    setLoadingUserFund(true);

    API.get('/zerodha/get-user-funds', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        toast.success('Holdings and Positions Updated.');
        fetchUsers();
      })
      .catch(() => {
        toast.error('Failed to update Holdings and Positions');
        setLoadingUserFund(false);
      })
      .finally(() => {
        setLoadingUserFund(false);
      });
  }, [token, fetchUsers]);

  // Get last updated from first user (if exists)
  const lastUpdated =
    users.length > 0 ? formatDateTime(users[0].fund_last_updated_at) : '-';

  const toggleSelectAllUsers = () => {
    const newValue = !selectAllUsers;
    setSelectAllUsers(newValue);

    const updated = {};
    filteredUsers.forEach(user => {
      updated[user.id] = {
        selected: newValue,
        holdings: {},
        positions: {}
      };
      if (newValue) {
        user?.holdings?.forEach(h => {
          updated[user.id].holdings[h.instrument_token] = true;
        });
        user?.positions?.net?.forEach(p => {
          updated[user.id].positions[p.instrument_token] = true;
        });
      }
    });
    setSelectedUsers(updated);
  };

  const toggleUser = (user, value) => {
    const userId = user.id;
    const updated = { ...selectedUsers };

    // get only filtered holdings/positions for this user
    const filteredHoldings = filteredUsers.find(u => u.id === userId)?.holdings || [];
    const filteredPositions = filteredUsers.find(u => u.id === userId)?.positions?.net || [];

    updated[userId] = {
      selected: value,
      holdings: {},
      positions: {}
    };
    if (value) {
      filteredHoldings.forEach(h => {
        updated[userId].holdings[h.instrument_token] = true;
      });
      filteredPositions.forEach(p => {
        updated[userId].positions[p.instrument_token] = true;
      });
    }
    setSelectedUsers(updated);
  };

  const toggleHolding = (userId, instrument_token, value) => {
    setSelectedUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        holdings: { ...prev[userId]?.holdings, [instrument_token]: value }
      }
    }));
  };

  const togglePosition = (userId, instrument_token, value) => {
    setSelectedUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        positions: { ...prev[userId]?.positions, [instrument_token]: value }
      }
    }));
  };

  const hasAnySelection = useMemo(() => {
    return Object.values(selectedUsers).some(u =>
      u?.selected ||
      Object.values(u?.holdings || {}).some(Boolean) ||
      Object.values(u?.positions || {}).some(Boolean)
    );
  }, [selectedUsers]);

  const handleCloseExisting = () => {
    if (!hasAnySelection) {
      toast.error("No instruments selected");
      return;
    }
    setShowReview(true);
    setOrderType("market");
  };

  const handleConfirmCloseExisting = async () => {
    if (Object.keys(qtyErrors).length > 0) {
      toast.error("Fix quantity errors first");
      return;
    }

    setProceedLoading(true);
    try {
      let payload = {};
      Object.entries(selectedUsers).forEach(([userId, sel]) => {
        const hasHoldings = Object.values(sel.holdings || {}).some(Boolean);
        const hasPositions = Object.values(sel.positions || {}).some(Boolean);
        if (!sel.selected && !hasHoldings && !hasPositions) return;

        const user = users.find(u => String(u.id) === String(userId));
        if (!user) return;

          // initialize user structure
          if (!payload[userId]) {
            payload[userId] = {
              user: {
                user_id: user.id,
                name: user.name,
                orderType
              },
              instruments: [],
            };
          }

          // collect selected holdings
          Object.entries(sel.holdings || {}).forEach(([instrument_token, checked]) => {
            if (!checked) return;
            const holding = user.holdings?.find(h => h.instrument_token === Number(instrument_token));
            if (!holding) return;

            const key = `h${userId}_${instrument_token}`;
            const rowQty = Number(quantities[key] ?? ((holding?.quantity || 0) + (holding?.t1_quantity || 0)));
            const qty = Math.abs(rowQty);
            const MAX_QTY = freezeLimits[holding.name];

            if (!MAX_QTY || qty <= 0) return;

            let remaining = qty;
            let sliceNo = 1;
            const totalSlices = Math.ceil(qty / MAX_QTY);

            while (remaining > 0) {
              const sliceQty = remaining > MAX_QTY ? MAX_QTY : remaining;
              const slicePrice = orderType === "limit" ? Number(limitPrices[key] ?? holding?.last_price) : null;

              payload[userId].instruments.push({
                ...holding,
                type: rowQty > 0 ? "SELL" : "BUY",
                close_quantity: sliceQty,
                close_price: slicePrice,
                sliceNo,
                totalSlices
              });

              remaining -= sliceQty;
              sliceNo++;
            }
          });

          // collect selected positions
          Object.entries(sel.positions || {}).forEach(([instrument_token, checked]) => {
            if (!checked) return;
            const position = user.positions?.net?.find(p => p.instrument_token === Number(instrument_token));
            if (!position) return;

            const key = `p${userId}_${instrument_token}`;
            const rowQty = Number(quantities[key] ?? (position?.quantity || 0));
            const qty = Math.abs(rowQty);
            const MAX_QTY = freezeLimits[position.name];

            if (!MAX_QTY || qty <= 0) return;

            let remaining = qty;
            let sliceNo = 1;
            const totalSlices = Math.ceil(qty / MAX_QTY);

            while (remaining > 0) {
              const sliceQty = remaining > MAX_QTY ? MAX_QTY : remaining;
              const slicePrice = orderType === "limit" ? Number(limitPrices[key] ?? position?.last_price) : null;

              payload[userId].instruments.push({
                ...position,
                type: rowQty > 0 ? "SELL" : "BUY",
                close_quantity: sliceQty,
                close_price: slicePrice,
                sliceNo,
                totalSlices
              });

              remaining -= sliceQty;
              sliceNo++;
            }
          });
      });

      // console.log("payload: ", payload); return false;
      try {
        const res = await API.post(
          "/zerodha/close-existing-order",
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.data.success) {
          setExecutionResults(res.data.results);
          toast.success(res.data.message || "Orders closed, Check order results");
        } else {
          setProceedLoading(false);
          toast.error("Failed to close orders");
        }
      } catch (err) {
        setProceedLoading(false);
        console.error(err);
        toast.error(
          err.response?.data?.message ||
          err.message ||
          "Something went wrong while closing orders"
        );
      }

    } catch (error) {
      setProceedLoading(false);
      console.error("Close order error:", error);
      toast.error("Failed to close orders");
    }
  };

  useEffect(() => {
    const fetchFreezeLimits = async () => {
      try {
        const res = await API.get('/freeze-limits', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFreezeLimits(res.data.freezeLimits || {});
      } catch {
        toast.error('Failed to load freeze limits');
      }
    };

    fetchFreezeLimits();
  }, [token]);

  // helper: extract base symbol like NIFTY, SENSEX, BANKNIFTY from dynamic tradingsymbol
  const getBaseSymbol = (tradingsymbol = "") => {
    if (!tradingsymbol) return "";
    // remove exchange prefix like "BFO:" or "NFO:"
    const cleaned = tradingsymbol.replace(/^.*:/, '');
    // match leading consecutive uppercase letters (covers NIFTY, SENSEX, BANKNIFTY, etc.)
    const m = cleaned.match(/^[A-Z]+/);
    return m ? m[0] : '';
  };

  // updateSliceCount now accepts instrument object (holding or position) so it can look up freezeLimits by multiple keys
  const updateSliceCount = useCallback((key, val, instrument) => {
    // instrument may be object or string
    if (!instrument) {
      setSliceCounts(prev => {
        const newSc = { ...prev };
        delete newSc[key];
        return newSc;
      });
      return;
    }

    // Derive possible keys to lookup MAX_QTY
    const nameKey = typeof instrument === 'string' ? instrument : (instrument.name || '');
    const tradSymKey = typeof instrument === 'string' ? instrument : (instrument.tradingsymbol || '');
    const baseSymbol = getBaseSymbol(tradSymKey || nameKey);

    // Try different lookups: exact name, tradingsymbol, or base symbol
    let MAX_QTY = null;
    if (nameKey && freezeLimits[nameKey]) {
      MAX_QTY = freezeLimits[nameKey];
    } else if (tradSymKey && freezeLimits[tradSymKey]) {
      MAX_QTY = freezeLimits[tradSymKey];
    } else if (baseSymbol && freezeLimits[baseSymbol]) {
      MAX_QTY = freezeLimits[baseSymbol];
    }

    // If still no MAX_QTY, remove slice count (shows "-")
    if (!MAX_QTY || !val || val <= 0) {
      setSliceCounts(prev => {
        const newSc = { ...prev };
        delete newSc[key];
        return newSc;
      });
      return;
    }

    const slices = Math.ceil(val / MAX_QTY);
    setSliceCounts(prev => ({ ...prev, [key]: slices }));
  }, [freezeLimits]);

  useEffect(() => {
    if (!showReview) return;

    Object.entries(selectedUsers).forEach(([userId, sel]) => {
      const user = users.find(u => String(u.id) === String(userId));
      if (!user) return;

      // Holdings
      Object.entries(sel.holdings || {}).forEach(([instrument_token, checked]) => {
        if (!checked) return;
        const holding = user.holdings?.find(h => h.instrument_token === Number(instrument_token));
        if (!holding) return;

        const key = `h${userId}_${instrument_token}`;
        const qty = Math.abs(quantities[key] ?? ((holding?.quantity || 0) + (holding?.t1_quantity || 0)));

        // PASS the whole holding object
        updateSliceCount(key, qty, holding);
      });

      // Positions
      Object.entries(sel.positions || {}).forEach(([instrument_token, checked]) => {
        if (!checked) return;
        const position = user.positions?.net?.find(p => p.instrument_token === Number(instrument_token));
        if (!position) return;

        const key = `p${userId}_${instrument_token}`;
        const qty = Math.abs(quantities[key] ?? (position?.quantity || 0));

        // PASS the whole position object
        updateSliceCount(key, qty, position);
      });
    });
  }, [showReview, selectedUsers, users, quantities, updateSliceCount]);

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Close Existing</h2>
      </div>
      <div className="theme-content-wrapper">
          <p className="last-updates-text">
            Last updated at <strong>{lastUpdated}</strong>{' '}
            {loadingUserFund ? (
              <Button size="sm" variant="warning" disabled>
                <Spinner animation="border" size="sm" />
              </Button>
            ) : (
              <Button size="sm" variant="warning" onClick={getUserFunds}>
                <i className="bi bi-arrow-clockwise"></i>
              </Button>
            )}
          </p>
      </div>

      <div className="form-wrapper mb-4">
        <div className="row g-4">
          <div className="col-md-3">
            <label className="form-label">User</label>
            <div style={{ color: '#000000' }}>
              <Select
                options={[
                  { value: '', label: 'All Users' },
                  ...users.map((u) => ({
                    value: String(u.id),
                    label: u.name,
                  })),
                ]}
                value={
                  tempFilters.userId
                    ? {
                        value: String(tempFilters.userId),
                        label: users.find((u) => String(u.id) === String(tempFilters.userId))?.name || '',
                      }
                    : { value: '', label: 'All Users' }
                }
                onChange={(selected) =>
                  setTempFilters({
                    ...tempFilters,
                    userId: selected ? selected.value : '',
                  })
                }
                isClearable
              />
            </div>
          </div>
          <div className="col-md-9"></div>

          <div className="col-md-3">
            <label className="form-label">Instrument Type</label>
            <div style={{ color: '#000000' }}>
              <Select
                options={[
                  { value: '', label: 'All Types' },
                  ...Object.keys(filterOptions.instrumentTypes).map(t => ({ value: t, label: t }))
                ]}
                value={
                  tempFilters.instrumentType
                    ? { value: tempFilters.instrumentType, label: tempFilters.instrumentType }
                    : { value: '', label: 'All Types' }
                }
                onChange={(selected) =>
                  setTempFilters({ ...tempFilters, instrumentType: selected?.value || '' })
                }
                isClearable
              />
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Name</label>
            <div style={{ color: '#000000' }}>
              <Select
                options={[
                  { value: '', label: 'All Names' },
                  ...Object.keys(filterOptions.names).map(t => ({ value: t, label: t }))
                ]}
                value={
                  tempFilters.name
                    ? { value: tempFilters.name, label: tempFilters.name }
                    : { value: '', label: 'All Names' }
                }
                onChange={(selected) =>
                  setTempFilters({ ...tempFilters, name: selected?.value || '' })
                }
                isClearable
                isSearchable
              />
            </div>
          </div>

          <div className="col-md-3">
            <label className="form-label">Expiry</label>
            <div style={{ color: '#000000' }}>
              <Select
                options={[
                  { value: '', label: 'All Expiry' },
                  ...Object.keys(filterOptions.expiries).map(t => ({ value: t, label: t }))
                ]}
                value={
                  tempFilters.expiry
                    ? { value: tempFilters.expiry, label: tempFilters.expiry }
                    : { value: '', label: 'All Expiry' }
                }
                onChange={(selected) =>
                  setTempFilters({ ...tempFilters, expiry: selected?.value || '' })
                }
                isClearable
                isSearchable
              />
            </div>
          </div>

          {loading ? (
            <div className="col-md-3 d-flex">
                <Spinner animation="border" variant="warning" />
            </div>
          ) : (
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="theme-btn primary w-50 me-2"
                onClick={() => setFilters(tempFilters)}
              >
                Apply
              </button>
              <button
                className="theme-btn btn-secondary w-50"
                onClick={() => {
                  const reset = { userId: '', instrumentType: '', instrumentName: '', instrumentExpiry: '' };
                  setTempFilters(reset);
                  setFilters(reset);
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <div className="dark-table-wrap table-responsive">
          <Table className="table table-dark table-bordered">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selectAllUsers}
                    onChange={toggleSelectAllUsers}
                  />
                </th>
                <th>Name</th>
                <th className="text-end">Holdings</th>
                <th className="text-end">Positions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center">
                    No matching data found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const hasHoldings = user?.holdings && user?.holdings.length > 0;
                  const hasPositions = user?.positions?.net && user?.positions.net.length > 0;

                  // skip if nothing to show
                  if (!hasHoldings && !hasPositions) return null;

                  return (
                    <React.Fragment key={`user${user.id}`}>
                      <tr>
                        <td>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedUsers[user.id]?.selected || false}
                            onChange={(e) => toggleUser(user, e.target.checked)}
                          />
                        </td>
                        <td>{user.name} {user.is_compound ? ('(c)') : ('(nc)')}</td>
                        <td
                          className={`text-end ${
                            (user?.holdings?.reduce?.((sum, holding) => sum + (holding.pnl || 0), 0)) > 0
                              ? 'text-color-green'
                              : (user?.holdings?.reduce?.((sum, holding) => sum + (holding.pnl || 0), 0)) < 0
                              ? 'text-color-red'
                              : 'text-gray'
                          }`}
                        >
                          <span>
                            ₹ {formatAmount(
                              user?.holdings?.reduce?.((sum, holding) => sum + (holding.pnl || 0), 0)
                            )}
                          </span>
                        </td>
                        <td
                          className={`text-end ${
                            (user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)) > 0
                              ? 'text-color-green'
                              : (user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)) < 0
                              ? 'text-color-red'
                              : 'text-gray'
                          }`}
                        >
                          <span>
                            ₹ {formatAmount(
                              user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)
                            )}
                          </span>
                        </td>
                      </tr>
                      {hasHoldings && (
                        <tr className="nested-table-row">
                          <td colSpan="6">
                              <table className="table table-dark table-bordered w-100">
                                  <thead>
                                      <tr>
                                        <th className="text-center" colSpan="9">
                                          Holdings
                                          <input
                                            type="checkbox"
                                            className="form-check-input ms-2"
                                            checked={
                                              user?.holdings?.length > 0 &&
                                              user?.holdings.every(h => selectedUsers[user.id]?.holdings?.[h.instrument_token])
                                            }
                                            onChange={(e) => {
                                              const value = e.target.checked;
                                              const updated = { ...selectedUsers };
                                              updated[user.id] = {
                                                ...updated[user.id],
                                                holdings: {}
                                              };
                                              user?.holdings.forEach(h => {
                                                updated[user.id].holdings[h.instrument_token] = value;
                                              });
                                              setSelectedUsers(updated);
                                            }}
                                          />
                                        </th>
                                      </tr>
                                      <tr>
                                          <th className="text-center">#</th>
                                          <th className="text-center">Instrument</th>
                                          <th className="text-end">Qty.</th>
                                          <th className="text-end">Avg. cost</th>
                                          <th className="text-end">LTP</th>
                                          <th className="text-end">Invested</th>
                                          <th className="text-end">Cur. val</th>
                                          <th className="text-end">P&L</th>
                                          <th className="text-end">Net chg.</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {user?.holdings && user?.holdings.length === 0 ? (
                                        <tr>
                                          <td colSpan="10" className="text-center">No holding found</td>
                                        </tr>
                                      ) : (
                                        user?.holdings.map((holding, idx) => {
                                          const qty = (holding.quantity || 0) + (holding.t1_quantity || 0);
                                          const invested = holding.average_price * qty;
                                          const curVal = holding.last_price * qty;
                                          const pnl = holding.pnl;
                                          const netChg = invested !== 0 ? (pnl / invested) * 100 : 0;

                                          return (
                                            <tr key={`userHoldings${idx}`}>
                                              <td className="text-center">
                                                <input
                                                  type="checkbox"
                                                  className="form-check-input"
                                                  checked={selectedUsers[user.id]?.holdings?.[holding.instrument_token] || false}
                                                  onChange={(e) => toggleHolding(user.id, holding.instrument_token, e.target.checked)}
                                                />
                                              </td>
                                              <td className="text-center">{holding.tradingsymbol}</td>
                                              <td className={`text-end ${qty > 0 ? 'text-color-blue' : qty < 0 ? 'text-color-red' : 'text-gray'}`}>{qty}</td>
                                              <td className="text-end">{formatAmount(holding.average_price)}</td>
                                              <td className="text-end">{formatAmount(holding.last_price)}</td>
                                              <td className="text-end">{formatAmount(invested)}</td>
                                              <td className="text-end">{formatAmount(curVal)}</td>
                                              <td className={`text-end ${pnl > 0 ? 'text-color-green' : pnl < 0 ? 'text-color-red' : 'text-gray'}`}>
                                                {formatAmount(pnl)}
                                              </td>
                                              <td className={`text-end ${netChg > 0 ? 'text-color-green' : netChg < 0 ? 'text-color-red' : 'text-gray'}`}>
                                                {netChg.toFixed(2)}%
                                              </td>
                                            </tr>
                                          );
                                        })
                                      )}
                                  </tbody>
                                  <tfoot>
                                    {(() => {
                                      const totals = user?.holdings?.reduce?.(
                                        (acc, holding) => {
                                          const qty = (holding.quantity || 0) + (holding.t1_quantity || 0);
                                          const invested = holding.average_price * qty;
                                          const curVal = holding.last_price * qty;
                                          const pnl = holding.pnl;

                                          acc.invested += invested;
                                          acc.curVal += curVal;
                                          acc.pnl += pnl;
                                          return acc;
                                        },
                                        { invested: 0, curVal: 0, pnl: 0 }
                                      );

                                      const netChgTotal = totals.invested !== 0 ? (totals.pnl / totals.invested) * 100 : 0;

                                      return (
                                        <tr>
                                          <th className="text-end" colSpan="5">Total</th>
                                          <th className="text-end">{formatAmount(totals.invested)}</th>
                                          <th className="text-end">{formatAmount(totals.curVal)}</th>
                                          <th className={`text-end ${totals.pnl > 0 ? 'text-color-green' : totals.pnl < 0 ? 'text-color-red' : 'text-gray'}`}>
                                            {formatAmount(totals.pnl)}
                                          </th>
                                          <th className={`text-end ${netChgTotal > 0 ? 'text-color-green' : netChgTotal < 0 ? 'text-color-red' : 'text-gray'}`}>
                                            {netChgTotal.toFixed(2)}%
                                          </th>
                                        </tr>
                                      );
                                    })()}
                                  </tfoot>
                              </table>
                          </td>
                        </tr>
                      )}
                      {hasPositions && (
                        <tr className="nested-table-row">
                          <td colSpan="6">
                              <table className="table table-dark table-bordered w-100">
                                  <thead>
                                      <tr>
                                        <th className="text-center" colSpan="7">
                                          Positions
                                          <input
                                            type="checkbox"
                                            className="form-check-input ms-2"
                                            checked={
                                              user?.positions?.net?.length > 0 &&
                                              user?.positions.net.every(p => selectedUsers[user.id]?.positions?.[p.instrument_token])
                                            }
                                            onChange={(e) => {
                                              const value = e.target.checked;
                                              const updated = { ...selectedUsers };
                                              updated[user.id] = {
                                                ...updated[user.id],
                                                positions: {}
                                              };
                                              user?.positions.net.forEach(p => {
                                                updated[user.id].positions[p.instrument_token] = value;
                                              });
                                              setSelectedUsers(updated);
                                            }}
                                          />
                                        </th>
                                      </tr>
                                      <tr>
                                          <th className="text-center">#</th>
                                          <th className="text-center">Products</th>
                                          <th className="text-center">Instrument</th>
                                          <th className="text-end">Qty.</th>
                                          <th className="text-end">Avg.</th>
                                          <th className="text-end">LTP</th>
                                          <th className="text-end">P&L</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {user?.positions && user?.positions?.net.length === 0 ? (
                                        <tr><td colSpan="8" className="text-center">No position found</td></tr>
                                      ) : (
                                        user?.positions?.net.map((position, idx) => (
                                          <tr key={`userPositions${idx}`}>
                                            <td className="text-center">
                                              <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={selectedUsers[user.id]?.positions?.[position.instrument_token] || false}
                                                onChange={(e) => togglePosition(user.id, position.instrument_token, e.target.checked)}
                                              />
                                            </td>
                                            <td className="text-center">{position.product}</td>
                                            <td className="text-center">{position.tradingsymbol}</td>
                                            <td className={`text-end ${position.quantity > 0 ? 'text-color-blue' : position.quantity < 0 ? 'text-color-red' : 'text-gray'}`}>{position.quantity}</td>
                                            <td className="text-end">{formatAmount(position.average_price)}</td>
                                            <td className="text-end">{formatAmount(position.last_price)}</td>
                                            <td className={`text-end ${position.pnl > 0 ? 'text-color-green' : position.pnl < 0 ? 'text-color-red' : 'text-gray'}`}>{formatAmount(position.pnl)}</td>
                                          </tr>
                                        ))
                                      )}
                                  </tbody>
                                  <tfoot>
                                    <tr>
                                      <th className="text-end" colSpan="6">Total P&L</th>
                                      <th
                                        className={`text-end ${
                                          (user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)) > 0
                                            ? 'text-color-green'
                                            : (user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)) < 0
                                            ? 'text-color-red'
                                            : 'text-gray'
                                        }`}
                                      >
                                        {formatAmount(
                                          user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)
                                        )}
                                      </th>
                                    </tr>
                                  </tfoot>
                              </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        <div className={`mt-4 text-end ${hasAnySelection ? "" : "d-none"}`}>
          <button className="theme-btn primary text-center" onClick={handleCloseExisting}>
            Close Existing
          </button>
        </div>

        {showReview && (
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog modal-xl">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title review-close-existing-modal-title">
                    Review Close Existing
                    <div className="form-check form-check-inline ms-3">
                      <input
                        type="radio"
                        className="form-check-input"
                        id="marketOrder"
                        name="orderType"
                        value="market"
                        checked={orderType === "market"}
                        onChange={() => setOrderType("market")}
                      />
                      <label className="form-check-label cursor-pointer" htmlFor="marketOrder">
                        Market
                      </label>
                    </div>
                    <div className="form-check form-check-inline">
                      <input
                        type="radio"
                        className="form-check-input"
                        id="limitOrder"
                        name="orderType"
                        value="limit"
                        checked={orderType === "limit"}
                        onChange={() => setOrderType("limit")}
                      />
                      <label className="form-check-label cursor-pointer" htmlFor="limitOrder" >
                        Limit
                      </label>
                    </div>
                  </h5>
                  {!proceedLoading && (
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => {
                        setQuantities({});
                        setLimitPrices({});
                        setShowReview(false);
                        setQtyErrors({});
                      }}
                    ></button>
                  )}
                </div>
                <div className="modal-body" style={{ color: '#000000' }}>
                  {Object.entries(selectedUsers).map(([userId, sel]) => {
                    // skip user if nothing selected
                    const hasHoldings = Object.values(sel.holdings || {}).some(Boolean);
                    const hasPositions = Object.values(sel.positions || {}).some(Boolean);

                    if (!sel.selected && !hasHoldings && !hasPositions) {
                      return null;
                    }

                    const user = users.find(u => String(u.id) === String(userId));
                    if (!user) return null;

                    return (
                      <div key={userId} className="form-wrapper mb-4">
                        <h6 className="mb-2">{user.name}</h6>
                        <Table className="table table-dark table-bordered">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Trading Symbol</th>
                              <th className="text-end">Quantity</th>
                              <th className="text-end">LTP</th>
                              <th className="text-end">Slices</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Holdings */}
                            {Object.entries(sel.holdings || {}).map(([instrument_token, checked]) => {
                              if (!checked) return null;
                              const holding = user.holdings?.find(h => h.instrument_token === Number(instrument_token));
                              if (!holding) return null;

                              return (
                                <tr key={`h${instrument_token}`}>
                                  <td>Holding</td>
                                  <td>{holding.tradingsymbol}</td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min="1"
                                      max={(holding?.quantity || 0) + (holding?.t1_quantity || 0)}
                                      step={holding?.lot_size ?? 1}
                                      value={quantities[`h${userId}_${instrument_token}`] ?? ((holding?.quantity || 0) + (holding?.t1_quantity || 0))}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const maxVal = (holding?.quantity || 0) + (holding?.t1_quantity || 0);
                                        const lotSize = holding?.lot_size ?? 1;
                                        const key = `h${userId}_${instrument_token}`;

                                        setQuantities(prev => ({ ...prev, [key]: val }));

                                        // Validation
                                        if (val > maxVal) {
                                          setQtyErrors(prev => ({ ...prev, [key]: `Cannot exceed max quantity (${maxVal})` }));
                                        } else if (val % lotSize !== 0) {
                                          setQtyErrors(prev => ({ ...prev, [key]: `Must be in multiples of ${lotSize}` }));
                                        } else {
                                          setQtyErrors(prev => {
                                            const newErr = { ...prev };
                                            delete newErr[key]; // clear error
                                            return newErr;
                                          });
                                        }

                                        // Slice count updates immediately - PASS holding object
                                        updateSliceCount(key, val, holding);
                                      }}
                                      className="form-control form-control-sm text-end text-white"
                                    />

                                    {/* Error Message */}
                                    {qtyErrors[`h${userId}_${instrument_token}`] && (
                                      <small className="text-danger">{qtyErrors[`h${userId}_${instrument_token}`]}</small>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    {orderType === "limit" ? (
                                      <input
                                        type="number"
                                        step="0.05"
                                        value={limitPrices[`h${userId}_${instrument_token}`] ?? holding?.last_price ?? ""}
                                        onChange={(e) =>
                                          setLimitPrices(prev => ({
                                            ...prev,
                                            [`h${userId}_${instrument_token}`]: e.target.value
                                          }))
                                        }
                                        className="form-control form-control-sm text-end text-white"
                                      />
                                    ) : (
                                      (holding?.last_price || 0)
                                    )}
                                  </td>
                                  <td className="text-end">
                                    {sliceCounts[`h${userId}_${instrument_token}`] ?? "-"}
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Positions */}
                            {Object.entries(sel.positions || {}).map(([instrument_token, checked]) => {
                              if (!checked) return null;
                              const position = user.positions?.net?.find(p => p.instrument_token === Number(instrument_token));
                              if (!position) return null;

                              return (
                                <tr key={`p${instrument_token}`}>
                                  <td>Position</td>
                                  <td>{position.tradingsymbol}</td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min="1"
                                      max={position?.quantity || 0}
                                      step={position?.lot_size ?? 1}
                                      value={quantities[`p${userId}_${instrument_token}`] ?? (position?.quantity || 0)}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const maxVal = position?.quantity || 0;
                                        const lotSize = position?.lot_size ?? 1;
                                        const key = `p${userId}_${instrument_token}`;

                                        setQuantities(prev => ({ ...prev, [key]: val }));

                                        // Validation
                                        if (val > maxVal) {
                                          setQtyErrors(prev => ({ ...prev, [key]: `Cannot exceed max quantity (${maxVal})` }));
                                        } else if (val % lotSize !== 0) {
                                          setQtyErrors(prev => ({ ...prev, [key]: `Must be in multiples of ${lotSize}` }));
                                        } else {
                                          setQtyErrors(prev => {
                                            const newErr = { ...prev };
                                            delete newErr[key]; // clear error
                                            return newErr;
                                          });
                                        }

                                        // Slice count updates immediately - PASS position object
                                        updateSliceCount(key, val, position);
                                      }}
                                      className="form-control form-control-sm text-end text-white"
                                    />

                                    {/* Error Message */}
                                    {qtyErrors[`p${userId}_${instrument_token}`] && (
                                      <small className="text-danger">{qtyErrors[`p${userId}_${instrument_token}`]}</small>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    {orderType === "limit" ? (
                                      <input
                                        type="number"
                                        step="0.05"
                                        value={limitPrices[`p${userId}_${instrument_token}`] ?? position?.last_price ?? ""}
                                        onChange={(e) =>
                                          setLimitPrices(prev => ({
                                            ...prev,
                                            [`p${userId}_${instrument_token}`]: e.target.value
                                          }))
                                        }
                                        className="form-control form-control-sm text-end text-white"
                                      />
                                    ) : (
                                      (position?.last_price || 0)
                                    )}
                                  </td>
                                  <td className="text-end">
                                    {sliceCounts[`p${userId}_${instrument_token}`] ?? "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Table>
                      </div>
                    );
                  })}
                </div>
                <div className="modal-footer">
                  {!executionResults ? (
                    proceedLoading ? (
                      <Button size="sm" variant="warning" disabled>
                        <Spinner animation="border" size="sm" /> Please wait...
                      </Button>
                    ) : (
                      <>
                        <button
                          className="theme-btn btn-secondary"
                          onClick={() => {
                            setQuantities({});
                            setLimitPrices({});
                            setShowReview(false);
                            setQtyErrors({});
                            setSliceCounts({});
                          }}
                        >
                          Cancel
                        </button>
                        {Object.keys(qtyErrors).length === 0 && (
                          <button className="theme-btn primary" onClick={handleConfirmCloseExisting}>
                            Proceed
                          </button>
                        )}
                      </>
                    )
                  ) : (
                    <div className="w-100">
                      <h5 className="text-dark">Order Results</h5>
                      <Table className="table table-dark table-bordered">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>User</th>
                            <th>Instrument</th>
                            <th>Status</th>
                            <th>Order ID</th>
                            <th>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {executionResults.map((res, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>{res.name}</td>
                              <td>{res.instrument}</td>
                              <td className={res.success ? "text-success" : "text-danger"}>
                                {res.success ? "Success" : "Failed"}
                              </td>
                              <td>{res.order_id || "-"}</td>
                              <td>{res.error || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                      <div className="text-end">
                        <button
                          className="theme-btn primary"
                          onClick={() => {
                            // setExecutionResults(null)
                            // setProceedLoading(false);
                            // setShowReview(false);
                            getUserFunds();
                            window.location.reload();
                          }}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};

export default CloseExistingPage;
