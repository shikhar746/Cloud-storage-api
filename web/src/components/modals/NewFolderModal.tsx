import React, { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';

export const NewFolderModal: React.FC = () => {
  const { isNewFolderOpen, setIsNewFolderOpen, createFolder, breadcrumbs } = useStorage();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isNewFolderOpen) return null;

  const currentName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Root';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Folder name is required');
      return;
    }
    if (cleanName.length > 255) {
      setError('Folder name must be at most 255 characters');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createFolder(cleanName);
      setName('');
      setIsNewFolderOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      id="new-folder-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setIsNewFolderOpen(false)}
    >
      <div
        id="new-folder-modal"
        className="bg-[#111111] w-full max-w-md rounded-2xl shadow-2xl border border-[#1f1f1f] p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/40 border border-amber-800/30 text-amber-400 flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Create New Folder</h3>
          </div>
          <button
            onClick={() => setIsNewFolderOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Creating folder inside <span className="font-semibold text-gray-200">"{currentName}"</span>
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-950/30 p-3 text-xs text-red-400 flex items-center gap-2 border border-red-800/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Folder Name
            </label>
            <input
              id="new-folder-name-input"
              type="text"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Invoices 2026"
              className="block w-full rounded-xl border border-[#262626] bg-[#161616] px-3.5 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsNewFolderOpen(false)}
              className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-new-folder-btn"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
