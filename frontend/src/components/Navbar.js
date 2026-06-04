import React from 'react';
import { Activity, Settings, BarChart3, RefreshCw } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab, onRefresh, lastUpdated }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'admin', label: 'Admin Panel', icon: Settings },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:py-0">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center md:gap-8">
            <div className="flex shrink-0 items-center space-x-2">
              <Activity className="w-8 h-8 text-primary-600" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Rate Limiter</h1>
            </div>
            
            <div className="flex max-w-full gap-1 overflow-x-auto pb-1 sm:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4 rounded-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            {lastUpdated && (
              <span className="hidden text-sm text-gray-500 sm:inline">
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={onRefresh}
              className="flex shrink-0 items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

