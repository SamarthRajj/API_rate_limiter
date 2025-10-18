// src/components/RealtimeDashboard.js
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { AreaChart, Area, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, AlertCircle, TrendingUp, Users } from 'lucide-react';

const SOCKET_URL = "http://localhost:5000"; // change if needed
const USAGE_API = "http://localhost:5000/api/usage";

function nowLabel() {
  return new Date().toLocaleTimeString();
}

export default function RealtimeDashboard() {
  const [clients, setClients] = useState([]); // holds client meta + current counts
  const [series, setSeries] = useState({}); // per-client time series: { apiKey: [{tsLabel, allowed, blocked, total}] }
  const socketRef = useRef(null);

  useEffect(() => {
    // fetch initial client list + counts
    const fetchUsage = () => {
      fetch(USAGE_API)
        .then(r => r.json())
        .then(data => {
          // Ensure data is an array
          const clientsData = Array.isArray(data) ? data : [];
          console.log('Fetched usage data:', clientsData);
          
          // Update clients state with current counts
          setClients(clientsData);
          
          // Initialize series ONLY if empty (first load)
          setSeries(prev => {
            const newSeries = { ...prev };
            clientsData.forEach(c => {
              // Only initialize if this client doesn't have series data yet
              if (!newSeries[c.apiKey] || newSeries[c.apiKey].length === 0) {
                newSeries[c.apiKey] = [{ 
                  ts: Date.now(), 
                  tsLabel: nowLabel(), 
                  allowed: 0, 
                  blocked: 0 
                }];
              }
            });
            return newSeries;
          });
        })
        .catch(err => {
          console.error("Error fetching usage data:", err);
          setClients([]);
        });
    };

    // Initial fetch
    fetchUsage();

    // Refresh usage data every 3 seconds to ensure table stays updated
    const refreshInterval = setInterval(fetchUsage, 3000);

    // connect socket
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("connected to socket", socketRef.current.id);
    });

    // backend emits 'usageUpdate' for allowed requests and 'blockedRequest' when blocking
    socketRef.current.on("usageUpdate", (p) => {
      console.log('usageUpdate event:', p);
      // Map backend payload to our handler's expected shape
      handleEvent({
        apiKey: p.apiKey,
        status: "allowed",
        ts: new Date(p.timestamp).getTime(),
        minuteCount: p.minuteCount,
        dayCount: p.dayCount,
        perMinuteLimit: p.limits?.perMinute,
        perDayLimit: p.limits?.perDay
      });
    });

    socketRef.current.on("blockedRequest", (p) => {
      console.log('blockedRequest event:', p);
      handleEvent({
        apiKey: p.apiKey,
        status: "blocked",
        ts: new Date(p.timestamp).getTime(),
        minuteCount: p.minuteCount,
        dayCount: p.dayCount,
        perMinuteLimit: p.perMinuteLimit,
        perDayLimit: p.perDayLimit
      });
    });

    return () => {
      clearInterval(refreshInterval);
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvent = (p) => {
    // Log for debugging
    console.log('Socket event received:', p);
    
    setClients(prev => {
      // update client list counts (if known)
      const found = prev.find(x => x.apiKey === p.apiKey);
      let newClients = prev;
      if (found) {
        newClients = prev.map(x => x.apiKey === p.apiKey ? {
          ...x,
          minuteCount: p.minuteCount ?? x.minuteCount,
          dayCount: p.dayCount ?? x.dayCount,
          blockedCount: p.blockedCount ?? x.blockedCount,
          perMinuteLimit: p.perMinuteLimit ?? x.perMinuteLimit,
          perDayLimit: p.perDayLimit ?? x.perDayLimit
        } : x);
      } else if (p.apiKey) {
        // add new client if appeared
        newClients = [...prev, {
          apiKey: p.apiKey,
          name: p.clientName || "unknown",
          minuteCount: p.minuteCount ?? 0,
          dayCount: p.dayCount ?? 0,
          blockedCount: p.blockedCount ?? 0,
          perMinuteLimit: p.perMinuteLimit || 0,
          perDayLimit: p.perDayLimit || 0
        }];
      }
      return newClients;
    });

    // update time series
    setSeries(prev => {
      const apiKey = p.apiKey || "unknown";
      const entry = { ts: p.ts || Date.now(), tsLabel: nowLabel() };
      if (p.status === "allowed") {
        entry.allowed = 1;
        entry.blocked = 0;
      } else if (p.status === "blocked") {
        entry.allowed = 0;
        entry.blocked = 1;
      } else {
        // missing/invalid key events
        entry.allowed = 0;
        entry.blocked = 0;
      }
      const cur = prev[apiKey] ? [...prev[apiKey]] : [];
      cur.push(entry);
      // Keep a larger history so cumulative graph can show the day
      const maxPoints = 24 * 60 * 60; // up to a day of second-level points
      if (cur.length > maxPoints) cur.splice(0, cur.length - maxPoints);
      return { ...prev, [apiKey]: cur };
    });
  };

  // Build per-second bar data: allowed, blocked per second
  const buildPerSecondData = (apiKey) => {
    const s = series[apiKey] || [];
    const buckets = {};
    
    s.forEach(pt => {
      const second = pt.ts ? Math.floor(pt.ts / 1000) : Math.floor(Date.now() / 1000);
      if (!buckets[second]) {
        buckets[second] = { 
          ts: second, 
          tsLabel: new Date(second * 1000).toLocaleTimeString(), 
          allowed: 0, 
          blocked: 0 
        };
      }
      // Each event represents 1 request
      if (pt.allowed > 0) buckets[second].allowed += 1;
      if (pt.blocked > 0) buckets[second].blocked += 1;
    });
    
    const arr = Object.values(buckets).sort((a, b) => a.ts - b.ts);
    // keep last 30 seconds for better visualization
    if (arr.length > 30) return arr.slice(arr.length - 30);
    return arr;
  };

  // Build cumulative total over time for overall usage chart (allowed only)
  const buildCumulativeData = (apiKey) => {
    const s = series[apiKey] || [];
    const points = [...s]
      .map(pt => ({ ts: pt.ts || Date.now(), allowed: pt.allowed || 0, blocked: pt.blocked || 0 }))
      .sort((a, b) => a.ts - b.ts);
    let cumulative = 0;
    return points.map(pt => {
      // Only count allowed towards the cumulative daily total
      cumulative += (pt.allowed || 0);
      return {
        ts: pt.ts,
        tsLabel: new Date(pt.ts).toLocaleTimeString(),
        total: cumulative
      };
    });
  };

  if (!Array.isArray(clients) || clients.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Clients Yet</h3>
          <p className="text-gray-600">Create your first API client to start monitoring rate limits.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Clients</p>
              <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
            </div>
            <Users className="w-10 h-10 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests (Current Minute)</p>
              <p className="text-3xl font-bold text-gray-900">
                {clients.reduce((sum, c) => sum + (c.minuteCount || 0), 0)}
              </p>
            </div>
            <Activity className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {clients.reduce((sum, c) => sum + (c.dayCount || 0), 0)}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Blocked Today</p>
              <p className="text-3xl font-bold text-gray-900">
                {clients.reduce((sum, c) => sum + (c.blockedCount || 0), 0)}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Clients Overview Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Clients Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minute Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Day Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blocked Today</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.map(c => {
                const minutePercentage = ((c.minuteCount || 0) / c.perMinuteLimit) * 100;
                const dayPercentage = ((c.dayCount || 0) / c.perDayLimit) * 100;
                const isWarning = dayPercentage >= 80;
                const isCritical = dayPercentage >= 90;

                return (
                  <tr key={c.apiKey} className={isCritical ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {c.apiKey?.substring(0, 16)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="font-medium">{c.minuteCount || 0}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-gray-600">{c.perMinuteLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            minutePercentage >= 90 ? 'bg-red-600' : minutePercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(minutePercentage, 100)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <span className="font-medium">{c.dayCount || 0}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-gray-600">{c.perDayLimit}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          className={`h-2 rounded-full ${
                            dayPercentage >= 90 ? 'bg-red-600' : dayPercentage >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(dayPercentage, 100)}%` }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                      {c.blockedCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        isCritical
                          ? 'bg-red-100 text-red-800'
                          : isWarning
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isCritical ? 'Critical' : isWarning ? 'Warning' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Charts for Each Client */}
      <div className="space-y-8">
        {clients.map(c => {
          const perSecond = buildPerSecondData(c.apiKey);
          const cumulative = buildCumulativeData(c.apiKey);
          const perSecondLimit = (c.perMinuteLimit || 0) / 60;
          const perDayLimit = c.perDayLimit || 0;
          const cumulativeWithOverlay = cumulative.map(d => ({
            ...d,
            overLimit: perDayLimit && d.total > perDayLimit ? d.total : null
          }));

          return (
            <div key={c.apiKey} className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">{c.name}</h3>
              
              {/* Side by Side Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Requests per Second Chart */}
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-4">Requests per Second</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={perSecond}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tsLabel" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {perSecondLimit > 0 && (
                        <ReferenceLine y={perSecondLimit} stroke="#f97316" strokeDasharray="4 4" label="per-sec limit" />
                      )}
                      <Bar dataKey="allowed" name="Allowed" fill="#22c55e" />
                      <Bar dataKey="blocked" name="Blocked" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Cumulative Usage Chart */}
                <div>
                  <h4 className="text-md font-medium text-gray-700 mb-4">Cumulative Usage (Daily)</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={cumulativeWithOverlay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="tsLabel" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {perDayLimit > 0 && (
                        <ReferenceLine y={perDayLimit} stroke="#f97316" strokeDasharray="4 4" label="daily limit" />
                      )}
                      <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" fill="#93c5fd" />
                      <Area type="monotone" dataKey="overLimit" name="Over limit" stroke="#ef4444" fill="#fecaca" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
