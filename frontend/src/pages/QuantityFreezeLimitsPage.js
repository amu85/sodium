import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import API from '../api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import MainLayout from '../layout/MainLayout';
import AsyncSelect from 'react-select/async';
import { Button, Spinner, Table } from 'react-bootstrap';
import useUsers from '../hooks/useUsers';

const QuantityFreezeLimitsPage = () => {
  const { token } = useContext(AuthContext);
  const { fetchUsers } = useUsers(token, false);

  const [uniqueOptions, setUniqueOptions] = useState({});
  const [filters, setFilters] = useState({});
  const [freezeLimits, setFreezeLimits] = useState({});
  const [loading, setLoading] = useState(true);

  // Fetch all users (context)
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch unique instrument filter options
  const fetchUniqueInstrumentOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/zerodha/unique-instrument-options', {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      });
      setUniqueOptions(res.data.uniqueOptions);
    } catch {
      toast.error('Failed to load filter options');
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  useEffect(() => {
    fetchUniqueInstrumentOptions();
  }, [fetchUniqueInstrumentOptions]);

  // Fetch freeze limits
  const fetchFreezeLimits = useCallback(async () => {
    try {
      const res = await API.get('/freeze-limits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFreezeLimits(res.data.freezeLimits || {});
    } catch {
      toast.error('Failed to load freeze limits');
    }
  }, [token]);

  useEffect(() => {
    fetchFreezeLimits();
  }, [fetchFreezeLimits]);

  // Add instruments into freeze-limits JSON
  const fetchInstrumentsAndSave = async () => {
    const selectedNames = filters?.name || [];
    if (selectedNames.length === 0) {
      toast.error('Please select at least one Name before adding.');
      return;
    }

    setLoading(true);
    try {
      // Fetch instruments for selected filters
      const res = await API.get('/zerodha/instruments', {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
      });

      const instruments = res.data?.instruments || [];
      if (instruments.length === 0) {
        toast.warn('No instruments found for selected Name.');
        return;
      }

      // Add them to freeze-limits JSON
      await API.put(
        '/freeze-limits',
        { instrumentName: instruments[0]?.name, limit: 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(`${instruments[0]?.name} instrument added to freeze-limits !`);

      // Refresh list
      await fetchFreezeLimits();

      // Reset filters
      handleReset();
    } catch {
      toast.error('Failed to fetch or add instruments');
    } finally {
      setLoading(false);
    }
  };

  // Save/update limit for one instrument
  const handleSaveFreezeLimit = async (name, value) => {
    if (!value || Number(value) <= 0) {
      toast.error('Please enter a valid freeze limit');
      return;
    }

    try {
      await API.put(
        '/freeze-limits',
        { instrumentName: name, limit: Number(value) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Freeze limit saved!');
      setFreezeLimits((prev) => ({ ...prev, [name]: Number(value) }));
    } catch {
      toast.error('Failed to save freeze limit');
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
        <h2 className="page-title">Quantity Freeze Limits</h2>
      </div>

      {/* Filters */}
      <div className="form-wrapper">
        <div className="row g-4">
          {Object.keys(uniqueOptions).map((key) => (
            <div className="col-xxl-3 col-xl-4 col-lg-6 col-md-6" key={key}>
              <label className="form-label text-capitalize">
                {key !== 'expiry' && key !== 'tradingsymbol' && key !== 'strike' && (
                  key.replace(/_/g, ' ')
                )}
              </label>
              <div style={{ color: '#000000' }}>
                {key !== 'expiry' && key !== 'tradingsymbol' && key !== 'strike' && (
                  <AsyncSelect
                    isMulti
                    cacheOptions={false}
                    defaultOptions={(uniqueOptions[key] || [])
                      .slice(0, 100)
                      .map((v) => ({ label: v.toString(), value: v.toString() }))}
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
                )}
              </div>
            </div>
          ))}

          <div className="col-md-3 d-flex align-items-end">
            {loading ? (
              <Spinner animation="border" variant="warning" />
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      {/* Freeze Limits Table */}
      <div className="table-wrapper form-wrapper mt-5">
        <div className="dark-gray-table-wrap">
          <div className="table-responsive">
            <Table className="table table-dark table-bordered">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Qty Freeze Limit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(freezeLimits).length > 0 ? (
                  Object.entries(freezeLimits).map(([name, value], idx) => (
                    <tr key={name}>
                      <td>{idx + 1}</td>
                      <td>{name}</td>
                      <td>
                        <input
                          type="number"
                          className="form-control"
                          value={value || ''}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setFreezeLimits((prev) => ({
                              ...prev,
                              [name]: newVal,
                            }));
                          }}
                          style={{ width: '100px' }}
                        />
                      </td>
                      <td>
                        <Button
                          size="sm"
                          className="theme-btn"
                          variant="warning"
                          onClick={() =>
                            handleSaveFreezeLimit(name, freezeLimits[name])
                          }
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No instrument names found
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

export default QuantityFreezeLimitsPage;
