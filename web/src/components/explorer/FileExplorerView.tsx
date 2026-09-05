import React, { useMemo } from 'react';
import { useStorage } from '../../context/StorageContext';
import { FolderCard } from './FolderCard';
import { FolderRow } from './FolderRow';
import { FileCard } from './FileCard';
import { FileRow } from './FileRow';
import { getFileCategory } from '../../utils/formatters';
import { FolderPlus, UploadCloud, Folder as FolderIcon, Inbox } from 'lucide-react';

export const FileExplorerView: React.FC = () => {
  const {
    folders,
    files,
    viewMode,
    sortConfig,
    selectedCategory,
    loading,
    setIsNewFolderOpen,
    uploadFiles,
  } = useStorage();

  // Filter files by category
  const filteredFiles = useMemo(() => {
    if (selectedCategory === 'all') return files;
    return files.filter((f) => getFileCategory(f.name, f.mime_type) === selectedCategory);
  }, [files, selectedCategory]);

  // If a specific file category is selected, we usually only show files, or show folders if 'all'
  const filteredFolders = useMemo(() => {
    if (selectedCategory !== 'all') return [];
    return folders;
  }, [folders, selectedCategory]);

  // Sort folders
  const sortedFolders = useMemo(() => {
    return [...filteredFolders].sort((a, b) => {
      if (sortConfig.by === 'name') {
        return sortConfig.direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortConfig.by === 'date') {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });
  }, [filteredFolders, sortConfig]);

  // Sort files
  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      if (sortConfig.by === 'name') {
        return sortConfig.direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortConfig.by === 'date') {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortConfig.by === 'size') {
        return sortConfig.direction === 'asc'
          ? a.size_bytes - b.size_bytes
          : b.size_bytes - a.size_bytes;
      }
      return 0;
    });
  }, [filteredFiles, sortConfig]);

  const isEmpty = sortedFolders.length === 0 && sortedFiles.length === 0;

  if (loading && folders.length === 0 && files.length === 0) {
    return (
      <div id="explorer-loading-state" className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Loading storage contents...</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        id="explorer-empty-state"
        className="flex-1 flex flex-col items-center justify-center p-12 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-[#1f1f1f] flex items-center justify-center text-gray-500 mb-4">
          <Inbox className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-white">No items found</h3>
        <p className="text-sm text-gray-400 max-w-sm mt-1 mb-6">
          {selectedCategory !== 'all'
            ? `No ${selectedCategory} files in this folder.`
            : 'This folder is empty. Upload files or create a subfolder to get started.'}
        </p>

        <div className="flex items-center gap-3">
          <button
            id="empty-new-folder-btn"
            onClick={() => setIsNewFolderOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#1f1f1f] bg-[#141414] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] hover:text-white transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>New Folder</span>
          </button>
          <label
            id="empty-upload-file-btn"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload File</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  uploadFiles(e.target.files);
                }
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div id="explorer-content-view" className="flex-1 overflow-y-auto py-4 space-y-6">
      {/* Folders Section */}
      {sortedFolders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Folders ({sortedFolders.length})
            </h3>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedFolders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} />
              ))}
            </div>
          ) : (
            <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Items</th>
                    <th className="py-2.5 px-4">Size</th>
                    <th className="py-2.5 px-4">Modified</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedFolders.map((folder) => (
                    <FolderRow key={folder.id} folder={folder} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Files Section */}
      {sortedFiles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Files ({sortedFiles.length})
            </h3>
          </div>

          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedFiles.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                {sortedFolders.length === 0 && (
                  <thead>
                    <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Size</th>
                      <th className="py-2.5 px-4">Uploaded</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {sortedFiles.map((file) => (
                    <FileRow key={file.id} file={file} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
