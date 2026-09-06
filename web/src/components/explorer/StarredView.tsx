import React from 'react';
import { Star, Folder as FolderIcon, RotateCw } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { StarButton } from '../common/StarButton';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileItem, Folder } from '../../types/storage';

type StarredRow =
  | ({ itemType: 'folder' } & Folder)
  | ({ itemType: 'file' } & FileItem);

export const StarredView: React.FC = () => {
  const {
    starredItems,
    starredLoading,
    fetchStarred,
    navigateToFolder,
    setPreviewFile,
    setActiveTab,
  } = useStorage();

  const rows: StarredRow[] = [
    ...starredItems.folders.map((f) => ({ ...f, itemType: 'folder' as const })),
    ...starredItems.files.map((f) => ({ ...f, itemType: 'file' as const })),
  ];

  const openRow = (row: StarredRow) => {
    if (row.itemType === 'folder') {
      // the explorer resolves the real ancestor chain for a folder opened here
      setActiveTab('files');
      navigateToFolder(row.id, row.name);
    } else {
      setPreviewFile(row);
    }
  };

  return (
    <div id="starred-view-container" className="flex-1 overflow-y-auto py-4 space-y-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-amber-900/30 text-amber-400 flex items-center justify-center shrink-0">
            <Star className="w-5 h-5 fill-amber-400/30" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Starred</h3>
            <p className="text-xs text-gray-400">
              Items you marked for quick access. Stars are private to your account.
            </p>
          </div>
        </div>

        <button
          id="starred-refresh-btn"
          onClick={fetchStarred}
          disabled={starredLoading}
          className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
          title="Refresh starred items"
        >
          <RotateCw className={`w-4 h-4 ${starredLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {starredLoading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Loading starred items...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-[#1f1f1f] flex items-center justify-center text-gray-500 mb-4">
            <Star className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">Nothing starred yet</h3>
          <p className="text-sm text-gray-400 max-w-sm mt-1 mb-6">
            Select the star on any file or folder and it appears here, wherever it actually
            lives.
          </p>
          <button
            onClick={() => setActiveTab('files')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors"
          >
            Go to My Files
          </button>
        </div>
      ) : (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden shadow-2xs overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Added</th>
                <th className="py-2.5 px-4 text-right">Star</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.itemType}-${row.id}`}
                  onClick={() => openRow(row)}
                  className="border-b border-[#1f1f1f] hover:bg-[#141414] text-sm cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {row.itemType === 'folder' ? (
                        <FolderIcon className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
                      ) : (
                        <FileIcon
                          name={row.name}
                          mimeType={row.mime_type}
                          size="sm"
                          className="shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-200 truncate block">
                          {row.name}
                        </span>
                        {row.itemType === 'file' && (
                          <span className="text-[11px] text-gray-500">
                            {formatBytes(row.size_bytes)}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">
                    {row.itemType === 'folder' ? 'Folder' : row.mime_type || 'File'}
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center align-middle">
                      <StarButton
                        resourceType={row.itemType}
                        id={row.id}
                        starred
                        alwaysVisible
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
