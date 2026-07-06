// src/components/RealtimeDashboard.js
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { AreaChart, Area, Bar, BarChart, CartesianGrid, ReferenceLine, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Activity, AlertCircle, Clock, Gauge, Loader2, Play, TrendingUp, Users, Zap } from 'lucide-react';

const API_BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
const SOCKET_URL = API_BASE_URL;
const USAGE_API = `${API_BASE_URL}/api/usage`;
const DEMO_API = `${API_BASE_URL}/api/demo`;
const DASHBOARD_CLIENT_LIMIT = 2;
const SIMULATION_DURATION_MS = 120000;
const SIMULATION_CYCLES = 2;

const SIMULATION_CONFIGS = {
  slow: { label: "Slow", loadMultiplier: 1 },
  medium: { label: "Medium", loadMultiplier: 1.4 },
  burst: { label: "Burst", loadMultiplier: 2 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getSimulationPlan(mode, client) {
  const config = SIMULATION_CONFIGS[mode];
  if (!config) return null;

  const perMinuteLimit = Math.max(1, Number(client?.perMinuteLimit) || 5);
  const requestsPerCycle = Math.max(1, Math.ceil(perMinuteLimit * config.loadMultiplier));
  const count = requestsPerCycle * SIMULATION_CYCLES;
  const interval = count > 1 ? Math.round(SIMULATION_DURATION_MS / (count - 1)) : SIMULATION_DURATION_MS;

  return {
    ...config,
    count,
    interval,
    requestsPerCycle,
    rate: `${requestsPerCycle} req/min`,
  };
}

function nowLabel() {
  return new Date().toLocaleTimeString();
}

const DEMO_CLIENTS = [
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

function buildDemoSeries() {
  const now = Date.now();
  const points = 30;

  const series = {};
  for (const c of DEMO_CLIENTS) {
    const arr = [];
    for (let i = points - 1; i >= 0; i--) {
      const ts = now - i * 1000;
      const tick = points - i;
      const allowed = c.name === "AppA" ? (tick % 6 === 0 ? 2 : 1) : (tick % 10 === 0 ? 2 : 1);
      const blocked = c.name === "AppA" ? (tick % 11 === 0 ? 1 : 0) : (tick % 17 === 0 ? 1 : 0);
      arr.push({ ts, tsLabel: new Date(ts).toLocaleTimeString(), allowed, blocked });
    }
    series[c.apiKey] = arr;
  }
  return series;
}

export default function RealtimeDashboard() {
  const [clients, setClients] = useState([]); // holds client meta + current counts
  const [series, setSeries] = useState({}); // per-client time series: { apiKey: [{tsLabel, allowed, blocked, total}] }
  const socketRef = useRef(null);
  const usingDemoRef = useRef(false);
  const chartsRef = useRef(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulationMode, setSimulationMode] = useState(null);
  const [simLog, setSimLog] = useState([]);

  useEffect(() => {
    // fetch initial client list + counts
    const fetchUsage = () => {
      fetch(USAGE_API)
        .then(r => r.json())
        .then(data => {
          // Ensure data is an array
          const clientsData = Array.isArray(data) ? data : [];
          if (clientsData.length === 0) {
            usingDemoRef.current = true;
            setUsingDemo(true);
            setClients(DEMO_CLIENTS);
            setSeries(buildDemoSeries());
            return;
          }

          usingDemoRef.current = false;
          setUsingDemo(false);
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
          console.warn("Usage API unavailable; showing static sample data.", err);
          usingDemoRef.current = true;
          setUsingDemo(true);
          setClients(DEMO_CLIENTS);
          setSeries(buildDemoSeries());
        });
    };

    // Initial fetch
    fetchUsage();

    // Refresh usage data while simulations are running so counters stay live even if sockets reconnect.
    const refreshInterval = setInterval(fetchUsage, 800);

    // connect socket
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    // backend emits 'usageUpdate' for allowed requests and 'blockedRequest' when blocking
    socketRef.current.on("usageUpdate", (p) => {
      // Map backend payload to our handler's expected shape
      handleEvent({
        apiKey: p.apiKey,
        status: "allowed",
        ts: new Date(p.timestamp).getTime(),
        clientName: p.clientName,
        minuteCount: p.minuteCount,
        dayCount: p.dayCount,
        blockedCount: p.blockedCount,
        perMinuteLimit: p.limits?.perMinute,
        perDayLimit: p.limits?.perDay
      });
    });

    socketRef.current.on("blockedRequest", (p) => {
      handleEvent({
        apiKey: p.apiKey,
        status: "blocked",
        ts: new Date(p.timestamp).getTime(),
        clientName: p.clientName,
        minuteCount: p.minuteCount,
        dayCount: p.dayCount,
        blockedCount: p.blockedCount,
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

  useEffect(() => {
    if (usingDemo) {
      setSelectedApiKey("");
      return;
    }

    const enabledClients = clients.slice(0, DASHBOARD_CLIENT_LIMIT).filter(c => c.enabled !== false && c.apiKey);
    if (enabledClients.length === 0) {
      setSelectedApiKey("");
      return;
    }

    setSelectedApiKey(prev => {
      const stillExists = enabledClients.some(c => c.apiKey === prev);
      return stillExists ? prev : enabledClients[0].apiKey;
    });
  }, [clients, usingDemo]);

  const handleEvent = (p) => {
    // If we are showing demo data, ignore socket events until real API is available.
    if (usingDemoRef.current) return;
    
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

  const runSimulation = async (mode) => {
    const eligibleClients = clients.slice(0, DASHBOARD_CLIENT_LIMIT).filter(c => c.enabled !== false && c.apiKey);
    const client = eligibleClients.find(c => c.apiKey === selectedApiKey) || eligibleClients[0];
    const config = client ? getSimulationPlan(mode, client) : null;

    if (!config || !client || usingDemo || simulating) return;

    setSimulating(true);
    setSimulationMode(mode);
    setSimLog([]);

    window.setTimeout(() => {
      chartsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    const log = [];

    for (let i = 0; i < config.count; i += 1) {
      const startedAt = performance.now();

      try {
        const response = await fetch(DEMO_API, {
          method: "GET",
          headers: {
            "x-api-key": client.apiKey,
          },
        });

        log.push({
          id: i + 1,
          status: response.status,
          passed: response.status >= 200 && response.status < 300,
          latencyMs: Math.round(performance.now() - startedAt),
        });
      } catch (error) {
        log.push({
          id: i + 1,
          status: "ERR",
          passed: false,
          latencyMs: 0,
        });
      }

      setSimLog([...log]);

      if (i < config.count - 1) {
        await sleep(config.interval);
      }
    }

    setSimulating(false);
    setSimulationMode(null);
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
    // Keep enough history to show both one-minute rate-limit cycles.
    if (arr.length > 120) return arr.slice(arr.length - 120);
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

  const visibleClients = clients.slice(0, DASHBOARD_CLIENT_LIMIT);
  const realClients = usingDemo ? [] : visibleClients.filter(c => c.enabled !== false && c.apiKey);
  const selectedClient = realClients.find(c => c.apiKey === selectedApiKey) || realClients[0];
  const slowPlan = getSimulationPlan("slow", selectedClient);
  const mediumPlan = getSimulationPlan("medium", selectedClient);
  const burstPlan = getSimulationPlan("burst", selectedClient);
  const passedCount = simLog.filter(entry => entry.passed).length;
  const blockedCount = simLog.filter(entry => !entry.passed).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Browser traffic simulator */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary-600" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-gray-900">Live Demo - Simulate Traffic</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Runs real requests for two minute-long limiter cycles with the selected client key.
            </p>
          </div>

          <div className="w-full lg:w-80">
            <label htmlFor="simulation-client" className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Client key
            </label>
            <select
              id="simulation-client"
              value={selectedApiKey}
              onChange={(event) => setSelectedApiKey(event.target.value)}
              disabled={simulating || realClients.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              {realClients.length === 0 ? (
                <option value="">No enabled clients available</option>
              ) : (
                realClients.map(client => (
                  <option key={client.apiKey} value={client.apiKey}>
                    {client.name} ({client.apiKey.slice(0, 10)}...)
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          <button
            onClick={() => runSimulation("slow")}
            disabled={simulating || !selectedClient}
            className="min-h-20 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-green-200 bg-green-50 text-left hover:bg-green-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Slow simulation"
          >
            <span>
              <span className="block text-sm font-semibold text-green-900">Slow</span>
              <span className="block text-xs text-green-700">{slowPlan.count} requests at {slowPlan.rate}</span>
            </span>
            {simulating && simulationMode === "slow" ? (
              <Loader2 className="w-5 h-5 text-green-700 animate-spin" aria-hidden="true" />
            ) : (
              <Clock className="w-5 h-5 text-green-700" aria-hidden="true" />
            )}
          </button>

          <button
            onClick={() => runSimulation("medium")}
            disabled={simulating || !selectedClient}
            className="min-h-20 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-yellow-200 bg-yellow-50 text-left hover:bg-yellow-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Medium simulation"
          >
            <span>
              <span className="block text-sm font-semibold text-yellow-900">Medium</span>
              <span className="block text-xs text-yellow-700">{mediumPlan.count} requests at {mediumPlan.rate}</span>
            </span>
            {simulating && simulationMode === "medium" ? (
              <Loader2 className="w-5 h-5 text-yellow-700 animate-spin" aria-hidden="true" />
            ) : (
              <Gauge className="w-5 h-5 text-yellow-700" aria-hidden="true" />
            )}
          </button>

          <button
            onClick={() => runSimulation("burst")}
            disabled={simulating || !selectedClient}
            className="min-h-20 flex items-center justify-between gap-3 px-4 py-3 rounded-md border border-red-200 bg-red-50 text-left hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            title="Burst simulation"
          >
            <span>
              <span className="block text-sm font-semibold text-red-900">Burst</span>
              <span className="block text-xs text-red-700">{burstPlan.count} requests at {burstPlan.rate}</span>
            </span>
            {simulating && simulationMode === "burst" ? (
              <Loader2 className="w-5 h-5 text-red-700 animate-spin" aria-hidden="true" />
            ) : (
              <Zap className="w-5 h-5 text-red-700" aria-hidden="true" />
            )}
          </button>
        </div>

        {usingDemo && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Connect to a running backend with at least one enabled client before running browser traffic.
          </div>
        )}

        {simLog.length > 0 && (
          <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div className="text-sm font-semibold text-gray-900">
                {selectedClient?.name || "Selected client"} results
              </div>
              <div className="text-sm text-gray-700">
                <span className="font-semibold text-green-700">{passedCount}</span> allowed
                <span className="mx-2 text-gray-400">|</span>
                <span className="font-semibold text-red-700">{blockedCount}</span> blocked or failed
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {simLog.map(entry => (
                <span
                  key={entry.id}
                  title={`Request ${entry.id}: ${entry.status} in ${entry.latencyMs}ms`}
                  className={`w-8 h-8 inline-flex items-center justify-center rounded-md text-xs font-semibold border ${
                    entry.passed
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-red-100 text-red-800 border-red-200"
                  }`}
                >
                  {entry.status}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Clients</p>
              <p className="text-3xl font-bold text-gray-900">{visibleClients.length}</p>
            </div>
            <Users className="w-10 h-10 text-primary-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests (Current Minute)</p>
              <p className="text-3xl font-bold text-gray-900">
                {visibleClients.reduce((sum, c) => sum + (c.minuteCount || 0), 0)}
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
                {visibleClients.reduce((sum, c) => sum + (c.dayCount || 0), 0)}
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
                {visibleClients.reduce((sum, c) => sum + (c.blockedCount || 0), 0)}
              </p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>
      </div>

      {/* Clients Overview Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Clients Overview</h2>
          </div>
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
              {visibleClients.map(c => {
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
      <div ref={chartsRef} className="space-y-8 scroll-mt-6">
        {visibleClients.map(c => {
          const perSecond = buildPerSecondData(c.apiKey);
          const cumulative = buildCumulativeData(c.apiKey);
          const axisInterval = Math.max(0, Math.ceil(perSecond.length / 8));
          const cumulativeAxisInterval = Math.max(0, Math.ceil(cumulative.length / 8));
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
                      <XAxis dataKey="tsLabel" angle={-45} textAnchor="end" height={80} fontSize={10} interval={axisInterval} />
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
                      <XAxis dataKey="tsLabel" angle={-45} textAnchor="end" height={80} fontSize={10} interval={cumulativeAxisInterval} />
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
