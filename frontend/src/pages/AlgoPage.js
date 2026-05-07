import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Button, Form, Modal, Spinner, Table } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';
import { ConfigContext } from '../context/ConfigContext';
import { formatAmount, formatDateTime, formatExpiryDateWithWeek } from '../utils/helpers';

const MODE_MAP = {
  auto: "Auto",
  manual: "Manual",
};
const TYPE_MAP = {
  breakout: "Breakout",
  rangebound: "Rangebound",
};

const AlgoPage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const { config, updateConfig } = useContext(ConfigContext);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [algoPositions, setAlgoPositions] = useState(null);

  const [expandedSettingsRow, setExpandedSettingsRow] = useState(null);
  const [expandedStatusRow, setExpandedStatusRow] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const loading = dataLoading;
  const [tradeDay, setTradeDay] = useState(false);

  const [form, setForm] = useState({});

  const [strategies, setStrategies] = useState({});

  const [manualLotErrors, setManualLotErrors] = useState({});
  const [algoStatus, setAlgoStatus] = useState({});
  const [globalAlgoLoading, setGlobalAlgoLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState({});

  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedStrategyKey, setSelectedStrategyKey] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(null);

  const [expandedIndex, setExpandedIndex] = useState(
    () => localStorage.getItem("expandedIndex")
  );
  const [expandedMode, setExpandedMode] = useState(
    () => localStorage.getItem("expandedMode")
  );
  const [expandedType, setExpandedType] = useState(
    () => localStorage.getItem("expandedType")
  );

  useEffect(() => {
    if (!isConfigLoaded) return;

    const fetchAlgoPositions = async () => {
      try {
        setDataLoading(true);
        const res = await API.get("/algo-positions", { headers: { Authorization: `Bearer ${token}` } });
        setAlgoPositions(res.data || {});
      } catch {
        toast.error("Failed to fetch Algo Positions");
      } finally {
        setDataLoading(false);
      }
    };

    fetchAlgoPositions();
  }, [isConfigLoaded, token]);

  // Check trading day
  useEffect(() => {
    // const today = new Date().getDay();
    // setTradeDay(today !== 0 && today !== 6);
    setTradeDay(true);
  }, []);

  // Fetch users
  useEffect(() => {
    if (!isConfigLoaded) return;
    fetchUsers();
  }, [isConfigLoaded, fetchUsers]);

  useEffect(() => {
    if (config?.strategies) {
      setStrategies(config.strategies);
      setForm(config.strategies);
      setIsConfigLoaded(true);
    }
  }, [config]);

  const toggleSettingsRow = (userId) => {
    setExpandedSettingsRow(expandedSettingsRow === userId ? null : userId);
    setExpandedStatusRow(null);
  };

  const toggleStatusRow = (strategyKey) => {
    setExpandedStatusRow(expandedStatusRow === strategyKey ? null : strategyKey);
    setExpandedSettingsRow(null);
  };

  const handleSaveConfig = async () => {
    try {
      const newConfig = {
        ...config,
        strategies: form,
      };

      await API.put('/config', newConfig, {
        headers: { Authorization: `Bearer ${token}` },
      });

      updateConfig(newConfig);
      toast.success('Configuration updated successfully');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update configuration');
    }
  };

  // Fetch Algo Status
  useEffect(() => {
    if (!isConfigLoaded) return;

    const fetchAlgoStatus = async () => {
      try {
        const res = await API.get("/algo/status", { headers: { Authorization: `Bearer ${token}` } });
        setAlgoStatus(res.data.runningStatus || {});
      } catch {
        toast.error("Failed to fetch Algo status");
      }
    };

    fetchAlgoStatus();
  }, [isConfigLoaded, token]);

  // Start Algo
  const validateBeforeStart = (strategyKey) => {
    const s = strategies[strategyKey];
    const f = form[strategyKey];

    if (!tradeDay) {
      return "Algo cannot be started on a non-trading day.";
    }

    if (!f?.minimumMargin || Number(f.minimumMargin) <= 0) {
      return "Minimum margin is missing or invalid.";
    }

    if (!f?.fundsAllocation || Object.values(f.fundsAllocation).every(v => !v || v <= 0)) {
      return "No funds allocated to any user.";
    }

    if (Object.keys(manualLotErrors).length > 0) {
      return "Manual lot validation error exists.";
    }

    if (s.strategyMode === "manual" && !selectedExpiry) {
      return "Please select an expiry before starting the algo.";
    }

    // validate manual lots vs max lots
    for (const user of users) {
      const allocated = Number(f.fundsAllocation?.[user.user_id] || 0);
      const manualLots = Number(f.manualLots?.[user.user_id] || 0);
      const maxLots = Math.floor(allocated / Number(f.minimumMargin));

      if (manualLots > maxLots) {
        return `Manual lots exceed max lots for ${user.name}`;
      }
    }

    return null; // valid
  };

  const handleStartAlgo = async (strategyKey) => {
    const error = validateBeforeStart(strategyKey);
    if (error) {
      toast.error(error);
      return;
    }
    const confirmed = window.confirm(`Are you sure you want to start the ${strategyKey} Algo?`);
    if (!confirmed) return;

    const strategy = strategies[strategyKey];

    setGlobalAlgoLoading(true);
    setButtonLoading((prev) => ({ ...prev, [strategyKey]: true }));
    try {
      await API.post("/algo/start", { strategyKey: strategyKey, selectedExpiry: selectedExpiry }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`${strategy.title} Algo Started`);
      setAlgoStatus((prev) => ({ ...prev, [strategyKey]: true }));
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to start ${strategy.title}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, [strategyKey]: false }));
      setGlobalAlgoLoading(false);
    }
  };

  // Stop Algo
  const handleStopAlgo = async (strategyKey) => {
    const confirmed = window.confirm(`Are you sure you want to stop the ${strategyKey} Algo?`);
    if (!confirmed) return;

    const strategy = strategies[strategyKey];

    setGlobalAlgoLoading(true);
    setButtonLoading((prev) => ({ ...prev, [strategyKey]: true }));
    try {
      await API.post("/algo/stop", { strategyKey: strategyKey }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(`${strategy.title} Algo Stopped`);
      setAlgoStatus((prev) => ({ ...prev, [strategyKey]: false }));
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to stop ${strategy.title}`);
    } finally {
      setButtonLoading((prev) => ({ ...prev, [strategyKey]: false }));
      setGlobalAlgoLoading(false);
    }
  };

  const renderStrikeCell = (stage3, stage4, positions) => {
    const position =
      positions?.find(p => p.stage === stage3) ||
      positions?.find(p => p.stage === stage4);

    return position ? (
      <div className="text-success">{position.strike}</div>
    ) : (
      "-"
    );
  };

  const renderExpiryCell = (stage3, stage4, positions) => {
    const position =
      positions?.find(p => p.stage === stage3) ||
      positions?.find(p => p.stage === stage4);

    return position ? (
      <div>{formatExpiryDateWithWeek(position.expiry)}</div>
    ) : (
      "-"
    );
  };

  // helpers for rendering cells
  const renderStageCell = (stage, positions) => {
    const position = positions?.find(p => p.stage === stage);
    if (position) {
      return (
        <div className="text-success">
          <div>Position taken</div>
          <div>Strike: {position.strike} ({position.tradingsymbol})</div>
          <div>Premium: {position.ltp}</div>
          {position?.taken_at && <div>Taken at: {formatDateTime(position.taken_at)}</div>}
        </div>
      );
    }
    return <span className="text-warning">Waiting for entry</span>;
  };

  // render adjustment/reentry helpers omitted here for brevity: reuse your original implementations
  const renderAdjustmentCell = (strategy, stage, positions, historyPositions) => {
    const position = positions?.find(p => p.stage === stage);
    const historyPosition = historyPositions?.find(p => p.stage === stage);
    if (historyPosition) {
      return (
        <div className="text-success">
          <div>Position closed</div>
          <div>Strike: {historyPosition.strike} ({historyPosition.tradingsymbol})</div>
          <div>Close LTP: {historyPosition.close_ltp}</div>
          {historyPosition?.reason && <div>Reason: {historyPosition.reason}</div>}
          {historyPosition?.closed_at && <div>Closed at: {formatDateTime(historyPosition.closed_at)}</div>}
        </div>
      );
    }

    // BREAKOUT ADJUSTMENT
    if (strategy.strategyType === "breakout") {
      const niftyMovePer = stage === "ATM CE" ? config?.breakoutUpPerValue : config?.breakoutDownPerValue;
      return (
        <div className="text-warning">
          <div>Waiting for adjustment</div>
          <div>
            If {strategy.indexName} {stage === "ATM CE" ? ">" : "<"} {(position.strike * niftyMovePer).toFixed(2)} ({position.strike} * {niftyMovePer})
            <br />
            or Premium &gt; {(1.5 * position.ltp).toFixed(2)} (150% * {position.ltp})
          </div>
        </div>
      );
    }

    // RANGEBOUND ADJUSTMENT
    if (strategy.strategyType === "rangebound") {
      let localReason = "";
      let sumLtps = 0;
      const multiplier = { sell: 1, buy: -1 };
      for (const leg of positions) {
        sumLtps += (multiplier[leg.action] || 0) * leg.ltp;
      }

      if (position.instrument_type === "CE") {
        const checkUpperPoint = position.strike + sumLtps;
        localReason = `If ${strategy.indexName} move above ${checkUpperPoint}`;
      } else if (position.instrument_type === "PE") {
        const checkLowerPoint = position.strike - sumLtps;
        localReason = `If ${strategy.indexName} move below ${checkLowerPoint}`;
      }

      return (
        <div className="text-warning">
          <div>Waiting for adjustment</div>
          <div>{localReason}</div>
        </div>
      );
    }
  };

  const renderReEntryCell = (strategy, stage, positions, historyPositions) => {
    const position = positions?.find(p => p.stage === stage);
    const historyPosition = historyPositions?.find(p => p.stage === stage);
    if (position?.status === "active") {
      return (
        <div className="text-success">
          <div>Position Re-enter</div>
          <div>Strike: {position.strike} ({position.tradingsymbol})</div>
          <div>LTP: {position.ltp}</div>
          {position?.reentry_reason && <div>Reason: {position.reentry_reason}</div>}
          {position?.reentered_at && <div>Re-entry at: {formatDateTime(position.reentered_at)}</div>}
        </div>
      );
    }

    // BREAKOUT RE-ENTRY
    if (strategy.strategyType === "breakout" && historyPosition) {
      return (
        <div className="text-warning">
          <div>Waiting for re-entry</div>
          <div>
            If {strategy.indexName} {stage === "ATM CE" ? "<" : ">"} {historyPosition.strike} <br />
            or Premium &lt; {historyPosition.ltp}
          </div>
        </div>
      );
    }

    // RANGEBOUND RE-ENTRY
    if (strategy.strategyType === "rangebound" && historyPosition) {
      return (
        <div className="text-warning">
          <div>Waiting for re-entry</div>
          <div>Premium &lt; {historyPosition.ltp}</div>
        </div>
      );
    }
  };

  const handlePerpetualCycleChange = (e, strategyKey) => {
    const nextValue = e.target.checked;

    const confirmed = window.confirm(
      nextValue
        ? `Enable perpetual cycle of ${strategyKey}?`
        : `Disable perpetual cycle of ${strategyKey}?`
    );

    if (!confirmed) {
      e.preventDefault();
      return;
    }

    setForm((prev) => ({
      ...prev,
      [strategyKey]: {
        ...prev[strategyKey],
        perpetualCycle: nextValue,
      },
    }));
  };

  const Chevron = ({ open }) => (
    <i className={`bi ${open ? "bi-chevron-down" : "bi-chevron-right"} me-2`} />
  );

  useEffect(() => {
    localStorage.setItem("expandedIndex", expandedIndex ?? "");
    localStorage.setItem("expandedMode", expandedMode ?? "");
    localStorage.setItem("expandedType", expandedType ?? "");
  }, [expandedIndex, expandedMode, expandedType]);

  useEffect(() => {
    if (!algoStatus || !strategies) return;

    const runningKey = Object.keys(algoStatus).find(k => algoStatus[k]);
    if (!runningKey) return;

    const s = strategies[runningKey];
    if (!s) return;

    setExpandedIndex(s.indexName);
    setExpandedMode(MODE_MAP[s.strategyMode]);
    setExpandedType(TYPE_MAP[s.strategyType]);
  }, [algoStatus, strategies]);

  const { groupedStrategies, strategyStats } = React.useMemo(() => {
    const groups = {};
    const stats = {};

    if (!strategies) return { groupedStrategies: {}, strategyStats: {} };

    for (const [strategyKey, strategy] of Object.entries(strategies)) {
      const index = strategy.indexName || "UNKNOWN";
      const mode = MODE_MAP[strategy.strategyMode];
      const type = TYPE_MAP[strategy.strategyType];
      const isRunning = !!algoStatus?.[strategyKey];

      // -------- GROUPING --------
      (((groups[index] ||= {})[mode] ||= {})[type] ||= []).push({
        strategyKey,
        strategy,
      });

      // -------- STATS --------
      const indexStats =
        (stats[index] ||= { total: 0, running: 0, modes: {} });

      const modeStats =
        (indexStats.modes[mode] ||= {
          total: 0,
          running: 0,
          types: {},
        });

      const typeStats =
        (modeStats.types[type] ||= { total: 0, running: 0 });

      indexStats.total++;
      modeStats.total++;
      typeStats.total++;

      if (isRunning) {
        indexStats.running++;
        modeStats.running++;
        typeStats.running++;
      }
    }

    return { groupedStrategies: groups, strategyStats: stats };
  }, [strategies, algoStatus]);

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Algo</h2>
      </div>
      {loading && (
        <div className="col-md-3 d-flex">
          <Spinner animation="border" variant="warning" />
        </div>
      )}
      <div className="theme-content-wrapper">
        <div className="row">
          <div className="col-xxl-6 col-xl-6 col-lg-6 col-md-6">
            <p>
              <span className="fw-bold">Strategy Name:</span> Index Weekly Options
            </p>
          </div>
          <div className="col-xxl-6 col-xl-6 col-lg-6 col-md-6 text-end">
            <p>
              Today is trading{" "}
              {tradeDay ? (
                <span className="text-success">On</span>
              ) : (
                <span className="text-danger">Off</span>
              )}{" "}
              Day
            </p>
          </div>
        </div>
      </div>

      <div className="table-wrapper form-wrapper">
        <div className="dark-table-wrap table-responsive">
          <Table className="table table-dark table-bordered table-hover">
            <thead>
              <tr>
                <th className="text-end" width="100px">Sr. No.</th>
                <th width="200px">Name</th>
                <th className="text-center">Settings</th>
                <th className="text-center">ATM</th>
                <th className="text-center">Expiry</th>
                <th className="text-center">Status</th>
                <th className="text-center">Algo</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedStrategies).length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">No data found</td>
                </tr>
              ) : (
                Object.entries(groupedStrategies).map(([indexName, modes]) => {
                  const indexStats = strategyStats[indexName];

                  return (
                    <React.Fragment key={indexName}>

                      {/* INDEX */}
                      <tr className="table-primary table-dark">
                        <td
                          colSpan="7"
                          className="fw-bold cursor-pointer"
                          onClick={() =>
                            setExpandedIndex(expandedIndex === indexName ? null : indexName)
                          }
                        >
                          <Chevron open={expandedIndex === indexName} />
                          {indexName}
                          <span className={`ms-2 ${indexStats.running > 0 && "text-success"}`}>
                            ({indexStats.running}/{indexStats.total})
                          </span>
                        </td>
                      </tr>

                      {expandedIndex === indexName &&
                        Object.entries(modes).map(([mode, types]) => {
                          const modeStats = indexStats.modes[mode];

                          return (
                            <React.Fragment key={mode}>

                              {/* MODE */}
                              <tr className="table-secondary table-dark">
                                <td
                                  colSpan="7"
                                  className="ps-4 fw-bold cursor-pointer"
                                  onClick={() =>
                                    setExpandedMode(expandedMode === mode ? null : mode)
                                  }
                                >
                                  <Chevron open={expandedMode === mode} />
                                  {mode}
                                  <span className={`ms-2 ${modeStats.running > 0 && "text-success"}`}>
                                    ({modeStats.running}/{modeStats.total})
                                  </span>
                                </td>
                              </tr>

                              {expandedMode === mode &&
                                Object.entries(types).map(([type, list]) => {
                                  const typeStats = modeStats.types[type];

                                  return (
                                    <React.Fragment key={type}>

                                      {/* TYPE */}
                                      <tr className="table-dark">
                                        <td
                                          colSpan="7"
                                          className="ps-5 fw-bold cursor-pointer"
                                          onClick={() =>
                                            setExpandedType(expandedType === type ? null : type)
                                          }
                                        >
                                          <Chevron open={expandedType === type} />
                                          {type}
                                          <span className={`ms-2 ${typeStats.running > 0 && "text-success"}`}>
                                            ({typeStats.running}/{typeStats.total})
                                          </span>
                                        </td>
                                      </tr>

                                      {/* STRATEGIES */}
                                      {expandedType === type &&
                                        list.map(({ strategyKey, strategy }, idx) => {

                                          // determine which algoPositions key to use
                                          const positionsKey = algoPositions?.[strategyKey]?.positions ?? {};
                                          const historyKey   = algoPositions?.[strategyKey]?.histories ?? {};

                                          // get positions data (based on first user's data)
                                          const positionsData = positionsKey || {};
                                          const currentWeekKey = positionsData ? Object.keys(positionsData)[0] : null;
                                          const positions = currentWeekKey ? positionsData[currentWeekKey] : [];

                                          // get history data (adjustments)
                                          const historyData = historyKey || {};
                                          const historyWeekKey = historyData ? Object.keys(historyData)[0] : null;
                                          const historyPositions = historyWeekKey ? historyData[historyWeekKey] : [];

                                          return (
                                            <React.Fragment key={strategyKey}>

                                              {/* EXISTING STRATEGY ROW */}
                                              <tr>
                                                <td className="text-end">{idx + 1}</td>
                                                <td>
                                                  {strategyKey.replace(/_/g, "-")}
                                                  <i
                                                    className="bi bi-info-circle-fill ms-2"
                                                    title={strategy.title}
                                                  />
                                                </td>
                                                <td className="text-center">
                                                  <i
                                                    className="bi bi-gear cursor-pointer"
                                                    onClick={() => toggleSettingsRow(strategyKey)}
                                                  />
                                                </td>
                                                <td className="text-center">
                                                  {renderStrikeCell(strategy.stages[2].stage, strategy.stages[3].stage, positions)}
                                                </td>
                                                <td className="text-center">
                                                  {renderExpiryCell(strategy.stages[2].stage, strategy.stages[3].stage, positions)}
                                                </td>
                                                <td className="text-center">
                                                  <i
                                                    className="bi bi-graph-up cursor-pointer"
                                                    onClick={() => toggleStatusRow(strategyKey)}
                                                  />
                                                </td>
                                                <td className="text-center">
                                                  {!loading && (
                                                    config?.perpetualCycle === true && form[strategyKey]?.perpetualCycle === true ? (
                                                      !algoStatus?.[strategyKey] ? (
                                                        <button
                                                          className="theme-btn text-center text-success algo-start-stop-btn"
                                                          onClick={() => {
                                                            if (strategy.strategyMode === "auto") {
                                                              handleStartAlgo(strategyKey)
                                                            } else {
                                                              setSelectedStrategyKey(strategyKey);
                                                              setSelectedExpiry(strategy?.instrumentConfig?.expiries[0] || null);
                                                              setShowStartModal(true);
                                                            }
                                                          }}
                                                          disabled={buttonLoading[strategyKey] || globalAlgoLoading}
                                                        >
                                                          {buttonLoading[strategyKey] ? "Starting..." : `Start ${strategyKey.replace(/_/g, "-")}`}
                                                        </button>
                                                      ) : (
                                                        <button
                                                          className="theme-btn text-center text-danger algo-start-stop-btn"
                                                          onClick={() => handleStopAlgo(strategyKey)}
                                                          disabled={buttonLoading[strategyKey] || globalAlgoLoading}
                                                        >
                                                          {buttonLoading[strategyKey] ? "Stopping..." : `Stop ${strategyKey.replace(/_/g, "-")}`}
                                                        </button>
                                                      )
                                                    ) : (
                                                      <p className="text-danger">
                                                        <span className="fw-bold">Perpetual cycle</span> is Off.
                                                      </p>
                                                    )
                                                  )}
                                                </td>
                                              </tr>

                                              {/* SETTINGS COLLAPSE */}
                                              {expandedSettingsRow === strategyKey && (
                                                <tr className="nested-table-row">
                                                  <td colSpan="7">
                                                    <table className="table table-dark table-bordered w-100">
                                                      <thead>
                                                        <tr>
                                                          <th className="text-center" colSpan="9">
                                                            <div className="d-flex align-items-center justify-content-center position-relative w-100">
                                                              <div className="text-center flex-grow-1">
                                                                Settings of {strategy.title}
                                                              </div>
                                                              { strategy.strategyMode === "auto" && (
                                                                <div className="position-absolute end-0 d-flex align-items-center">
                                                                  <label className="cursor-pointer">
                                                                    <span className="me-2">Perpetual cycle</span>
                                                                    <input
                                                                      type="checkbox"
                                                                      className="form-check-input"
                                                                      style={{ transform: "scale(1.3)" }}
                                                                      checked={form[strategyKey]?.perpetualCycle || false}
                                                                      onChange={(e) => handlePerpetualCycleChange(e, strategyKey)}
                                                                    />
                                                                  </label>
                                                                </div>
                                                              )}
                                                            </div>
                                                          </th>
                                                        </tr>
                                                        <tr>
                                                          <th className="text-center" width="5%" rowSpan="2">Sr. No.</th>
                                                          <th className="text-left" width="15%" rowSpan="2">Title</th>
                                                          <th className="text-center" width="80%" colSpan="2">Configuration</th>
                                                        </tr>
                                                        <tr>
                                                          <th className="text-center" width="40%">Current Week</th>
                                                          <th className="text-center" width="40%">Next Week</th>
                                                        </tr>
                                                      </thead>

                                                      <tbody>
                                                        {/* 1. EXPIRY */}
                                                        <tr>
                                                          <td className="text-center">1</td>
                                                          <td>Expiry</td>
                                                          <td>
                                                            {formatExpiryDateWithWeek(strategy?.instrumentConfig?.expiries[0] || null)}
                                                          </td>
                                                          <td>
                                                            {formatExpiryDateWithWeek(strategy?.instrumentConfig?.expiries[1] || null)}
                                                          </td>
                                                        </tr>

                                                        {/* 2. ENTRY TIME */}
                                                        <tr>
                                                          <td className="text-center">2</td>
                                                          <td>Entry Time</td>
                                                          <td></td>
                                                          <td>After the successful closing of the previous cycle.</td>
                                                        </tr>

                                                        {/* 3. EXIT TIME */}
                                                        <tr>
                                                          <td className="text-center">3</td>
                                                          <td>Exit Time</td>
                                                          <td>
                                                            <input
                                                              type="time"
                                                              className="form-control"
                                                              value={form[strategyKey]?.currentWeekExitTime || ""}
                                                              onChange={(e) =>
                                                                setForm((prev) => ({
                                                                  ...prev,
                                                                  [strategyKey]: {
                                                                    ...prev[strategyKey],
                                                                    currentWeekExitTime: e.target.value,
                                                                  },
                                                                }))
                                                              }
                                                            />
                                                          </td>
                                                          <td></td>
                                                        </tr>

                                                        {/* 4. LOT SIZE */}
                                                        <tr>
                                                          <td className="text-center">4</td>
                                                          <td>Lot Size</td>
                                                          <td>{strategy.instrumentConfig.lotSize.current || "-"}</td>
                                                          <td>{strategy.instrumentConfig.lotSize.next || "-"}</td>
                                                        </tr>

                                                        {/* 5. MINIMUM MARGIN */}
                                                        <tr>
                                                          <td className="text-center">5</td>
                                                          <td>Margin per Lot</td>
                                                          <td colSpan="2">
                                                            <label className="form-label fw-bold">Minimum margin</label>
                                                            <input
                                                              type="number"
                                                              min="0"
                                                              className="form-control"
                                                              placeholder="Enter Minimum margin amount"
                                                              value={form[strategyKey]?.minimumMargin}
                                                              onChange={(e) =>
                                                                setForm((prev) => ({
                                                                  ...prev,
                                                                  [strategyKey]: {
                                                                    ...prev[strategyKey],
                                                                    minimumMargin: e.target.value,
                                                                  },
                                                                }))
                                                              }
                                                            />
                                                          </td>
                                                        </tr>

                                                        {/* 6. FUNDS ALLOCATION */}
                                                        <tr>
                                                          <td className="text-center">6</td>
                                                          <td>Funds Allocation per Instrument & Lots</td>
                                                          <td colSpan="2">
                                                            <div className="d-flex flex-column gap-2">
                                                              {users.map((user) => {
                                                                const maxLots = Math.floor(
                                                                  (form[strategyKey]?.fundsAllocation?.[user.user_id] || 1) /
                                                                  (form[strategyKey]?.minimumMargin || 1)
                                                                );

                                                                return (
                                                                  <div key={user.user_id}>
                                                                    <div className="row">
                                                                      <div className="col-xxl-3">
                                                                        <label className="me-2">{user.name}</label><br />
                                                                        <label className="me-2">
                                                                          Avl.: {formatAmount(user.available_funds || 0)}
                                                                        </label>
                                                                      </div>
                                                                      <div className="col-xxl-3">
                                                                        <label className="form-label fw-bold">Funds</label>
                                                                        <input
                                                                          type="number"
                                                                          className="form-control"
                                                                          value={
                                                                            form[strategyKey]?.fundsAllocation?.[user.user_id] || ""
                                                                          }
                                                                          onChange={(e) =>
                                                                            setForm((prev) => ({
                                                                              ...prev,
                                                                              [strategyKey]: {
                                                                                ...prev[strategyKey],
                                                                                fundsAllocation: {
                                                                                  ...prev[strategyKey].fundsAllocation,
                                                                                  [user.user_id]: e.target.value,
                                                                                },
                                                                              },
                                                                            }))
                                                                          }
                                                                        />
                                                                      </div>
                                                                      <div className="col-xxl-2">Max Lots: {maxLots}</div>
                                                                      <div className="col-xxl-3">
                                                                        <label className="form-label fw-bold">Manual Lots</label>
                                                                        <input
                                                                          type="number"
                                                                          className={`form-control ${
                                                                            manualLotErrors[user.user_id] ? "is-invalid" : ""
                                                                          }`}
                                                                          value={
                                                                            form[strategyKey]?.manualLots?.[user.user_id] || ""
                                                                          }
                                                                          onChange={(e) => {
                                                                            const val = Number(e.target.value);
                                                                            if (val > maxLots) {
                                                                              setManualLotErrors((prev) => ({
                                                                                ...prev,
                                                                                [user.user_id]: `Manual lots cannot exceed Max lots (${maxLots})`,
                                                                              }));
                                                                            } else {
                                                                              setManualLotErrors((prev) => {
                                                                                const { [user.user_id]: removed, ...rest } = prev;
                                                                                return rest;
                                                                              });

                                                                              setForm((prev) => ({
                                                                                ...prev,
                                                                                [strategyKey]: {
                                                                                  ...prev[strategyKey],
                                                                                  manualLots: {
                                                                                    ...prev[strategyKey].manualLots,
                                                                                    [user.user_id]: val,
                                                                                  },
                                                                                },
                                                                              }));
                                                                            }
                                                                          }}
                                                                        />
                                                                        {manualLotErrors[user.user_id] && (
                                                                          <div className="invalid-feedback">
                                                                            {manualLotErrors[user.user_id]}
                                                                          </div>
                                                                        )}
                                                                      </div>
                                                                    </div>

                                                                    <hr />
                                                                  </div>
                                                                );
                                                              })}
                                                            </div>
                                                          </td>
                                                        </tr>

                                                        {/* 7. FREEZE QUANTITY */}
                                                        <tr>
                                                          <td className="text-center">7</td>
                                                          <td>Freeze Quantity</td>
                                                          <td colSpan="2">{strategy.freezeLimit}</td>
                                                        </tr>

                                                        {/* 8. STRIKE RANGE */}
                                                        <tr>
                                                          <td className="text-center">8</td>
                                                          <td>Strike Range</td>
                                                          <td colSpan="2">
                                                            {strategy.instrumentConfig.strikeRange || "-"}
                                                          </td>
                                                        </tr>

                                                        {/* 9. STRIKE SELECTION */}
                                                        <tr>
                                                          <td className="text-center">9</td>
                                                          <td>Strike Selection</td>
                                                          <td colSpan="2">
                                                              {strategy.stages[0].stage} - {strategy.stages[0].action}, {strategy.stages[1].stage} - {strategy.stages[1].action}, {strategy.stages[2].stage} - {strategy.stages[2].action}, {strategy.stages[3].stage} - {strategy.stages[3].action}
                                                          </td>
                                                        </tr>

                                                      </tbody>
                                                    </table>
                                                  </td>
                                                </tr>
                                              )}

                                              {/* STATUS COLLAPSE */}
                                              {expandedStatusRow === strategyKey && (
                                                <tr className="nested-table-row">
                                                  <td colSpan="7">
                                                    <table className="table table-dark table-bordered w-100">
                                                      <thead>
                                                        <tr>
                                                          <th className="text-center" colSpan="7">
                                                            Status of {strategy.title} - <span className="text-danger">Remaining adjustment count: {2 - (config?.globalAdjustmentCount[strategyKey] || 0)}</span>
                                                          </th>
                                                        </tr>
                                                        <tr>
                                                          <th>Stages</th>
                                                          <th>{strategy.stages[0].stage} - {strategy.stages[0].action}</th>
                                                          <th>{strategy.stages[1].stage} - {strategy.stages[1].action}</th>
                                                          <th>{strategy.stages[2].stage} - {strategy.stages[2].action}</th>
                                                          <th>{strategy.stages[3].stage} - {strategy.stages[3].action}</th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {positions.length === 0 ? (
                                                          <tr>
                                                            <td colSpan="7" className="text-center text-warning">
                                                              Waiting for entry
                                                            </td>
                                                          </tr>
                                                        ) : (
                                                          <>
                                                            <tr>
                                                              <th>Entry</th>
                                                              <td>{renderStageCell(strategy.stages[0].stage, positions)}</td>
                                                              <td>{renderStageCell(strategy.stages[1].stage, positions)}</td>
                                                              <td>{renderStageCell(strategy.stages[2].stage, positions)}</td>
                                                              <td>{renderStageCell(strategy.stages[3].stage, positions)}</td>
                                                            </tr>
                                                            <tr>
                                                              <th>Adjustment</th>
                                                              <td></td>
                                                              <td></td>
                                                              <td>{renderAdjustmentCell(strategy, strategy.stages[2].stage, positions, historyPositions)}</td>
                                                              <td>{renderAdjustmentCell(strategy, strategy.stages[3].stage, positions, historyPositions)}</td>
                                                            </tr>
                                                            <tr>
                                                              <th>Re-entry</th>
                                                              <td></td>
                                                              <td></td>
                                                              <td>{renderReEntryCell(strategy, strategy.stages[2].stage, positions, historyPositions)}</td>
                                                              <td>{renderReEntryCell(strategy, strategy.stages[3].stage, positions, historyPositions)}</td>
                                                            </tr>
                                                          </>
                                                        )}
                                                      </tbody>
                                                    </table>
                                                  </td>
                                                </tr>
                                              )}

                                            </React.Fragment>
                                          );
                                        })}

                                    </React.Fragment>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </Table>
          <div className="float-start text-start my-3 gap-1">
          </div>
          <div className="float-end text-end my-3 gap-1">
            <button
              className="theme-btn primary text-center"
              onClick={handleSaveConfig}
            >
              Save Config
            </button>
          </div>
        </div>
      </div>
      <Modal
        show={showStartModal}
        onHide={() => setShowStartModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Start Algo of {selectedStrategyKey?.replace(/_/g, "-")}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedStrategyKey && (() => {
            const strategy = strategies[selectedStrategyKey];
            return (
              <>
                <label className="mb-3">{strategy.title}</label>
                {/* EXPIRY SELECTION */}
                <div className="mb-3">
                  <label className="fw-bold mb-2 d-block">Select Expiry</label>

                  <Form.Select
                    value={selectedExpiry || ""}
                    onChange={(e) => setSelectedExpiry(e.target.value)}
                  >
                    {strategy?.instrumentConfig?.expiries?.map((exp, idx) => (
                      <option key={exp} value={exp}>
                        {formatExpiryDateWithWeek(exp)} {idx === 0 ? "(Nearest)" : ""}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <hr />

                {/* FUNDS SUMMARY */}
                <div>
                  <label className="fw-bold mb-2 d-block">Funds Allocation Summary</label>

                  <Table bordered size="sm">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th className="text-end">Allocated Funds</th>
                        <th className="text-end">Manual Lots / Max Lots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const allocated =
                          form[selectedStrategyKey]?.fundsAllocation?.[user.user_id] || 0;

                        const minMargin =
                          Number(form[selectedStrategyKey]?.minimumMargin || 1);

                        const maxLots = Math.floor(allocated / minMargin);

                        const manualLots =
                          form[selectedStrategyKey]?.manualLots?.[user.user_id] || 0;

                        return (
                          <tr key={user.user_id}>
                            <td>{user.name}</td>
                            <td className="text-end">{formatAmount(allocated)}</td>
                            <td className="text-end">{manualLots} / {maxLots}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </>
            );
          })()}
        </Modal.Body>

        <Modal.Footer>
          <Button
            variant="secondary"
            className="theme-btn"
            onClick={() => setShowStartModal(false)}
          >
            Cancel
          </Button>

          <Button
            variant="warning"
            className="theme-btn"
            onClick={async () => {
              setShowStartModal(false);
              await handleStartAlgo(selectedStrategyKey);
            }}
          >
            Confirm & Start {selectedStrategyKey?.replace(/_/g, "-")}
          </Button>
        </Modal.Footer>
      </Modal>
    </MainLayout>
  );
};

export default AlgoPage;
