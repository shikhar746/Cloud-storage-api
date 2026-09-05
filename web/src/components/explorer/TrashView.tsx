import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Folder as FolderIcon,
  XCircle,
  Inbox,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes, formatDate } from '../../utils/formatters';

export const TrashView: React.FC = () => {
  const {
    trashData,
    restoreFolder,
    restoreFile,
    permanentDeleteFolder,
    permanentDeleteFile,
    emptyTrash,
  } = useStorage();

  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const totalTrash = trashData.folders.length + trashData.files.length;

  const handleEmptyTrash = async () => {
    setProcessingId('all');
    try {
      await emptyTrash();
      setConfirmEmpty(false);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRestore = async (type: 'folder' | 'file', id: string) => {
    setProcessingId(id);
    try {
      if (type === 'folder') {
        await restoreFolder(id);
      } else {
        await restoreFile(id);
      }
    } finally {
      setProcessingId(null);
    }
  };

  const handlePermanentDelete = async (type: 'folder' | 'file', id: string) => {
    if (!confirm('Permanently delete this item? This action cannot be undone.')) return;
    setProcessingId(id);
    try {
      if (type === 'folder') {
        await permanentDeleteFolder(id);
      } else {
        await permanentDeleteFile(id);
      }
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div id="trash-view-container" className="flex-1 overflow-y-auto py-4 space-y-6">
      {/* Warning & Actions Header */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-900/40 text-amber-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Trash Bin</h3>
            <p className="text-xs text-gray-400">
              Items in trash can be restored back to your storage or permanently deleted.
            </p>
          </div>
        </div>

        {totalTrash > 0 && (
          <div>
            {!confirmEmpty ? (
              <button
                id="empty-trash-btn"
                onClick={() => setConfirmEmpty(true)}
                className="px-3.5 py-1.5 rounded-lg border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-950/30 transition-colors"
              >
                Empty Trash
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  id="confirm-empty-trash-btn"
                  onClick={handleEmptyTrash}
                  disabled={processingId === 'all'}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  {processingId === 'all' ? 'Purging...' : 'Confirm Purge All'}
                </button>
                <button
                  onClick={() => setConfirmEmpty(false)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-gray-400 hover:bg-[#1a1a1a] transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {totalTrash === 0 ? (
        <div id="trash-empty-state" className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#161616] border border-[#1f1f1f] flex items-center justify-center text-gray-500 mb-3">
            <Inbox className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white">Trash is empty</h4>
          <p className="text-sm text-gray-400 mt-1">
            Deleted files and folders will appear here until permanently deleted.
          </p>
        </div>
      ) : (
        <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Deleted</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Deleted Folders */}
              {trashData.folders.map((folder) => (
                <tr key={folder.id} className="border-b border-[#1f1f1f] hover:bg-[#141414] text-sm">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <FolderIcon className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
                      <span className="font-semibold text-gray-200 truncate">{folder.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">Folder</td>
                  <td className="py-3 px-4 text-xs text-gray-500">—</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{formatDate(folder.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore('folder', folder.id)}
                        disabled={processingId === folder.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a1a] text-xs font-semibold text-gray-300 hover:bg-indigo-950/40 hover:text-indigo-400 transition-colors"
                        title="Restore Folder"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete('folder', folder.id)}
                        disabled={processingId === folder.id}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Delete Permanently"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {/* Deleted Files */}
              {trashData.files.map((file) => (
                <tr key={file.id} className="border-b border-[#1f1f1f] hover:bg-[#141414] text-sm">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <FileIcon name={file.name} mimeType={file.mime_type} size="sm" className="shrink-0" />
                      <span className="font-medium text-gray-200 truncate">{file.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{file.mime_type || 'File'}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{formatBytes(file.size_bytes)}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">{formatDate(file.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRestore('file', file.id)}
                        disabled={processingId === file.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1a1a1a] text-xs font-semibold text-gray-300 hover:bg-indigo-950/40 hover:text-indigo-400 transition-colors"
                        title="Restore File"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete('file', file.id)}
                        disabled={processingId === file.id}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Delete Permanently"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
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
