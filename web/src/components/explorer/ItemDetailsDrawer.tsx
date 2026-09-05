import React from 'react';
import {
  X,
  Eye,
  Download,
  Share2,
  Edit3,
  Trash2,
  FolderInput,
  Folder as FolderIcon,
  Calendar,
  HardDrive,
  FileText,
} from 'lucide-react';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes, formatDate } from '../../utils/formatters';

export const ItemDetailsDrawer: React.FC = () => {
  const {
    selectedItem,
    setSelectedItem,
    setPreviewFile,
    setRenameTarget,
    setMoveTarget,
    setShareTarget,
    deleteFolder,
    deleteFile,
    navigateToFolder,
    downloadFile,
  } = useStorage();

  if (!selectedItem) return null;

  const isFolder = selectedItem.type === 'folder';
  const item = selectedItem.data;

  return (
    <div
      id="item-details-drawer"
      className="hidden lg:flex flex-col w-72 bg-[#111111] border-l border-[#1f1f1f] p-4 shrink-0 overflow-y-auto"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1f1f1f]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
          Item Details
        </h3>
        <button
          onClick={() => setSelectedItem(null)}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Item Visual Icon/Preview */}
      <div className="py-6 flex flex-col items-center text-center border-b border-[#1f1f1f]">
        <div className="w-20 h-20 rounded-2xl bg-[#161616] flex items-center justify-center mb-3 shadow-2xs border border-[#222222] overflow-hidden">
          {isFolder ? (
            <FolderIcon className="w-10 h-10 text-amber-500 fill-amber-500/20" />
          ) : 'mime_type' in item && item.mime_type.startsWith('image/') && item.previewUrl ? (
            <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <FileIcon name={item.name} mimeType={'mime_type' in item ? item.mime_type : undefined} size="lg" />
          )}
        </div>
        <h4 className="font-semibold text-gray-200 text-sm max-w-[220px] truncate" title={item.name}>
          {item.name}
        </h4>
        <p className="text-xs text-gray-500 mt-0.5">
          {isFolder
            ? `${(item as any).items_count ?? 0} items`
            : formatBytes((item as any).size_bytes || 0)}
        </p>
      </div>

      {/* Quick Actions Row */}
      <div className={`grid ${!isFolder ? 'grid-cols-5' : 'grid-cols-4'} gap-1 py-3 border-b border-[#1f1f1f]`}>
        {!isFolder && (
          <button
            onClick={() => setPreviewFile(item as any)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-300 transition-colors"
            title="Preview"
          >
            <Eye className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-medium">Preview</span>
          </button>
        )}
        {!isFolder && (
          <button
            onClick={() => downloadFile(item as any)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-300 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-medium">Download</span>
          </button>
        )}
        {isFolder && (
          <button
            onClick={() => navigateToFolder(item.id, item.name)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-300 transition-colors"
            title="Open"
          >
            <FolderIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-medium">Open</span>
          </button>
        )}

        <button
          onClick={() => setShareTarget({ type: selectedItem.type, item })}
          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-300 transition-colors"
          title="Share"
        >
          <Share2 className="w-4 h-4 text-indigo-400" />
          <span className="text-[10px] font-medium">Share</span>
        </button>

        <button
          onClick={() =>
            setRenameTarget({
              type: selectedItem.type,
              id: item.id,
              currentName: item.name,
            })
          }
          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-300 transition-colors"
          title="Rename"
        >
          <Edit3 className="w-4 h-4 text-gray-400" />
          <span className="text-[10px] font-medium">Rename</span>
        </button>

        <button
          onClick={async () => {
            if (isFolder) {
              await deleteFolder(item.id);
            } else {
              await deleteFile(item.id);
            }
            setSelectedItem(null);
          }}
          className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-red-950/30 text-red-400 transition-colors"
          title="Trash"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-[10px] font-medium">Trash</span>
        </button>
      </div>

      {/* Metadata Fields */}
      <div className="py-4 space-y-3 text-xs flex-1">
        <div>
          <span className="text-gray-500 font-medium block">Type</span>
          <span className="font-semibold text-gray-200">
            {isFolder ? 'Folder' : (item as any).mime_type || 'File'}
          </span>
        </div>

        <div>
          <span className="text-gray-500 font-medium block">Created</span>
          <span className="font-semibold text-gray-200">{formatDate(item.created_at)}</span>
        </div>

        <div>
          <span className="text-gray-500 font-medium block">Resource ID</span>
          <span className="font-mono text-[10px] text-gray-400 break-all">{item.id}</span>
        </div>
      </div>
    </div>
  );
};
