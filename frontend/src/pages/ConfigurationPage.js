import React, { useContext, useEffect, useState } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import API from '../api';
import MainLayout from '../layout/MainLayout';
import { ConfigContext } from '../context/ConfigContext';
import { AuthContext } from '../context/AuthContext';

const ConfigurationPage = () => {
  const { token } = useContext(AuthContext);
  const { config, updateConfig } = useContext(ConfigContext);
  const [form, setForm] = useState({
    preOpeningTime: '',
    openingTime: '',
    closingTime: '',
    postClosingTime: '',
    orderMargin: '',
    sebiRules: '',
    strikeMultiple: '',
    perpetualCycle: false,
    breakoutUpPerValue: '',
    breakoutDownPerValue: '',
    stopLossPer: 1,
  });
  const [algoRunning, setAlgoRunning] = useState(false);

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    API.put('/config', form, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        toast.success('Configuration updated successfully');
        updateConfig(form);
      })
      .catch(() => toast.error('Failed to update configuration'));
  };

  useEffect(() => {
    const fetchAlgoStatus = async () => {
      try {
        const res = await API.get("/algo/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAlgoRunning(res.data.running);
      } catch {
        toast.error("Failed to fetch Algo status");
      }
    };

    fetchAlgoStatus();
  }, [token]);

  return (
    <MainLayout>
      <ToastContainer />
      <Form onSubmit={handleSubmit} className="form-wrapper">
        <div className="breadcrumb-wrap mb-4">
          <h2 className="page-title">System Configuration</h2>
        </div>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Pre-Opening Time</Form.Label>
              <Form.Control type="time" name="preOpeningTime" value={form.preOpeningTime} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Opening Time</Form.Label>
              <Form.Control type="time" name="openingTime" value={form.openingTime} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Closing Time</Form.Label>
              <Form.Control type="time" name="closingTime" value={form.closingTime} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Post-Closing Time</Form.Label>
              <Form.Control type="time" name="postClosingTime" value={form.postClosingTime} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Order Margin %</Form.Label>
              <Form.Control type="number" name="orderMargin" value={form.orderMargin} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group className="mb-3">
              <Form.Label>SEBI Rules</Form.Label>
              <Form.Control as="textarea" rows={4} name="sebiRules" value={form.sebiRules} onChange={handleChange} required />
            </Form.Group>
          </Col>
        </Row>
        <hr />
        <div className="breadcrumb-wrap mb-4">
          <h2 className="page-title">Strategy Configuration</h2>
        </div>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Strike Multiple</Form.Label>
              <Form.Control type="number" name="strikeMultiple" value={form.strikeMultiple} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Perpetual cycle</Form.Label>
              {!algoRunning ? (
                <Form.Check type="checkbox" name="perpetualCycle" checked={form.perpetualCycle} onChange={handleChange} style={{ transform: "scale(1.5)", transformOrigin: "left center" }} />
              ) : (
                <p className="text-danger">
                  <span className="fw-bold">Algo running</span>...
                </p>
              )}
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Breakout up per value</Form.Label>
              <Form.Control type="number" name="breakoutUpPerValue" value={form.breakoutUpPerValue} onChange={handleChange} required />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Breakout down per value</Form.Label>
              <Form.Control type="number" name="breakoutDownPerValue" value={form.breakoutDownPerValue} onChange={handleChange} required />
            </Form.Group>
          </Col>
        </Row>
        <hr />
        <div className="breadcrumb-wrap mb-4">
          <h2 className="page-title">Monitoring Configuration</h2>
        </div>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Stop Loss %</Form.Label>
              <Form.Control type="number" name="stopLossPer" value={form.stopLossPer} onChange={handleChange} required />
            </Form.Group>
          </Col>
        </Row>
        <Button type="submit" variant="warning" className="theme-btn">Update</Button>
      </Form>
    </MainLayout>
  );
};

export default ConfigurationPage;
