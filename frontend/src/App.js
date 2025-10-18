import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from "./components/Navbar";
import RealtimeDashboard from "./components/RealtimeDashboard";
import AdminPanel from "./components/AdminPanel";
import Analytics from "./components/Analytics";

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleRefresh = () => {
    setLastUpdated(new Date());
    window.location.reload();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <RealtimeDashboard />;
      case 'admin':
        return <AdminPanel />;
      case 'analytics':
        return <Analytics />;
      default:
        return <RealtimeDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onRefresh={handleRefresh}
        lastUpdated={lastUpdated}
      />
      <main>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
