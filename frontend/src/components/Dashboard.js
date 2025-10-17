import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function Dashboard() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/api/clients")
      .then(res => res.json())
      .then(data => setClients(data));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Rate Limiter Dashboard</h1>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Client</th>
            <th>API Key</th>
            <th>Per Minute</th>
            <th>Per Day</th>
          </tr>
        </thead>
        <tbody>
          {clients.map(c => (
            <tr key={c.apiKey}>
              <td>{c.name}</td>
              <td>{c.apiKey}</td>
              <td>{c.perMinuteLimit}</td>
              <td>{c.perDayLimit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
