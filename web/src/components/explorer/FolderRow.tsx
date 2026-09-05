import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Folder as FolderIcon, Edit3, Trash2, Share2, FolderInput, ArrowRight } from 'lucide-react';
import { Folder } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';
import { formatDate } from '../../utils/formatters';

interface FolderRowProps {
  folder: Folder;
}

export const FolderRow: React.FC<FolderRowProps> = ({ folder }) => {
  const {
    navigateToFolder,
    deleteFolder,
    setRenameTarget,
    setMoveTarget,
    setShareTarget,
    selectedItem,
    setSelectedItem,
    moveFile,
  } = useStorage();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isSelected = selectedItem?.type === 'folder' && selectedItem.data.id === folder.id;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const fileId = e.dataTransfer.getData('application/csa-file-id');
    if (fileId) {
      await moveFile(fileId, folder.id);
    }
  };

  return (
    <tr
      id={`folder-row-${folder.id}`}
      onClick={() => setSelectedItem({ type: 'folder', data: folder })}
      onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-b border-[#1f1f1f] text-sm select-none cursor-pointer transition-colors ${
        isDragOver
          ? 'bg-indigo-950/30'
          : isSelected
          ? 'bg-indigo-950/25'
          : 'hover:bg-[#141414]'
      }`}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3 min-w-0">
          <FolderIcon className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />
          <span className="font-semibold text-gray-200 truncate hover:text-indigo-400">
            {folder.name}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        {folder.items_count !== undefined ? `${folder.items_count} items` : 'Folder'}
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        —
      </td>
      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
        {formatDate(folder.created_at)}
      </td>
      <td className="py-3 px-4 text-right">
        <div ref={menuRef} className="relative inline-block text-left">
          <button
            id={`folder-row-menu-btn-${folder.id}`}
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
              id={`folder-row-dropdown-${folder.id}`}
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[#111111] border border-[#1f1f1f] shadow-2xl py-1 z-30 text-xs"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  navigateToFolder(folder.id, folder.name);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
              >
                <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                <span>Open Folder</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setShareTarget({ type: 'folder', item: folder });
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-gray-300 hover:bg-[#1a1a1a] hover:text-white font-medium"
              >
                <Share2 className="w-3.5 h-3.5 text-gray-500" />
                <span>Share Access</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(false);
                  setRenameTarget({ type: 'folder', id: folder.id, currentName: folder.name });
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
                  setMoveTarget({ type: 'folder', id: folder.id, name: folder.name });
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
                  await deleteFolder(folder.id);
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-red-400 hover:bg-red-950/30 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Move to Trash</span>
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};
