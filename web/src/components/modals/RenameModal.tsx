import React, { useState, useEffect } from 'react';
import { X, Edit3, AlertCircle } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

export const RenameModal: React.FC = () => {
  const { renameTarget, setRenameTarget, renameFolder, renameFile } = useStorage();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (renameTarget) {
      setName(renameTarget.currentName);
      setError(null);
    }
  }, [renameTarget]);

  if (!renameTarget) return null;

  const isFolder = renameTarget.type === 'folder';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Name cannot be empty');
      return;
    }
    if (cleanName === renameTarget.currentName) {
      setRenameTarget(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (isFolder) {
        await renameFolder(renameTarget.id, cleanName);
      } else {
        await renameFile(renameTarget.id, cleanName);
      }
      setRenameTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="rename-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setRenameTarget(null)}
    >
      <div
        id="rename-modal"
        className="bg-[#111111] w-full max-w-md rounded-2xl shadow-2xl border border-[#1f1f1f] p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-800/30 text-indigo-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">
              Rename {isFolder ? 'Folder' : 'File'}
            </h3>
          </div>
          <button
            onClick={() => setRenameTarget(null)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/30 p-3 text-xs text-red-400 flex items-center gap-2 border border-red-800/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              New Name
            </label>
            <input
              id="rename-input"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-xl border border-[#262626] bg-[#161616] px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition-colors"
            >
              Cancel
            </button>
            <button
              id="confirm-rename-btn"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Renaming...' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
