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
import { StarButton } from '../common/StarButton';
import { formatBytes, formatDate } from '../../utils/formatters';

interface FileRowProps {
  file: FileItem;
}

export const FileRow: React.FC<FileRowProps> = ({ file }) => {
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
    <tr
      id={`file-row-${file.id}`}
      draggable={canEdit}
      onDragStart={handleDragStart}
      onClick={() => setSelectedItem({ type: 'file', data: file })}
      onDoubleClick={() => setPreviewFile(file)}
      className={`border-b border-[#1f1f1f] text-sm select-none cursor-pointer transition-colors ${
        isSelected ? 'bg-indigo-950/25' : 'hover:bg-[#141414]'
      }`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon name={file.name} mimeType={file.mime_type} size="sm" className="shrink-0" />
          <span className="font-medium text-gray-200 truncate hover:text-indigo-400">
            {file.name}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        {file.mime_type || 'File'}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        {formatBytes(file.size_bytes)}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        {formatDate(file.created_at)}
      </td>
      <td className="py-3 px-4 text-right">
        <span className="inline-flex items-center align-middle mr-1">
          <StarButton resourceType="file" id={file.id} starred={file.starred} alwaysVisible />
        </span>
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            id={`file-row-menu-btn-${file.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className="p-1 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              id={`file-row-dropdown-${file.id}`}
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
      </td>
    </tr>
  );
};
