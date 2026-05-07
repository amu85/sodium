import React, { useEffect, useContext, useCallback, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Button, Spinner, Table } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';
import { createPortal } from "react-dom";
import { formatTime } from '../utils/helpers';

const OrdersPage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const [loading, setLoading] = useState(false);
  const [userOrders, setUserOrders] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modifyPrice, setModifyPrice] = useState("");
  const [proceedLoading, setProceedLoading] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  const fetchUserOrders = useCallback(async (users) => {
    setLoading(true);

    users.forEach(user => {
      try {
        API.get('/zerodha/get-orders', {
          headers: { Authorization: `Bearer ${token}` },
          params: { user_id: user.user_id },
        }).then((res) => {
          setUserOrders((prev) => ({
            ...prev,
            [user.user_id]: res.data.orders || {},
          }));
          setLoading(false);
        })
        .catch(() => {
          toast.error('Failed to load user orders');
          setLoading(false);
        });
      } catch (err) {
        toast.error('Failed to load user orders');
      } finally {
        setLoading(false);
      }
    });
  }, [token]);

  useEffect(() => {
    if (users.length > 0) {
      fetchUserOrders(users);
    }
  }, [users, fetchUserOrders]);

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '0.00';
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const toggleDropdown = (key, event) => {
    if (openDropdown === key) {
      setOpenDropdown(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + window.scrollY,
      left: rect.right + window.scrollX - 150,
    });
    setOpenDropdown(key);
  };

  const handleModifyClick = (user_id, order) => {
    setSelectedOrder({ ...order, user_id });
    setModifyPrice(order.price);
  };

  const handleModifyOrder = () => {
    if (!selectedOrder) return;
    setProceedLoading(true);

    API.post('/zerodha/modify-regular-order', {
      user_id: selectedOrder.user_id,
      order_id: selectedOrder.order_id,
      price: modifyPrice,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        setProceedLoading(false);
        toast.success("Order modified successfully");
        setSelectedOrder(null);
        fetchUserOrders(users);
      })
      .catch((err) => {
        setProceedLoading(false);
        console.error(err);
        toast.error(
          err.response?.data?.message ||
          err.message ||
          "Something went wrong while closing orders"
        );
        setExecutionResults(err.response?.data);
      });
  };

  const handleCancelOrder = (user_id, order) => {
    if (!window.confirm(`Are you sure you want to cancel order ${order.order_id}?`)) {
      return;
    }

    API.post('/zerodha/cancel-regular-order', {
      user_id: user_id,
      order_id: order.order_id,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => {
        toast.success("Order cancelled successfully");
        fetchUserOrders(users);
      })
      .catch(() => {
        toast.error("Failed to cancel order");
      });
  };

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Orders</h2>
        {loading && (
          <div>
              <Spinner animation="border" variant="warning" />
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <div className="dark-table-wrap table-responsive">
          <Table className="table table-dark table-bordered">
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Name</th>
                <th className="text-end">Orders</th>
                <th className="text-end">Open Orders</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 && (
                users
                  .filter(user => userOrders[user.user_id] && userOrders[user.user_id].length > 0)
                  .map((user, idx) => {
                  const orders = userOrders[user.user_id] || [];
                  const openOrdersCount = orders.filter(order => order.status === "OPEN").length;
                  const hasOrders = orders.length > 0;
                  return (
                    <React.Fragment key={`user${user.id}`}>
                      <tr className={openOrdersCount > 0 ? "open-order-user-row" : ""}>
                        <td>{idx + 1}</td>
                        <td>{user.name} {user.is_compound ? ('(c)') : ('(nc)')}</td>
                        <td className="text-end">{userOrders[user.user_id].length}</td>
                        <td className="text-end">{openOrdersCount}</td>
                      </tr>
                      {hasOrders && (
                        <tr className="nested-table-row">
                          <td colSpan="6">
                              <table className="table table-dark table-bordered table-hover w-100">
                                  <thead>
                                      <tr>
                                          <th className="text-center">#</th>
                                          <th className="text-center">Time</th>
                                          <th className="text-center">Type</th>
                                          <th className="">Instrument</th>
                                          <th className="">Product</th>
                                          <th className="text-end">Qty.</th>
                                          <th className="text-end">Avg. price</th>
                                          <th className="text-center">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {userOrders[user.user_id] && userOrders[user.user_id].length > 0 && (
                                        userOrders[user.user_id].map((order, idx) => (
                                          <tr key={`userPositions${idx}`}>
                                            <td className="text-center">{idx + 1}</td>
                                            <td className="text-center">{formatTime(order.order_timestamp)}</td>
                                            <td className={`text-center ${order.transaction_type === 'BUY' ? 'text-color-blue' : 'text-color-red'}`}>{order.transaction_type}</td>
                                            <td className="">{order.tradingsymbol}</td>
                                            <td className="">{order.product}</td>
                                            <td className="text-end">{order.filled_quantity} / {order.quantity}</td>
                                            <td className="text-end">{formatAmount(order.average_price)}</td>
                                            <td className="text-center">
                                              {order.status === "COMPLETE" ? (
                                                <span className="text-color-green">{order.status}</span>
                                              ) : order.status === "OPEN" ? (
                                                <div className="order-dropdown-wrapper d-inline-block">
                                                  <i
                                                    className="bi bi-three-dots-vertical cursor-pointer"
                                                    onClick={(e) => toggleDropdown(`${order.order_id}${user.user_id}${idx}`, e)}
                                                  ></i>

                                                  {openDropdown === `${order.order_id}${user.user_id}${idx}` &&
                                                    createPortal(
                                                      <ul
                                                        className="dropdown-menu show position-absolute"
                                                        style={{
                                                          top: `${dropdownPosition.top}px`,
                                                          left: `${dropdownPosition.left}px`,
                                                          zIndex: 2000,
                                                          minWidth: "150px", // ensures consistent width
                                                        }}
                                                      >
                                                        <li>
                                                          <button
                                                            className="dropdown-item"
                                                            onClick={() => handleModifyClick(user.user_id, order)}
                                                          >
                                                            Modify Order
                                                          </button>
                                                        </li>
                                                        <li>
                                                          <button
                                                            className="dropdown-item text-danger"
                                                            onClick={() => handleCancelOrder(user.user_id, order)}
                                                          >
                                                            Cancel Order
                                                          </button>
                                                        </li>
                                                      </ul>,
                                                      document.body
                                                    )}
                                                </div>
                                              ) : (
                                                <span className="text-color-red">{order.status}</span>
                                              )}
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                  </tbody>
                              </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}

              {users.filter(user => userOrders[user.user_id] && userOrders[user.user_id].length > 0).length === 0 && (
                <tr>
                  <td colSpan="4" className="text-center">No order found</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </div>

      {/* Modify Order Modal */}
      {selectedOrder && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Modify Order</h5>
                {!proceedLoading && (
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedOrder(null)}
                  ></button>
                )}
              </div>
              <div className="modal-body">
                <label>Price</label>
                <input
                  type="number"
                  className="form-control"
                  value={modifyPrice}
                  onChange={(e) => setModifyPrice(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                {!executionResults ? (
                  proceedLoading ? (
                    <Button size="sm" variant="warning" disabled>
                      <Spinner animation="border" size="sm" /> Please wait...
                    </Button>
                  ) : (
                    <>
                      <button className="theme-btn btn-secondary" onClick={() => setSelectedOrder(false)}>
                        Cancel
                      </button>
                      <button className="theme-btn primary" onClick={handleModifyOrder}>
                        Update Order
                      </button>
                    </>
                  )
                ) : (
                  <div className="w-100">
                    <h5 className="text-dark">Order Results</h5>
                    <div className="text-danger">
                      {executionResults.error}
                    </div>
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
    </MainLayout>
  );
};

export default OrdersPage;
