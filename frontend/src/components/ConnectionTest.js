'use client';

import { useState, useEffect } from 'react';

const ConnectionTest = () => {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [testData, setTestData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api';

  // Test connection to backend and database
  const testConnection = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/test/connection/`);
      const data = await response.json();
      
      if (response.ok) {
        setConnectionStatus(data);
      } else {
        setError(data.message || 'Connection test failed');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Get test data from database
  const getTestData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/test/data/`);
      const data = await response.json();
      
      if (response.ok) {
        setTestData(data.data || []);
      } else {
        setError(data.message || 'Failed to fetch test data');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Create new test data
  const createTestData = async () => {
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/test/data/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('');
        // Refresh the test data list
        await getTestData();
      } else {
        setError(data.message || 'Failed to create test data');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Clear all test data
  const clearTestData = async () => {
    if (!confirm('Are you sure you want to clear all test data?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/test/data/clear/`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestData([]);
        setConnectionStatus(null);
      } else {
        setError(data.message || 'Failed to clear test data');
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🔗 Connection Test Module
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Test Section */}
        <div className="bg-[#3CCED7]/10 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-[#1a9ba3]">
            Connection Status
          </h3>
          
          <button
            onClick={testConnection}
            disabled={loading}
            className="w-full bg-[#3CCED7] text-white py-2 px-4 rounded hover:bg-[#2AB5BD] disabled:opacity-50 mb-4"
          >
            {loading ? 'Testing...' : 'Test Connection'}
          </button>

          {connectionStatus && (
            <div className="bg-green-100 p-3 rounded border border-green-300">
              <h4 className="font-semibold text-green-800 mb-2">✅ Connection Successful!</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p><strong>Status:</strong> {connectionStatus.status}</p>
                <p><strong>Message:</strong> {connectionStatus.message}</p>
                <p><strong>Database:</strong> {connectionStatus.database}</p>
                <p><strong>Test Data:</strong> {connectionStatus.test_data}</p>
                <p><strong>Timestamp:</strong> {new Date(connectionStatus.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Create Test Data Section */}
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-green-800">
            Create Test Data
          </h3>
          
          <div className="space-y-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter test message..."
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && createTestData()}
            />
            
            <button
              onClick={createTestData}
              disabled={loading || !message.trim()}
              className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Test Data'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Data Display */}
      <div className="mt-6 bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Test Data from Database ({testData.length} items)
          </h3>
          <div className="space-x-2">
            <button
              onClick={getTestData}
              disabled={loading}
              className="bg-gray-600 text-white py-1 px-3 rounded text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <button
              onClick={clearTestData}
              disabled={loading}
              className="bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </div>

        {testData.length > 0 ? (
          <div className="space-y-2">
            {testData.map((item) => (
              <div key={item.id} className="bg-white p-3 rounded border border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-800">{item.message}</p>
                    <p className="text-sm text-gray-500">
                      ID: {item.id} | Created: {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">
            No test data found. Create some data to test the database connection!
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-semibold text-yellow-800 mb-2">📋 How to Test:</h4>
        <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
          <li>Click &quot;Test Connection&quot; to verify backend and database connectivity</li>
          <li>Enter a message and click &quot;Create Test Data&quot; to add data to the database</li>
          <li>Click &quot;Refresh&quot; to see all test data from the database</li>
          <li>Use &quot;Clear All&quot; to remove all test data</li>
        </ol>
        <p className="text-xs text-yellow-600 mt-2">
          This module tests: Frontend → Nginx → Backend → PostgreSQL → Database
        </p>
      </div>
    </div>
  );
};

export default ConnectionTest; 