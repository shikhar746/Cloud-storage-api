import React, { useState, useEffect } from 'react';
import { X, Share2, Copy, Check, Users, Trash2, Shield, AlertCircle } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ShareItem, ShareRole } from '../../types/storage';

export const ShareModal: React.FC = () => {
  const { shareTarget, setShareTarget } = useStorage();
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('viewer');
  const [shares, setShares] = useState<ShareItem[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shareTarget && user) {
      loadShares();
      setError(null);
    }
  }, [shareTarget, user]);

  if (!shareTarget) return null;

  const loadShares = async () => {
    if (!user || !shareTarget) return;
    setLoadingShares(true);
    try {
      const list = await api.listShares(user.id, shareTarget.type, shareTarget.item.id);
      setShares(list);
    } catch (err) {
      console.error('Failed to load shares', err);
    } finally {
      setLoadingShares(false);
    }
  };

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createShare(user.id, shareTarget.type, shareTarget.item.id, cleanEmail, role);
      setEmail('');
      await loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    if (!user) return;
    try {
      await api.deleteShare(user.id, shareId);
      await loadShares();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke access');
    }
  };

  const shareUrl = `${window.location.origin}/shared/${shareTarget.type}/${shareTarget.item.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="share-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => setShareTarget(null)}
    >
      <div
        id="share-modal"
        className="bg-[#111111] w-full max-w-lg rounded-2xl shadow-2xl border border-[#1f1f1f] p-6 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/40 border border-indigo-800/30 text-indigo-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share Access</h3>
              <p className="text-xs text-gray-400 truncate max-w-xs">{shareTarget.item.name}</p>
            </div>
          </div>
          <button
            onClick={() => setShareTarget(null)}
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

        {/* Invite Member Form */}
        <form onSubmit={handleCreateShare} className="mb-6 space-y-3">
          <label className="block text-xs font-semibold text-gray-300">
            Invite collaborator by email
          </label>
          <div className="flex gap-2">
            <input
              id="share-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@organization.com"
              className="flex-1 rounded-xl border border-[#262626] bg-[#161616] px-3.5 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              id="share-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as ShareRole)}
              className="rounded-xl border border-[#262626] px-3 py-2 text-xs text-gray-200 font-medium bg-[#161616] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="viewer">Can View</option>
              <option value="editor">Can Edit</option>
            </select>
            <button
              id="submit-share-btn"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Sharing...' : 'Invite'}
            </button>
          </div>
        </form>

        {/* Existing Collaborators */}
        <div className="border-t border-[#1f1f1f] pt-4 mb-6">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            People with access
          </h4>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {/* Owner */}
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-[#161616] text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-semibold text-[10px] flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || 'Y'}
                </div>
                <div className="truncate">
                  <span className="font-semibold text-gray-200">{user?.name} (You)</span>
                  <span className="text-gray-500 block text-[10px]">{user?.email}</span>
                </div>
              </div>
              <span className="text-gray-400 font-medium text-[11px]">Owner</span>
            </div>

            {/* Shares */}
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-[#161616] text-xs transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#262626] text-gray-300 font-semibold text-[10px] flex items-center justify-center">
                    {share.grantee_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="truncate">
                    <span className="font-medium text-gray-200">
                      {share.grantee_name || share.grantee_email || 'Collaborator'}
                    </span>
                    <span className="text-gray-500 block text-[10px]">
                      {share.grantee_email || share.grantee_user_id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      share.role === 'editor'
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                        : 'bg-indigo-950/40 text-indigo-400 border border-indigo-800/40'
                    }`}
                  >
                    {share.role === 'editor' ? 'Editor' : 'Viewer'}
                  </span>
                  <button
                    onClick={() => handleDeleteShare(share.id)}
                    className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
                    title="Revoke access"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copy Link Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1f1f1f]">
          <button
            id="copy-shareable-link-btn"
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShareTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-semibold text-gray-300 hover:bg-[#1a1a1a] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
