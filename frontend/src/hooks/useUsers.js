import { useState, useCallback } from 'react';
import API from '../api';
import { toast } from 'react-toastify';

export default function useUsers(token, showInactive = false) {
  const [users, setUsers] = useState([]);

  const fetchUsers = useCallback(() => {
    const url = showInactive ? '/users?include_inactive=true' : '/users';
    API.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setUsers(res.data))
      .catch(() => toast.error("Failed to load users"));
  }, [token, showInactive]);

  return { users, setUsers, fetchUsers };
}
