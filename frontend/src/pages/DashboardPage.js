import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Table, Button, Spinner } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';

const DashboardPage = () => {
  const { token, logout } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const [loadingUserFund, setLoadingUserFund] = useState(false);
  const [expandedHoldingsRow, setExpandedHoldingsRow] = useState(null);
  const [expandedPositionsRow, setExpandedPositionsRow] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  // Get User Fund
  const getUserFunds = useCallback(() => {
    setLoadingUserFund(true);

    API.get('/zerodha/get-user-funds', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        toast.success('Fund Updated.');
        fetchUsers();
      })
      .catch(() => {
        toast.error('Session expired. Logging out...');
        setTimeout(() => {
          logout();
        }, 2000);
      })
      .finally(() => {
        setLoadingUserFund(false);
      });
  }, [token, fetchUsers, logout]);

  // Get last updated from first user (if exists)
  const lastUpdated =
    users.length > 0 ? formatDateTime(users[0].fund_last_updated_at) : '-';

  const toggleHoldingsRow = (userId) => {
    if (expandedHoldingsRow === userId) {
      setExpandedHoldingsRow(null);
    } else {
      setExpandedHoldingsRow(userId);
      setExpandedPositionsRow(null);
    }
  };

  const togglePositionsRow = (userId) => {
    if (expandedPositionsRow === userId) {
      setExpandedPositionsRow(null);
    } else {
      setExpandedPositionsRow(userId);
      setExpandedHoldingsRow(null);
    }
  };

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Users</h2>
      </div>
      <div className="theme-content-wrapper">
        <div className="row">
          <div className="col-xxl-6 col-xl-6 col-lg-6 col-md-6">
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
          <div className="col-xxl-6 col-xl-6 col-lg-6 col-md-6 text-end">
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <div className="dark-table-wrap table-responsive">
          <Table className="table table-dark table-bordered">
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Name</th>
                <th className="text-end">Holdings</th>
                <th className="text-end">Positions</th>
                <th className="text-end">Trading Funds</th>
                <th className="text-end">Available Funds</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => (
                  <React.Fragment key={`user${user.id}`}>
                    <tr>
                      <td>{idx + 1}</td>
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
                        <span
                          className="clickable-name"
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleHoldingsRow(user.id)}
                        >
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
                        <span
                          className="clickable-name"
                          style={{ cursor: "pointer" }}
                          onClick={() => togglePositionsRow(user.id)}
                        >
                          ₹ {formatAmount(
                            user?.positions?.net?.reduce?.((sum, position) => sum + (position.pnl || 0), 0)
                          )}
                        </span>
                      </td>
                      <td className="text-end">₹ {formatAmount(user.trading_funds || 0)}</td>
                      <td className="text-end">₹ {formatAmount(user.available_funds || 0)} <span className="text-color-blue small">({formatAmount(((user.available_funds * 100) / user.trading_funds) || 0)}%)</span></td>
                    </tr>
                    {expandedHoldingsRow === user.id && (
                      <tr className="nested-table-row">
                        <td colSpan="6">
                            <table className="table table-dark table-bordered w-100">
                                <thead>
                                    <tr>
                                      <th className="text-center" colSpan="9">Holdings of {user.name}</th>
                                    </tr>
                                    <tr>
                                        <th className="text-center">Sr. No.</th>
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
                                            <td className="text-center">{idx + 1}</td>
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
                    {expandedPositionsRow === user.id && (
                      <tr className="nested-table-row">
                        <td colSpan="6">
                            <table className="table table-dark table-bordered w-100">
                                <thead>
                                    <tr>
                                      <th className="text-center" colSpan="7">Positions of {user.name}</th>
                                    </tr>
                                    <tr>
                                        <th className="text-center">Sr. No.</th>
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
                                          <td className="text-center">{idx + 1}</td>
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
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold">
                <td colSpan="2" className="text-end">Total</td>
                <td className=""></td>
                <td className=""></td>
                <td className="text-end">
                  ₹ {formatAmount(
                    users.reduce((sum, u) => sum + (u.trading_funds || 0), 0)
                  )}
                </td>
                <td className="text-end">
                  ₹ {formatAmount(
                    users.reduce((sum, u) => sum + (u.available_funds || 0), 0)
                  )}
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default DashboardPage;
