import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Key, Power, Check, X, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const AdminPanel = () => {
  const [clients, setClients] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [authToken, setAuthToken] = useState(localStorage.getItem('adminToken') || '');
  const [showLoginForm, setShowLoginForm] = useState(!authToken);
  
  const [formData, setFormData] = useState({
    name: '',
    perMinuteLimit: '',
    perDayLimit: '',
  });

  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    if (authToken) {
      fetchClients();
    }
  }, [authToken]);

  const fetchClients = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      toast.error('Failed to fetch clients');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData),
      });
      const data = await response.json();
      
      if (data.success) {
        localStorage.setItem('adminToken', data.data.token);
        setAuthToken(data.data.token);
        setShowLoginForm(false);
        toast.success('Login successful!');
      } else {
        toast.error(data.message || 'Login failed');
      }
    } catch (error) {
      toast.error('Login error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setAuthToken('');
    setShowLoginForm(true);
    toast.success('Logged out successfully');
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          perMinuteLimit: parseInt(formData.perMinuteLimit),
          perDayLimit: parseInt(formData.perDayLimit),
        }),
      });
      
      if (response.ok) {
        toast.success('Client created successfully!');
        setShowCreateForm(false);
        setFormData({ name: '', perMinuteLimit: '', perDayLimit: '' });
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to create client');
      }
    } catch (error) {
      toast.error('Error creating client');
    }
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${editingClient._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: formData.name,
          perMinuteLimit: parseInt(formData.perMinuteLimit),
          perDayLimit: parseInt(formData.perDayLimit),
        }),
      });
      
      if (response.ok) {
        toast.success('Client updated successfully!');
        setEditingClient(null);
        setFormData({ name: '', perMinuteLimit: '', perDayLimit: '' });
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to update client');
      }
    } catch (error) {
      toast.error('Error updating client');
    }
  };

  const handleDeleteClient = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        toast.success('Client deleted successfully!');
        setDeleteConfirm(null);
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to delete client');
      }
    } catch (error) {
      toast.error('Error deleting client');
    }
  };

  const handleToggleClient = async (client) => {
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client._id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        toast.success(`Client ${client.enabled ? 'disabled' : 'enabled'} successfully!`);
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to toggle client');
      }
    } catch (error) {
      toast.error('Error toggling client');
    }
  };

  const handleRegenerateKey = async (client) => {
    try {
      const response = await fetch(`http://localhost:5000/api/clients/${client._id}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        toast.success('API key regenerated successfully!');
        fetchClients();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to regenerate key');
      }
    } catch (error) {
      toast.error('Error regenerating key');
    }
  };

  const startEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      perMinuteLimit: client.perMinuteLimit.toString(),
      perDayLimit: client.perDayLimit.toString(),
    });
  };

  if (showLoginForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Toaster position="top-right" />
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <AlertCircle className="w-12 h-12 text-primary-600 mx-auto mb-2" />
            <h2 className="text-2xl font-bold text-gray-900">Admin Login</h2>
            <p className="text-gray-600 mt-2">Enter your credentials to access the admin panel</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary-600 text-white py-2 rounded-md hover:bg-primary-700 transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Client</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingClient) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingClient ? 'Edit Client' : 'Create New Client'}
          </h3>
          <form onSubmit={editingClient ? handleUpdateClient : handleCreateClient} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Minute Limit</label>
                <input
                  type="number"
                  value={formData.perMinuteLimit}
                  onChange={(e) => setFormData({ ...formData, perMinuteLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Per Day Limit</label>
                <input
                  type="number"
                  value={formData.perDayLimit}
                  onChange={(e) => setFormData({ ...formData, perDayLimit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  min="1"
                  required
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{editingClient ? 'Update' : 'Create'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingClient(null);
                  setFormData({ name: '', perMinuteLimit: '', perDayLimit: '' });
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clients Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minute Limit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day Limit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.map((client) => (
              <tr key={client._id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                  {client.apiKey.substring(0, 16)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.perMinuteLimit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.perDayLimit}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    client.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {client.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => startEdit(client)}
                    className="text-primary-600 hover:text-primary-900"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleClient(client)}
                    className="text-yellow-600 hover:text-yellow-900"
                    title={client.enabled ? 'Disable' : 'Enable'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRegenerateKey(client)}
                    className="text-purple-600 hover:text-purple-900"
                    title="Regenerate API Key"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(client)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete client "{deleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex space-x-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteClient(deleteConfirm._id)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;

