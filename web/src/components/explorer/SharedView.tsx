import React from 'react';
import { Users, ExternalLink, ShieldCheck, Folder as FolderIcon, FileText, Info } from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes, formatDate } from '../../utils/formatters';

export const SharedView: React.FC = () => {
  const { folders, files, navigateToFolder, setPreviewFile, setActiveTab } = useStorage();
  const { apiMode } = useAuth();

  if (apiMode === 'live') {
    return (
      <div id="shared-view-container" className="flex-1 overflow-y-auto py-8 space-y-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-[#262626] bg-[#141414] p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">Live Cloud Storage Sharing</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            The connected backend API does not currently expose an incoming "Shared with me" listing endpoint.
            You can grant access to collaborators on any folder or file you own by clicking the <span className="text-indigo-400 font-semibold">Share</span> action in <span className="text-gray-200 font-semibold">My Files</span>.
          </p>
          <button
            onClick={() => setActiveTab('files')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-colors"
          >
            Go to My Files
          </button>
        </div>
      </div>
    );
  }

  // Sandbox demo data
  const sharedItems = [
    ...folders.slice(0, 1).map((f) => ({ ...f, itemType: 'folder' as const, role: 'editor' as const, sharedBy: 'Sarah Jenkins' })),
    ...files.slice(0, 2).map((file) => ({ ...file, itemType: 'file' as const, role: 'viewer' as const, sharedBy: 'Engineering Team' })),
  ];

  return (
    <div id="shared-view-container" className="flex-1 overflow-y-auto py-4 space-y-6">
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-900/40 text-indigo-400 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Shared With You</h3>
            <p className="text-xs text-gray-400">
              Files and directories shared with your account with Viewer or Editor permissions.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#111111] rounded-xl border border-[#1f1f1f] overflow-hidden shadow-2xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1f1f1f] bg-[#161616] text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="py-2.5 px-4">Item</th>
              <th className="py-2.5 px-4">Shared By</th>
              <th className="py-2.5 px-4">Your Role</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4 text-right">Access</th>
            </tr>
          </thead>
          <tbody>
            {sharedItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => {
                  if (item.itemType === 'folder') {
                    navigateToFolder(item.id, item.name);
                  } else {
                    setPreviewFile(item);
                  }
                }}
                className="border-b border-[#1f1f1f] hover:bg-[#141414] text-sm cursor-pointer transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {item.itemType === 'folder' ? (
                      <FolderIcon className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
                    ) : (
                      <FileIcon
                        name={item.name}
                        mimeType={'mime_type' in item ? item.mime_type : undefined}
                        size="sm"
                        className="shrink-0"
                      />
                    )}
                    <span className="font-semibold text-gray-200 truncate">{item.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-gray-400">{item.sharedBy}</td>
                <td className="py-3 px-4 text-xs">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                      item.role === 'editor'
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                        : 'bg-indigo-950/40 text-indigo-400 border border-indigo-800/40'
                    }`}
                  >
                    {item.role === 'editor' ? 'Can Edit' : 'Can View'}
                  </span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-500">{formatDate(item.created_at)}</td>
                <td className="py-3 px-4 text-right">
                  <button
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <span>Open</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
