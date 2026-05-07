import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Table, Button, Spinner } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';

const HealthcheckPage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, false);
  const [loadingUserIds, setLoadingUserIds] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // User login
  const userLogin = useCallback((user) => {
    setLoadingUserIds(prev => [...prev, user.id]);

    API.get('/zerodha/login?user_id=' + user.user_id, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => fetchUsers())
      .catch(() => toast.error("Failed to login user."))
      .finally(() => {
        setLoadingUserIds(prev => prev.filter(id => id !== user.id));
      });
  }, [token, fetchUsers]);

  const isUserLoading = (userId) => loadingUserIds.includes(userId);

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Logged Users</h2>
      </div>

      <div className="table-wrapper">
          <div className="dark-gray-table-wrap">
              <div className="row">
                  <div className="col-xxl-12 col-xl-12 col-lg-12">
                    <Table className="table table-dark table-bordered">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>User ID</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.length === 0 ? (
                          <tr><td colSpan="5" className="text-center">No users found</td></tr>
                        ) : (
                          users.map((user, idx) => (
                            <tr key={user.id}>
                              <td>{idx + 1}</td>
                              <td>{user.name}</td>
                              <td>{user.email}</td>
                              <td>{user.user_id}</td>
                              <td>
                                {isUserLoading(user.id) ? (
                                  <Button size="sm" variant="warning" disabled>
                                    <Spinner animation="border" size="sm" />
                                  </Button>
                                ) : (
                                  (() => {
                                    const hasToken = user.access_token && user.access_token.length > 0;
                                    let isToday = false;

                                    if (user.access_token_date) {
                                      const tokenDate = new Date(user.access_token_date);
                                      const today = new Date();
                                      isToday =
                                        tokenDate.getFullYear() === today.getFullYear() &&
                                        tokenDate.getMonth() === today.getMonth() &&
                                        tokenDate.getDate() === today.getDate();
                                    }

                                    if (hasToken && isToday) {
                                      return (
                                        <Button size="sm" variant="success" disabled>
                                          <i className="bi bi-check"></i>
                                        </Button>
                                      );
                                    } else {
                                      return (
                                        <Button
                                          size="sm"
                                          variant="warning"
                                          onClick={() => userLogin(user)}
                                        >
                                          <i className="bi bi-arrow-clockwise"></i>
                                        </Button>
                                      );
                                    }
                                  })()
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>
              </div>
          </div>
      </div>
    </MainLayout>
  );
};

export default HealthcheckPage;
