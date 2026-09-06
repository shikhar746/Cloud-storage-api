import React from 'react';
import { Users, ExternalLink, Folder as FolderIcon, RotateCw, Inbox } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes, formatDate } from '../../utils/formatters';
import { SharedFile, SharedFolder } from '../../types/storage';

type SharedRow =
  | ({ itemType: 'folder' } & SharedFolder)
  | ({ itemType: 'file' } & SharedFile);

export const SharedView: React.FC = () => {
  const {
    sharedWithMe,
    sharedLoading,
    fetchSharedWithMe,
    navigateToFolder,
    setPreviewFile,
    setActiveTab,
  } = useStorage();

  const rows: SharedRow[] = [
    ...sharedWithMe.folders.map((f) => ({ ...f, itemType: 'folder' as const })),
    ...sharedWithMe.files.map((f) => ({ ...f, itemType: 'file' as const })),
  ];

  const openRow = (row: SharedRow) => {
    if (row.itemType === 'folder') {
      // the explorer resolves the real ancestor chain for a folder reached this way
      setActiveTab('files');
      navigateToFolder(row.id, row.name);
    } else {
      setPreviewFile(row);
    }
  };

  return (
    <div id="shared-view-container" className="flex-1 overflow-y-auto py-4 space-y-6">
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-900/40 text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">Shared With You</h3>
            <p className="text-xs text-gray-400">
              Files and directories other people granted your account access to.
            </p>
          </div>
        </div>

        <button
          id="shared-refresh-btn"
          onClick={fetchSharedWithMe}
          disabled={sharedLoading}
          className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors disabled:opacity-50 shrink-0"
          title="Refresh shared items"
        >
          <RotateCw className={`w-4 h-4 ${sharedLoading ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {sharedLoading && rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Loading shared items...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-[#1f1f1f] flex items-center justify-center text-gray-500 mb-4">
            <Inbox className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">Nothing shared with you yet</h3>
          <p className="text-sm text-gray-400 max-w-sm mt-1 mb-6">
            When someone grants your account viewer or editor access to a file or folder, it
            shows up here.
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
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Item</th>
                <th className="py-2.5 px-4">Shared By</th>
                <th className="py-2.5 px-4">Your Role</th>
                <th className="py-2.5 px-4">Shared</th>
                <th className="py-2.5 px-4 text-right">Access</th>
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
                    {row.shared_by?.name || row.shared_by?.email || 'Unknown'}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                        row.role === 'editor'
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                          : 'bg-indigo-950/40 text-indigo-400 border border-indigo-800/40'
                      }`}
                    >
                      {row.role === 'editor' ? 'Can Edit' : 'Can View'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    {formatDate(row.shared_at || row.created_at)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                      <span>Open</span>
                      <ExternalLink className="w-3.5 h-3.5" />
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
