import React, { useRef } from 'react';
import {
  LayoutGrid,
  List,
  RotateCw,
  FolderPlus,
  UploadCloud,
  Eye,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { FileCategory, SortConfig } from '../../types/storage';

export const ExplorerToolbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    sortConfig,
    setSortConfig,
    selectedCategory,
    setSelectedCategory,
    refreshCurrentFolder,
    loading,
    setIsNewFolderOpen,
    uploadFiles,
    canEdit,
  } = useStorage();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories: Array<{ id: FileCategory; label: string }> = [
    { id: 'all', label: 'All Items' },
    { id: 'document', label: 'Docs' },
    { id: 'image', label: 'Images' },
    { id: 'code', label: 'Code' },
    { id: 'video', label: 'Media' },
    { id: 'archive', label: 'Archives' },
  ];

  const handleSortChange = (field: 'name' | 'date' | 'size') => {
    setSortConfig((prev: SortConfig) => {
      if (prev.by === field) {
        return { by: field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { by: field, direction: 'asc' };
    });
  };

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div
      id="explorer-toolbar"
      className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-[#1f1f1f]"
    >
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-[#141414] text-gray-400 hover:bg-[#1f1f1f] hover:text-white border border-[#1f1f1f]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Right Actions: Refresh, Sort, View Toggle, Upload, New Folder */}
      <div className="flex items-center justify-between sm:justify-end gap-2">
        {/* Quick Add Buttons for Mobile/Tablet — hidden for viewers, whose
            create and upload calls the API would refuse anyway */}
        <div className="flex items-center gap-1.5">
          {canEdit ? (
            <>
              <button
                id="toolbar-new-folder-btn"
                onClick={() => setIsNewFolderOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1f1f1f] bg-[#141414] text-xs font-medium text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
                title="Create Folder"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Folder</span>
              </button>

              <button
                id="toolbar-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1f1f1f] bg-[#141414] text-xs font-medium text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
                title="Upload Files"
              >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden md:inline">Upload</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUploadChange}
              />
            </>
          ) : (
            <span
              id="toolbar-readonly-badge"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-800/40 bg-indigo-950/30 text-xs font-medium text-indigo-300"
              title="This folder was shared with you as a viewer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View only</span>
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#1f1f1f] hidden sm:block mx-1" />

        {/* Refresh button */}
        <button
          id="toolbar-refresh-btn"
          onClick={refreshCurrentFolder}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh folder content"
        >
          <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        {/* Sort Selector */}
        <div className="relative flex items-center">
          <select
            id="toolbar-sort-select"
            value={`${sortConfig.by}-${sortConfig.direction}`}
            onChange={(e) => {
              const [by, direction] = e.target.value.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc'];
              setSortConfig({ by, direction });
            }}
            className="text-xs font-medium bg-[#141414] border border-[#1f1f1f] rounded-lg px-2.5 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="name-asc">Name (A to Z)</option>
            <option value="name-desc">Name (Z to A)</option>
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="size-desc">Largest First</option>
            <option value="size-asc">Smallest First</option>
          </select>
        </div>

        {/* View Mode Toggle: Grid vs List */}
        <div className="flex items-center rounded-lg border border-[#1f1f1f] bg-[#141414] p-0.5">
          <button
            id="view-grid-btn"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-[#222222] text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            id="view-list-btn"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === 'list'
                ? 'bg-[#222222] text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
