// src/components/RealtimeDashboard.js
import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, AreaChart, Area, Bar, BarChart, CartesianGrid, ReferenceLine } from "recharts";

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
    fetch(USAGE_API)
      .then(r => r.json())
      .then(data => {
        // Ensure data is an array
        const clientsData = Array.isArray(data) ? data : [];
        setClients(clientsData);
        const initialSeries = {};
        clientsData.forEach(c => {
          initialSeries[c.apiKey] = [{ ts: Date.now(), tsLabel: nowLabel(), allowed: c.minuteCount, blocked: c.blockedCount, day: c.dayCount }];
        });
        setSeries(initialSeries);
      })
      .catch(err => {
        console.error("Error fetching usage data:", err);
        setClients([]);
        setSeries({});
      });

    // connect socket
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.log("connected to socket", socketRef.current.id);
    });

    // backend emits 'usageUpdate' for allowed requests and 'blockedRequest' when blocking
    socketRef.current.on("usageUpdate", (p) => {
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
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvent = (p) => {
    setClients(prev => {
      // update client list counts (if known)
      const found = prev.find(x => x.apiKey === p.apiKey);
      let newClients = prev;
      if (found) {
        newClients = prev.map(x => x.apiKey === p.apiKey ? {
          ...x,
          minuteCount: p.minuteCount ?? x.minuteCount,
          dayCount: p.dayCount ?? x.dayCount,
          blockedCount: (p.status === "blocked") ? ((x.blockedCount||0)+1) : (p.blockedCount ?? x.blockedCount)
        } : x);
      } else if (p.apiKey) {
        // add new client if appeared
        newClients = [...prev, {
          apiKey: p.apiKey,
          name: p.clientName || "unknown",
          minuteCount: p.minuteCount ?? 0,
          dayCount: p.dayCount ?? 0,
          blockedCount: p.status === "blocked" ? 1 : 0,
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

  return (
    <div style={{ padding: 20 }}>
      <h1>Rate Limiter — Real-time Dashboard</h1>

      <section style={{ marginTop: 10 }}>
        <h2>Clients</h2>
        <table border="1" cellPadding="8">
          <thead>
            <tr><th>Name</th><th>API Key</th><th>Minute / Limit</th><th>Day / Limit</th><th>Blocked Today</th></tr>
          </thead>
          <tbody>
            {Array.isArray(clients) && clients.map(c => (
              <tr key={c.apiKey}>
                <td>{c.name}</td>
                <td style={{ fontFamily: "monospace", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>{c.apiKey}</td>
                <td>{(c.minuteCount||0)} / {c.perMinuteLimit}</td>
                <td>{(c.dayCount||0)} / {c.perDayLimit}</td>
                <td>{c.blockedCount||0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>Realtime Usage (per client)</h2>
        {Array.isArray(clients) && clients.map(c => {
          const perSecond = buildPerSecondData(c.apiKey);
          const cumulative = buildCumulativeData(c.apiKey);
          const perSecondLimit = (c.perMinuteLimit || 0) / 60; // approximate per-second limit
          const perDayLimit = c.perDayLimit || 0;
          // Prepare over-limit overlay for overall chart
          const cumulativeWithOverlay = cumulative.map(d => ({
            ...d,
            overLimit: perDayLimit && d.total > perDayLimit ? d.total : null
          }));

          return (
            <div key={c.apiKey} style={{ marginBottom: 48 }}>
              <h3>{c.name} — per second</h3>
              <BarChart width={900} height={260} data={perSecond}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tsLabel" hide={false} />
                <YAxis />
                <Tooltip />
                <Legend />
                {/* per-second limit line (approx) */}
                {perSecondLimit > 0 && (
                  <ReferenceLine y={perSecondLimit} stroke="#f97316" strokeDasharray="4 4" label="per-sec limit" />
                )}
                <Bar dataKey="allowed" name="Allowed" fill="#22c55e" />
                <Bar dataKey="blocked" name="Blocked" fill="#ef4444" />
              </BarChart>

              <div style={{ height: 16 }} />

              <h3>{c.name} — overall usage (cumulative)</h3>
              <AreaChart width={900} height={260} data={cumulativeWithOverlay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tsLabel" />
                <YAxis />
                <Tooltip />
                <Legend />
                {/* per-day limit reference */}
                {perDayLimit > 0 && (
                  <ReferenceLine y={perDayLimit} stroke="#f97316" strokeDasharray="4 4" label="daily limit" />
                )}
                {/* Base cumulative total */}
                <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" fill="#93c5fd" />
                {/* Overlay red when over limit */}
                <Area type="monotone" dataKey="overLimit" name="Over limit" stroke="#ef4444" fill="#fecaca" />
              </AreaChart>
            </div>
          );
        })}
      </section>
    </div>
  );
}
