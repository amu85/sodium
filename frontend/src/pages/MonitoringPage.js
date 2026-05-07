import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import AsyncSelect from 'react-select/async';
import { Spinner, Table } from 'react-bootstrap';
import useUsers from '../hooks/useUsers';

const MonitoringPage = () => {
  const { token } = useContext(AuthContext);
  const { fetchUsers } = useUsers(token, false);

  const [uniqueOptions, setUniqueOptions] = useState({});
  const [filters, setFilters] = useState({});
  const [monitoring, setMonitoring] = useState([]);
  const [loading, setLoading] = useState(false);
  const [monitoringRunning, setMonitoringRunning] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch filter options
  const fetchUniqueInstrumentOptions = useCallback(() => {
    setLoading(true);
    API.get('/zerodha/unique-instrument-options', {
      headers: { Authorization: `Bearer ${token}` },
      params: filters,
    })
      .then((res) => {
        setUniqueOptions(res.data.uniqueOptions);
      })
      .catch(() => {
        toast.error('Failed to load filter options');
      })
      .finally(() => setLoading(false));
  }, [token, filters]);

  /*useEffect(() => {
    fetchUniqueInstrumentOptions();
  }, [fetchUniqueInstrumentOptions]);*/

  // Fetch current monitoring list
  const fetchMonitoring = useCallback(async () => {
    try {
      setButtonLoading(true);
      const res = await API.get('/monitoring', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { monitoringRunning, ...filteredData } = res.data.Monitoring;
      const data = Array.isArray(filteredData)
        ? filteredData
        : Object.values(filteredData || {});
      setMonitoringRunning(monitoringRunning);
      setMonitoring(data);
    } catch (err) {
      toast.error('Failed to load monitoring list');
    } finally {
      setButtonLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMonitoring();
  }, [fetchMonitoring]);

  const handleStartMonitoring = async () => {
    try {
      setButtonLoading(true);
      await API.post("/futures-strategy/start", {}, { headers: { Authorization: `Bearer ${token}` } });
      setMonitoringRunning(true);
      toast.success("Monitoring Started");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start Monitoring");
    } finally {
      setButtonLoading(false);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      setButtonLoading(true);
      await API.post("/futures-strategy/stop", {}, { headers: { Authorization: `Bearer ${token}` } });
      setMonitoringRunning(false);
      toast.success("Monitoring Stopped");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to stop Monitoring");
    } finally {
      setButtonLoading(false);
    }
  };

  // Add instruments
  const fetchInstrumentsAndSave = async () => {
    const selectedNames = filters?.name || [];
    if (selectedNames.length === 0) {
      toast.error('Please select at least one Name before adding.');
      return;
    }

    setLoading(true);
    try {
      // Fetch instruments based on selected filters
      const res = await API.get('/zerodha/instruments', {
        headers: { Authorization: `Bearer ${token}` },
        params: filters, // this includes selected name(s)
      });

      const instruments = res.data?.instruments || [];

      if (instruments.length === 0) {
        toast.warn('No instruments found for selected Name.');
        setLoading(false);
        return;
      }

      // Save fetched instruments to monitoring
      await API.put(
        '/monitoring',
        { instruments },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${instruments.length} instruments added to monitoring!`);

      // Refresh monitoring list
      await fetchMonitoring();

      // Reset filters after add
      handleReset()
    } catch (err) {
      toast.error('Failed to fetch or add instruments');
    } finally {
      setLoading(false);
    }
  };

  // Reset filters
  const handleReset = () => {
    setFilters({});
    fetchUniqueInstrumentOptions();
  };

  return (
    <MainLayout>
      <ToastContainer />
      <div className="breadcrumb-wrap mb-4">
        <h2 className="page-title">Monitoring</h2>

        <div className="my-3">
          {!loading && (
            !monitoringRunning ? (
              <button
                className="theme-btn success text-center"
                onClick={handleStartMonitoring}
                disabled={buttonLoading}
              >
                {buttonLoading ? "Starting..." : "Start Monitoring"}
              </button>
            ) : (
              <button
                className="theme-btn danger text-center"
                onClick={handleStopMonitoring}
                disabled={buttonLoading}
              >
                {buttonLoading ? "Stopping..." : "Stop Monitoring"}
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter Form */}
      <div className="form-wrapper d-none">
        <div className="row g-4">
          {Object.keys(uniqueOptions).map((key) => (
            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-6" key={key}>
              <label className="form-label text-capitalize">
                {key !== 'expiry' && key !== 'tradingsymbol' && key !== 'strike' && (
                  key.replace(/_/g, ' ')
                )}
              </label>
              <div style={{ color: '#000000' }}>
                {key !== 'expiry' && key !== 'tradingsymbol' && key !== 'strike' ? (
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
                  <div></div>
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
                onClick={fetchInstrumentsAndSave}
              >
                Add
              </button>
              <button
                className="theme-btn btn-secondary w-50"
                onClick={handleReset}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Monitoring Table */}
      <div className="table-wrapper form-wrapper">
        <div className="dark-gray-table-wrap">
          <div className="table-responsive">
            <Table className="table table-dark table-bordered">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th className="text-center">Settings</th>
                  <th>Trades</th>
                  <th>Returns</th>
                </tr>
              </thead>
              <tbody>
                {monitoring && Object.keys(monitoring).length > 0 ? (
                  Object.entries(monitoring).map(([key, inst], idx) => (
                    <tr key={key}>
                      <td>{idx + 1}</td>
                      <td>
                        <label>Name:</label> {inst.name}<br />
                        <label>Exchange:</label> {inst.exchange}<br />
                        <label>Derivative:</label> {inst.derivative_name}
                      </td>
                      <td className="text-center"><i className="bi bi-gear"></i></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center">
                      No instruments added for monitoring.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default MonitoringPage;
