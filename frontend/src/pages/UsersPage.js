import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { Table, Button, Form, Modal, Row, Col } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import useUsers from '../hooks/useUsers';

const UserPage = () => {
  const { token } = useContext(AuthContext);
  const { users, fetchUsers } = useUsers(token, true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    api_key: '',
    api_secret: '',
    user_id: '',
    password: '',
    totp_secret: '',
    access_token: '',
    server_ip: '',
    trading_funds: '',
    is_compound: false,
    is_active: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editUserId, setEditUserId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === "trading_funds" ? parseInt(value, 10) || 0 : value)
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      api_key: '',
      api_secret: '',
      user_id: '',
      password: '',
      totp_secret: '',
      access_token: '',
      server_ip: '',
      trading_funds: '',
      is_compound: false,
      is_active: false,
    });
    setIsEditing(false);
    setEditUserId(null);
  };

  const handleCreateOrUpdate = (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.name || !formData.email) {
      toast.error('Name and Email are required');
      return;
    }
    if (!formData.user_id || !formData.password) {
      toast.error('User Id and Password are required');
      return;
    }
    if (!formData.api_key || !formData.api_secret) {
      toast.error('API Key and Secret are required');
      return;
    }
    if (!formData.totp_secret) {
      toast.error('TOTP Secret is required');
      return;
    }
    if (!formData.trading_funds) {
      toast.error('Trading Funds is required');
      return;
    }

    if (isEditing) {
      // Update
      API.put(`/users/${editUserId}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(() => {
          toast.success('User updated');
          fetchUsers();
          setShowModal(false);
          resetForm();
        })
        .catch(() => toast.error('Failed to update user'));
    } else {
      // Create
      API.post('/users', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(() => {
          toast.success('User created');
          fetchUsers();
          setShowModal(false);
          resetForm();
        })
        .catch(() => toast.error('Failed to create user'));
    }
  };

  const handleEdit = (user) => {
    setFormData(user);
    setIsEditing(true);
    setEditUserId(user.id);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure?")) {
      API.delete(`/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(() => {
          toast.success('User deleted');
          fetchUsers();
        })
        .catch(() => toast.error('Failed to delete user'));
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const handleToggle = (id, field, value) => {
    API.put(`/users/${id}`, { [field]: value }, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        toast.success(`${field === "is_active" ? "Active status" : "Compound status"} updated`);
        fetchUsers();
      })
      .catch(() => toast.error("Failed to update status"));
  };

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4 d-flex justify-content-between align-items-center mb-3">
        <h2 className="page-title">Users</h2>
        <Button variant="warning" className="theme-btn" onClick={() => { setShowModal(true); resetForm(); }}>
          Add User
        </Button>
      </div>

      <div className="table-wrapper">
        <div className="dark-gray-table-wrap">
          <Table className="table table-dark table-bordered">
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Name</th>
                <th>Email</th>
                <th>Is Compound</th>
                <th>Is Active</th>
                <th>Server IP</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="7" className="text-center">No users found</td></tr>
              ) : (
                users.map((user, idx) => (
                  <tr key={user.id}>
                    <td>{idx + 1}</td>
                    <td>{user.name} {user.is_compound ? ('(c)') : ('(nc)')} </td>
                    <td>{user.email}</td>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={user.is_compound}
                        onChange={(e) => handleToggle(user.id, "is_compound", e.target.checked)}
                      />
                    </td>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={user.is_active}
                        onChange={(e) => handleToggle(user.id, "is_active", e.target.checked)}
                      />
                    </td>
                    <td>{user.server_ip}</td>
                    <td>
                      <Button size="sm" variant="warning" onClick={() => handleEdit(user)}><i className="bi bi-pencil"></i></Button>{' '}
                      <Button size="sm" variant="danger" onClick={() => handleDelete(user.id)}><i className="bi bi-trash"></i></Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Edit User' : 'Add User'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreateOrUpdate}>
          <Modal.Body>
            <Row>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Name *</Form.Label><Form.Control name="name" value={formData.name} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Email *</Form.Label><Form.Control type="email" name="email" value={formData.email} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>API Key *</Form.Label><Form.Control name="api_key" value={formData.api_key} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>API Secret *</Form.Label><Form.Control name="api_secret" value={formData.api_secret} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>User ID *</Form.Label><Form.Control name="user_id" value={formData.user_id} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Password *</Form.Label><Form.Control name="password" value={formData.password} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>TOTP Secret *</Form.Label><Form.Control name="totp_secret" value={formData.totp_secret} onChange={handleInputChange} required /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Server IP</Form.Label><Form.Control name="server_ip" value={formData.server_ip} onChange={handleInputChange} /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Trading Funds *</Form.Label><Form.Control type="number" name="trading_funds" value={formData.trading_funds} onChange={handleInputChange} /></Form.Group></Col>
              <Col md={3}><Form.Group className="mb-2"><Form.Label>Is Compound</Form.Label><Form.Check type="checkbox" name="is_compound" checked={formData.is_compound} onChange={handleInputChange} style={{ transform: "scale(1.5)", transformOrigin: "left center" }} /></Form.Group></Col>
              <Col md={3}><Form.Group className="mb-2"><Form.Label>Is Active</Form.Label><Form.Check type="checkbox" name="is_active" checked={formData.is_active} onChange={handleInputChange} style={{ transform: "scale(1.5)", transformOrigin: "left center" }} /></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Access Token</Form.Label>: <br /><Form.Label>{formData.access_token}</Form.Label></Form.Group></Col>
              <Col md={6}><Form.Group className="mb-2"><Form.Label>Access Token Date</Form.Label>: <br /><Form.Label>{formData.access_token_date ? formatDate(formData.access_token_date) : ''}</Form.Label></Form.Group></Col>
              { isEditing && (
                <Col md={6}>
                  <Form.Group className="mb-2">
                    <Form.Label>Authorization</Form.Label>: <br />
                    <a
                      href={`https://kite.trade/connect/login?v=3&api_key=${formData.api_key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-color-blue"
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  </Form.Group>
                </Col>
              )}
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" className="theme-btn" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
            <Button type="submit" variant="warning" className="theme-btn">{isEditing ? 'Update' : 'Create'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </MainLayout>
  );
};

export default UserPage;
