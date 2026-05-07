import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import AsyncSelect from 'react-select/async';
import Select from 'react-select';
import ReactPaginate from 'react-paginate';
import { Button, Spinner, Table } from 'react-bootstrap';
import useUsers from '../hooks/useUsers';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { ConfigContext } from '../context/ConfigContext';

const PAGE_SIZE = 20;

const formatDate = (isoString) => {
  const date = new Date(isoString);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const CreateNewTradePage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const { config } = useContext(ConfigContext);

  const [uniqueOptions, setUniqueOptions] = useState({});
  const [filters, setFilters] = useState({});
  const [instruments, setInstruments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedInstruments, setSelectedInstruments] = useState([]);
  const [showSelected] = useState(true);
  const [marginPerLot, setMarginPerLot] = useState(true);
  const [userLots, setUserLots] = useState({});
  const [tradeMode, setTradeMode] = useState(true);
  const [tradeModeQtys, setTradeModeQtys] = useState({});
  const [tradeModeAmounts, setTradeModeAmounts] = useState({});
  const [tradePercentage, setTradePercentage] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [orderType, setOrderType] = useState("market"); // "market" | "limit"
  const [limitPrices, setLimitPrices] = useState({}); // { instrument_token: price }
  const [proceedLoading, setProceedLoading] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);
  const [freezeLimits, setFreezeLimits] = useState({});
  const [slicedOrders, setSlicedOrders] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const fetchUniqueInstrumentOptions = useCallback(() => {
    setLoading(true);
    API.get('/zerodha/unique-instrument-options', {
      headers: { Authorization: `Bearer ${token}` },
      params: filters,
    })
      .then((res) => {
        setUniqueOptions(res.data.uniqueOptions);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load filter options');
        setLoading(false);
      });
  }, [token, filters]);

  useEffect(() => {
    fetchUniqueInstrumentOptions();
  }, [fetchUniqueInstrumentOptions]);

  const fetchInstruments = (page = 1) => {
    setLoading(true);
    const params = { ...filters, page, pageSize: PAGE_SIZE };
    API.get('/zerodha/instruments', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    })
      .then((res) => {
        setInstruments(res.data.instruments || []);
        setTotalCount(res.data.count || 0);
        setCurrentPage(page);
        setLoading(false);
      })
      .catch(() => toast.error('Failed to load instruments'));
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSelect = (instrument, type) => {

    // Check first user id
    if (users && !users[0].user_id) {
      toast.error("No user selected");
      return;
    }

    // Check if we already have instruments selected
    if (selectedInstruments.length > 0) {
      const firstName = selectedInstruments[0].name;
      if (instrument.name !== firstName) {
        toast.error(`You can only select instruments with name "${firstName}"`);
        return;
      }
    }

    // Check for Equity allow buy only
    if (instrument.exchange !== "BFO" && instrument.exchange !== "NFO" && type === 'sell') {
      toast.error(`You can only buy instruments for Equity`);
      return;
    }

    API.post("/zerodha/get-ltp-from-kite",
      {
        user_id: users[0].user_id,
        instruments: [`${instrument.exchange}:${instrument.tradingsymbol}`],
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    .then((res) => {
      const ltpData = res.data.ltp;
      const key = `${instrument.exchange}:${instrument.tradingsymbol}`;
      const ltp = ltpData[key]?.last_price || null;

      setSelectedInstruments((prev) => {
        const existing = prev.find(i => i.instrument_token === instrument.instrument_token);

        if (existing && existing.type === type) {
          return prev.filter(i => i.instrument_token !== instrument.instrument_token);
        }

        if (existing) {
          return prev.map(i =>
            i.instrument_token === instrument.instrument_token
              ? { ...i, type, ltp }
              : i
          );
        }

        return [...prev, { ...instrument, type, ltp }];
      });
    })
    .catch(() => {
      toast.error("Failed to load LTP");
    });
  };

  // Calculate earliest expiry remaining days
  const remainingDays = useMemo(() => {
    if (!selectedInstruments || selectedInstruments.length === 0) return null;

    const earliestExpiry = selectedInstruments
      .map(item => new Date(item.expiry))
      .sort((a, b) => a - b)[0];

    if (!earliestExpiry) return null;

    const today = new Date();
    const diffTime = earliestExpiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  }, [selectedInstruments]);

  useEffect(() => {
    console.log("Selected instruments updated:", selectedInstruments);
  }, [selectedInstruments]);

  const handleLotChange = (userId, lots) => {
    setUserLots((prev) => ({
      ...prev,
      [userId]: Number(lots) || 0,
    }));
  };

  const handleQtyChange = (userId, tradeModeQty) => {
    setTradeModeQtys((prev) => ({
      ...prev,
      [userId]: Number(tradeModeQty) || 0,
    }));
  };

  const handleAmountChange = (userId, tradeModeAmount) => {
    setTradeModeAmounts((prev) => ({
      ...prev,
      [userId]: Number(tradeModeAmount) || 0,
    }));
  };

  // Calculate Lots wise order amount for a user
  const calculateLotsOrderAmount = (userId) => {
    const lots = userLots[userId] || 0;
    const tradeModeQty = tradeModeQtys[userId] || 0;
    const tradeModeAmount = tradeModeAmounts[userId] || 0;
    const orderMargin = config?.orderMargin || 0;
    if (selectedInstruments.length === 0) return 0;

    const inst = selectedInstruments[0];
    let ltp =
      orderType === "limit"
        ? (limitPrices[inst.instrument_token] || 0)
        : inst.ltp;

    if (orderType === "limit" && (!ltp || ltp <= 0)) {
      return { orderAmount: 0, qty: 0 }; // block invalid
    }
    let orderAmount = 0;
    let qty = 0;

    if (inst.exchange === "BFO" || inst.exchange === "NFO") {
      // Derivatives: margin per lot
      orderAmount = lots * marginPerLot;

    } else if (tradeMode === "1") {
      // Quantity mode
      orderAmount = tradeModeQty * ltp;

    } else if (tradeMode === "2") {
      // Amount mode
      qty = parseInt(Math.floor(tradeModeAmount / ltp));
      orderAmount = qty * ltp;

    } else if (tradeMode === "3") {
      // Percentage mode
      const user = users.find(u => u.id === userId);
      if (!user) return 0;

      const portfolio = user.trading_funds || 0;
      const percentageAmount = (tradePercentage / 100) * portfolio;
      qty = parseInt(Math.floor(percentageAmount / ltp));
      orderAmount = qty * ltp;

    } else {
      orderAmount = ltp * lots;
    }

    // Increase Configuration Order Margin % Amount
    if(orderAmount > 0 && orderMargin > 0) {
      orderAmount = orderAmount + (orderMargin * orderAmount / 100);
    }

    return { orderAmount, qty };
  };

  const handleRefreshLTP = () => {
    if (!users || users.length === 0) {
      toast.error("No user selected");
      return;
    }

    if (selectedInstruments.length === 0) {
      toast.error("No instruments selected");
      return;
    }

    setRefreshing(true);

    const userId = users[0].user_id;
    const instrumentsList = selectedInstruments.map(
      (inst) => `${inst.exchange}:${inst.tradingsymbol}`
    );

    API.post(
      "/zerodha/get-ltp-from-kite",
      {
        user_id: userId,
        instruments: instrumentsList,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((res) => {
        const ltpData = res.data.ltp || {};

        setSelectedInstruments((prev) =>
          prev.map((inst) => {
            const key = `${inst.exchange}:${inst.tradingsymbol}`;
            const newLtp = ltpData[key]?.last_price || inst.ltp;
            return { ...inst, ltp: newLtp };
          })
        );

        toast.success("LTP refreshed successfully");
      })
      .catch(() => {
        toast.error("Failed to refresh LTP");
      })
      .finally(() => {
        setRefreshing(false);
      });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reordered = Array.from(selectedInstruments);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setSelectedInstruments(reordered);
  };

  const handleExecute = () => {
    if (selectedInstruments.length === 0) {
      toast.error("No instruments selected");
      return;
    }

    if (orderType === "limit") {
      const missingPrices = selectedInstruments.filter(
        (inst) => !limitPrices[inst.instrument_token] || limitPrices[inst.instrument_token] <= 0
      );

      if (missingPrices.length > 0) {
        toast.error("Please enter a valid limit price for all selected instruments");
        return;
      }
    }

    // build sliced orders here
    let setQuantityFreeze = 1;
    const slices = users.flatMap((user) => {
      const { orderAmount, qty } = calculateLotsOrderAmount(user.id);
      const inst = selectedInstruments[0];

      const value =
        selectedInstruments.some(
          (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
        )
          ? (userLots[user.id] * inst.lot_size) || 0
          : tradeMode === "1"
          ? tradeModeQtys[user.id] || 0
          : qty;

      if (value <= 0) return [];

      const ltp =
        orderType === "limit"
          ? limitPrices[inst.instrument_token] || 0
          : inst.ltp;

      // enforce freeze limit
      const MAX_QTY = freezeLimits[inst.name];
      if (!MAX_QTY || Number(MAX_QTY) <= 0) {
        toast.error(`Please set Quantity Freeze Limit for ${inst.name}`);
        setQuantityFreeze = 0;
        return [];
      }

      const sliced = [];
      let remaining = value;
      let sliceNo = 1;

      while (remaining > 0) {
        const sliceQty = remaining > MAX_QTY ? MAX_QTY : remaining;
        sliced.push({
          id: user.id,
          name: user.name,
          tradeMode: tradeMode,
          orderType: orderType,
          instrument: inst.tradingsymbol,
          qty: sliceQty,
          sliceNo,
          totalSlices: Math.ceil(value / MAX_QTY),
          limit_price: ltp,
          orderAmount,
        });
        remaining -= sliceQty;
        sliceNo++;
      }

      return sliced;
    });

    if(setQuantityFreeze === 1){
      setSlicedOrders(slices);
      setShowReview(true);
    }
  };

  const handleConfirmExecute = async () => {
    setProceedLoading(true);
    try {
      const payload = {
        instruments: selectedInstruments.map((inst) => ({
          exchange: inst.exchange,
          instrument_token: inst.instrument_token,
          tradingsymbol: inst.tradingsymbol,
          type: inst.type,
          ltp: inst.ltp,
          lots: inst.lots,
        })),
        users: slicedOrders, // send already-sliced orders
      };

      // console.log("payload: ", payload); return false;
      try {
        const res = await API.post(
          "/zerodha/execute-order",
          payload,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.data.success) {
          setExecutionResults(res.data.results);
          toast.success(res.data.message || "Orders executed, Check order results");

        } else {
          setProceedLoading(false);
          toast.error("Failed to execute orders");
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
      console.error("Execute order error:", error);
      toast.error("Failed to execute orders");
    }
  };

  const handleIndexSelect = async (indexName, exchange, segment) => {
    const autoFilters = {
      exchange: [exchange],
      segment: [segment],
      name: [indexName]
    };

    setFilters(autoFilters);
  };

  const getATMStrike = (ltp, strikeMultiple = 50) => {
    if (!ltp) return null;
    return Math.round(ltp / strikeMultiple) * strikeMultiple;
  };

  const handleCombo = async (indexName) => {
    if (!users || users.length === 0) {
      toast.error("No user selected");
      return;
    }

    const userId = users[0].user_id;
    const indexSymbol = { NIFTY: "NSE:NIFTY 50", BANKNIFTY: "NSE:NIFTY BANK", SENSEX: "BSE:SENSEX" }[indexName];
    const strikeMultiple = { NIFTY: 50, BANKNIFTY: 100, SENSEX: 100 }[indexName];

    try {
      // Get LTP for ATM
      const ltpRes = await API.post(
        "/zerodha/get-ltp-from-kite",
        { user_id: userId, instruments: [indexSymbol] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const ltp = ltpRes.data?.ltp?.[indexSymbol]?.last_price;
      const atm = getATMStrike(ltp, strikeMultiple);
      if (!atm) {
        toast.error("Failed to calculate ATM strike");
        return;
      }

      // Define combo strikes
      const strikes = [
        { strike: atm + strikeMultiple, type: "CE", action: "buy" },
        { strike: atm - strikeMultiple, type: "PE", action: "buy" },
        { strike: atm, type: "CE", action: "sell" },
        { strike: atm, type: "PE", action: "sell" },
      ];

      // Fetch option instruments
      const res = await API.get("/zerodha/instruments", {
        headers: { Authorization: `Bearer ${token}` },
        params: { name: indexName, expiry: filters.expiry, pageSize: 40 }
      });

      const allOptions = res.data.instruments || [];
      const comboKeys = [];

      // Find instruments matching legs
      strikes.forEach(({ strike, type }) => {
        const match = allOptions.find(
          (i) =>
            i.strike === strike &&
            i.instrument_type === type &&
            i.name === indexName
        );
        if (match)
          comboKeys.push(`${match.exchange}:${match.tradingsymbol}`);
      });

      if (comboKeys.length !== 4) {
        toast.error(`Unable to build complete ${indexName} combo.`);
        return;
      }

      // Fetch LTP for all combo legs
      const comboLtpRes = await API.post(
        "/zerodha/get-ltp-from-kite",
        { user_id: userId, instruments: comboKeys },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const ltpData = comboLtpRes.data.ltp;

      // Map combo legs to instruments with updated LTP
      const selectedLegs = comboKeys.map((key, i) => {
        const inst = allOptions.find(
          (x) => `${x.exchange}:${x.tradingsymbol}` === key
        );
        return {
          ...inst,
          type: strikes[i].action,
          ltp: ltpData[key]?.last_price
        };
      });

      setSelectedInstruments(selectedLegs);
      toast.success(`${indexName} Combo Added`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate combo");
    }
  };

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4 d-flex justify-content-between align-items-center">
        <h2 className="page-title">Create New Trade</h2>

        <div className="d-flex gap-2">
          <button className="theme-btn default" onClick={() => handleIndexSelect("NIFTY", "NFO", "NFO-OPT")}>
            NIFTY
          </button>
          <button className="theme-btn default" onClick={() => handleIndexSelect("SENSEX", "BFO", "BFO-OPT")}>
            SENSEX
          </button>
          <button className="theme-btn default" onClick={() => handleIndexSelect("BANKNIFTY", "NFO", "NFO-OPT")}>
            BANKNIFTY
          </button>
        </div>
      </div>

      <div className="form-wrapper">
        <div className="row g-4">
          {Object.keys(uniqueOptions).map((key) => (
            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-6" key={key}>
              <label className="form-label text-capitalize">
                {key.replace(/_/g, ' ')}
              </label>

              <div style={{ color: '#000000' }}>
                {(key !== 'expiry') ? (
                  <AsyncSelect
                    isMulti
                    cacheOptions={false}
                    defaultOptions={(uniqueOptions[key] || [])
                      .slice(0, 100)
                      .map((v) => ({ label: v.toString(), value: v.toString() }))
                    }
                    loadOptions={(inputValue, callback) => {
                      const filtered = (uniqueOptions[key] || [])
                        .filter((v) =>
                          v.toString().toLowerCase().includes(inputValue.toLowerCase())
                        )
                        .slice(0, 100)
                        .map((v) => ({ label: v.toString(), value: v.toString() }));

                      callback(filtered);
                    }}
                    value={(filters[key] || []).map((v) => ({ label: v, value: v }))}
                    onChange={(selectedOptions) => {
                      const selectedValues = selectedOptions?.map((s) => s.value) || [];
                      setFilters((prev) => ({ ...prev, [key]: selectedValues }));
                    }}
                    isClearable
                  />
                ) : (
                  <Select
                    options={[
                      { label: 'All', value: '' },
                      ...uniqueOptions[key].map((v) => ({
                        label: formatDate(v),
                        value: formatDate(v),
                      }))
                    ]}
                    value={
                      filters[key]
                        ? { label: filters[key], value: filters[key] }
                        : { label: 'All', value: '' }
                    }
                    onChange={(selected) =>
                      setFilters((prev) => ({ ...prev, [key]: selected?.value || '' }))
                    }
                    isClearable
                  />
                )}
              </div>
            </div>
          ))}

          {loading ? (
            <div className="col-md-3 d-flex">
                <Spinner animation="border" variant="warning" />
            </div>
          ) : (
            <div className="col-md-3 d-flex align-items-end">
              <button
                className="theme-btn primary w-50 me-2"
                onClick={() => fetchInstruments(1)}
              >
                Apply
              </button>
              <button
                className="theme-btn btn-secondary w-50"
                onClick={() => {
                  setFilters({});
                  fetchUniqueInstrumentOptions();
                }}
              >
                Reset
              </button>
            </div>
          )}

          {filters?.name?.length > 0 && filters?.expiry && (
            <>
              <div className="col-md-9 d-flex align-items-end"></div>
              <div className="col-md-3 d-flex align-items-end">
                <button
                  className="theme-btn primary w-100"
                  onClick={() => handleCombo(filters.name[0])}
                >
                  {filters.name[0]} Options Combo
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="table-wrapper mt-5">
        <div className="dark-gray-table-wrap">
          <div className="table-responsive">
            <Table className="table table-dark table-bordered">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Instrument Token</th>
                  <th>Exchange Token</th>
                  <th>Trading Symbol</th>
                  <th>Name</th>
                  <th className="text-end">Last Price</th>
                  <th>Expiry</th>
                  <th>Strike</th>
                  <th className="text-end">Tick Size</th>
                  <th className="text-end">Lot Size</th>
                  <th>Instrument Type</th>
                  <th>Segment</th>
                  <th>Exchange</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {instruments.length > 0 ? (
                  instruments.map((instrument, idx) => {
                    const selected = selectedInstruments.find(
                      i => i.instrument_token === instrument.instrument_token
                    );
                    return (
                      <tr
                        key={instrument.instrument_token}
                        className={
                          selected?.type === "buy"
                            ? "row-buy"
                            : selected?.type === "sell"
                            ? "row-sell"
                            : ""
                        }
                      >
                        <td>{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td>{instrument.instrument_token}</td>
                        <td>{instrument.exchange_token}</td>
                        <td>{instrument.tradingsymbol}</td>
                        <td>{instrument.name}</td>
                        <td className="text-end">{instrument.last_price}</td>
                        <td>{instrument.expiry ? formatDate(instrument.expiry) : ''}</td>
                        <td>{instrument.strike}</td>
                        <td className="text-end">{instrument.tick_size}</td>
                        <td className="text-end">{instrument.lot_size}</td>
                        <td>{instrument.instrument_type}</td>
                        <td>{instrument.segment}</td>
                        <td>{instrument.exchange}</td>
                        <td>
                          <div className="action-btn-wrap">
                              <span
                                className="small-btn-theme buy dark cursor-pointer me-1"
                                onClick={() => handleSelect(instrument, "buy")}
                              >
                                B
                              </span>
                              <span
                                className="small-btn-theme sell dark cursor-pointer"
                                onClick={() => handleSelect(instrument, "sell")}
                              >
                                S
                              </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="14" className="text-center">
                      No data found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>

            {/* Pagination */}
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div>Total Records: {totalCount}</div>
              <ReactPaginate
                breakLabel="..."
                previousLabel="« Prev"
                nextLabel="Next »"
                onPageChange={(e) => fetchInstruments(e.selected + 1)}
                pageCount={totalPages}
                forcePage={currentPage - 1}
                containerClassName="pagination mb-0"
                pageClassName="page-item"
                pageLinkClassName="page-link"
                previousClassName="page-item"
                previousLinkClassName="page-link"
                nextClassName="page-item"
                nextLinkClassName="page-link"
                breakClassName="page-item"
                breakLinkClassName="page-link"
                activeClassName="active"
                marginPagesDisplayed={1}
                pageRangeDisplayed={1}
              />
            </div>
          </div>

          <hr />

          {showSelected && (
            <div className="row">
              <div className="col-xxl-12 col-xl-12 col-lg-12">
                <div className="form-wrapper selected-instruments mt-2">
                  <h4>
                    Selected Instruments
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

                    <button
                      className="btn btn-sm btn-warning ms-2"
                      title="Refresh LTP"
                      onClick={handleRefreshLTP}
                      disabled={refreshing || orderType === "limit"} // disable refresh in Limit mode
                    >
                      {refreshing ? (
                        <span className="spinner-border spinner-border-sm" role="status" />
                      ) : (
                        <i className="bi bi-arrow-clockwise"></i>
                      )}
                    </button>

                    {selectedInstruments.length > 0 && (
                      selectedInstruments.some(
                        (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
                      ) && (
                        remainingDays !== null && (
                          <span className="text-danger" style={{ fontWeight: "normal", fontSize: "14px", marginLeft: "8px" }}>
                            ({remainingDays} days remaining to expiry)
                          </span>
                        )
                      )
                    )}
                  </h4>
                  <div className="table-responsive">
                    <Table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}><i className="bi bi-arrow-down-up"></i></th>
                          <th>#</th>
                          <th>Trading Symbol</th>
                          <th className="text-end">LTP</th>
                          <th className="text-end">Lot Size</th>
                          <th></th>
                        </tr>
                      </thead>
                      <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="selectedInstruments">
                          {(provided) => (
                            <tbody ref={provided.innerRef} {...provided.droppableProps}>
                              {selectedInstruments.length > 0 ? (
                                selectedInstruments.map((instrument, idx) => (
                                  <Draggable
                                    key={instrument.instrument_token}
                                    draggableId={instrument.instrument_token.toString()}
                                    index={idx}
                                  >
                                    {(provided, snapshot) => (
                                      <tr
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        className={`row-${instrument.type} ${snapshot.isDragging ? "dragging" : ""}`}
                                      >
                                        <td {...provided.dragHandleProps} className="text-center">
                                          <i className="bi bi-grip-vertical"></i>
                                        </td>
                                        <td>{idx + 1}</td>
                                        <td>{instrument.tradingsymbol}</td>
                                        <td className="text-end">
                                          {orderType === "market" ? (
                                            instrument.ltp
                                          ) : (
                                            <>
                                              <input
                                                type="number"
                                                className="form-control text-end"
                                                value={limitPrices[instrument.instrument_token] || ""}
                                                placeholder="Enter Limit Price"
                                                onChange={(e) =>
                                                  setLimitPrices((prev) => ({
                                                    ...prev,
                                                    [instrument.instrument_token]: Number(e.target.value) || 0,
                                                  }))
                                                }
                                              />
                                              <span>Actual LTP: {instrument.ltp}</span>
                                            </>
                                          )}
                                        </td>
                                        <td className="text-end">{instrument.lot_size}</td>
                                        <td>
                                          <div className="action-btn-wrap">
                                            <button
                                              className="btn btn-sm btn-danger ms-2"
                                              onClick={() =>
                                                setSelectedInstruments(prev => {
                                                  const updated = prev.filter(i => i.instrument_token !== instrument.instrument_token);

                                                  if (updated.length === 0) {
                                                    setMarginPerLot('');
                                                    setUserLots({});
                                                    setTradeMode('');
                                                    setTradeModeQtys({});
                                                    setTradeModeAmounts({});
                                                    setTradePercentage('');
                                                  }

                                                  return updated;
                                                })
                                              }
                                            >
                                              <i className="bi bi-trash"></i>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Draggable>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="6" className="text-center">
                                    No instruments selected
                                  </td>
                                </tr>
                              )}
                              {provided.placeholder}
                            </tbody>
                          )}
                        </Droppable>
                      </DragDropContext>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="col-xxl-12 col-xl-12 col-lg-12">
                <div className="form-wrapper mt-2">
                  <h4>Execute for</h4>

                  {/* Margin Block (only if exchange is BFO or NFO) */}
                  {/* Margin Block (only else of above) */}
                  <div className="row mb-2">
                    {selectedInstruments.length > 0 && (
                      selectedInstruments.some(
                        (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
                      ) ? (
                        <div className="col-xxl-6 col-xl-6 col-lg-6">
                          <label className="form-label fw-bold">Margin per Lot</label>
                          <input
                            type="number"
                            min="0"
                            className="form-control"
                            placeholder="Enter Margin per Lot amount"
                            value={marginPerLot}
                            onChange={(e) => setMarginPerLot(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="col-xxl-6 col-xl-6 col-lg-6">
                            <label className="form-label fw-bold">Trade Mode</label>
                            <select
                              name="tradeMode"
                              className="form-select"
                              style={{ maxWidth: "100%" }}
                              value={tradeMode}
                              onChange={(e) =>
                                setTradeMode(prev => {
                                  setTradeModeQtys({});
                                  setTradeModeAmounts({});
                                  setTradePercentage('');

                                  return e.target.value;
                                })
                              }
                            >
                                <option defaultChecked >Select Mode</option>
                                <option value="1">Qty</option>
                                <option value="2">Amount</option>
                                <option value="3">Percentage (%)</option>
                            </select>
                          </div>
                          {tradeMode === "3" && (
                            <div className="col-xxl-6 col-xl-6 col-lg-6">
                              <label className="form-label fw-bold">Enter Percentage (%)</label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="form-control"
                                placeholder="Enter Percentage (%)"
                                value={tradePercentage}
                                onChange={(e) => setTradePercentage(e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      )
                    )}
                  </div>

                  <div className="table-responsive">
                    <Table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>Users</th>
                          <th className="text-end">
                            <div>
                              {selectedInstruments.length > 0 && (
                                selectedInstruments.some(
                                  (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
                                ) ? (
                                  <div>Lots</div>
                                ) : (
                                  <div>
                                    {tradeMode === "1"
                                      ? "Qty"
                                      : tradeMode === "2"
                                      ? "Amount"
                                      : tradeMode === "3"
                                      ? "Qty"
                                      : ""}
                                  </div>
                                )
                              )}
                            </div>
                          </th>
                          <th className="text-end">Order Amount</th>
                          <th className="text-end">Available Funds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr><td colSpan="5" className="text-center">No users found</td></tr>
                        ) : (
                          users.map((user, idx) => {
                            const lots = userLots[user.id] || 0;
                            const tradeModeQty = tradeModeQtys[user.id] || 0;
                            const tradeModeAmount = tradeModeAmounts[user.id] || 0;
                            const calOrderAmount = calculateLotsOrderAmount(user.id).orderAmount;
                            const calQty = calculateLotsOrderAmount(user.id).qty;
                            const available = user.available_funds || 0;

                            return (
                              <tr key={user.id} className={`${
                                    tradeModeAmounts[user.id] > 0 && calQty === 0 ? "zero-qty-row" : ""
                                  }`}>
                                <td>{idx + 1}</td>
                                <td>{user.name}</td>
                                <td className="text-end">
                                  {selectedInstruments.length > 0 && (
                                    selectedInstruments.some(
                                      (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
                                    ) ? (
                                      <input
                                        type="number"
                                        min="0"
                                        className="form-control"
                                        value={lots}
                                        onChange={(e) => handleLotChange(user.id, e.target.value)}
                                      />
                                    ) : (
                                      tradeMode === "1"
                                      ? (
                                        <input
                                          type="number"
                                          min="0"
                                          className="form-control"
                                          value={tradeModeQty}
                                          onChange={(e) => handleQtyChange(user.id, e.target.value)}
                                        />
                                      )
                                      : tradeMode === "2"
                                      ? (
                                        <>
                                        <input
                                          type="number"
                                          min="0"
                                          className="form-control"
                                          value={tradeModeAmount}
                                          onChange={(e) => handleAmountChange(user.id, e.target.value)}
                                        />
                                        <span className="text-gray-400">Qty: { calQty || 0 }</span>
                                        </>
                                      )
                                      : tradeMode === "3"
                                      ? calQty || 0
                                      : ""
                                    )
                                  )}
                                </td>
                                <td
                                  className={`text-end ${
                                    calOrderAmount > available ? "text-danger" : "text-success"
                                  }`}
                                >
                                  ₹ {formatAmount(calOrderAmount)}
                                </td>
                                <td className="text-end">
                                  ₹ {formatAmount(available)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>

                  {/* Execute button (only if instruments are selected) */}
                  <div className={`mt-4 text-end ${
                    selectedInstruments.length > 0 ? "" : "d-none"
                  }`} >
                    <button className="theme-btn primary text-center" onClick={handleExecute}>
                      Execute
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showReview && (
            <div className="modal fade show d-block" tabIndex="-1">
              <div className="modal-dialog modal-xl">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Review Orders</h5>
                    {!proceedLoading && (
                      <button
                        type="button"
                        className="btn-close"
                        onClick={() => setShowReview(false)}
                      ></button>
                    )}
                  </div>
                  <div className="modal-body">
                    <Table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>User</th>
                          <th className="text-end">
                            {selectedInstruments.some(
                              (instrument) => instrument.exchange === "BFO" || instrument.exchange === "NFO"
                            )
                              ? "Lots (Qty)"
                              : "Qty"}
                          </th>
                          <th className="text-end">Slice Count</th>
                          <th className="text-end">Price ({orderType === "market" ? "Market LTP" : "Limit"})</th>
                          <th className="text-end">Order Amount</th>
                          <th className="text-end">Available Funds</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user, idx) => {
                          const { orderAmount, qty } = calculateLotsOrderAmount(user.id);
                          const available = user.available_funds || 0;

                          const value =
                            selectedInstruments.some(
                              (instrument) =>
                                instrument.exchange === "BFO" || instrument.exchange === "NFO"
                            )
                              ? userLots[user.id] || 0
                              : tradeMode === "1"
                              ? tradeModeQtys[user.id] || 0
                              : qty;

                          const inst = selectedInstruments[0];
                          const ltp =
                            orderType === "limit"
                              ? limitPrices[inst.instrument_token] || 0
                              : inst.ltp;

                          // Calculate slice count based on Quantity Freeze Limit
                          const MAX_QTY = freezeLimits[inst.name] || 0;
                          let sliceCount = 0;
                          if (MAX_QTY > 0 && value > 0) {
                            sliceCount = Math.ceil((value  * inst.lot_size) / MAX_QTY);
                          }

                          return (
                            <tr key={user.id}>
                              <td>{idx + 1}</td>
                              <td>{user.name}</td>
                              <td className="text-end">
                                { (inst.exchange === "BFO" || inst.exchange === "NFO")
                                  ? (
                                    `${value} (${value * inst.lot_size})`
                                  ) : (
                                    value
                                  )
                                }
                              </td>
                              <td className="text-end">{sliceCount > 0 ? sliceCount : "-"}</td>
                              <td className="text-end">₹ {formatAmount(ltp)}</td>
                              <td
                                className={`text-end ${
                                  orderAmount > available ? "text-danger" : "text-success"
                                }`}
                              >
                                ₹ {formatAmount(orderAmount)}
                              </td>
                              <td className="text-end">₹ {formatAmount(available)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  <div className="modal-footer">
                    {!executionResults ? (
                      proceedLoading ? (
                        <Button size="sm" variant="warning" disabled>
                          <Spinner animation="border" size="sm" /> Please wait...
                        </Button>
                      ) : (
                        <>
                          <button className="theme-btn btn-secondary" onClick={() => setShowReview(false)}>
                            Cancel
                          </button>
                          <button className="theme-btn primary" onClick={handleConfirmExecute}>
                            Proceed
                          </button>
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
                            onClick={() => window.location.reload()}
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
      </div>
    </MainLayout>
  );
};

export default CreateNewTradePage;
