import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Eye,
  Download,
  Share2,
  Edit3,
  Trash2,
  FolderInput,
} from 'lucide-react';
import { FileItem } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';
import { FileIcon } from '../common/FileIcon';
import { formatBytes, formatDate } from '../../utils/formatters';

interface FileCardProps {
  file: FileItem;
}

export const FileCard: React.FC<FileCardProps> = ({ file }) => {
  const {
    deleteFile,
    setPreviewFile,
    setRenameTarget,
    setMoveTarget,
    setShareTarget,
    selectedItem,
    setSelectedItem,
    downloadFile,
    canEdit,
    canShare,
  } = useStorage();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedItem?.type === 'file' && selectedItem.data.id === file.id;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/csa-file-id', file.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    downloadFile(file);
  };

  return (
    <div
      id={`file-card-${file.id}`}
      draggable={canEdit}
      onDragStart={handleDragStart}
      onClick={() => setSelectedItem({ type: 'file', data: file })}
      onDoubleClick={() => setPreviewFile(file)}
      className={`group relative rounded-xl border bg-[#111111] p-3 transition-all select-none cursor-pointer flex flex-col justify-between ${
        isSelected
          ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/30 shadow-xs'
          : 'border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#141414]'
      }`}
    >
      {/* Top thumbnail/preview area */}
      <div className="relative h-32 w-full rounded-lg bg-[#161616] flex items-center justify-center overflow-hidden mb-2.5 border border-[#222222]">
        {file.mime_type.startsWith('image/') && file.previewUrl ? (
          <img
            src={file.previewUrl}
            alt={file.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            referrerPolicy="no-referrer"
          />
        ) : (
          <FileIcon name={file.name} mimeType={file.mime_type} size="lg" />
        )}

        {/* Hover quick preview button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPreviewFile(file);
          }}
          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity backdrop-blur-xs"
          title="Quick Preview"
        >
          <div className="bg-[#111111]/90 text-gray-200 border border-[#2a2a2a] p-2 rounded-full shadow-lg hover:bg-[#1a1a1a] hover:text-white transition-colors">
            <Eye className="w-4 h-4" />
          </div>
        </button>
      </div>

      {/* Meta info and menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4
            className="text-xs font-semibold text-gray-200 truncate group-hover:text-indigo-400 transition-colors"
            title={file.name}
          >
            {file.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500">
            <span>{formatBytes(file.size_bytes)}</span>
            <span>•</span>
            <span>{formatDate(file.created_at)}</span>
          </div>
        </div>

        {/* 3 dots menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            id={`file-card-menu-btn-${file.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="p-1 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              id={`file-dropdown-${file.id}`}
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#111111] border border-[#1f1f1f] shadow-2xl py-1 z-30 text-xs"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setPreviewFile(file);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
              >
                <Eye className="w-3.5 h-3.5 text-gray-500" />
                <span>Preview</span>
              </button>
              <button
                onClick={handleDownload}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Download</span>
              </button>
              {canShare && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    setShareTarget({ type: 'file', item: file });
                  }}
                  className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
                >
                  <Share2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Share</span>
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      setRenameTarget({ type: 'file', id: file.id, currentName: file.name });
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-gray-500" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      setMoveTarget({ type: 'file', id: file.id, name: file.name });
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
                  >
                    <FolderInput className="w-3.5 h-3.5 text-gray-500" />
                    <span>Move To...</span>
                  </button>
                  <div className="border-t border-[#1f1f1f] my-1" />
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      await deleteFile(file.id);
                    }}
                    className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-red-400 hover:bg-red-950/30 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    <span>Move to Trash</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
