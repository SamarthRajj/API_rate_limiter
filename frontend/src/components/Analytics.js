import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Download, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DEMO_USAGE_DATA = [
  {
    name: "AppA",
    apiKey: "68f1e0aced2e2209642f6406",
    minuteCount: 42,
    dayCount: 1234,
    blockedCount: 19,
    perMinuteLimit: 60,
    perDayLimit: 5000,
  },
  {
    name: "new2",
    apiKey: "bc175c9efc2d2b80f4a989a54f2e3e27",
    minuteCount: 17,
    dayCount: 620,
    blockedCount: 6,
    perMinuteLimit: 30,
    perDayLimit: 2500,
  },
];

const Analytics = () => {
  const [usageData, setUsageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    fetchUsageData();
    // Refresh every 3 seconds for more real-time updates
    const interval = setInterval(fetchUsageData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsageData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/usage');
      const data = await response.json();
      console.log('Analytics: Fetched usage data', data); // Debug log
      const arr = Array.isArray(data) ? data : [];
      if (arr.length === 0) {
        setUsingDemo(true);
        setUsageData(DEMO_USAGE_DATA);
      } else {
        setUsingDemo(false);
        setUsageData(arr);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching usage data:', error);
      setUsingDemo(true);
      setUsageData(DEMO_USAGE_DATA);
      setLoading(false);
    }
  };

  const calculateSuccessRate = (client) => {
    const total = client.dayCount + client.blockedCount;
    if (total === 0) return 0; // Changed from 100 to 0 when no requests
    return ((client.dayCount / total) * 100).toFixed(1);
  };

  const calculateUsagePercentage = (current, limit) => {
    return ((current / limit) * 100).toFixed(1);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusBg = (percentage) => {
    if (percentage >= 90) return 'bg-red-100';
    if (percentage >= 80) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const exportToCSV = () => {
    const headers = ['Client Name', 'API Key', 'Minute Count', 'Minute Limit', 'Day Count', 'Day Limit', 'Blocked Count', 'Success Rate'];
    const rows = usageData.map(client => [
      client.name,
      client.apiKey,
      client.minuteCount,
      client.perMinuteLimit,
      client.dayCount,
      client.perDayLimit,
      client.blockedCount,
      calculateSuccessRate(client) + '%'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-limiter-analytics-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
    a.click();
  };

  // Prepare data for charts - recalculate on every render when usageData changes
  const successRateData = React.useMemo(() => {
    return usageData.map(client => {
      const successRate = parseFloat(calculateSuccessRate(client));
      return {
        name: client.name,
        successRate: successRate,
        blockedRate: 100 - successRate,
      };
    });
  }, [usageData]);

  const usageComparisonData = React.useMemo(() => {
    return usageData.map(client => ({
      name: client.name,
      current: client.dayCount,
      limit: client.perDayLimit,
      percentage: parseFloat(calculateUsagePercentage(client.dayCount, client.perDayLimit)),
    }));
  }, [usageData]);

  const pieData = React.useMemo(() => {
    // Filter out clients with 0 requests for better visualization
    return usageData
      .filter(client => client.dayCount > 0)
      .map(client => ({
        name: client.name,
        value: client.dayCount,
      }));
  }, [usageData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Demo note */}
      <div className={`rounded-lg shadow-md p-5 mb-6 border ${usingDemo ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {usingDemo ? "Demo data shown (static)" : "Live data (real-time)"}
            </h3>
            <p className="text-xs text-gray-700 mt-1">
              For real-time analytics, point the frontend to a running backend and generate traffic using the simulator from your local machine.
            </p>
          </div>
          {usingDemo && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              Demo snapshot
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Analytics & Insights</h2>
        <button
          onClick={exportToCSV}
          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Clients</p>
              <p className="text-3xl font-bold text-gray-900">{usageData.length}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {usageData.reduce((sum, c) => sum + c.dayCount, 0)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Blocked</p>
              <p className="text-3xl font-bold text-gray-900">
                {usageData.reduce((sum, c) => sum + c.blockedCount, 0)}
              </p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Success Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {usageData.length > 0
                  ? (usageData.reduce((sum, c) => sum + parseFloat(calculateSuccessRate(c)), 0) / usageData.length).toFixed(1)
                  : '0.0'}%
              </p>
            </div>
            <AlertTriangle className="w-10 h-10 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {usageData
          .filter(client => {
            const dayPercentage = (client.dayCount / client.perDayLimit) * 100;
            return dayPercentage >= 80;
          })
          .map(client => {
            const dayPercentage = (client.dayCount / client.perDayLimit) * 100;
            return (
              <div key={client.apiKey} className={`rounded-lg shadow-md p-6 ${getStatusBg(dayPercentage)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className={`w-5 h-5 ${getStatusColor(dayPercentage)}`} />
                      <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {dayPercentage >= 90
                        ? 'Critical: Near daily limit!'
                        : 'Warning: Approaching daily limit'}
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {client.dayCount} / {client.perDayLimit} requests ({dayPercentage.toFixed(1)}%)
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Success Rate Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Success Rate by Client</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={successRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="successRate" name="Success Rate %" fill="#10b981" animationDuration={500} />
              <Bar dataKey="blockedRate" name="Blocked Rate %" fill="#ef4444" animationDuration={500} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usage Comparison */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Daily Usage vs Limit</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="current" name="Current Usage" fill="#0ea5e9" />
              <Bar dataKey="limit" name="Limit" fill="#e5e7eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Usage Distribution Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Request Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={500}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              No request data yet
            </div>
          )}
        </div>

        {/* Usage Percentage */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Usage Percentage (Daily)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={usageComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="percentage" 
                name="Usage %" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ r: 6 }}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <h3 className="text-lg font-semibold p-6 border-b">Detailed Statistics</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Minute Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Blocked</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usageData.map((client) => {
                const dayPercentage = calculateUsagePercentage(client.dayCount, client.perDayLimit);
                const successRate = calculateSuccessRate(client);
                
                return (
                  <tr key={client.apiKey}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.minuteCount} / {client.perMinuteLimit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.dayCount} / {client.perDayLimit} ({dayPercentage}%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {client.blockedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {successRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        dayPercentage >= 90
                          ? 'bg-red-100 text-red-800'
                          : dayPercentage >= 80
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {dayPercentage >= 90 ? 'Critical' : dayPercentage >= 80 ? 'Warning' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;

