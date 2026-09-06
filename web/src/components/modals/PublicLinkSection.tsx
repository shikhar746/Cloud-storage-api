import React, { useEffect, useState } from 'react';
import { Link2, Copy, Check, Trash2, Lock, Clock, AlertCircle } from 'lucide-react';
import { api, API_BASE_URL } from '../../services/api';
import { ResourceType, ShareLink } from '../../types/storage';
import { formatDate } from '../../utils/formatters';

interface PublicLinkSectionProps {
  resourceType: ResourceType;
  resourceId: string;
}

const EXPIRY_CHOICES: { label: string; days: number | null }[] = [
  { label: '1 day', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'Never', days: null },
];

/**
 * The link is built from the page origin rather than returned by the server:
 * the API and this bundle are served from one origin, so the browser already
 * knows the right host, and no extra configuration can drift out of date.
 */
function linkUrl(token: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : API_BASE_URL;
  return `${origin}/s/${token}`;
}

export const PublicLinkSection: React.FC<PublicLinkSectionProps> = ({
  resourceType,
  resourceId,
}) => {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [expiryDays, setExpiryDays] = useState<number | null>(7);
  const [password, setPassword] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .listShareLinks(resourceType, resourceId)
      .then((rows) => {
        if (active) setLinks(rows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load links');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [resourceType, resourceId]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const link = await api.createShareLink(resourceType, resourceId, {
        expiresInDays: expiryDays,
        password: password.trim() || null,
      });
      setLinks((prev) => [link, ...prev]);
      setPassword('');
      // copying immediately is what the user wanted anyway
      await handleCopy(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(linkUrl(link.token));
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 2000);
    } catch {
      setError('Could not copy to the clipboard. Select the link and copy it manually.');
    }
  };

  const handleRevoke = async (link: ShareLink) => {
    if (!confirm('Revoke this link? Anyone holding it will lose access immediately.')) return;
    const previous = links;
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    try {
      await api.deleteShareLink(link.id);
    } catch (err) {
      setLinks(previous);
      setError(err instanceof Error ? err.message : 'Could not revoke the link');
    }
  };

  const expired = (link: ShareLink) =>
    Boolean(link.expires_at && new Date(link.expires_at).getTime() <= Date.now());

  return (
    <div className="mb-6 rounded-xl border border-[#262626] bg-[#141414] p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-indigo-400" />
        <h4 className="text-xs font-semibold text-gray-200">Public link</h4>
        <span className="text-[11px] text-gray-500">Anyone with the link, no account needed</span>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/30 p-2.5 text-[11px] text-red-400 flex items-start gap-2 border border-red-800/40">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          id="public-link-expiry"
          value={expiryDays === null ? 'never' : String(expiryDays)}
          onChange={(e) =>
            setExpiryDays(e.target.value === 'never' ? null : Number(e.target.value))
          }
          className="rounded-xl border border-[#262626] bg-[#161616] px-3 py-2 text-xs text-gray-200 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {EXPIRY_CHOICES.map((choice) => (
            <option key={choice.label} value={choice.days === null ? 'never' : String(choice.days)}>
              Expires: {choice.label}
            </option>
          ))}
        </select>

        <input
          id="public-link-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (optional, min 4)"
          className="flex-1 rounded-xl border border-[#262626] bg-[#161616] px-3.5 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        <button
          id="create-public-link-btn"
          type="button"
          onClick={handleCreate}
          disabled={creating || (password.trim().length > 0 && password.trim().length < 4)}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create link'}
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-500">Loading links...</p>
      ) : links.length === 0 ? (
        <p className="text-[11px] text-gray-500">
          No public links yet. Creating one copies it to your clipboard.
        </p>
      ) : (
        <div className="space-y-1.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-lg border border-[#1f1f1f] bg-[#111111] px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] font-mono truncate ${
                    expired(link) ? 'text-gray-600 line-through' : 'text-gray-300'
                  }`}
                  title={linkUrl(link.token)}
                >
                  {linkUrl(link.token)}
                </p>
                <div className="flex items-center gap-2.5 mt-0.5 text-[10px] text-gray-500">
                  {link.has_password && (
                    <span className="inline-flex items-center gap-1 text-amber-400/80">
                      <Lock className="w-3 h-3" />
                      Password
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {link.expires_at
                      ? expired(link)
                        ? 'Expired'
                        : `Expires ${formatDate(link.expires_at)}`
                      : 'No expiry'}
                  </span>
                  <span>
                    {link.last_used_at ? `Used ${formatDate(link.last_used_at)}` : 'Never opened'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(link)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors shrink-0"
                title="Copy link"
              >
                {copiedId === link.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleRevoke(link)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 transition-colors shrink-0"
                title="Revoke link"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
