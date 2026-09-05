import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, Folder as FolderIcon, Edit3, Trash2, Share2, FolderInput, ArrowRight } from 'lucide-react';
import { Folder } from '../../types/storage';
import { useStorage } from '../../context/StorageContext';
import { formatDate } from '../../utils/formatters';

interface FolderCardProps {
  folder: Folder;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder }) => {
  const {
    navigateToFolder,
    deleteFolder,
    setRenameTarget,
    setMoveTarget,
    setShareTarget,
    selectedItem,
    setSelectedItem,
    moveFile,
    canEdit,
    canShare,
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
    // no drop target when the caller cannot move things here anyway
    if (canEdit) setIsDragOver(true);
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
    if (!canEdit) return;
    const fileId = e.dataTransfer.getData('application/csa-file-id');
    if (fileId) {
      await moveFile(fileId, folder.id);
    }
  };

  return (
    <div
      id={`folder-card-${folder.id}`}
      onClick={() => setSelectedItem({ type: 'folder', data: folder })}
      onDoubleClick={() => navigateToFolder(folder.id, folder.name)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative rounded-xl border p-3.5 bg-[#111111] transition-all select-none cursor-pointer flex items-center justify-between ${
        isDragOver
          ? 'border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/40'
          : isSelected
          ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500/30 shadow-xs'
          : 'border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#141414]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <FolderIcon className="w-6 h-6 fill-amber-500/20" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-gray-200 truncate group-hover:text-indigo-400 transition-colors">
            {folder.name}
          </h4>
          <p className="text-[11px] text-gray-500">
            {folder.items_count !== undefined ? `${folder.items_count} items` : formatDate(folder.created_at)}
          </p>
        </div>
      </div>

      {/* Action Menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          id={`folder-card-menu-btn-${folder.id}`}
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
            id={`folder-dropdown-${folder.id}`}
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
            {canShare && (
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
            )}
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
