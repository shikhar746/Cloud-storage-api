import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Cloud,
  LogOut,
  User,
  Settings,
  X,
  Server,
  ChevronDown,
  Folder as FolderIcon,
  File as FileIconLucide,
  ExternalLink,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes } from '../../utils/formatters';

export const Header: React.FC = () => {
  const { user, logout, apiMode, baseUrl } = useAuth();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    navigateToFolder,
    setPreviewFile,
    setIsSettingsOpen,
    setActiveTab,
    isSidebarOpen,
    toggleSidebar,
  } = useStorage();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasSearchResults =
    searchResults && (searchResults.folders.length > 0 || searchResults.files.length > 0);

  return (
    <header
      id="app-header"
      className="h-16 bg-[#111111] border-b border-[#1f1f1f] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30"
    >
      {/* Brand & Mode */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          id="hamburger-sidebar-toggle"
          type="button"
          onClick={toggleSidebar}
          className="p-2 -ml-1 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 cursor-pointer"
          aria-label={isSidebarOpen ? 'Collapse navigation sidebar' : 'Open navigation sidebar'}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          id="header-brand-logo"
          onClick={() => {
            setActiveTab('files');
            navigateToFolder(null);
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs group-hover:bg-indigo-500 transition-colors">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-sm sm:text-base leading-none block tracking-tight">
              CloudStorage
            </span>
            <span className="hidden sm:block text-[11px] font-medium text-gray-400 mt-0.5">
              Explorer Console
            </span>
          </div>
        </button>

        {/* Backend mode pill */}
        <button
          id="header-api-mode-badge"
          onClick={() => setIsSettingsOpen(true)}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            apiMode === 'live'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20'
          }`}
          title="Click to configure API connection"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiMode === 'live' ? 'bg-emerald-400' : 'bg-indigo-400'
            }`}
          />
          <span>{apiMode === 'live' ? 'Live API' : 'Sandbox (Demo)'}</span>
        </button>
      </div>

      {/* Global Search */}
      <div ref={searchContainerRef} className="relative flex-1 max-w-xl">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="w-4 h-4 text-gray-500" />
          </div>
          <input
            id="global-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search files, folders, or document contents..."
            className="block w-full rounded-full border border-[#2a2a2a] bg-[#1a1a1a] pl-9 pr-9 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:bg-[#202020] focus:border-indigo-500 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              id="clear-search-btn"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.trim() && (
          <div
            id="search-results-dropdown"
            className="absolute left-0 right-0 mt-2 bg-[#111111] rounded-xl shadow-2xl border border-[#1f1f1f] py-2 max-h-96 overflow-y-auto z-50"
          >
            {hasSearchResults ? (
              <div className="space-y-3">
                {searchResults!.folders.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Folders ({searchResults!.folders.length})
                    </div>
                    {searchResults!.folders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setActiveTab('files');
                          navigateToFolder(f.id, f.name);
                          setIsSearchFocused(false);
                          setSearchQuery('');
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#1a1a1a] flex items-center gap-2.5 text-sm text-gray-200 transition-colors"
                      >
                        <FileIcon name={f.name} isFolder size="sm" />
                        <span className="font-medium truncate">{f.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults!.files.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Files ({searchResults!.files.length})
                    </div>
                    {searchResults!.files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setPreviewFile(file);
                          setIsSearchFocused(false);
                        }}
                        className="w-full px-3.5 py-2 text-left hover:bg-[#1a1a1a] flex items-center justify-between gap-2.5 text-sm text-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileIcon name={file.name} mimeType={file.mime_type} size="sm" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">
                          {formatBytes(file.size_bytes)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-gray-400">
                No matching files or folders found for "{searchQuery}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls: Settings & User menu */}
      <div className="flex items-center gap-2">
        <button
          id="header-settings-btn"
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl transition-colors"
          title="Backend API Connection & Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User profile dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            id="user-menu-btn"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[#1a1a1a] transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 font-semibold text-xs flex items-center justify-center">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden sm:block text-xs font-semibold text-gray-200 max-w-[120px] truncate">
              {user?.name || 'Account'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {isUserMenuOpen && (
            <div
              id="user-menu-dropdown"
              className="absolute right-0 mt-2 w-64 rounded-xl bg-[#111111] shadow-2xl border border-[#1f1f1f] py-2 z-50 text-sm"
            >
              <div className="px-4 py-2 border-b border-[#1f1f1f]">
                <p className="font-semibold text-white truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="w-full px-4 py-2 text-left flex items-center gap-2.5 text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
                >
                  <Server className="w-4 h-4 text-gray-400" />
                  <span>API Settings</span>
                </button>
              </div>

              <div className="border-t border-[#1f1f1f] pt-1">
                <button
                  id="user-logout-btn"
                  onClick={async () => {
                    setIsUserMenuOpen(false);
                    await logout();
                  }}
                  className="w-full px-4 py-2 text-left flex items-center gap-2.5 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
