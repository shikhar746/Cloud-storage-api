import React, { useState } from 'react';
import {
  X,
  Server,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Database,
  ExternalLink,
  Code,
  Sliders,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { checkBackendHealth } from '../../services/api';
import { mockStorage } from '../../services/mockStorage';

export const ApiConfigModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, refreshCurrentFolder } = useStorage();
  const { apiMode, setApiMode, baseUrl, setBaseUrl, user } = useAuth();

  const [inputUrl, setInputUrl] = useState(baseUrl);
  const [testing, setTesting] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    tested: boolean;
    online: boolean;
    message?: string;
  } | null>(null);

  if (!isSettingsOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setHealthStatus(null);
    try {
      const isOnline = await checkBackendHealth(inputUrl);
      setHealthStatus({
        tested: true,
        online: isOnline,
        message: isOnline
          ? `Successfully reached backend at ${inputUrl}`
          : `No response from ${inputUrl}. Make sure your Express server is running.`,
      });
    } catch {
      setHealthStatus({
        tested: true,
        online: false,
        message: `Failed to connect to ${inputUrl}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setBaseUrl(inputUrl);
    setIsSettingsOpen(false);
    refreshCurrentFolder();
  };

  const handleResetSandbox = () => {
    if (confirm('Reset sandbox data to default sample files & folders?')) {
      mockStorage.resetToDefaults(user?.id || 'demo-user-id');
      refreshCurrentFolder();
      setIsSettingsOpen(false);
    }
  };

  return (
    <div
      id="api-config-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsSettingsOpen(false)}
    >
      <div
        id="api-config-modal"
        className="bg-[#111111] w-full max-w-lg rounded-2xl shadow-2xl border border-[#1f1f1f] p-6 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-800/30 text-indigo-400 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">API Connection & Backend Settings</h3>
              <p className="text-xs text-gray-400">Connect to shikhar746/Cloud-storage-api</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
          {/* Mode Selector */}
          <div>
            <label className="block font-semibold text-gray-300 mb-2">Operating Mode</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setApiMode('sandbox')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  apiMode === 'sandbox'
                    ? 'border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-[#262626] bg-[#141414] hover:border-[#333333]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-sm">Sandbox Mode</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-800/30 font-semibold text-[10px]">
                    Recommended
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Fast client-side engine with persistent localStorage. Perfect for instant testing without setting up Supabase.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setApiMode('live')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  apiMode === 'live'
                    ? 'border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-[#262626] bg-[#141414] hover:border-[#333333]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-sm">Live Backend</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 font-semibold text-[10px]">
                    REST API
                  </span>
                </div>
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Sends live HTTP requests with cookie credentials to your running Cloud-storage-api Express server.
                </p>
              </button>
            </div>
          </div>

          {/* Backend URL configuration */}
          <div className="space-y-2">
            <label className="block font-semibold text-gray-300">
              Backend Base URL
            </label>
            <div className="flex gap-2">
              <input
                id="backend-url-input"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:5000"
                className="flex-1 rounded-xl border border-[#262626] bg-[#161616] px-3.5 py-2 text-xs font-mono text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-2 rounded-xl border border-[#262626] hover:bg-[#1a1a1a] text-gray-300 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>Test</span>
              </button>
            </div>

            {healthStatus && (
              <div
                className={`p-2.5 rounded-lg flex items-center gap-2 text-[11px] border ${
                  healthStatus.online
                    ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
                    : 'bg-amber-950/30 text-amber-400 border-amber-800/40'
                }`}
              >
                {healthStatus.online ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                )}
                <span>{healthStatus.message}</span>
              </div>
            )}
          </div>

          {/* Backend Endpoints Spec Info */}
          <div className="rounded-xl bg-[#141414] border border-[#1f1f1f] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-gray-300 text-[11px]">
              <Code className="w-3.5 h-3.5 text-indigo-400" />
              <span>Supported Backend API Contracts:</span>
            </div>
            <ul className="space-y-1 text-[11px] text-gray-400 font-mono">
              <li>• POST /api/auth/login & /api/auth/register</li>
              <li>• GET /api/folders & POST /api/folders</li>
              <li>• POST /api/files/upload (multipart/form-data)</li>
              <li>• GET /api/folders/trash & PATCH /restore</li>
              <li>• POST /api/shares & GET /api/shares/:type/:id</li>
            </ul>
          </div>

          {/* Reset Sandbox Data */}
          <div className="pt-2 border-t border-[#1f1f1f] flex items-center justify-between">
            <div>
              <span className="font-semibold text-gray-200 block">Reset Sandbox Data</span>
              <span className="text-gray-500 text-[11px]">Re-populate default files and folders</span>
            </div>
            <button
              type="button"
              onClick={handleResetSandbox}
              className="px-3 py-1.5 rounded-lg border border-[#262626] hover:bg-[#1a1a1a] text-gray-300 font-medium text-xs transition-colors"
            >
              Reset Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#1f1f1f] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition-colors"
          >
            Cancel
          </button>
          <button
            id="save-api-settings-btn"
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
