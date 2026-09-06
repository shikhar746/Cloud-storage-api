/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StorageProvider } from './context/StorageContext';
import { AuthPage } from './components/auth/AuthPage';
import { MainLayout } from './components/layout/MainLayout';
import { PublicShareView } from './components/public/PublicShareView';
import { Cloud } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div id="app-loading-screen" className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 mb-4 animate-pulse">
          <Cloud className="w-6 h-6" />
        </div>
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
          Initializing Storage Session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <StorageProvider>
      <MainLayout />
    </StorageProvider>
  );
};

/**
 * The app has no router, but a share link still needs a URL of its own. The
 * path is read once at boot: /s/<token> renders the visitor page instead of
 * the app, deliberately OUTSIDE AuthProvider — a visitor has no account, and
 * mounting the auth flow would redirect them to a sign-in screen they cannot
 * complete.
 *
 * The character class matches base64url, which is what the server generates.
 */
function publicShareToken(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : null;
}

export default function App() {
  const token = publicShareToken();
  if (token) return <PublicShareView token={token} />;

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
