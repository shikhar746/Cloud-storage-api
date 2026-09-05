import React, { useState } from 'react';
import { X, FolderInput, HardDrive, Folder as FolderIcon, Check, AlertCircle } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

export const MoveModal: React.FC = () => {
  const { moveTarget, setMoveTarget, folders, moveFolder, moveFile, currentFolderId } = useStorage();
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!moveTarget) return null;

  const isFolder = moveTarget.type === 'folder';

  // Folders eligible for moving into (exclude self if folder)
  const validFolders = folders.filter((f) => !isFolder || f.id !== moveTarget.id);

  const handleMove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (isFolder) {
        await moveFolder(moveTarget.id, selectedDestination);
      } else {
        await moveFile(moveTarget.id, selectedDestination);
      }
      setMoveTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Move operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="move-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setMoveTarget(null)}
    >
      <div
        id="move-modal"
        className="bg-[#111111] w-full max-w-md rounded-2xl shadow-2xl border border-[#1f1f1f] p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-800/30 text-indigo-400 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              Move "{moveTarget.name}"
            </h3>
          </div>
          <button
            onClick={() => setMoveTarget(null)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Select target destination folder:
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/30 p-3 text-xs text-red-400 flex items-center gap-2 border border-red-800/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="max-h-60 overflow-y-auto space-y-1 border border-[#1f1f1f] bg-[#0d0d0d] rounded-xl p-2 mb-6">
          {/* Root Destination */}
          <button
            type="button"
            onClick={() => setSelectedDestination(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              selectedDestination === null
                ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/40'
                : 'text-gray-300 hover:bg-[#161616]'
            }`}
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <span>Root (My Storage)</span>
            </div>
            {selectedDestination === null && <Check className="w-4 h-4 text-indigo-400" />}
          </button>

          {/* Subfolders */}
          {validFolders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedDestination(f.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                selectedDestination === f.id
                  ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/40'
                  : 'text-gray-300 hover:bg-[#161616]'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4 text-amber-500" />
                <span className="truncate">{f.name}</span>
              </div>
              {selectedDestination === f.id && <Check className="w-4 h-4 text-indigo-400" />}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setMoveTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition-colors"
          >
            Cancel
          </button>
          <button
            id="confirm-move-btn"
            type="button"
            onClick={handleMove}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
};
